<script setup lang="ts">
// `::glosslint-hero`: the headline and the pitch, a prompt for agents and an install line for people, and the ways in,
// beside the neon sign that says what glosslint does.
//
// The sign hangs on two nails. Each click on a nail turns it a little; a nail turned six times falls out. With one nail
// out the sign swings and hangs from the other, and with both out it falls to the bottom edge of the window, unplugged.

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

const nails: Record<Side, { x: number, y: number, slot: number }> = {
  left: { x: 32, y: 30, slot: 35 },
  right: { x: 728, y: 30, slot: -20 },
}
const sides: Side[] = ['left', 'right']
const other = (side: Side): Side => side === 'left' ? 'right' : 'left'

// Six turns of 7.5° pull a nail out: 45° in all, a little at a time.
const turnsToDrop = 6
const degreesPerTurn = 45 / turnsToDrop
// The angle the sign settles at on one nail. Its cable on the other side keeps it from swinging all the way.
const hangAngle = 15

const turns = reactive<Record<Side, number>>({ left: 0, right: 0 })
const out = reactive<Record<Side, boolean>>({ left: false, right: false })
const pivot = ref<Side>()
const angle = ref(0)
const fallen = ref(false)
const fallenLit = ref(true)
const fallenBox = ref({ left: 0, width: 0 })
const announcement = ref('')

const wall = ref<HTMLElement>()
const board = ref<HTMLElement>()
const fallenSign = ref<HTMLElement>()
const nailButtons = reactive<Partial<Record<Side, HTMLButtonElement>>>({})
const rehangButton = ref<HTMLButtonElement>()

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
  const start = onBoard([764, 284])
  const bend = onBoard([794, 290])
  return `M ${start.join(' ')} C ${bend.join(' ')}, 782 372, 782 420`
})

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
    announcement.value = 'Both nails are out. The sign fell to the bottom of the window and came unplugged.'
    rehangButton.value?.focus()
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
    { translate: '0 0', rotate: '0deg', scale: 1, easing: 'cubic-bezier(.3,.9,.6,1)' },
    { offset: 0.12, translate: `${drift * 0.1}px -6px`, rotate: '-30deg', scale: 1.25, easing: 'cubic-bezier(.5,0,.95,.6)' },
    { translate: `${drift}px ${distance}px`, rotate: `${drift > 0 ? 400 : -400}deg`, scale: 1.15 },
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

// Where the fallen sign lies: below where it hung, moved in so the board and its plug stay inside the window.
function placeFallen() {
  const rect = wall.value!.getBoundingClientRect()
  const width = rect.width * 760 / 800
  const reach = width * 860 / 760
  const left = Math.max(0, Math.min(rect.left, window.innerWidth - reach - 8))
  fallenBox.value = { left, width }
  return { rect, width, left }
}

async function fall() {
  cancelAnimationFrame(frame)
  const { rect, width, left } = placeFallen()
  fallenLit.value = true
  fallen.value = true
  await nextTick()
  const el = fallenSign.value
  if (!el) return
  // Pulled from the wall, the tubes go out.
  requestAnimationFrame(() => { fallenLit.value = false })

  if (prefersReducedMotion()) {
    el.animate([{ opacity: 0, translate: '0 -16px' }, { opacity: 1, translate: '0 0' }], { duration: 200, easing: 'ease-out' })
    return
  }

  // Start the fallen copy exactly where the hanging board is: the same box, turned the same way about its nail. The
  // copy turns about its bottom middle, so the turn about the nail becomes that turn plus a shift.
  const scale = width / 760
  const height = 400 * scale
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

async function rehang() {
  const finish = async () => {
    fallen.value = false
    pivot.value = undefined
    angle.value = 0
    for (const side of sides) {
      turns[side] = 0
      out[side] = false
    }
    announcement.value = 'The sign hangs on both nails again.'
    await nextTick()
    board.value?.animate([{ opacity: 0, translate: '0 -10px' }, { opacity: 1, translate: '0 0' }], { duration: prefersReducedMotion() ? 120 : 360, easing: 'ease-out' })
    nailButtons.left?.focus()
  }
  const el = fallenSign.value
  if (!el) return finish()
  el.animate([{ opacity: 1 }, { opacity: 0, translate: '0 24px' }], { duration: prefersReducedMotion() ? 120 : 260, easing: 'ease-in' }).onfinish = finish
}

const onResize = () => fallen.value && placeFallen()
onMounted(() => window.addEventListener('resize', onResize, { passive: true }))
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  cancelAnimationFrame(frame)
})
</script>

<template>
  <section class="glosslint-hero">
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

    <div ref="wall" :class="['glosslint-hero-sign', { 'is-hanging': pivot && !fallen, 'is-fallen': fallen }]">
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
        <GlosslintSign lit />
      </div>

      <!-- The cable into its plug, in front of the wall. It stays with the sign when the sign falls. -->
      <svg v-if="!fallen" class="gl-wall-layer" viewBox="0 0 800 480" aria-hidden="true">
        <g fill="none" stroke-linecap="round">
          <path :d="cable" stroke="#1c2433" stroke-width="5" />
          <path :d="cable" stroke="#fff" stroke-opacity="0.08" stroke-width="1" transform="translate(-1 -1)" />
        </g>
        <rect x="779" y="418" width="6" height="8" rx="1.5" fill="#1a202c" />
        <rect x="773.5" y="424" width="17" height="19" rx="3.5" fill="#1a202c" stroke="#05070c" stroke-opacity="0.6" />
        <rect x="775.5" y="425.5" width="13" height="1.6" rx="0.8" fill="#fff" fill-opacity="0.1" />
      </svg>

      <template v-for="side in sides" :key="side">
        <button
          v-if="!out[side] && !fallen"
          :ref="el => { nailButtons[side] = (el as HTMLButtonElement | null) ?? undefined }"
          type="button"
          :class="['gl-nail', `gl-nail-${side}`]"
          :style="{ left: `${nails[side].x / 8}%`, top: `${nails[side].y / 4.8}%` }"
          :aria-label="`Loosen the ${side} nail (${turnsToDrop - turns[side]} ${turnsToDrop - turns[side] === 1 ? 'turn' : 'turns'} left)`"
          @click="loosen(side)"
        >
          <svg viewBox="-18 -18 36 36" aria-hidden="true">
            <circle cx="0.6" cy="1.8" r="7.8" fill="#000" :opacity="0.4 + turns[side] * 0.05" :transform="`translate(${turns[side] * 0.25} ${turns[side] * 0.4})`" />
            <g :style="{ scale: 1 + turns[side] * 0.025 }" class="gl-nail-head">
              <circle r="7.5" class="gl-nail-metal" />
              <circle r="7.5" fill="none" stroke="#05070c" stroke-opacity="0.85" />
              <path d="M -4.6 0 L 4.6 0" class="gl-nail-slot" :style="{ rotate: `${nails[side].slot - turns[side] * degreesPerTurn}deg` }" />
            </g>
          </svg>
        </button>
      </template>

      <button v-if="fallen" ref="rehangButton" type="button" class="gl-rehang" @click="rehang">
        Hang the sign back up
      </button>

      <p class="gl-visually-hidden" aria-live="polite">
        {{ announcement }}
      </p>
    </div>

    <!-- The fallen sign lies on the bottom edge of the window, behind the page, so text and links stay on top. -->
    <div
      v-if="fallen"
      ref="fallenSign"
      class="gl-fallen"
      :style="{ left: `${fallenBox.left}px`, width: `${fallenBox.width}px` }"
    >
      <GlosslintSign :lit="fallenLit" unplugged />
    </div>

    <div
      v-for="nail in falling"
      :key="nail.id"
      :ref="el => startNailFall(el as Element | null, nail)"
      class="gl-falling-nail"
      :style="{ left: `${nail.x - nail.size / 2}px`, top: `${nail.y - nail.size / 2}px`, width: `${nail.size}px` }"
      aria-hidden="true"
    >
      <svg viewBox="-18 -18 36 36">
        <circle r="7.5" class="gl-nail-metal" />
        <circle r="7.5" fill="none" stroke="#05070c" stroke-opacity="0.85" />
        <path d="M -4.6 0 L 4.6 0" class="gl-nail-slot" :style="{ rotate: `${nail.slot}deg` }" />
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

/* On a phone the sign comes first and the copy follows. From 64rem they sit side by side, copy on the left. */
.glosslint-hero-sign {
  order: -1;
}

@media (min-width: 64rem) {
  .glosslint-hero {
    grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.1fr);
    gap: 4rem;
    padding-block: 4.5rem 4rem;
  }

  .glosslint-hero-sign {
    order: 0;
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

/* ---- Nails: a button each, over the board's top corners. The hit area is at least 28px. ---- */

.gl-nail {
  position: absolute;
  z-index: 1;
  width: 5%;
  aspect-ratio: 1;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  cursor: pointer;
  translate: -50% -50%;
  -webkit-tap-highlight-color: transparent;
}

.gl-nail::before {
  position: absolute;
  inset: min(0px, calc(50% - 14px));
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

.gl-nail-head {
  transition: scale 0.2s cubic-bezier(0.3, 1.6, 0.5, 1);
}

.gl-nail-slot {
  stroke: #0a0d14;
  stroke-width: 1.5;
  stroke-linecap: round;
  transition: rotate 0.22s cubic-bezier(0.3, 1.6, 0.5, 1);
}

/* Metal with a highlight at the top left. A gradient id would be shared by every nail, so this is a CSS gradient. */
.gl-nail-metal {
  fill: #2c3546;
  filter: drop-shadow(-1px -1px 0 rgb(255 255 255 / 12%));
}

@media (hover: hover) {
  .gl-nail:hover .gl-nail-metal {
    fill: #3a4558;
  }
}

.gl-falling-nail {
  position: fixed;
  z-index: 60;
  aspect-ratio: 1;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .gl-nail-head,
  .gl-nail-slot {
    transition: none;
  }
}

/* ---- After the fall ---- */

.gl-fallen {
  position: fixed;
  bottom: 0;
  z-index: -1;
  rotate: -1.2deg;
  transform-origin: 50% 100%;
  pointer-events: none;
}

.gl-fallen > :deep(svg) {
  filter: drop-shadow(0 -2px 10px rgb(0 0 0 / 35%));
}

/* On the light page the dark board sits under dark text, so it lies there faded. */
:global(.light .gl-fallen > svg) {
  opacity: 0.25;
}

.gl-rehang {
  position: absolute;
  top: 40%;
  left: 47.5%;
  padding: 0.375rem 0.75rem;
  border: 1px dashed var(--ui-border-accented);
  border-radius: 999px;
  background: color-mix(in oklab, var(--ui-bg) 70%, transparent);
  color: var(--ui-text-muted);
  font-size: 0.8125rem;
  cursor: pointer;
  translate: -50% -50%;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
}

@media (hover: hover) {
  .gl-rehang:hover {
    border-color: var(--ui-primary);
    color: var(--ui-text-highlighted);
  }
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

.gl-hero-tabs {
  max-width: 36rem;
  margin-top: 1.75rem;
}

.gl-hero-tablist {
  display: inline-flex;
  gap: 0.125rem;
  padding: 0.1875rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.625rem;
  background: var(--ui-bg-muted);
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

.gl-hero-panel {
  margin-top: 0.75rem;
}

.gl-hero-panel > :deep(*) {
  margin-block: 0;
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
