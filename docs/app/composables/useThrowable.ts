// useThrowable: pick an element up with a pointer, carry it, throw it, and let it latch onto a magnet.
//
// Contract
// - `target` is the element that takes the pointer. It should be `position: fixed; top: 0; left: 0` with
//   `touch-action: none`: the composable places it by writing `translate` from `position`, the viewport px of its top
//   left corner.
// - `position` belongs to the caller, who sets it to place the element (before it mounts, or after a fall). The
//   composable writes it while the element is held and while it flies.
// - `bounds()` is the box, in viewport px, that the whole element has to end up inside. A throw bounces off its edges
//   and comes to rest inside it; `clamp()` moves the element back inside, after a resize say.
// - `magnet()` returns where a point on the element (`anchor`) wants to go (`target`), both in viewport px, and how
//   close counts (`radius`). Released within the radius, the element latches: `onLatch` runs and there is no throw.
// - `reducedMotion()` true: a release only drops the element where it is, with no flight.
// - `onGrab` runs on pointerdown, before the composable reads `position`, so the caller can settle any animation.
// - Returns `dragging` and `moving` (held, or flying after a throw), and `clamp()`.
//
// Round 1 keeps this small: drag with pointer capture, release velocity from the last 150ms of moves, a friction-only
// flight that bounces off the bounds, and the magnet check on release.

import type { Ref } from 'vue'

export interface Point { x: number, y: number }
export interface Bounds { left: number, top: number, right: number, bottom: number }
export interface Magnet { anchor: Point, target: Point, radius: number }

export interface ThrowableOptions {
  position: Ref<Point>
  bounds: () => Bounds
  magnet?: () => Magnet | undefined
  reducedMotion?: () => boolean
  onGrab?: () => void
  onLatch?: () => void
  onRest?: () => void
}

// Speed lost per second in flight, as a rate: v(t) = v0 · e^(−friction · t).
const friction = 4
// A release slower than this, in px/s, just drops the element; a flight slower than this has come to rest.
const minSpeed = 40
const bounce = 0.4
// Release speed comes from the moves in this many ms before the last one.
const sampleWindow = 150

export function useThrowable(target: Ref<HTMLElement | undefined>, options: ThrowableOptions) {
  const { position } = options
  const dragging = ref(false)
  const moving = ref(false)

  let pointerId: number | undefined
  let offset: Point = { x: 0, y: 0 }
  let samples: { x: number, y: number, t: number }[] = []
  let frame = 0

  watchEffect(() => {
    const el = target.value
    if (el) el.style.translate = `${position.value.x}px ${position.value.y}px`
  }, { flush: 'post' })

  function limits() {
    const el = target.value
    const b = options.bounds()
    const w = el?.offsetWidth ?? 0
    const h = el?.offsetHeight ?? 0
    // An element wider or taller than the bounds keeps its near edge in.
    return {
      minX: Math.min(b.left, b.right - w),
      maxX: Math.max(b.left, b.right - w),
      minY: Math.min(b.top, b.bottom - h),
      maxY: Math.max(b.top, b.bottom - h),
    }
  }

  function clamp() {
    const { minX, maxX, minY, maxY } = limits()
    position.value = {
      x: Math.min(maxX, Math.max(minX, position.value.x)),
      y: Math.min(maxY, Math.max(minY, position.value.y)),
    }
  }

  function stopFlight() {
    cancelAnimationFrame(frame)
    if (moving.value && !dragging.value) {
      moving.value = false
      options.onRest?.()
    }
  }

  function onDown(event: PointerEvent) {
    if (event.button !== 0 || pointerId !== undefined) return
    cancelAnimationFrame(frame)
    options.onGrab?.()
    const el = target.value!
    el.setPointerCapture(event.pointerId)
    pointerId = event.pointerId
    offset = { x: event.clientX - position.value.x, y: event.clientY - position.value.y }
    samples = [{ x: event.clientX, y: event.clientY, t: event.timeStamp }]
    dragging.value = true
    moving.value = true
    event.preventDefault()
  }

  function onMove(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    position.value = { x: event.clientX - offset.x, y: event.clientY - offset.y }
    // Touch moves arrive once a frame; the coalesced events keep each sample's own time.
    const coalesced = event.getCoalescedEvents?.() ?? []
    for (const e of coalesced.length ? coalesced : [event]) samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp })
    samples = samples.filter(sample => event.timeStamp - sample.t <= sampleWindow)
  }

  function velocity(now: number): Point {
    const last = samples.at(-1)
    // Held still before letting go: no throw. A janky page can space moves ~100ms apart, so the gap allows that.
    if (!last || now - last.t > 100) return { x: 0, y: 0 }
    const recent = samples.filter(sample => last.t - sample.t <= sampleWindow)
    if (recent.length < 2) return { x: 0, y: 0 }
    const first = recent[0]!
    const dt = Math.max(16, last.t - first.t) / 1000
    return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt }
  }

  function onUp(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    pointerId = undefined
    dragging.value = false
    const magnet = options.magnet?.()
    if (magnet && Math.hypot(magnet.anchor.x - magnet.target.x, magnet.anchor.y - magnet.target.y) <= magnet.radius) {
      moving.value = false
      options.onLatch?.()
      return
    }
    const v = event.type === 'pointercancel' ? { x: 0, y: 0 } : velocity(event.timeStamp)
    if (options.reducedMotion?.() || Math.hypot(v.x, v.y) < minSpeed) {
      clamp()
      moving.value = false
      options.onRest?.()
      return
    }
    fly(v)
  }

  function fly(v: Point) {
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000)
      last = now
      const { minX, maxX, minY, maxY } = limits()
      let { x, y } = position.value
      x += v.x * dt
      y += v.y * dt
      if (x < minX || x > maxX) {
        x = Math.min(maxX, Math.max(minX, x))
        v.x = -v.x * bounce
      }
      if (y < minY || y > maxY) {
        y = Math.min(maxY, Math.max(minY, y))
        v.y = -v.y * bounce
      }
      const keep = Math.exp(-friction * dt)
      v.x *= keep
      v.y *= keep
      position.value = { x, y }
      if (Math.hypot(v.x, v.y) < minSpeed) return stopFlight()
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  }

  const listeners = [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp]] as const
  watch(target, (el, old) => {
    for (const [type, handler] of listeners) old?.removeEventListener(type, handler as EventListener)
    for (const [type, handler] of listeners) el?.addEventListener(type, handler as EventListener)
    if (!el) {
      cancelAnimationFrame(frame)
      pointerId = undefined
      dragging.value = false
      moving.value = false
    }
  })

  onBeforeUnmount(() => cancelAnimationFrame(frame))

  return { dragging, moving, clamp }
}
