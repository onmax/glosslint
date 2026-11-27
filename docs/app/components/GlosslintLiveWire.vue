<script setup lang="ts">
// The cable stub left in the outlet after the hero's sign falls and tears its cable out: a short rope that hangs from
// the plug, sways, and now and then sparks at its torn end. Drag the end, or press Enter on it, to plug it back in.
//
// Contract
// - Mount it inside the hero's wall (the 800 × 480 box), only while the cable is out of the board. It fills the wall
//   and centres its canvases on `anchor`, the top of the plug in wall units.
// - `from`, in wall units, is where the cable ran to when it snapped: the stub starts pointing there and drops.
// - `length` is the stub's length in CSS px. It doesn't stretch: a dragged end stops at the length from the plug.
// - `socket`, in wall units, is where the hung board takes the cable, passed only while there is one to plug into. A
//   held end that comes within 40px of it wiggles for a moment, as if feeling for the hole, then arcs across the gap
//   in the sign's cyan. Until the end is picked up, a dashed path in the same cyan marches from it to the socket, so
//   it's clear where the cable goes.
// - The cord is heavy: a held end trails the pointer through a damped spring, and let go it swings on and settles.
//   The rope never stretches.
// - The wire canvas carries `data-state` (`live`, or `held` while dragged), `data-len` (the rope's measured length in
//   CSS px), `data-tip="x,y"` (the torn end in the canvas's CSS px) and `data-frames` (frames drawn since mount).
// - Sparks, the tip's flicker and the arc go on a second canvas, `canvas.gl-sparks`, of the same box, which is empty
//   between bursts.
// - `.gl-wire-end` is a 44px button on the torn end. Dragging it emits `release` with the end's viewport point when
//   it's let go; Enter or Space on it emits `plug`. The hero decides whether either plugs the cable in.
// - `focus()` focuses the end.
// - Under reduced motion it draws once and on each drag move, with no sway, no sparks, no arc, and the end right
//   under the pointer.
// - Its loop stops while the stub is off screen or the tab is hidden, and the canvases are capped at 2x pixel density.

const props = withDefaults(defineProps<{
  anchor: [number, number]
  from?: [number, number]
  length?: number
  socket?: [number, number]
}>(), { length: 100 })

const emit = defineEmits<{
  release: [point: { x: number, y: number }]
  plug: []
}>()

const root = ref<HTMLElement>()
const wire = ref<HTMLCanvasElement>()
const sparkCanvas = ref<HTMLCanvasElement>()
const end = ref<HTMLButtonElement>()
const box = ref<HTMLElement>()
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
// The hand on a held end: it follows the pointer on a damped spring, so the end lags a fast pull and overshoots a
// little, and the rope carries that speed on when it is let go.
let hand: { x: number, y: number, vx: number, vy: number } | undefined
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
  // Torn out under tension, the cord whips: the end flicks sideways, away from the board, harder the further out, and
  // the stretched cord springs back toward the plug, so it buckles.
  const whip = reduced ? 0 : 26
  const recoil = reduced ? 0 : 11
  const side = dir[1]! < 0 ? 1 : -1
  knots = Array.from({ length: count }, (_, i) => {
    const x = centre() + dir[0]! * segment() * i
    const y = centre() + dir[1]! * segment() * i
    const f = i / (count - 1)
    const kick = whip * f ** 2
    return {
      x,
      y,
      px: x + dir[1]! * side * kick + dir[0]! * recoil * f,
      py: y - dir[0]! * side * kick + dir[1]! * recoil * f + kick * 0.4,
    }
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

// The hand's spring: its natural frequency in rad/s and its damping ratio. Under 1, a fast pull overshoots a little.
const handOmega = 24
const handDamping = 0.55
// Speed the cord loses per second, as a rate. Heavy rubber: a swing dies out in about a second and a half.
const drag = 4.5

function moveHand(dt: number) {
  const goal = reach(target!)
  if (!hand || reduced) {
    hand = { ...goal, vx: 0, vy: 0 }
    return
  }
  // Semi-implicit Euler, in small steps so a long frame can't throw the spring off.
  const steps = Math.ceil(dt / (1 / 120))
  const h = dt / steps
  for (let n = 0; n < steps; n++) {
    hand.vx += (handOmega ** 2 * (goal.x - hand.x) - 2 * handDamping * handOmega * hand.vx) * h
    hand.vy += (handOmega ** 2 * (goal.y - hand.y) - 2 * handDamping * handOmega * hand.vy) * h
    hand.x += hand.vx * h
    hand.y += hand.vy * h
  }
  Object.assign(hand, reach(hand))
}

// ---- Feeling for the socket: within `searchIn` px the end wiggles across the line to it for `searchFor` seconds,
// and only then does the arc jump. Pulled back past `searchOut` px, it searches again next time. ----

const searchIn = 40
const searchOut = 56
const searchFor = 0.22
let search: 'away' | 'feeling' | 'found' = 'away'
let searchStart = 0

function socketPoint() {
  return props.socket && fromWall(props.socket)
}

function feel(point: { x: number, y: number }, t: number) {
  const socket = socketPoint()
  if (!socket || reduced) {
    search = 'away'
    return point
  }
  const dx = socket.x - point.x
  const dy = socket.y - point.y
  const d = Math.hypot(dx, dy) || 1
  if (d > searchOut) search = 'away'
  else if (d <= searchIn && search === 'away') {
    search = 'feeling'
    searchStart = t
  }
  if (search === 'feeling' && t - searchStart >= searchFor) search = 'found'
  if (search !== 'feeling') return point
  // About two quick shakes at 9 Hz, 4px either side, easing off as it finds the hole.
  const since = t - searchStart
  const sideways = Math.sin(since * 9 * 2 * Math.PI) * 4 * (1 - since / searchFor * 0.5)
  return reach({ x: point.x - dy / d * sideways, y: point.y + dx / d * sideways })
}

function step(dt: number, t: number) {
  // A heavy rubber cord: it swings slowly, settles, and sways on a long, lazy beat.
  const gravity = 950
  const sway = reduced ? 0 : Math.sin(t * 0.55) * 30 + Math.sin(t * 1.25 + 1) * 9
  const keep = Math.exp(-drag * dt)
  for (let i = 1; i < count; i++) {
    const knot = knots[i]!
    const vx = (knot.x - knot.px) * keep
    const vy = (knot.y - knot.py) * keep
    knot.px = knot.x
    knot.py = knot.y
    knot.x += vx + sway * (i / count) * dt * dt
    knot.y += vy + gravity * dt * dt
  }
  if (target) moveHand(dt)
  else {
    hand = undefined
    search = 'away'
  }
  const held = hand && feel({ x: hand.x, y: hand.y }, t)
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
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const px = Math.round(size.value * dpr)
  if (canvas.width !== px) {
    canvas.width = px
    canvas.height = px
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

const isDark = () => document.documentElement.classList.contains('dark')

// The copper inside the torn end: two conductors, each splayed into loose strands. Fixed per mount so they don't jitter.
const strands = Array.from({ length: 9 }, (_, i) => ({
  wire: i % 2 ? 1 : -1,
  spread: (Math.random() - 0.5) * 1.5,
  length: 0.55 + Math.random() * 0.45,
  curl: (Math.random() - 0.5) * 0.9,
  color: ['#b8622a', '#d98545', '#8f4a1c'][i % 3]!,
}))

// How hot the torn end is, 0 to 1: it flares after each burst and cools back to a faint ember.
let heat = 1
let breath = 0

function draw() {
  const canvas = wire.value
  if (!canvas) return
  const ctx = fit(canvas)
  ctx.clearRect(0, 0, size.value, size.value)
  const scale = Math.max(0.5, wallSize.value.width / 800)
  const dark = isDark()
  // The hero's cable is 5 wall units wide; the stub is the same cord, a touch heavier so it reads at small sizes.
  const width = Math.max(5, 8 * scale)

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  drawGuide(ctx, dark)
  const trace = (from = 0) => {
    ctx.beginPath()
    ctx.moveTo(knots[from]!.x, knots[from]!.y)
    for (let i = from + 1; i < count - 1; i++) {
      const a = knots[i]!
      const b = knots[i + 1]!
      ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2)
    }
    ctx.lineTo(knots[count - 1]!.x, knots[count - 1]!.y)
  }

  // A soft shadow on the wall, then the rubber: a dark rim, the jacket, and a sheen along its top.
  ctx.save()
  ctx.shadowColor = dark ? 'rgb(0 0 0 / 55%)' : 'rgb(15 23 42 / 28%)'
  ctx.shadowBlur = 6 * scale + 2
  ctx.shadowOffsetX = 1.5 * scale
  ctx.shadowOffsetY = 5 * scale
  trace()
  ctx.strokeStyle = '#05070c'
  ctx.lineWidth = width + 1.6
  ctx.stroke()
  ctx.restore()
  // On the dark wall a cool rim around the rubber, as if the room's light caught its edges, keeps its shape readable.
  if (dark) {
    trace()
    ctx.strokeStyle = 'rgb(148 170 205 / 30%)'
    ctx.lineWidth = width + 2
    ctx.stroke()
  }
  trace()
  ctx.strokeStyle = '#1c2433'
  ctx.lineWidth = width
  ctx.stroke()
  ctx.save()
  ctx.translate(-width * 0.18, -width * 0.22)
  trace()
  ctx.strokeStyle = dark ? 'rgb(190 210 240 / 16%)' : 'rgb(255 255 255 / 11%)'
  ctx.lineWidth = width * 0.42
  ctx.stroke()
  trace()
  ctx.strokeStyle = dark ? 'rgb(215 230 255 / 30%)' : 'rgb(255 255 255 / 15%)'
  ctx.lineWidth = Math.max(1, width * 0.14)
  ctx.stroke()
  ctx.restore()

  // The strain relief where the cord leaves the plug: a short, thicker boot.
  const boot = knots[1]!
  ctx.beginPath()
  ctx.moveTo(knots[0]!.x, knots[0]!.y)
  ctx.lineTo(knots[0]!.x + (boot.x - knots[0]!.x) * 0.7, knots[0]!.y + (boot.y - knots[0]!.y) * 0.7)
  ctx.strokeStyle = '#1a202c'
  ctx.lineWidth = width * 1.55
  ctx.lineCap = 'butt'
  ctx.stroke()
  ctx.lineCap = 'round'

  const tip = knots[count - 1]!
  const before = knots[count - 2]!
  const angle = Math.atan2(tip.y - before.y, tip.x - before.x)
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  const flash = sparkField.light

  // A burst lights the last stretch of cord from below.
  if (flash > 0) {
    ctx.save()
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over'
    trace(count - 5)
    ctx.strokeStyle = dark ? `rgb(255 170 90 / ${flash * 0.55})` : `rgb(249 115 22 / ${flash * 0.45})`
    ctx.lineWidth = width * 0.6
    ctx.stroke()
    ctx.restore()
  }

  // The cut face of the jacket, then two insulated conductors and their copper splayed out past it.
  const nx = -uy
  const ny = ux
  ctx.strokeStyle = '#2a3447'
  ctx.lineWidth = Math.max(1, width * 0.22)
  ctx.beginPath()
  ctx.moveTo(tip.x + nx * width * 0.48, tip.y + ny * width * 0.48)
  ctx.lineTo(tip.x - nx * width * 0.48, tip.y - ny * width * 0.48)
  ctx.stroke()
  const core = Math.max(3, 4 * scale)
  const reachOut = Math.max(8, 13 * scale)
  // The strands trail a little behind the end as it moves.
  const lag = Math.max(-0.5, Math.min(0.5, ((tip.x - tip.px) * nx + (tip.y - tip.py) * ny) * -0.12))
  for (const wireSide of [-1, 1]) {
    const ox = tip.x + nx * width * 0.2 * wireSide
    const oy = tip.y + ny * width * 0.2 * wireSide
    ctx.strokeStyle = wireSide < 0 ? '#5a3418' : '#24406a'
    ctx.lineWidth = width * 0.36
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.moveTo(ox - ux, oy - uy)
    ctx.lineTo(ox + ux * core, oy + uy * core)
    ctx.stroke()
    ctx.lineCap = 'round'
    for (const strand of strands) {
      if (strand.wire !== wireSide) continue
      const sx = ox + ux * core
      const sy = oy + uy * core
      const a = angle + strand.spread * 0.8 + wireSide * 0.25 + lag
      const len = reachOut * strand.length
      const ex = sx + Math.cos(a) * len
      const ey = sy + Math.sin(a) * len
      const c = a + strand.curl
      ctx.strokeStyle = strand.color
      ctx.lineWidth = Math.max(0.9, 1.2 * scale)
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.quadraticCurveTo(sx + Math.cos(c) * len * 0.6, sy + Math.sin(c) * len * 0.6, ex, ey)
      ctx.stroke()
    }
  }

  // The ember: a faint glow on the copper that breathes, and flares with each burst.
  const glow = Math.min(1, 0.28 + 0.16 * Math.sin(breath) + heat * 0.6 + flash * 0.4)
  const ex = tip.x + ux * (core + reachOut * 0.4)
  const ey = tip.y + uy * (core + reachOut * 0.4)
  const radius = (12 + heat * 10) * Math.max(0.8, scale)
  ctx.save()
  ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over'
  const ember = ctx.createRadialGradient(ex, ey, 0, ex, ey, radius)
  if (dark) {
    ember.addColorStop(0, `rgb(255 214 150 / ${glow * 0.75})`)
    ember.addColorStop(0.3, `rgb(255 120 30 / ${glow * 0.4})`)
    ember.addColorStop(1, 'rgb(255 90 20 / 0)')
  }
  else {
    ember.addColorStop(0, `rgb(234 88 12 / ${glow * 0.55})`)
    ember.addColorStop(0.35, `rgb(249 115 22 / ${glow * 0.22})`)
    ember.addColorStop(1, 'rgb(249 115 22 / 0)')
  }
  ctx.fillStyle = ember
  ctx.fillRect(ex - radius, ey - radius, radius * 2, radius * 2)
  ctx.restore()

  frames++
  canvas.dataset.frames = String(frames)
  canvas.dataset.len = measured().toFixed(1)
  canvas.dataset.tip = `${tip.x.toFixed(1)},${tip.y.toFixed(1)}`
  if (end.value) end.value.style.translate = `${tip.x - 22}px ${tip.y - 22}px`
}

// The way to the socket: a dashed curve from the torn end, bowed away from the board, fading in once the board is
// back up and marching toward the socket. Under reduced motion it stands still.
let guideSince = 0

function drawGuide(ctx: CanvasRenderingContext2D, dark: boolean) {
  const socket = socketPoint()
  if (!socket || target) {
    guideSince = 0
    return
  }
  const now = performance.now()
  guideSince ||= now
  const alpha = reduced ? 1 : Math.min(1, Math.max(0, (now - guideSince - 900) / 400))
  if (!alpha) return
  const tip = knots[count - 1]!
  const dx = socket.x - tip.x
  const dy = socket.y - tip.y
  // The bow goes to the right of the line, away from the board.
  const bow = dy < 0 ? 0.3 : -0.3
  const cx = (tip.x + socket.x) / 2 - dy * bow
  const cy = (tip.y + socket.y) / 2 + dx * bow
  ctx.save()
  ctx.setLineDash([5, 7])
  ctx.lineDashOffset = reduced ? 0 : -now / 1000 * 24
  ctx.lineWidth = 2
  ctx.strokeStyle = dark ? `rgb(34 232 255 / ${0.6 * alpha})` : `rgb(8 145 178 / ${0.7 * alpha})`
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.quadraticCurveTo(cx, cy, socket.x, socket.y)
  ctx.stroke()
  ctx.restore()
}

// ---- Sparks: long quiet stretches, then a short, violent burst from the torn end. ----

const sparkField = new SparkField()
let nextBurst = 0
let sparksDirty = false

// Sparks stay inside the hero's sides, and go out within a stub's length or so below the plug rather than raining on
// whatever sits under the wall.
function clip() {
  if (sparkCanvas.value) sparkField.clipTo(sparkCanvas.value)
  sparkField.bottom = Math.min(sparkField.bottom, centre() + props.length * 1.9)
}

// The moment the cable tears out: the biggest burst, a white flash, and the cord whipping away.
function snap(t: number) {
  const tip = knots[count - 1]!
  clip()
  const scale = Math.max(0.6, wallSize.value.width / 800)
  sparkField.burst(tip.x, tip.y, { count: 64, angle: -Math.PI / 2, spread: 1.6, speed: [260, 760], life: [0.35, 0.95], width: 2.6 })
  // The flash is wide, so it sits a little in from the hero's edge to light the wall rather than be cut off by it.
  sparkField.flash(Math.min(tip.x, sparkField.right - 70 * scale), tip.y, { radius: 150 * scale, life: 0.22, white: true })
  heat = 1
  // The first crackle comes soon after the tear; after that the cord rests longer between them.
  gap = 1.4 + Math.random() * 1.2
  nextBurst = t + gap
}

function burst(t: number) {
  const tip = knots[count - 1]!
  clip()
  const before = knots[count - 2]!
  const angle = Math.atan2(tip.y - before.y, tip.x - before.x)
  // Sprayed out of the end, between where it points and straight down, turned a different way each time.
  const lean = Math.atan2(Math.sin(angle) + 0.7, Math.cos(angle)) + (Math.random() - 0.5) * 1.8
  sparkField.burst(tip.x, tip.y, { count: 22 + Math.floor(Math.random() * 16), angle: lean, spread: 1, speed: [200, 600], life: [0.2, 0.5], width: 2, flash: { radius: 70, life: 0.12 } })
  // A third of the time it crackles again a moment later.
  if (Math.random() < 0.35) aftershock = t + 0.08 + Math.random() * 0.08
  heat = 1
  // The cord jumps with the discharge.
  if (!target) {
    for (let i = count - 3; i < count; i++) {
      const k = (i - count + 4) / 3
      knots[i]!.px -= (Math.random() - 0.5) * 7 * k
      knots[i]!.py += 3 * k
    }
  }
  // Every 3 to 6.5 seconds, and a long rest is followed by a shorter one: two rests in a row never pass 9.5 seconds,
  // so any 10 seconds hold two bursts.
  gap = 3 + Math.random() * Math.min(3.5, 6.5 - Math.max(3, gap))
  nextBurst = t + gap
}

let gap = 0
let aftershock = 0

function crackle() {
  const tip = knots[count - 1]!
  sparkField.burst(tip.x, tip.y, { count: 6 + Math.floor(Math.random() * 6), angle: -Math.PI / 2 + (Math.random() - 0.5) * 2, spread: 1, speed: [150, 420], life: [0.15, 0.35], width: 1.6, flash: { radius: 34, life: 0.07 } })
  aftershock = 0
}

// ---- Neon: just before each burst the tip flickers cyan-white, and a held end near the socket arcs across to it, in
// the sign's own cyan, so the cable's faults tie into its light. ----

interface Point { x: number, y: number }
// How long the tip flickers before a burst, and the arc's current shape, redrawn every few frames.
const flickerLead = 0.2
let flicker = 0
let bolts: number[][] = []
let reshape = 0

// A jagged line from a to b: each pass splits every segment and pushes its middle sideways by half as much as before.
function zigzag(a: Point, b: Point, rough: number, detail: number) {
  let points = [a.x, a.y, b.x, b.y]
  let offset = Math.hypot(b.x - a.x, b.y - a.y) * rough
  for (let pass = 0; pass < detail; pass++) {
    const next: number[] = []
    for (let i = 0; i < points.length - 2; i += 2) {
      const [x0, y0, x1, y1] = [points[i]!, points[i + 1]!, points[i + 2]!, points[i + 3]!]
      const d = Math.hypot(x1 - x0, y1 - y0) || 1
      const push = (Math.random() - 0.5) * 2 * offset
      next.push(x0, y0, (x0 + x1) / 2 - (y1 - y0) / d * push, (y0 + y1) / 2 + (x1 - x0) / d * push)
    }
    next.push(points.at(-2)!, points.at(-1)!)
    points = next
    offset /= 2
  }
  return points
}

// A point in wall units, in the canvas's CSS px.
function fromWall(point: [number, number]) {
  const k = wallSize.value.width / 800
  return { x: centre() + (point[0] - props.anchor[0]) * k, y: centre() + (point[1] - props.anchor[1]) * k }
}

// How close a held end that has found the socket is to it: 0 when there is no arc, from 0.2 at the edge of the search
// to 1 on it.
function nearness() {
  const socket = socketPoint()
  if (!socket || !target || search !== 'found') return 0
  const tip = knots[count - 1]!
  return Math.min(1, Math.max(0.2, 1 - (Math.hypot(socket.x - tip.x, socket.y - tip.y) - 10) / 30))
}

// The gap arcs more often, and thicker, the closer the end comes; between arcs it drops out for a frame or two.
function reshapeArc(near: number) {
  bolts = []
  if (near <= 0 || Math.random() > 0.4 + near * 0.6) return
  const tip = knots[count - 1]!
  const socket = fromWall(props.socket!)
  const main = zigzag(tip, socket, 0.28, 4)
  bolts.push(main)
  const length = Math.hypot(socket.x - tip.x, socket.y - tip.y)
  const heading = Math.atan2(socket.y - tip.y, socket.x - tip.x)
  for (let n = near > 0.6 ? 2 : 1; n > 0; n--) {
    const i = 2 * Math.floor(2 + Math.random() * (main.length / 2 - 4))
    const from = { x: main[i]!, y: main[i + 1]! }
    const turn = heading + (Math.random() - 0.5) * 2.2
    const reach = length * (0.2 + Math.random() * 0.3)
    bolts.push(zigzag(from, { x: from.x + Math.cos(turn) * reach, y: from.y + Math.sin(turn) * reach }, 0.3, 3))
  }
}

function drawNeon(ctx: CanvasRenderingContext2D, dark: boolean, near: number) {
  const tip = knots[count - 1]!
  const s = Math.max(0.85, wallSize.value.width / 800)
  ctx.save()
  ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // The tip's flicker, and a steadier glow while the arc holds: a cyan-white point inside a soft cyan halo.
  const level = Math.max(flicker, bolts.length ? 0.5 + near * 0.5 : 0)
  if (level > 0) {
    const r = (16 + 14 * level) * s
    const halo = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, r)
    if (dark) {
      halo.addColorStop(0, `rgb(240 255 255 / ${0.9 * level})`)
      halo.addColorStop(0.2, `rgb(46 230 255 / ${0.5 * level})`)
      halo.addColorStop(0.6, `rgb(34 232 255 / ${0.12 * level})`)
      halo.addColorStop(1, 'rgb(34 232 255 / 0)')
    }
    else {
      halo.addColorStop(0, `rgb(240 253 255 / ${0.95 * level})`)
      halo.addColorStop(0.22, `rgb(6 182 212 / ${0.45 * level})`)
      halo.addColorStop(0.6, `rgb(8 145 178 / ${0.12 * level})`)
      halo.addColorStop(1, 'rgb(8 145 178 / 0)')
    }
    ctx.fillStyle = halo
    ctx.fillRect(tip.x - r, tip.y - r, r * 2, r * 2)
  }
  // The arc: a wide soft glow, the body, and a hot thin core; its forks drawn thinner.
  bolts.forEach((points, index) => {
    ctx.beginPath()
    ctx.moveTo(points[0]!, points[1]!)
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i]!, points[i + 1]!)
    const w = (index ? 0.8 : 1.5 + near * 0.7) * s
    const layers: [string, number][] = dark
      ? [['rgb(34 232 255 / 22%)', w * 5], ['rgb(46 230 255 / 85%)', w * 1.8], ['rgb(242 254 255)', w * 0.7]]
      : [['rgb(8 47 73 / 50%)', w * 2.8], ['rgb(2 132 199)', w * 1.6], ['rgb(207 250 254 / 95%)', w * 0.55]]
    for (const [color, width] of layers) {
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.stroke()
    }
  })
  ctx.restore()
}

function drawSparks(dt: number, t: number) {
  const canvas = sparkCanvas.value
  if (!canvas) return
  sparkField.step(dt)
  // A bad contact: in the last moments before a burst the tip blinks on and off.
  flicker = snapped && nextBurst - t < flickerLead && Math.random() > 0.3 ? 0.55 + Math.random() * 0.45 : 0
  const near = nearness()
  if (near <= 0) bolts = []
  else if (--reshape <= 0) {
    reshapeArc(near)
    reshape = 2 + Math.floor(Math.random() * 3)
  }
  const lit = sparkField.active || flicker > 0 || bolts.length > 0
  if (!lit && !sparksDirty) return
  const ctx = fit(canvas)
  ctx.clearRect(0, 0, size.value, size.value)
  sparksDirty = lit
  if (!lit) return
  const dark = isDark()
  sparkField.draw(ctx, dark)
  drawNeon(ctx, dark, near)
}

// ---- The loop: it runs only while the stub is on screen and the tab is visible. ----

let frame = 0
let last = 0
let running = false
let onScreen = true
let snapped = false

function tick(now: number) {
  const t = now / 1000
  const dt = Math.min(1 / 30, (now - last) / 1000)
  last = now
  step(dt, t)
  heat = Math.max(0, heat - dt * 1.3)
  breath += dt * 1.4
  if (!snapped) {
    snapped = true
    snap(t)
  }
  else if (t >= nextBurst) {
    burst(t)
  }
  if (aftershock && t >= aftershock) crackle()
  drawSparks(dt, t)
  draw()
  frame = requestAnimationFrame(tick)
}

function start() {
  if (running || reduced || !onScreen || document.hidden) return
  running = true
  last = performance.now()
  frame = requestAnimationFrame(tick)
}

function stop() {
  running = false
  cancelAnimationFrame(frame)
}

const onVisibility = () => document.hidden ? stop() : start()

// Under reduced motion the rope settles at once and is drawn once: a still, frayed stub, no sparks.
function settle() {
  for (let i = 0; i < 90; i++) step(1 / 60, 0)
  heat = 0
  draw()
}

function measure() {
  const rect = root.value!.getBoundingClientRect()
  wallSize.value = { width: rect.width, height: rect.height }
}

let observer: ResizeObserver | undefined
let seen: IntersectionObserver | undefined

onMounted(() => {
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  measure()
  init()
  observer = new ResizeObserver(measure)
  observer.observe(root.value!)
  if (reduced) return settle()
  seen = new IntersectionObserver(([entry]) => {
    onScreen = !!entry?.isIntersecting
    onScreen ? start() : stop()
  })
  seen.observe(box.value!)
  document.addEventListener('visibilitychange', onVisibility)
  start()
})

onBeforeUnmount(() => {
  stop()
  observer?.disconnect()
  seen?.disconnect()
  document.removeEventListener('visibilitychange', onVisibility)
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
  const tip = knots[count - 1]!
  hand = { x: tip.x, y: tip.y, vx: 0, vy: 0 }
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

// Under reduced motion nothing redraws on its own, so the path to the socket is drawn when the socket appears.
watch(() => props.socket, () => reduced && draw())

defineExpose({ focus: () => end.value?.focus() })
</script>

<template>
  <div ref="root" class="gl-live-wire">
    <div ref="box" class="gl-live-wire-box" :style="boxStyle">
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
