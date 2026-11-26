<script setup lang="ts">
// `::glosslint-hero`: the headline, the pitch and the ways in, beside the neon sign that says what glosslint does.
// The sign is drawn here instead of as the README's banner.svg so each letter is its own tube and can flicker on its own.

type Tube = 'cyan' | 'mint'

interface Letter {
  paths: string[]
  tube: Tube
  // A tube with a worn electrode: `stutter` drops out twice, `buzz` catches twice in a blink, `brownout` dims once.
  flicker?: 'stutter' | 'buzz' | 'brownout'
}

// The README banner's monoline glyphs, in the same coordinates.
const letters: Letter[] = [
  { tube: 'cyan', flicker: 'brownout', paths: ['M 68 42 A 34 39 0 1 0 0 42 A 34 39 0 1 0 68 42', 'M 68 4 L 68 86 C 68 118, 42 126, 12 114'] },
  { tube: 'cyan', paths: ['M 92 -46 L 92 66 Q 92 82, 108 82'] },
  { tube: 'cyan', paths: ['M 194 42 A 34 39 0 1 0 126 42 A 34 39 0 1 0 194 42'] },
  { tube: 'cyan', paths: ['M 264 14 C 258 1, 222 0, 219 20 C 216 36, 232 39, 244 42 C 258 45, 271 50, 268 65 C 265 83, 226 85, 217 70'] },
  { tube: 'cyan', flicker: 'stutter', paths: ['M 338 14 C 332 1, 296 0, 293 20 C 290 36, 306 39, 318 42 C 332 45, 345 50, 342 65 C 339 83, 300 85, 291 70'] },
  { tube: 'mint', paths: ['M 372 -46 L 372 66 Q 372 82, 388 82'] },
  { tube: 'mint', flicker: 'buzz', paths: ['M 412 4 L 412 66 Q 412 82, 428 82', 'M 412 -27 L 412 -25'] },
  { tube: 'mint', paths: ['M 450 4 L 450 82', 'M 450 32 C 450 -7, 506 -7, 506 32 L 506 82'] },
  { tube: 'mint', paths: ['M 542 -32 L 542 64 Q 542 82, 562 82', 'M 526 6 L 564 6'] },
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

// Where a tube turns back through the face to its electrode.
const electrodes = [[12, 114], [92, -46], [372, -46], [542, -32], [526, 6]]

// The clear posts that hold the tubes off the board.
const standoffs = [[68, 60], [92, 12], [160, 81], [244, 42], [318, 42], [372, 12], [506, 52], [542, 34]]

const screws = [[30, 30, 35], [730, 30, -20], [30, 370, 70], [730, 370, 10]]
</script>

<template>
  <section class="glosslint-hero">
    <div class="glosslint-hero-copy">
      <slot />
      <div class="glosslint-hero-links">
        <UButton to="/guide/installation" color="primary" size="lg" trailing-icon="i-lucide-arrow-right">
          Get started
        </UButton>
        <UButton to="https://github.com/onmax/glosslint" target="_blank" color="neutral" variant="outline" size="lg" icon="i-simple-icons-github">
          GitHub
        </UButton>
      </div>
    </div>

    <div class="glosslint-hero-sign">
      <svg viewBox="0 0 760 400" width="760" height="400" role="img" aria-label="A neon sign reading glosslint, with e-bike rack crossed out and corrected to eBike dock" class="gl-sign">
        <defs>
          <linearGradient id="gl-sign-board" x1="0" y1="0" x2="0" y2="400" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#101624" />
            <stop offset="0.55" stop-color="#0a0e18" />
            <stop offset="1" stop-color="#06080f" />
          </linearGradient>
          <linearGradient id="gl-sign-edge" x1="0" y1="0" x2="0" y2="400" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#fff" stop-opacity="0.16" />
            <stop offset="0.3" stop-color="#fff" stop-opacity="0.04" />
            <stop offset="1" stop-color="#fff" stop-opacity="0.02" />
          </linearGradient>
          <radialGradient id="gl-sign-pool-cyan" cx="250" cy="150" r="260" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#22e8ff" stop-opacity="0.2" />
            <stop offset="0.5" stop-color="#0ea5e9" stop-opacity="0.07" />
            <stop offset="1" stop-color="#0ea5e9" stop-opacity="0" />
          </radialGradient>
          <radialGradient id="gl-sign-pool-mint" cx="540" cy="150" r="240" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#2ef5a3" stop-opacity="0.17" />
            <stop offset="0.5" stop-color="#10b981" stop-opacity="0.06" />
            <stop offset="1" stop-color="#10b981" stop-opacity="0" />
          </radialGradient>
          <radialGradient id="gl-sign-pool-tray" cx="380" cy="320" r="260" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#38f9b8" stop-opacity="0.08" />
            <stop offset="1" stop-color="#22e8ff" stop-opacity="0" />
          </radialGradient>
          <radialGradient id="gl-sign-screw" cx="0.38" cy="0.32" r="0.75">
            <stop offset="0" stop-color="#5b6678" />
            <stop offset="0.55" stop-color="#2a3343" />
            <stop offset="1" stop-color="#121822" />
          </radialGradient>
          <linearGradient id="gl-sign-tray-border" x1="100" y1="0" x2="660" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#ff4770" stop-opacity="0.45" />
            <stop offset="0.45" stop-color="#283650" stop-opacity="0.6" />
            <stop offset="0.55" stop-color="#283650" stop-opacity="0.6" />
            <stop offset="1" stop-color="#34f5a8" stop-opacity="0.55" />
          </linearGradient>
          <linearGradient id="gl-sign-arrow" x1="358" y1="0" x2="402" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#ff6b8d" />
            <stop offset="0.48" stop-color="#6eedff" />
            <stop offset="1" stop-color="#45ffd0" />
          </linearGradient>
          <linearGradient id="gl-sign-cable" x1="0" y1="396" x2="0" y2="470" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#1c2433" />
            <stop offset="1" stop-color="#1c2433" stop-opacity="0" />
          </linearGradient>
          <clipPath id="gl-sign-face">
            <rect width="760" height="400" rx="16" />
          </clipPath>
          <filter id="gl-sign-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <filter id="gl-sign-halo" filterUnits="userSpaceOnUse" x="-120" y="-160" width="900" height="460">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id="gl-sign-bloom" filterUnits="userSpaceOnUse" x="-120" y="-160" width="900" height="460">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="gl-sign-soft" filterUnits="userSpaceOnUse" x="0" y="200" width="760" height="200">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b2" />
            <feMerge>
              <feMergeNode in="b1" />
              <feMergeNode in="b2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="gl-sign-shadow" filterUnits="userSpaceOnUse" x="-120" y="-160" width="900" height="460">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        <!-- The cable to the transformer, leaving the board at the bottom. -->
        <path d="M 700 396 C 702 428, 724 432, 728 470" fill="none" stroke="url(#gl-sign-cable)" stroke-width="5" stroke-linecap="round" />

        <!-- The backing board: a dark painted panel with a fine grain, a light top edge, and an inset frame. -->
        <g clip-path="url(#gl-sign-face)">
          <rect width="760" height="400" fill="url(#gl-sign-board)" />
          <rect width="760" height="400" filter="url(#gl-sign-grain)" opacity="0.07" />
          <rect width="760" height="400" fill="url(#gl-sign-pool-cyan)" />
          <rect width="760" height="400" fill="url(#gl-sign-pool-mint)" />
          <rect width="760" height="400" fill="url(#gl-sign-pool-tray)" />
        </g>
        <rect x="0.5" y="0.5" width="759" height="399" rx="15.5" fill="none" stroke="url(#gl-sign-edge)" />
        <rect x="14" y="14" width="732" height="372" rx="9" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="1.5" />
        <rect x="15.5" y="15.5" width="729" height="369" rx="8" fill="none" stroke="#fff" stroke-opacity="0.035" />
        <rect x="692" y="389" width="16" height="11" rx="3" fill="#161d2a" stroke="#28324a" />

        <g v-for="[x, y, angle] in screws" :key="`${x}-${y}`" :transform="`translate(${x} ${y})`">
          <circle r="6" fill="url(#gl-sign-screw)" stroke="#05070c" stroke-opacity="0.8" />
          <path d="M -3.6 0 L 3.6 0" stroke="#0a0d14" stroke-width="1.4" stroke-linecap="round" :transform="`rotate(${angle})`" />
        </g>

        <!-- The wordmark, centered over the tray. -->
        <g transform="translate(98 116)" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <!-- Shadows of the tubes on the board. -->
          <g transform="translate(0 8)" filter="url(#gl-sign-shadow)" opacity="0.85" stroke="#010205" stroke-width="13">
            <template v-for="(letter, i) in letters" :key="i">
              <path v-for="d in letter.paths" :key="d" :d="d" />
            </template>
          </g>

          <g v-for="[x, y] in standoffs" :key="`${x}-${y}`" :transform="`translate(${x} ${y})`">
            <circle cx="1.5" cy="4" r="9" fill="#010205" opacity="0.6" />
            <circle r="8.5" fill="#182030" stroke="#334058" />
            <circle r="5" fill="#0e131d" />
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

          <!-- Lit: the halo, the gas, its brighter middle, and the core. A worn tube flickers on its own. -->
          <g class="gl-sign-lit">
            <g v-for="(letter, i) in letters" :key="i" :class="letter.flicker && `gl-sign-${letter.flicker}`">
              <g filter="url(#gl-sign-halo)" opacity="0.75">
                <path v-for="d in letter.paths" :key="d" :d="d" :stroke="glass[letter.tube].halo" stroke-width="16" />
              </g>
              <g filter="url(#gl-sign-bloom)">
                <path v-for="d in letter.paths" :key="d" :d="d" :stroke="glass[letter.tube].gas" stroke-width="10" />
              </g>
              <path v-for="d in letter.paths" :key="d" :d="d" :stroke="glass[letter.tube].middle" stroke-width="5.5" opacity="0.85" />
              <path v-for="d in letter.paths" :key="d" :d="d" :stroke="glass[letter.tube].core" stroke-width="2.4" />
            </g>
          </g>

          <!-- The painted ends where a tube turns into the board. -->
          <g v-for="[x, y] in electrodes" :key="`${x}-${y}`" :transform="`translate(${x} ${y})`">
            <circle r="6.5" fill="#0d121b" stroke="#2c3649" />
            <circle r="2.2" fill="#3a465c" />
          </g>
        </g>

        <!-- The correction tray: e-bike rack, struck, becomes eBike dock. -->
        <rect x="100" y="292" width="560" height="56" rx="28" fill="#05080f" fill-opacity="0.85" stroke="url(#gl-sign-tray-border)" stroke-width="1.5" />
        <g class="gl-sign-wrong">
          <g opacity="0.72" fill="none" stroke-linecap="round">
            <path d="M 128 314 L 140 326 M 140 314 L 128 326" stroke="#ff4770" stroke-width="3" filter="url(#gl-sign-soft)" />
            <path d="M 128 314 L 140 326 M 140 314 L 128 326" stroke="#ffb3c5" stroke-width="1.2" />
          </g>
          <text x="250" y="327" text-anchor="middle" class="gl-sign-mono" fill="#ff4770" filter="url(#gl-sign-soft)" opacity="0.46">e-bike rack</text>
          <text x="250" y="327" text-anchor="middle" class="gl-sign-mono" fill="#ffa0b6" opacity="0.84">e-bike rack</text>
          <line x1="178" y1="324" x2="322" y2="315" stroke="#ff3562" stroke-width="2.8" stroke-linecap="round" filter="url(#gl-sign-soft)" opacity="0.82" />
          <line x1="178" y1="324" x2="322" y2="315" stroke="#ff7a98" stroke-width="1.5" stroke-linecap="round" opacity="0.9" />
        </g>
        <g fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 358 320 L 400 320 M 389 310 L 401 320 L 389 330" stroke="url(#gl-sign-arrow)" stroke-width="4" filter="url(#gl-sign-soft)" opacity="0.85" />
          <path d="M 358 320 L 400 320 M 389 310 L 401 320 L 389 330" stroke="#e9fff8" stroke-width="1.7" />
        </g>
        <text x="510" y="327" text-anchor="middle" class="gl-sign-mono" fill="#20f0a0" filter="url(#gl-sign-soft)" opacity="0.85">eBike dock</text>
        <text x="510" y="327" text-anchor="middle" class="gl-sign-mono" fill="#f0fff9">eBike dock</text>
        <g fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 612 320 L 618 326 L 630 313" stroke="#2ef5a3" stroke-width="3.4" filter="url(#gl-sign-soft)" />
          <path d="M 612 320 L 618 326 L 630 313" stroke="#ecfff7" stroke-width="1.5" />
        </g>
      </svg>
    </div>
  </section>
</template>

<style scoped>
.glosslint-hero {
  display: grid;
  gap: 2.5rem;
  align-items: center;
  width: 100%;
  max-width: 76rem;
  margin-inline: auto;
  padding: 2.5rem 1rem 3.5rem;
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
    padding-block: 4.5rem 5rem;
  }

  .glosslint-hero-sign {
    order: 0;
  }
}

/* The sign hangs on the wall: a soft shadow under the board, and the tubes' light on the wall around it. */
.glosslint-hero-sign {
  position: relative;
  isolation: isolate;
  margin-bottom: 1.25rem;
  border-radius: 2.1% / 4%;
  box-shadow: 0 1px 2px rgb(0 0 0 / 30%), 0 18px 40px -16px rgb(0 0 0 / 55%);
  aspect-ratio: 760 / 400;
}

.glosslint-hero-sign::before {
  position: absolute;
  inset: -8% -6% -14%;
  z-index: -1;
  border-radius: 50%;
  background:
    radial-gradient(closest-side at 32% 40%, rgb(34 232 255 / 55%), transparent),
    radial-gradient(closest-side at 70% 40%, rgb(46 245 163 / 45%), transparent),
    radial-gradient(closest-side at 32% 88%, rgb(255 71 112 / 22%), transparent);
  filter: blur(48px);
  opacity: var(--gl-hero-spill, 0.5);
  content: "";
}

/* `:global(.light) .a` compiles to `.light` alone, so the whole selector goes inside `:global()`. */
:global(.light .glosslint-hero-sign) {
  --gl-hero-spill: 0.32;
  box-shadow: 0 1px 2px rgb(15 23 42 / 25%), 0 22px 44px -18px rgb(15 23 42 / 55%);
}

.gl-sign {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.gl-sign-mono {
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 600;
}

.glosslint-hero-copy :deep(h1) {
  max-width: 20ch;
  color: var(--ui-text-highlighted);
  font-size: clamp(2.25rem, 4.5vw, 3.25rem);
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.03em;
  text-wrap: balance;
}

.glosslint-hero-copy :deep(p) {
  max-width: 60ch;
  margin-top: 1.25rem;
  color: var(--ui-text-muted);
  font-size: 1.125rem;
  text-wrap: pretty;
}

.glosslint-hero-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 2rem;
}

/*
 * The tubes catch once on load, then a few worn ones flicker on their own clocks, so the pattern never lines up.
 * Every flicker is at most two dips about 0.15 to 0.5 seconds apart, under the three flashes a second that WCAG 2.3.1
 * allows, on one letter at a time. Opacity only. Nothing moves under `prefers-reduced-motion: reduce`.
 */
@media (prefers-reduced-motion: no-preference) {
  .gl-sign-lit {
    animation: gl-sign-ignite 1.6s linear 0.2s both;
  }

  .gl-sign-stutter {
    animation: gl-sign-stutter 9.7s linear 2.2s infinite;
  }

  .gl-sign-buzz {
    animation: gl-sign-buzz 13.3s linear 4.1s infinite;
  }

  .gl-sign-brownout {
    animation: gl-sign-brownout 17.9s linear 1s infinite;
  }

  .gl-sign-wrong {
    animation: gl-sign-wrong 7s ease-in-out infinite;
  }

  .glosslint-hero-sign::before {
    animation: gl-sign-breathe 4.5s ease-in-out 1.8s infinite alternate;
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

@keyframes gl-sign-wrong {
  0%, 82%, 86%, 91%, 100% { opacity: 1; }
  84% { opacity: 0.54; }
  88% { opacity: 0.74; }
}

@keyframes gl-sign-breathe {
  to {
    opacity: calc(var(--gl-hero-spill, 0.5) * 0.6);
  }
}
</style>
