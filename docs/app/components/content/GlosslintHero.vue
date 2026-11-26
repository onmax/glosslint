<script setup lang="ts">
// `::glosslint-hero`: the headline and the pitch, a prompt for agents and an install line for people, and the ways in,
// beside the neon sign that says what glosslint does.
//
// The sign hangs on two nails. Each click on a nail turns it a third of the way round; a nail turned six times falls
// out. With one nail out the sign swings and hangs from the other. With both out it falls to the bottom edge of the
// window, over the page, and its cable tears out of the board: the sign goes dark, and a stub of cable stays in the
// outlet, swaying and sparking. Drag the sign back onto the wall to hang it on its nails, still dark, then drag the
// cable's end into the socket on the board's right edge to light it again. Enter does each step from the keyboard.
//
// `data-state` on the root says where it is: `hung-live` (on the wall, plugged in, even on one nail), `fallen`, or
// `hung-dark` (back on the wall, unplugged).

const slots = useSlots()

const tabs = [
  { slot: 'agents', label: 'For agents' },
  { slot: 'humans', label: 'For humans' },
].filter(tab => slots[tab.slot])
const tab = ref(tabs[0]?.slot)

const tabIds = useId()
const tabButtons = ref<HTMLButtonElement[]>([])

// Arrow keys, Home and End move between tabs, as the ARIA tabs pattern does.
function onTabKey(event: KeyboardEvent, index: number) {
  const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key]
  if (next === undefined) return
  event.preventDefault()
  const target = (next + tabs.length) % tabs.length
  tab.value = tabs[target]!.slot
  tabButtons.value[target]?.focus()
}

// ---- The sign on its nails. Wall units: the backplate is 760 × 400 at the top left of an 800 × 480 wall. ----

type Side = 'left' | 'right'
type HeroState = 'hung-live' | 'fallen' | 'hung-dark'

const nails: Record<Side, { x: number, y: number, slot: number }> = {
  left: { x: 32, y: 30, slot: 35 },
  right: { x: 728, y: 30, slot: -20 },
}
const sides: Side[] = ['left', 'right']
const other = (side: Side): Side => side === 'left' ? 'right' : 'left'

// Each click turns a nail a third of the way round; six clicks, two full turns, pull it out.
const turnsToDrop = 6
const degreesPerTurn = 120
// The angle the sign settles at on one nail. Its cable on the other side keeps it from swinging all the way.
const hangAngle = 15
// Where the cable leaves the board, and the top of the plug it runs into, in wall units.
const grommetAt: [number, number] = [764, 284]
const plugAt: [number, number] = [782, 419]
// How close, in px, the board's nail holes must come to the wall's, and the cable's end to the grommet, to latch.
const hangReach = 40
const plugReach = 24

const turns = reactive<Record<Side, number>>({ left: 0, right: 0 })
const out = reactive<Record<Side, boolean>>({ left: false, right: false })
const pivot = ref<Side>()
const angle = ref(0)
const state = ref<HeroState>('hung-live')
// Whether the sign has power. Both copies of the sign follow it, so they play their die and ignite animations.
const powered = ref(true)
const fallen = computed(() => state.value === 'fallen')
const announcement = ref('')

const wall = ref<HTMLElement>()
const board = ref<HTMLElement>()
const fallenSign = ref<HTMLElement>()
const fallenBody = ref<HTMLElement>()
const liveWire = ref<{ focus: () => void }>()
const nailButtons = reactive<Partial<Record<Side, HTMLButtonElement>>>({})

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// A point on the board, turned with it about the nail it hangs from.
function onBoard([x, y]: [number, number]): [number, number] {
  if (!pivot.value) return [x, y]
  const { x: px, y: py } = nails[pivot.value]
  const r = angle.value * Math.PI / 180
  const [cos, sin] = [Math.cos(r), Math.sin(r)]
  return [px + (x - px) * cos - (y - py) * sin, py + (x - px) * sin + (y - py) * cos]
}

// The cable from the grommet on the board's right edge down into the plug, which follows the board as it swings.
const cable = computed(() => {
  const start = onBoard(grommetAt)
  const bend = onBoard([794, 290])
  return `M ${start.join(' ')} C ${bend.join(' ')}, 782 372, 782 420`
})

// Where the cable was going when it tore out, so the stub starts from there and drops.
const snapFrom = ref<[number, number]>(grommetAt)

const boardStyle = computed(() => pivot.value && {
  transformOrigin: `${nails[pivot.value].x / 7.6}% ${nails[pivot.value].y / 4}%`,
  transform: `rotate(${angle.value}deg)`,
})

function loosen(side: Side) {
  if (out[side] || fallen.value) return
  turns[side]++
  // The last turn shows before the nail lets go.
  if (turns[side] >= turnsToDrop) setTimeout(() => drop(side), prefersReducedMotion() ? 0 : 200)
}

const falling = ref<{ id: number, x: number, y: number, size: number, slot: number }[]>([])
let fallingId = 0

async function drop(side: Side) {
  const button = nailButtons[side]
  if (!button || out[side]) return
  const rect = button.getBoundingClientRect()
  falling.value.push({ id: fallingId++, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: rect.width, slot: nails[side].slot - turns[side] * degreesPerTurn })
  out[side] = true

  const rest = other(side)
  if (!out[rest]) {
    pivot.value = rest
    swing(rest === 'right' ? -hangAngle : hangAngle)
    announcement.value = `The ${side} nail fell out. The sign hangs from the ${rest} nail.`
    await nextTick()
    nailButtons[rest]?.focus()
  }
  else {
    await fall()
    announcement.value = 'Both nails are out. The sign fell and its cable tore out, so it went dark. Drag it back onto the wall, or press Enter to hang it back up.'
    await nextTick()
    fallenSign.value?.focus({ preventScroll: true })
  }
}

// A falling nail tumbles out of the window and is gone.
function startNailFall(el: Element | null, nail: { id: number, y: number }) {
  if (!(el instanceof HTMLElement) || el.dataset.started) return
  el.dataset.started = 'true'
  const done = () => { falling.value = falling.value.filter(candidate => candidate.id !== nail.id) }
  if (prefersReducedMotion()) {
    el.animate([{ opacity: 1 }, { opacity: 0, translate: '0 12px' }], { duration: 160, easing: 'ease-in' }).onfinish = done
    return
  }
  const distance = window.innerHeight - nail.y + 60
  const drift = (Math.random() - 0.5) * 60
  el.animate([
    { translate: '0 0', rotate: '0deg', easing: 'cubic-bezier(.3,.9,.6,1)' },
    { offset: 0.12, translate: `${drift * 0.1}px -6px`, rotate: '-30deg', easing: 'cubic-bezier(.5,0,.95,.6)' },
    { translate: `${drift}px ${distance}px`, rotate: `${drift > 0 ? 400 : -400}deg` },
  ], { duration: Math.min(1200, 420 + Math.sqrt(distance) * 18) }).onfinish = done
}

let frame = 0

// A damped swing from where the sign is to where it settles. Under reduced motion it is just there.
function swing(target: number) {
  cancelAnimationFrame(frame)
  if (prefersReducedMotion()) {
    angle.value = target
    return
  }
  const from = angle.value
  const started = performance.now()
  const damping = 2.4
  const omega = 2 * Math.PI * 0.85
  const step = (now: number) => {
    const t = (now - started) / 1000
    angle.value = target + (from - target) * Math.exp(-damping * t) * (Math.cos(omega * t) + damping / omega * Math.sin(omega * t))
    if (t < 3) frame = requestAnimationFrame(step)
    else angle.value = target
  }
  frame = requestAnimationFrame(step)
}

// ---- The fallen sign: over the page, at the bottom edge of the window, and free to pick up and throw. ----

const fallenWidth = ref(0)
// Whether the sign had power when it fell, so its fallen copy sputters out rather than lying there dark already.
const fellLit = ref(false)
const fallenPosition = ref({ x: 0, y: 0 })

const centre = (el: Element) => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
const midpoint = (els: Iterable<Element>) => {
  const points = [...els].map(centre)
  return points.length ? { x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length } : undefined
}

const throwable = useThrowable(fallenSign, {
  position: fallenPosition,
  bounds: () => ({ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }),
  reducedMotion: prefersReducedMotion,
  // Picked up mid-fall, the sign stops falling where it is headed.
  onGrab: () => fallenBody.value?.getAnimations().forEach(animation => animation.finish()),
  // The board's nail holes over the wall's.
  magnet: () => {
    const anchor = fallenSign.value && midpoint(fallenSign.value.querySelectorAll('.gl-hole-mark'))
    const target = wall.value && midpoint(wall.value.querySelectorAll('.gl-wall-hole'))
    return anchor && target && { anchor, target, radius: hangReach }
  },
  onLatch: () => hangBack(),
})

async function fall() {
  cancelAnimationFrame(frame)
  const rect = wall.value!.getBoundingClientRect()
  const width = rect.width * 760 / 800
  const height = 400 * width / 760
  const left = Math.max(0, Math.min(rect.left, window.innerWidth - width - 8))
  snapFrom.value = onBoard(grommetAt)
  fallenWidth.value = width
  fallenPosition.value = { x: left, y: window.innerHeight - height }
  fellLit.value = powered.value
  state.value = 'fallen'
  powered.value = false
  await nextTick()
  const el = fallenBody.value
  if (!el) return

  if (prefersReducedMotion()) {
    el.animate([{ opacity: 0, translate: '0 -16px' }, { opacity: 1, translate: '0 0' }], { duration: 200, easing: 'ease-out' })
    return
  }

  // Start the fallen copy exactly where the hanging board is: the same box, turned the same way about its nail. The
  // copy turns about its bottom middle, so the turn about the nail becomes that turn plus a shift.
  const scale = width / 760
  const nail = pivot.value ? nails[pivot.value] : { x: 380, y: 200 }
  const toNail = [nail.x * scale - width / 2, nail.y * scale - height]
  const r = angle.value * Math.PI / 180
  const turned = [toNail[0]! * Math.cos(r) - toNail[1]! * Math.sin(r), toNail[0]! * Math.sin(r) + toNail[1]! * Math.cos(r)]
  const x = rect.left - left + toNail[0]! - turned[0]!
  const y = rect.top - (window.innerHeight - height) + toNail[1]! - turned[1]!
  const duration = Math.min(1400, Math.max(650, 480 + Math.sqrt(Math.abs(y)) * 22))
  el.animate([
    { translate: `${x}px ${y}px`, rotate: `${angle.value}deg`, easing: 'cubic-bezier(.45,0,.9,.55)' },
    { offset: 0.74, translate: '0 0', rotate: '1.6deg', easing: 'cubic-bezier(.2,.7,.3,1)' },
    { offset: 0.86, translate: `0 ${-8 * scale - 4}px`, rotate: '-2.4deg', easing: 'cubic-bezier(.6,0,.9,.5)' },
    { translate: '0 0', rotate: '-1.2deg' },
  ], { duration })
}

// Back on its nails, still unplugged.
async function hangBack(fromKeyboard = false) {
  if (state.value !== 'fallen') return
  for (const side of sides) {
    turns[side] = 0
    out[side] = false
  }
  pivot.value = undefined
  angle.value = 0
  state.value = 'hung-dark'
  announcement.value = 'The sign is back on its nails, still dark. Plug the cable back into its right edge to light it.'
  if (!fromKeyboard) return
  await nextTick()
  liveWire.value?.focus()
}

// A spark at the grommet as the cable goes back in; the sign's own ignite follows it.
const plugSpark = ref(0)

async function reconnect(fromKeyboard = false) {
  if (state.value === 'fallen') {
    if (fromKeyboard) announcement.value = 'Hang the sign back on the wall before you plug it in.'
    return
  }
  if (state.value !== 'hung-dark') return
  state.value = 'hung-live'
  powered.value = true
  if (!prefersReducedMotion()) plugSpark.value++
  announcement.value = 'The cable is plugged back in, and the sign is lit.'
  if (!fromKeyboard) return
  await nextTick()
  nailButtons.left?.focus()
}

// The cable's end let go: it plugs in only on the hanging board's grommet.
function onWireRelease(point: { x: number, y: number }) {
  const grommet = board.value?.querySelector('.gl-grommet')
  if (state.value !== 'hung-dark' || !grommet) return
  const at = centre(grommet)
  if (Math.hypot(point.x - at.x, point.y - at.y) <= plugReach) reconnect()
}

// Enter or Space hangs the fallen sign back up; arrow keys nudge it.
function onFallenKey(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    hangBack(true)
    return
  }
  const nudge = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key]
  if (!nudge) return
  event.preventDefault()
  fallenPosition.value = { x: fallenPosition.value.x + nudge[0]!, y: fallenPosition.value.y + nudge[1]! }
  throwable.clamp()
}

const onResize = () => fallen.value && throwable.clamp()
onMounted(() => window.addEventListener('resize', onResize, { passive: true }))
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  cancelAnimationFrame(frame)
})
</script>

<template>
  <section class="glosslint-hero" :data-state="state">
    <div class="glosslint-hero-copy">
      <slot />

      <div v-if="tabs.length" class="gl-hero-tabs">
        <div role="tablist" aria-label="Start with glosslint" class="gl-hero-tablist">
          <button
            v-for="(item, index) in tabs"
            :id="`${tabIds}-tab-${item.slot}`"
            :key="item.slot"
            ref="tabButtons"
            type="button"
            role="tab"
            class="gl-hero-tab"
            :aria-selected="tab === item.slot"
            :aria-controls="`${tabIds}-panel-${item.slot}`"
            :tabindex="tab === item.slot ? 0 : -1"
            @click="tab = item.slot"
            @keydown="onTabKey($event, index)"
          >
            {{ item.label }}
          </button>
        </div>
        <div
          v-for="item in tabs"
          v-show="tab === item.slot"
          :id="`${tabIds}-panel-${item.slot}`"
          :key="item.slot"
          role="tabpanel"
          class="gl-hero-panel docs-content"
          :aria-labelledby="`${tabIds}-tab-${item.slot}`"
        >
          <slot :name="item.slot" />
        </div>
      </div>

      <div class="glosslint-hero-links">
        <UButton to="/guide/installation" color="primary" size="lg" trailing-icon="i-lucide-arrow-right">
          Get started
        </UButton>
        <UButton to="https://github.com/onmax/glosslint" target="_blank" color="neutral" variant="outline" size="lg" icon="i-simple-icons-github">
          GitHub
        </UButton>
      </div>
    </div>

    <div ref="wall" :class="['glosslint-hero-sign', { 'is-hanging': pivot && !fallen, 'is-fallen': fallen, 'is-powered': powered }]">
      <div class="gl-wall-bricks" aria-hidden="true" />

      <!-- The wall behind the sign: the nail holes and the outlet, which show once the sign is gone. -->
      <svg class="gl-wall-layer" viewBox="0 0 800 480" aria-hidden="true">
        <circle v-for="side in sides" :key="side" :cx="nails[side].x" :cy="nails[side].y" r="2.4" class="gl-wall-hole" />
        <g class="gl-outlet">
          <rect x="767" y="420" width="30" height="50" rx="4.5" class="gl-outlet-plate" />
          <g v-for="y in [433, 455]" :key="y" :transform="`translate(782 ${y})`">
            <rect x="-9" y="-7.5" width="18" height="15" rx="3.5" class="gl-outlet-socket" />
            <rect x="-4.6" y="-3.4" width="2" height="6" rx="1" class="gl-outlet-slot" />
            <rect x="2.6" y="-3.4" width="2" height="6" rx="1" class="gl-outlet-slot" />
          </g>
        </g>
      </svg>

      <div ref="board" class="gl-board" :style="boardStyle">
        <GlosslintSign :lit="powered" />
        <span class="gl-grommet" />
      </div>

      <!-- The cable into its plug, in front of the wall, while it is plugged into the board. -->
      <svg class="gl-wall-layer" viewBox="0 0 800 480" aria-hidden="true">
        <g v-if="state === 'hung-live'" fill="none" stroke-linecap="round">
          <path :d="cable" stroke="#1c2433" stroke-width="5" />
          <path :d="cable" stroke="#fff" stroke-opacity="0.08" stroke-width="1" transform="translate(-1 -1)" />
        </g>
        <rect x="779" y="418" width="6" height="8" rx="1.5" fill="#1a202c" />
        <rect x="773.5" y="424" width="17" height="19" rx="3.5" fill="#1a202c" stroke="#05070c" stroke-opacity="0.6" class="gl-plug" />
        <rect x="775.5" y="425.5" width="13" height="1.6" rx="0.8" fill="#fff" fill-opacity="0.1" />
      </svg>

      <!-- Torn out of the board, the cable is a live stub hanging from the plug. -->
      <GlosslintLiveWire
        v-if="state !== 'hung-live'"
        ref="liveWire"
        :anchor="plugAt"
        :from="snapFrom"
        @release="onWireRelease"
        @plug="reconnect(true)"
      />

      <GlosslintSparkPop v-if="plugSpark" :key="plugSpark" :at="grommetAt" @done="plugSpark = 0" />

      <template v-for="side in sides" :key="side">
        <button
          v-if="!out[side] && !fallen"
          :ref="el => { nailButtons[side] = (el as HTMLButtonElement | null) ?? undefined }"
          type="button"
          data-motion="none"
          :class="['gl-nail', `gl-nail-${side}`]"
          :style="{ left: `${nails[side].x / 8}%`, top: `${nails[side].y / 4.8}%` }"
          :aria-label="`Loosen the ${side} nail (${turnsToDrop - turns[side]} ${turnsToDrop - turns[side] === 1 ? 'turn' : 'turns'} left)`"
          @click="loosen(side)"
        >
          <svg viewBox="-18 -18 36 36" aria-hidden="true">
            <circle cx="0.8" cy="2.2" r="10" fill="#000" :opacity="0.5 + turns[side] * 0.05" :transform="`translate(${turns[side] * 0.25} ${turns[side] * 0.4})`" />
            <circle r="9.5" class="gl-nail-metal" />
            <path d="M -6.6 -4.2 A 7.8 7.8 0 0 1 2.2 -7.5" class="gl-nail-shine" />
            <circle r="9.5" fill="none" stroke="#05070c" stroke-opacity="0.9" />
            <path d="M -6 0 L 6 0" class="gl-nail-slot" :style="{ rotate: `${nails[side].slot - turns[side] * degreesPerTurn}deg` }" />
          </svg>
        </button>
      </template>

      <p class="gl-visually-hidden" aria-live="polite">
        {{ announcement }}
      </p>
    </div>

    <!-- The fallen sign lies on the bottom edge of the window, over the page, to pick up and throw or hang back up. -->
    <Teleport to="body">
      <div
        v-if="fallen"
        ref="fallenSign"
        class="gl-fallen"
        :style="{ width: `${fallenWidth}px` }"
        role="button"
        tabindex="0"
        aria-label="The fallen sign. Drag it back onto the wall, or press Enter to hang it back up. Arrow keys move it."
        @keydown="onFallenKey"
      >
        <div ref="fallenBody" class="gl-fallen-body">
          <GlosslintSign :lit="powered" :was-lit="fellLit" />
          <span class="gl-grommet" />
          <span
            v-for="side in sides"
            :key="side"
            class="gl-hole-mark"
            :style="{ left: `${nails[side].x / 7.6}%`, top: `${nails[side].y / 4}%` }"
          />
        </div>
      </div>
    </Teleport>

    <div
      v-for="nail in falling"
      :key="nail.id"
      :ref="el => startNailFall(el as Element | null, nail)"
      class="gl-falling-nail"
      :style="{ left: `${nail.x - nail.size / 2}px`, top: `${nail.y - nail.size / 2}px`, width: `${nail.size}px` }"
      aria-hidden="true"
    >
      <svg viewBox="-18 -18 36 36">
        <circle r="9.5" class="gl-nail-metal" />
        <path d="M -6.6 -4.2 A 7.8 7.8 0 0 1 2.2 -7.5" class="gl-nail-shine" />
        <circle r="9.5" fill="none" stroke="#05070c" stroke-opacity="0.9" />
        <path d="M -6 0 L 6 0" class="gl-nail-slot" :style="{ rotate: `${nail.slot}deg` }" />
      </svg>
    </div>
  </section>
</template>

<style scoped>
.glosslint-hero {
  display: grid;
  /* minmax(0, …) so a long line in a code block scrolls inside its frame instead of widening the column. */
  grid-template-columns: minmax(0, 1fr);
  gap: 2.5rem;
  align-items: center;
  width: 100%;
  max-width: 76rem;
  margin-inline: auto;
  padding: 2.5rem 1rem 3.5rem;
  /* The wall texture and a swinging sign reach past the column. They never widen the page. */
  overflow-x: clip;
}

@media (min-width: 40rem) {
  .glosslint-hero {
    padding-inline: 1.5rem;
  }
}

/* On a phone the sign comes first and the copy follows. From 64rem they sit side by side, copy on the left.
   On one nail the board swings out to about 19°, which carries it 15% of the wall past the wall's left edge (right
   nail) or 10% past its right edge (left nail). The margins keep that swing inside the hero, which clips sideways. */
.glosslint-hero-sign {
  order: -1;
  margin-inline: 12% 8%;
}

@media (min-width: 64rem) {
  .glosslint-hero {
    grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.1fr);
    gap: 4rem;
    padding-block: 4.5rem 4rem;
  }

  /* Swinging left, the board may reach into the gap beside the copy. */
  .glosslint-hero-sign {
    order: 0;
    margin-inline: 4% 6%;
  }
}

/* ---- The wall: an 800 × 480 box. The board covers its top left; the outlet sits below its right corner. ---- */

.glosslint-hero-sign {
  --gl-brick: rgb(150 205 255 / 9%);
  --gl-outlet-plate: #121825;
  --gl-outlet-edge: #263044;
  --gl-outlet-socket: #0c111b;
  --gl-outlet-slot: #020306;
  position: relative;
  isolation: isolate;
  aspect-ratio: 800 / 480;
}

:global(.light .glosslint-hero-sign) {
  --gl-brick: rgb(15 23 42 / 7%);
  --gl-outlet-plate: #f4f6f9;
  --gl-outlet-edge: #c6cfdb;
  --gl-outlet-socket: #e3e8ef;
  --gl-outlet-slot: #3b4452;
}

/* Painted brick behind the sign, lit where the sign lights it and fading into the page. */
.gl-wall-bricks {
  position: absolute;
  inset: -16% -10% -8% -14%;
  z-index: -2;
  background: var(--gl-brick);
  mask-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='52'%3E%3Cpath d='M0 .75H120M0 26.75H120M.75 0V26M60.75 26V52' stroke='%23000' stroke-width='1.5' fill='none'/%3E%3C/svg%3E"),
    radial-gradient(closest-side at 48% 46%, #000 30%, rgb(0 0 0 / 40%) 65%, transparent);
  mask-size: 120px 52px, 100% 100%;
  mask-repeat: repeat, no-repeat;
  mask-composite: intersect;
  pointer-events: none;
}

.gl-wall-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.gl-wall-hole {
  fill: var(--gl-outlet-slot);
  opacity: 0.55;
}

.gl-outlet-plate {
  fill: var(--gl-outlet-plate);
  stroke: var(--gl-outlet-edge);
}

.gl-outlet-socket {
  fill: var(--gl-outlet-socket);
  stroke: var(--gl-outlet-edge);
  stroke-opacity: 0.6;
}

.gl-outlet-slot {
  fill: var(--gl-outlet-slot);
}

/* The board: a soft shadow on the wall, and the tubes' light on the wall around it. It never takes a click. */
.gl-board {
  position: absolute;
  top: 0;
  left: 0;
  width: 95%;
  border-radius: 2.1% / 4%;
  box-shadow: 0 1px 2px rgb(0 0 0 / 30%), 0 18px 40px -16px rgb(0 0 0 / 55%);
  pointer-events: none;
}

.gl-board::before {
  position: absolute;
  inset: -8% -6% -14%;
  z-index: -1;
  border-radius: 50%;
  background:
    radial-gradient(closest-side at 32% 40%, rgb(34 232 255 / 55%), transparent),
    radial-gradient(closest-side at 70% 40%, rgb(46 245 163 / 45%), transparent),
    radial-gradient(closest-side at 32% 88%, rgb(255 71 112 / 16%), transparent);
  filter: blur(48px);
  opacity: var(--gl-hero-spill, 0.5);
  content: "";
}

/* `:global(.light) .a` compiles to `.light` alone, so the whole selector goes inside `:global()`. */
:global(.light .glosslint-hero-sign .gl-board) {
  --gl-hero-spill: 0.32;
  box-shadow: 0 1px 2px rgb(15 23 42 / 25%), 0 22px 44px -18px rgb(15 23 42 / 55%);
}

.is-fallen .gl-board {
  visibility: hidden;
}

/* ---- Nails: a button each, over the board's top corners. The hit area is twice the nail and at least 44px. ---- */

.gl-nail {
  position: absolute;
  z-index: 1;
  width: 6%;
  aspect-ratio: 1;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  /* A flat screwdriver, its blade at the hotspot. */
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cg fill='none'%3E%3Cpath d='M3.5 3.5 16 16' stroke='%230b0f17' stroke-width='4.6'/%3E%3Cpath d='M3.5 3.5 16 16' stroke='%23d6dde8' stroke-width='2.4'/%3E%3Cpath d='M17 17 27 27' stroke='%230b0f17' stroke-width='9.5' stroke-linecap='round'/%3E%3Cpath d='M17 17 27 27' stroke='%23f59e0b' stroke-width='7' stroke-linecap='round'/%3E%3Cpath d='M18.6 17.4 25.4 24.2' stroke='%23fff' stroke-opacity='.45' stroke-width='1.4' stroke-linecap='round'/%3E%3C/g%3E%3C/svg%3E") 3 3, pointer;
  translate: -50% -50%;
  -webkit-tap-highlight-color: transparent;
}

.gl-nail::before {
  position: absolute;
  inset: min(-50%, calc(50% - 22px));
  border-radius: 50%;
  content: "";
}

.gl-nail svg,
.gl-falling-nail svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.gl-nail:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: -2px;
}

.gl-nail-slot {
  stroke: #05070c;
  stroke-width: 2.2;
  stroke-linecap: round;
  transition: rotate 0.32s cubic-bezier(0.2, 0.8, 0.3, 1);
}

/* Bright steel with a shine at the top left, so the nails read as something to turn. */
.gl-nail-metal {
  fill: #6b778c;
  filter: drop-shadow(-1px -1px 0 rgb(255 255 255 / 22%));
}

.gl-nail-shine {
  fill: none;
  stroke: #fff;
  stroke-opacity: 0.5;
  stroke-width: 1.3;
  stroke-linecap: round;
}

@media (hover: hover) {
  .gl-nail:hover .gl-nail-metal {
    fill: #8592a8;
  }
}

.gl-falling-nail {
  position: fixed;
  z-index: 60;
  aspect-ratio: 1;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .gl-nail-slot {
    transition: none;
  }
}

/* ---- After the fall ---- */

/* Unplugged, the sign throws no light on the wall. */
.glosslint-hero-sign:not(.is-powered) .gl-board::before {
  opacity: 0;
  animation: none;
  transition: opacity 0.6s;
}

/* Over everything on the page, the header included. `useThrowable` places it with `translate`. */
.gl-fallen {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 90;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.gl-fallen:active {
  cursor: grabbing;
}

.gl-fallen:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 4px;
  border-radius: 2.1% / 4%;
}

.gl-fallen-body {
  position: relative;
  rotate: -1.2deg;
  transform-origin: 50% 100%;
}

.gl-fallen-body > :deep(svg) {
  filter: drop-shadow(0 -2px 10px rgb(0 0 0 / 35%));
}

/* Where the cable leaves the board, and the nail holes, in its 760 × 400 units: points to measure from. */
.gl-grommet,
.gl-hole-mark {
  position: absolute;
  pointer-events: none;
}

.gl-grommet {
  top: calc(284 / 400 * 100%);
  left: calc(764 / 760 * 100%);
}

.gl-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ---- Copy ---- */

.glosslint-hero-copy :deep(h1) {
  max-width: 20ch;
  color: var(--ui-text-highlighted);
  font-size: clamp(2.25rem, 4.5vw, 3.25rem);
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.03em;
  text-wrap: balance;
}

.glosslint-hero-copy > :deep(p) {
  max-width: 60ch;
  margin-top: 1.25rem;
  color: var(--ui-text-muted);
  font-size: 1.125rem;
  text-wrap: pretty;
}

/* The audience switch and its snippet share one frame, drawn like the docs' code frames: the switch is the frame's
   header, and the code block or install tabs inside drop their own frame. */
.gl-hero-tabs {
  --gl-frame-border: color-mix(in oklab, var(--gl-cyan, var(--ui-primary)) 20%, var(--ui-border));
  max-width: 36rem;
  margin-top: 1.75rem;
  overflow: hidden;
  border: 1px solid var(--gl-frame-border);
  border-radius: calc(var(--ui-radius) * 2);
  background: var(--ui-bg-muted);
  box-shadow: 0 18px 40px -28px color-mix(in oklab, var(--gl-cyan, var(--ui-primary)) 45%, transparent);
}

.gl-hero-tablist {
  display: flex;
  gap: 0.125rem;
  padding: 0.375rem;
  border-bottom: 1px solid var(--gl-frame-border);
}

.gl-hero-tab {
  padding: 0.3125rem 0.75rem;
  border-radius: 0.4375rem;
  color: var(--ui-text-muted);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s, box-shadow 0.15s;
}

@media (hover: hover) {
  .gl-hero-tab:hover {
    color: var(--ui-text-highlighted);
  }
}

.gl-hero-tab[aria-selected="true"] {
  background: var(--ui-bg);
  color: var(--ui-text-highlighted);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--ui-primary) 35%, var(--ui-border)), 0 0 14px -6px color-mix(in oklab, var(--ui-primary) 70%, transparent);
}

/* The docs give code frames a block margin and a lit top edge; inside this frame the switch's border is the only line
   above the code. */
.gl-hero-tabs .gl-hero-panel > :deep(*) {
  margin-block: 0;
}

.gl-hero-panel :deep(:is(.ck, .ct)) {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.gl-hero-tabs .gl-hero-panel :deep(:is(.ck, .ct))::before {
  display: none;
}

/* The prompt's "text" label says nothing, so its bar goes and the copy button floats in the corner. */
.gl-hero-panel :deep(.ck-title) {
  display: none;
}

.gl-hero-panel > :deep(.ck) > .ck-bar {
  left: auto;
  border: 0;
  background: transparent;
}

.gl-hero-tabs .gl-hero-panel > :deep(div.ck) > pre {
  padding-top: 1rem;
  padding-right: 3rem;
}

/* The agent prompt is prose for copying, so it wraps instead of scrolling out of the box. */
.gl-hero-panel :deep(pre) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.glosslint-hero-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.75rem;
}

@media (prefers-reduced-motion: no-preference) {
  .gl-board::before {
    animation: gl-sign-breathe 4.5s ease-in-out 1.8s infinite alternate;
  }
}

@keyframes gl-sign-breathe {
  to {
    opacity: calc(var(--gl-hero-spill, 0.5) * 0.6);
  }
}
</style>
