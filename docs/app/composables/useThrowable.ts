// useThrowable: pick an element up with a pointer, carry it, throw it, and let it latch onto a magnet. Let go, it
// falls: gravity pulls it to the bottom of the bounds, where it bounces, slides to a stop and rests.
//
// Contract
// - `target` is the element that takes the pointer. It should be `position: fixed; top: 0; left: 0` with
//   `touch-action: none`: the composable places it by writing `translate` from `position`, the viewport px of its top
//   left corner, and tilts it by writing `rotate` while it is held or flying.
// - `position` belongs to the caller, who sets it to place the element (before it mounts, or after a fall). The
//   composable writes it while the element is held and while it flies.
// - `bounds()` is the box, in viewport px, that the whole element has to end up inside. Its bottom is the floor: a
//   release anywhere falls to it. The sides and the top bounce a throw back. `clamp()` moves the element back inside,
//   and `drop()` lets it fall from where it is, after a resize say.
// - `magnet()` returns where a point on the element (`anchor`) wants to go (`target`), both in viewport px, and how
//   close counts (`radius`). Released within the radius, the element latches: `onLatch` runs and it doesn't fall. A
//   throw never latches in flight, so it always comes back down.
// - `reducedMotion()` true: a release puts the element straight on the floor, with no flight and no tilt.
// - `onGrab` runs on pointerdown, before the composable reads `position`, so the caller can settle any animation.
// - `onImpact(speed)` runs when the element hits the floor hard enough to bounce, with its speed in px/s.
// - Returns `dragging`, `moving` (held, or flying after a throw), `clamp()` and `drop()`.

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
  onImpact?: (speed: number) => void
}

// Downward pull in px/s². A drop from the top of a laptop screen lands in about 0.8s.
const gravity = 2800
// Speed lost per second in the air, and while sliding on the floor, as rates: v(t) = v0 · e^(−rate · t).
const airDrag = 0.35
const floorFriction = 6
// The share of its speed a bounce keeps, off the floor and off the sides and top.
const floorBounce = 0.32
const wallBounce = 0.45
// Hitting the floor slower than this, in px/s, it stays down instead of bouncing.
const minBounce = 220
// On the floor and slower than this, in px/s, it has come to rest.
const minSpeed = 30
// A throw faster than this, in px/s, is cut down to it.
const maxSpeed = 5200
// Release speed comes from the moves in this many ms before the last one.
const sampleWindow = 120
// The tilt: degrees per px/s of sideways speed, its limit, and the spring it follows (rad/s and damping ratio).
const tiltPerSpeed = 0.006
const maxTilt = 12
const tiltOmega = 14
const tiltDamping = 0.5

export function useThrowable(target: Ref<HTMLElement | undefined>, options: ThrowableOptions) {
  const { position } = options
  const dragging = ref(false)
  const moving = ref(false)

  let pointerId: number | undefined
  let offset: Point = { x: 0, y: 0 }
  let samples: { x: number, y: number, t: number }[] = []
  let frame = 0
  let tilt = 0
  let spin = 0

  watchEffect(() => {
    const el = target.value
    if (el) el.style.translate = `${position.value.x}px ${position.value.y}px`
  }, { flush: 'post' })

  function setTilt(angle: number) {
    tilt = angle
    if (target.value) target.value.style.rotate = Math.abs(angle) < 0.01 ? '' : `${angle.toFixed(2)}deg`
  }

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

  function rest() {
    cancelAnimationFrame(frame)
    setTilt(0)
    spin = 0
    if (moving.value && !dragging.value) {
      moving.value = false
      options.onRest?.()
    }
  }

  // The tilt follows the sideways speed on a damped spring, so a sudden pull swings it and it settles back.
  function stepTilt(vx: number, dt: number) {
    const goal = Math.max(-maxTilt, Math.min(maxTilt, vx * tiltPerSpeed))
    spin += (tiltOmega ** 2 * (goal - tilt) - 2 * tiltDamping * tiltOmega * spin) * dt
    setTilt(tilt + spin * dt)
  }

  function latched() {
    const magnet = options.magnet?.()
    if (!magnet || Math.hypot(magnet.anchor.x - magnet.target.x, magnet.anchor.y - magnet.target.y) > magnet.radius) return false
    cancelAnimationFrame(frame)
    setTilt(0)
    spin = 0
    moving.value = false
    options.onLatch?.()
    return true
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
    if (!options.reducedMotion?.()) hold()
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
    const v = { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt }
    const speed = Math.hypot(v.x, v.y)
    return speed > maxSpeed ? { x: v.x / speed * maxSpeed, y: v.y / speed * maxSpeed } : v
  }

  // While held, the sign swings with the hand.
  function hold() {
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000)
      last = now
      stepTilt(velocity(now).x, dt)
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  }

  function onUp(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    pointerId = undefined
    dragging.value = false
    cancelAnimationFrame(frame)
    if (latched()) return
    if (options.reducedMotion?.()) {
      clamp()
      position.value = { ...position.value, y: limits().maxY }
      return rest()
    }
    fly(event.type === 'pointercancel' ? { x: 0, y: 0 } : velocity(event.timeStamp))
  }

  // Free fall from where it is: thrown with `v`, pulled down, bounced off the sides, top and floor, slid to a stop.
  function fly(v: Point) {
    moving.value = true
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000)
      last = now
      const { minX, maxX, minY, maxY } = limits()
      let { x, y } = position.value
      v.y += gravity * dt
      x += v.x * dt
      y += v.y * dt
      if (x < minX || x > maxX) {
        x = Math.min(maxX, Math.max(minX, x))
        v.x = -v.x * wallBounce
        spin -= v.x * 0.02
      }
      if (y < minY) {
        y = minY
        v.y = -v.y * wallBounce
      }
      const onFloor = y >= maxY
      if (onFloor) {
        y = maxY
        if (v.y > minBounce) {
          options.onImpact?.(v.y)
          v.y = -v.y * floorBounce
          // A sideways throw landing tips the sign, so it rocks a little as it lands.
          spin += v.x * 0.01
        }
        else {
          v.y = 0
        }
      }
      const keep = Math.exp(-(onFloor ? floorFriction : airDrag) * dt)
      v.x *= keep
      position.value = { x, y }
      stepTilt(onFloor ? 0 : v.x, dt)
      if (onFloor && v.y === 0 && Math.abs(v.x) < minSpeed && Math.abs(tilt) < 0.2 && Math.abs(spin) < 2) return rest()
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  }

  // Let it fall from where it is, as if let go without a throw.
  function drop() {
    if (dragging.value) return
    cancelAnimationFrame(frame)
    clamp()
    if (options.reducedMotion?.()) {
      position.value = { ...position.value, y: limits().maxY }
      return
    }
    fly({ x: 0, y: 0 })
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
      tilt = 0
      spin = 0
    }
  })

  onBeforeUnmount(() => cancelAnimationFrame(frame))

  return { dragging, moving, clamp, drop }
}
