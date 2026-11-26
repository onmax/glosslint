<script setup lang="ts">
// The cable stub left in the outlet after the hero's sign falls and tears its cable out: a short rope that hangs from
// the plug, sways, and now and then sparks at its torn end. Drag the end, or press Enter on it, to plug it back in.
//
// Contract
// - Mount it inside the hero's wall (the 800 × 480 box), only while the cable is out of the board. It fills the wall
//   and centres its canvases on `anchor`, the top of the plug in wall units.
// - `from`, in wall units, is where the cable ran to when it snapped: the stub starts pointing there and drops.
// - `length` is the stub's length in CSS px. It doesn't stretch: a dragged end stops at the length from the plug.
// - The wire canvas carries `data-state` (`live`, or `held` while dragged), `data-len` (the rope's measured length in
//   CSS px), `data-tip="x,y"` (the torn end in the canvas's CSS px) and `data-frames` (frames drawn since mount).
// - Sparks go on a second canvas, `canvas.gl-sparks`, of the same box, which is empty between bursts.
// - `.gl-wire-end` is a 44px button on the torn end. Dragging it emits `release` with the end's viewport point when
//   it's let go; Enter or Space on it emits `plug`. The hero decides whether either plugs the cable in.
// - `focus()` focuses the end.
// - Under reduced motion it draws once and on each drag move, with no sway and no sparks.

const props = withDefaults(defineProps<{
  anchor: [number, number]
  from?: [number, number]
  length?: number
}>(), { length: 100 })

const emit = defineEmits<{
  release: [point: { x: number, y: number }]
  plug: []
}>()

const root = ref<HTMLElement>()
const wire = ref<HTMLCanvasElement>()
const sparkCanvas = ref<HTMLCanvasElement>()
const end = ref<HTMLButtonElement>()
const state = ref<'live' | 'held'>('live')
const wallSize = ref({ width: 0, height: 0 })

// Room around the plug for the stub and its sparks, in CSS px.
const pad = 120
const size = computed(() => 2 * (props.length + pad))
const boxStyle = computed(() => ({
  left: `${props.anchor[0] / 800 * wallSize.value.width - size.value / 2}px`,
  top: `${props.anchor[1] / 480 * wallSize.value.height - size.value / 2}px`,
  width: `${size.value}px`,
  height: `${size.value}px`,
}))

// ---- The rope: verlet points from the plug (fixed) to the torn end, in the canvas's CSS px. ----

const count = 14
interface Knot { x: number, y: number, px: number, py: number }
let knots: Knot[] = []
let target: { x: number, y: number } | undefined
let frames = 0
let reduced = false

const centre = () => size.value / 2
const segment = () => props.length / (count - 1)

function init() {
  let dir = [0, 1]
  if (props.from && wallSize.value.width && !reduced) {
    const k = wallSize.value.width / 800
    const dx = (props.from[0] - props.anchor[0]) * k
    const dy = (props.from[1] - props.anchor[1]) * k
    const d = Math.hypot(dx, dy) || 1
    dir = [dx / d, dy / d]
  }
  knots = Array.from({ length: count }, (_, i) => {
    const x = centre() + dir[0]! * segment() * i
    const y = centre() + dir[1]! * segment() * i
    return { x, y, px: x, py: y }
  })
}

// Where a held end can go: the pointer, pulled in to the stub's reach.
function reach(point: { x: number, y: number }) {
  const c = centre()
  const dx = point.x - c
  const dy = point.y - c
  const d = Math.hypot(dx, dy)
  const max = props.length * 0.985
  return d <= max ? point : { x: c + dx / d * max, y: c + dy / d * max }
}

function step(dt: number, t: number) {
  const gravity = 1500
  const sway = reduced ? 0 : Math.sin(t * 1.1) * 40 + Math.sin(t * 2.7 + 1) * 18
  for (let i = 1; i < count; i++) {
    const knot = knots[i]!
    const vx = (knot.x - knot.px) * 0.985
    const vy = (knot.y - knot.py) * 0.985
    knot.px = knot.x
    knot.py = knot.y
    knot.x += vx + sway * (i / count) * dt * dt
    knot.y += vy + gravity * dt * dt
  }
  const held = target && reach(target)
  const length = segment()
  for (let pass = 0; pass < 24; pass++) {
    Object.assign(knots[0]!, { x: centre(), y: centre() })
    if (held) Object.assign(knots[count - 1]!, held)
    for (let i = 0; i < count - 1; i++) {
      const a = knots[i]!
      const b = knots[i + 1]!
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.hypot(dx, dy) || 0.0001
      const diff = (d - length) / d
      // The plug doesn't move, and neither does an end in someone's hand.
      const aFixed = i === 0
      const bFixed = held && i + 1 === count - 1
      const wa = aFixed ? 0 : bFixed ? 1 : 0.5
      const wb = bFixed ? 0 : aFixed ? 1 : 0.5
      a.x += dx * diff * wa
      a.y += dy * diff * wa
      b.x -= dx * diff * wb
      b.y -= dy * diff * wb
    }
  }
  // Relaxing leaves a little stretch where the rope is pulled taut. Laying each segment out at its length, from the
  // end in the hand back and then from the plug out, takes it out, so the stub never grows.
  if (held) {
    for (let pass = 0; pass < 3; pass++) {
      Object.assign(knots[count - 1]!, held)
      for (let i = count - 2; i >= 0; i--) place(knots[i]!, knots[i + 1]!, length)
      Object.assign(knots[0]!, { x: centre(), y: centre() })
      for (let i = 1; i < count; i++) place(knots[i]!, knots[i - 1]!, length)
    }
  }
  else {
    for (let i = 1; i < count; i++) place(knots[i]!, knots[i - 1]!, length)
  }
}

// Move `knot` along the line to `from` until it is `length` away.
function place(knot: Knot, from: Knot, length: number) {
  const dx = knot.x - from.x
  const dy = knot.y - from.y
  const d = Math.hypot(dx, dy) || 0.0001
  knot.x = from.x + dx / d * length
  knot.y = from.y + dy / d * length
}

function measured() {
  let total = 0
  for (let i = 0; i < count - 1; i++) total += Math.hypot(knots[i + 1]!.x - knots[i]!.x, knots[i + 1]!.y - knots[i]!.y)
  return total
}

// ---- Drawing ----

function fit(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1
  const px = Math.round(size.value * dpr)
  if (canvas.width !== px) {
    canvas.width = px
    canvas.height = px
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

function draw() {
  const canvas = wire.value
  if (!canvas) return
  const ctx = fit(canvas)
  ctx.clearRect(0, 0, size.value, size.value)
  const scale = Math.max(0.5, wallSize.value.width / 800)

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const trace = () => {
    ctx.beginPath()
    ctx.moveTo(knots[0]!.x, knots[0]!.y)
    for (let i = 1; i < count - 1; i++) {
      const a = knots[i]!
      const b = knots[i + 1]!
      ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2)
    }
    ctx.lineTo(knots[count - 1]!.x, knots[count - 1]!.y)
  }
  trace()
  ctx.strokeStyle = '#1c2433'
  ctx.lineWidth = 5 * scale
  ctx.stroke()
  ctx.save()
  ctx.translate(-1, -1)
  trace()
  ctx.strokeStyle = 'rgb(255 255 255 / 8%)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()

  // The torn end: three copper strands splayed past the jacket.
  const tip = knots[count - 1]!
  const before = knots[count - 2]!
  const angle = Math.atan2(tip.y - before.y, tip.x - before.x)
  ctx.strokeStyle = '#d97706'
  ctx.lineWidth = 1.2
  for (const spread of [-0.5, 0, 0.45]) {
    ctx.beginPath()
    ctx.moveTo(tip.x, tip.y)
    ctx.lineTo(tip.x + Math.cos(angle + spread) * 6 * scale, tip.y + Math.sin(angle + spread) * 6 * scale)
    ctx.stroke()
  }

  frames++
  canvas.dataset.frames = String(frames)
  canvas.dataset.len = measured().toFixed(1)
  canvas.dataset.tip = `${tip.x.toFixed(1)},${tip.y.toFixed(1)}`
  if (end.value) end.value.style.translate = `${tip.x - 22}px ${tip.y - 22}px`
}

// ---- Sparks: rare bursts from the torn end, drawn the way Canvas UI draws light: short hot streaks and a flash. ----

interface Spark { x: number, y: number, vx: number, vy: number, life: number, age: number }
let sparks: Spark[] = []
let flash = 0
let nextBurst = 0
let sparksDirty = false

function burst(t: number) {
  const tip = knots[count - 1]!
  const n = 14 + Math.floor(Math.random() * 12)
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4
    const speed = 80 + Math.random() * 220
    sparks.push({ x: tip.x, y: tip.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.18 + Math.random() * 0.35, age: 0 })
  }
  flash = 0.09
  nextBurst = t + 1.4 + Math.random() * 2.2
}

function drawSparks(dt: number) {
  const canvas = sparkCanvas.value
  if (!canvas) return
  if (!sparks.length && flash <= 0 && !sparksDirty) return
  const ctx = fit(canvas)
  ctx.clearRect(0, 0, size.value, size.value)
  sparksDirty = false
  if (!sparks.length && flash <= 0) return
  sparksDirty = true

  const dark = document.documentElement.classList.contains('dark')
  ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over'
  ctx.lineCap = 'round'
  const tip = knots[count - 1]!
  if (flash > 0) {
    const glow = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 18)
    glow.addColorStop(0, dark ? 'rgb(220 250 255 / 90%)' : 'rgb(255 170 60 / 85%)')
    glow.addColorStop(1, dark ? 'rgb(34 232 255 / 0%)' : 'rgb(249 115 22 / 0%)')
    ctx.fillStyle = glow
    ctx.globalAlpha = Math.min(1, flash / 0.09)
    ctx.fillRect(tip.x - 18, tip.y - 18, 36, 36)
    ctx.globalAlpha = 1
    flash -= dt
  }
  for (const spark of sparks) {
    spark.age += dt
    spark.vy += 900 * dt
    spark.x += spark.vx * dt
    spark.y += spark.vy * dt
    const fade = 1 - spark.age / spark.life
    if (fade <= 0) continue
    const tail = { x: spark.x - spark.vx * 0.025, y: spark.y - spark.vy * 0.025 }
    if (dark) {
      ctx.strokeStyle = `rgb(125 243 255 / ${fade * 0.8})`
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.moveTo(tail.x, tail.y)
      ctx.lineTo(spark.x, spark.y)
      ctx.stroke()
      ctx.strokeStyle = `rgb(255 255 255 / ${fade})`
      ctx.lineWidth = 1
    }
    else {
      ctx.strokeStyle = `rgb(124 45 18 / ${fade * 0.7})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(tail.x, tail.y)
      ctx.lineTo(spark.x, spark.y)
      ctx.stroke()
      ctx.strokeStyle = `rgb(249 115 22 / ${fade})`
      ctx.lineWidth = 1.6
    }
    ctx.beginPath()
    ctx.moveTo(tail.x, tail.y)
    ctx.lineTo(spark.x, spark.y)
    ctx.stroke()
  }
  sparks = sparks.filter(spark => spark.age < spark.life)
}

// ---- The loop ----

let frame = 0
let last = 0

function tick(now: number) {
  const t = now / 1000
  const dt = Math.min(1 / 30, (now - last) / 1000)
  last = now
  step(dt, t)
  draw()
  if (t >= nextBurst) burst(t)
  drawSparks(dt)
  frame = requestAnimationFrame(tick)
}

// Under reduced motion the rope settles at once and is drawn once.
function settle() {
  for (let i = 0; i < 90; i++) step(1 / 60, 0)
  draw()
}

function measure() {
  const rect = root.value!.getBoundingClientRect()
  wallSize.value = { width: rect.width, height: rect.height }
}

let observer: ResizeObserver | undefined

onMounted(() => {
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  measure()
  init()
  observer = new ResizeObserver(measure)
  observer.observe(root.value!)
  if (reduced) return settle()
  last = performance.now()
  nextBurst = 0
  frame = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  observer?.disconnect()
})

// ---- The end in a hand ----

let pointerId: number | undefined

function pointAt(event: PointerEvent) {
  const rect = wire.value!.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function onDown(event: PointerEvent) {
  if (event.button !== 0 || pointerId !== undefined) return
  end.value!.setPointerCapture(event.pointerId)
  pointerId = event.pointerId
  state.value = 'held'
  target = pointAt(event)
  if (reduced) settle()
  event.preventDefault()
}

function onMove(event: PointerEvent) {
  if (event.pointerId !== pointerId) return
  target = pointAt(event)
  if (reduced) settle()
}

function onUp(event: PointerEvent) {
  if (event.pointerId !== pointerId) return
  pointerId = undefined
  const at = target && reach(target)
  target = undefined
  state.value = 'live'
  if (reduced) settle()
  if (!at || event.type === 'pointercancel') return
  const rect = wire.value!.getBoundingClientRect()
  emit('release', { x: rect.left + at.x, y: rect.top + at.y })
}

// A click from Enter or Space has no pointer behind it (`detail` is 0); a click after a drag is ignored.
function onClick(event: MouseEvent) {
  if (event.detail === 0) emit('plug')
}

defineExpose({ focus: () => end.value?.focus() })
</script>

<template>
  <div ref="root" class="gl-live-wire">
    <div class="gl-live-wire-box" :style="boxStyle">
      <canvas ref="wire" class="gl-wire" :data-state="state" aria-hidden="true" />
      <canvas ref="sparkCanvas" class="gl-sparks" aria-hidden="true" />
      <button
        ref="end"
        type="button"
        class="gl-wire-end"
        aria-label="The cable's torn end. Press Enter to plug it back into the sign."
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @click="onClick"
      />
    </div>
  </div>
</template>

<style scoped>
.gl-live-wire {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.gl-live-wire-box {
  position: absolute;
}

.gl-live-wire-box canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.gl-wire-end {
  position: absolute;
  top: 0;
  left: 0;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  cursor: grab;
  pointer-events: auto;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}

.gl-wire-end:active {
  cursor: grabbing;
}

.gl-wire-end:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: -6px;
}
</style>
