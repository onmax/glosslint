<script setup lang="ts">
// The neon sign of the hero, on its own so the hero can draw it twice: hanging on the wall, and lying on the floor of
// the window after both nails are pulled. Board units: the backplate is 760 × 400.

const props = defineProps<{
  // Off, the glass stays and the gas goes dark.
  lit?: boolean
  // Mounted dark the moment it lost power, as the fallen copy is: it sputters out instead of starting dark.
  wasLit?: boolean
}>()

// The gas sputters out only when the power goes, not when a sign starts dark or stays dark.
const dying = ref(!props.lit && props.wasLit)
watch(() => props.lit, (lit, was) => { dying.value = !lit && !!was })

type Tube = 'cyan' | 'mint'

interface Letter {
  paths: string[]
  // The gas stops short of a tube end, where the glass is painted out and turns back through the board.
  lit?: string[]
  tube: Tube
  // A tube with a worn electrode: `stutter` drops out twice, `buzz` catches twice in a blink, `brownout` dims once.
  flicker?: 'stutter' | 'buzz' | 'brownout'
}

// The README banner's monoline glyphs, in the same coordinates.
const letters: Letter[] = [
  { tube: 'cyan', flicker: 'brownout', paths: ['M 68 42 A 34 39 0 1 0 0 42 A 34 39 0 1 0 68 42', 'M 68 4 L 68 86 C 68 118, 42 126, 12 114'], lit: ['M 68 42 A 34 39 0 1 0 0 42 A 34 39 0 1 0 68 42', 'M 68 4 L 68 86 C 68 114.16, 47.87 123.73, 22.59 117.45'] },
  { tube: 'cyan', paths: ['M 92 -46 L 92 66 Q 92 82, 108 82'], lit: ['M 92 -35 L 92 66 Q 92 82, 108 82'] },
  { tube: 'cyan', paths: ['M 194 42 A 34 39 0 1 0 126 42 A 34 39 0 1 0 194 42'] },
  { tube: 'cyan', paths: ['M 264 14 C 258 1, 222 0, 219 20 C 216 36, 232 39, 244 42 C 258 45, 271 50, 268 65 C 265 83, 226 85, 217 70'] },
  { tube: 'cyan', flicker: 'stutter', paths: ['M 338 14 C 332 1, 296 0, 293 20 C 290 36, 306 39, 318 42 C 332 45, 345 50, 342 65 C 339 83, 300 85, 291 70'] },
  { tube: 'mint', paths: ['M 372 -46 L 372 66 Q 372 82, 388 82'], lit: ['M 372 -35 L 372 66 Q 372 82, 388 82'] },
  { tube: 'mint', flicker: 'buzz', paths: ['M 412 4 L 412 66 Q 412 82, 428 82', 'M 412 -27 L 412 -25'] },
  { tube: 'mint', paths: ['M 450 4 L 450 82', 'M 450 32 C 450 -7, 506 -7, 506 32 L 506 82'] },
  { tube: 'mint', paths: ['M 542 -32 L 542 64 Q 542 82, 562 82', 'M 526 6 L 564 6'], lit: ['M 542 -21 L 542 64 Q 542 82, 562 82', 'M 537 6 L 564 6'] },
]

// Glass from the outside in: the tinted glass wall, the lit gas, its brighter middle, and the hot core.
const glass: Record<Tube, { wall: string, halo: string, gas: string, middle: string, core: string }> = {
  cyan: { wall: '#0c3240', halo: '#15dcff', gas: '#2ee6ff', middle: '#9cf4ff', core: '#f2feff' },
  mint: { wall: '#0b3a2a', halo: '#1ff098', gas: '#3af5a8', middle: '#a8fbd7', core: '#f2fff9' },
}

// The painted-out tube that carries the gas from one letter to the next behind the sign face.
const blockouts = [
  'M 108 82 Q 124 82, 131 63',
  'M 194 42 Q 200 64, 217 70',
  'M 342 65 Q 352 82, 372 66',
  'M 428 82 L 450 82',
  'M 506 82 Q 522 84, 542 70',
]

// Where a tube ends, past the gas: glass painted out the color of the board, turning back through a small hole to the
// electrode housing behind. Each path runs from the end of the gas to the hole.
const tubeEnds = [
  { d: 'M 22.59 117.45 Q 17.6 116.2, 12 114', hole: [12, 114] },
  { d: 'M 92 -35 L 92 -46', hole: [92, -46] },
  { d: 'M 372 -35 L 372 -46', hole: [372, -46] },
  { d: 'M 542 -21 L 542 -32', hole: [542, -32] },
  { d: 'M 537 6 L 526 6', hole: [526, 6] },
]

// The clear posts that hold the tubes off the board.
const standoffs = [[68, 60], [92, 12], [160, 81], [244, 42], [318, 42], [372, 12], [506, 52], [542, 34]]

// The holes the two nails go through, as the hero places them.
const nailHoles = [[32, 30], [728, 30]]

// One sign can be on the page twice, so its gradients and filters need their own ids.
const uid = useId()
const id = (name: string) => `gl-${uid}-${name}`
const url = (name: string) => `url(#${id(name)})`

const label = 'A neon sign reading glosslint. Under it, e-bike rack is a dark tube with a red line through it, and eBike dock is lit in green.'
</script>

<template>
  <svg viewBox="0 0 760 400" width="760" height="400" role="img" :aria-label="label" :class="['gl-sign', { 'is-lit': props.lit, 'is-dying': dying }]">
    <defs>
      <linearGradient :id="id('board')" x1="0" y1="0" x2="0" y2="400" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#101624" />
        <stop offset="0.55" stop-color="#0a0e18" />
        <stop offset="1" stop-color="#06080f" />
      </linearGradient>
      <linearGradient :id="id('edge')" x1="0" y1="0" x2="0" y2="400" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#fff" stop-opacity="0.16" />
        <stop offset="0.3" stop-color="#fff" stop-opacity="0.04" />
        <stop offset="1" stop-color="#fff" stop-opacity="0.02" />
      </linearGradient>
      <radialGradient :id="id('pool-cyan')" cx="250" cy="140" r="260" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#22e8ff" stop-opacity="0.2" />
        <stop offset="0.5" stop-color="#0ea5e9" stop-opacity="0.07" />
        <stop offset="1" stop-color="#0ea5e9" stop-opacity="0" />
      </radialGradient>
      <radialGradient :id="id('pool-mint')" cx="540" cy="150" r="240" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#2ef5a3" stop-opacity="0.17" />
        <stop offset="0.5" stop-color="#10b981" stop-opacity="0.06" />
        <stop offset="1" stop-color="#10b981" stop-opacity="0" />
      </radialGradient>
      <radialGradient :id="id('pool-line')" cx="420" cy="322" r="250" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#38f9b8" stop-opacity="0.07" />
        <stop offset="1" stop-color="#22e8ff" stop-opacity="0" />
      </radialGradient>
      <linearGradient :id="id('arrow')" x1="368" y1="0" x2="404" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#2ee6ff" />
        <stop offset="1" stop-color="#3af5a8" />
      </linearGradient>
      <clipPath :id="id('face')">
        <rect width="760" height="400" rx="16" />
      </clipPath>
      <filter :id="id('grain')" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <filter :id="id('halo')" filterUnits="userSpaceOnUse" x="-120" y="-160" width="900" height="460">
        <feGaussianBlur stdDeviation="9" />
      </filter>
      <filter :id="id('bloom')" filterUnits="userSpaceOnUse" x="-120" y="-160" width="900" height="460">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter :id="id('soft')" filterUnits="userSpaceOnUse" x="0" y="240" width="760" height="160">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b1" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="b2" />
        <feMerge>
          <feMergeNode in="b1" />
          <feMergeNode in="b2" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter :id="id('shadow')" filterUnits="userSpaceOnUse" x="-120" y="-160" width="900" height="460">
        <feGaussianBlur stdDeviation="4" />
      </filter>
    </defs>

    <!-- The backing board: a dark painted panel with a fine grain, a light top edge, and an inset frame. -->
    <g :clip-path="url('face')">
      <rect width="760" height="400" :fill="url('board')" />
      <rect width="760" height="400" :filter="url('grain')" opacity="0.07" />
      <g class="gl-sign-pools">
        <rect width="760" height="400" :fill="url('pool-cyan')" />
        <rect width="760" height="400" :fill="url('pool-mint')" />
        <rect width="760" height="400" :fill="url('pool-line')" />
      </g>
    </g>
    <rect x="0.5" y="0.5" width="759" height="399" rx="15.5" fill="none" :stroke="url('edge')" />
    <rect x="14" y="14" width="732" height="372" rx="9" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="1.5" />
    <rect x="15.5" y="15.5" width="729" height="369" rx="8" fill="none" stroke="#fff" stroke-opacity="0.035" />

    <!-- The nail holes, which show once a nail is out. -->
    <g v-for="[x, y] in nailHoles" :key="`${x}-${y}`" :transform="`translate(${x} ${y})`">
      <circle r="2.6" fill="#020306" />
      <circle r="3.4" fill="none" stroke="#fff" stroke-opacity="0.06" />
    </g>

    <!-- The cable leaves the board on its right edge through a rubber grommet. -->
    <rect x="752" y="277" width="13" height="14" rx="3" fill="#161c27" stroke="#05070c" stroke-opacity="0.8" />
    <rect x="754" y="279" width="9" height="2" rx="1" fill="#fff" fill-opacity="0.07" />

    <!-- The wordmark. -->
    <g transform="translate(98 104)" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <!-- Shadows of the tubes on the board. -->
      <g transform="translate(0 8)" :filter="url('shadow')" opacity="0.85" stroke="#010205" stroke-width="13">
        <template v-for="(letter, i) in letters" :key="i">
          <path v-for="d in letter.paths" :key="d" :d="d" />
        </template>
      </g>

      <!-- Clear acrylic posts: a faint rim and a contact shadow, mostly hidden under the glass. -->
      <g v-for="[x, y] in standoffs" :key="`${x}-${y}`" :transform="`translate(${x} ${y})`">
        <ellipse cx="1" cy="3" rx="8" ry="7" fill="#000" opacity="0.35" />
        <circle r="8" fill="#9fb4d0" fill-opacity="0.05" stroke="#c8d6ea" stroke-opacity="0.16" stroke-width="0.8" />
        <path d="M -5.6 -5.6 A 8 8 0 0 1 3 -7.4" stroke="#fff" stroke-opacity="0.22" stroke-width="0.9" />
      </g>

      <g stroke="#121926" stroke-width="8">
        <path v-for="d in blockouts" :key="d" :d="d" />
      </g>
      <g stroke="#2a3447" stroke-width="1.2" transform="translate(-1 -2)">
        <path v-for="d in blockouts" :key="d" :d="d" />
      </g>

      <!-- Unlit, each tube is still tinted glass. -->
      <template v-for="(letter, i) in letters" :key="i">
        <path v-for="d in letter.paths" :key="d" :d="d" :stroke="glass[letter.tube].wall" stroke-width="13" />
      </template>

      <!-- Tube ends: painted glass a shade off the board, and the dark hole where the tube turns back. -->
      <g v-for="end in tubeEnds" :key="end.d">
        <path :d="end.d" stroke="#121a28" stroke-width="12" />
        <path :d="end.d" stroke="#8fa3c0" stroke-opacity="0.14" stroke-width="1" transform="translate(-2.4 -1.6)" />
        <circle :cx="end.hole[0]" :cy="end.hole[1]" r="3.2" fill="#03050a" opacity="0.55" />
      </g>

      <!-- Lit: the halo, the gas, its brighter middle, and the core. A worn tube flickers on its own. -->
      <g class="gl-sign-lit">
        <g v-for="(letter, i) in letters" :key="i" :class="letter.flicker && `gl-sign-${letter.flicker}`">
          <g :filter="url('halo')" opacity="0.75">
            <path v-for="d in letter.lit ?? letter.paths" :key="d" :d="d" :stroke="glass[letter.tube].halo" stroke-width="16" />
          </g>
          <g :filter="url('bloom')">
            <path v-for="d in letter.lit ?? letter.paths" :key="d" :d="d" :stroke="glass[letter.tube].gas" stroke-width="10" />
          </g>
          <path v-for="d in letter.lit ?? letter.paths" :key="d" :d="d" :stroke="glass[letter.tube].middle" stroke-width="5.5" opacity="0.85" />
          <path v-for="d in letter.lit ?? letter.paths" :key="d" :d="d" :stroke="glass[letter.tube].core" stroke-width="2.4" />
        </g>
      </g>

    </g>

    <!-- The second line, in smaller tubes: the wrong words are a dead coral tube with a lit strike, the right ones glow. -->
    <g class="gl-sign-wrong">
      <text x="236" y="334" text-anchor="middle" class="gl-sign-mono" fill="#4a2633" stroke="#86465a" stroke-opacity="0.55" stroke-width="0.8">e-bike rack</text>
      <text x="236" y="334" text-anchor="middle" class="gl-sign-mono gl-sign-sputter" fill="#ff4770" :filter="url('soft')" opacity="0">e-bike rack</text>
    </g>
    <g class="gl-sign-lit" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M 156 330 L 316 314" stroke="#ff3562" stroke-width="4.4" :filter="url('soft')" opacity="0.8" />
      <path d="M 156 330 L 316 314" stroke="#ffd0db" stroke-width="1.6" />
      <path d="M 368 322 L 402 322 M 392 313 L 403 322 L 392 331" :stroke="url('arrow')" stroke-width="4.2" :filter="url('soft')" opacity="0.8" />
      <path d="M 368 322 L 402 322 M 392 313 L 403 322 L 392 331" stroke="#eafffb" stroke-width="1.6" />
    </g>
    <g class="gl-sign-unlit" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M 156 330 L 316 314" stroke="#3a2029" stroke-width="3.6" />
      <path d="M 368 322 L 402 322 M 392 313 L 403 322 L 392 331" stroke="#0c3240" stroke-width="3.6" />
    </g>
    <text x="518" y="334" text-anchor="middle" class="gl-sign-mono" fill="#0b3a2a">eBike dock</text>
    <g class="gl-sign-lit">
      <text x="518" y="334" text-anchor="middle" class="gl-sign-mono" fill="#20f0a0" :filter="url('soft')" opacity="0.85">eBike dock</text>
      <text x="518" y="334" text-anchor="middle" class="gl-sign-mono" fill="#effff8">eBike dock</text>
    </g>

  </svg>
</template>

<style scoped>
.gl-sign {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.gl-sign-mono {
  font-family: var(--font-mono);
  font-size: 24px;
  font-weight: 600;
}

/* Lit or dark: the gas, the light it throws on the board, and the strike go together. */
.gl-sign-lit,
.gl-sign-pools {
  opacity: 0;
  transition: opacity 0.2s;
}

.is-lit :is(.gl-sign-lit, .gl-sign-pools) {
  opacity: 1;
}

.gl-sign-unlit {
  opacity: 1;
}

.is-lit .gl-sign-unlit {
  opacity: 0;
}

/*
 * The tubes catch once on load, then a few worn ones flicker on their own clocks, so the pattern never lines up.
 * Every flicker is at most two dips about 0.15 to 0.5 seconds apart, under the three flashes a second that WCAG 2.3.1
 * allows, on one letter at a time. Opacity only. Nothing flickers under `prefers-reduced-motion: reduce`.
 */
@media (prefers-reduced-motion: no-preference) {
  .is-lit .gl-sign-lit {
    animation: gl-sign-ignite 1.6s linear 0.2s both;
  }

  /* Switched off, the gas sputters out. */
  .gl-sign.is-dying .gl-sign-lit {
    animation: gl-sign-die 1.2s linear both;
  }

  .is-lit .gl-sign-stutter {
    animation: gl-sign-stutter 9.7s linear 2.2s infinite;
  }

  .is-lit .gl-sign-buzz {
    animation: gl-sign-buzz 13.3s linear 4.1s infinite;
  }

  .is-lit .gl-sign-brownout {
    animation: gl-sign-brownout 17.9s linear 1s infinite;
  }

  /* Now and then the dead tube tries to catch, and doesn't. */
  .is-lit .gl-sign-sputter {
    animation: gl-sign-sputter 11s linear 5s infinite;
  }
}

/* Under reduced motion the gas is on or off at once. */
@media (prefers-reduced-motion: reduce) {
  .gl-sign-lit,
  .gl-sign-pools {
    transition: none;
  }
}

@keyframes gl-sign-ignite {
  0% { opacity: 0.1; }
  10% { opacity: 1; }
  16% { opacity: 0.3; }
  26%, 46% { opacity: 1; }
  52% { opacity: 0.6; }
  58%, 100% { opacity: 1; }
}

/* Out for about a tenth of a second, back, then half-lit for another tenth half a second later. */
@keyframes gl-sign-stutter {
  0%, 20% { opacity: 1; }
  20.3%, 21.4% { opacity: 0.12; }
  21.7%, 26.6% { opacity: 1; }
  26.9%, 27.8% { opacity: 0.45; }
  28.1%, 100% { opacity: 1; }
}

/* Two quick catches, 0.15 seconds apart. */
@keyframes gl-sign-buzz {
  0%, 58% { opacity: 1; }
  58.2%, 58.8% { opacity: 0.2; }
  59%, 59.4% { opacity: 0.9; }
  59.6%, 60.2% { opacity: 0.25; }
  60.5%, 100% { opacity: 1; }
}

/* The voltage sags for a moment. */
@keyframes gl-sign-brownout {
  0%, 80% { opacity: 1; }
  81%, 84% { opacity: 0.55; }
  85%, 100% { opacity: 1; }
}

/* Three last catches, under three a second, each weaker than the one before. */
@keyframes gl-sign-die {
  0%, 6% { opacity: 1; }
  10%, 24% { opacity: 0.05; }
  28%, 34% { opacity: 1; }
  38%, 56% { opacity: 0.05; }
  60%, 64% { opacity: 0.6; }
  68%, 100% { opacity: 0; }
}

@keyframes gl-sign-sputter {
  0%, 84%, 85.6%, 87.4%, 100% { opacity: 0; }
  84.6% { opacity: 0.32; }
  86.6% { opacity: 0.14; }
}
</style>
