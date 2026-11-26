<script setup lang="ts">
// `::glosslint-hero`: the home page's headline and pitch, then the ways in.
</script>

<template>
  <section class="glosslint-hero">
    <div class="glosslint-hero-sign">
      <img src="/banner.svg" alt="" class="glosslint-hero-banner" width="1280" height="400">
    </div>
    <slot />
    <div class="glosslint-hero-links">
      <UButton to="/guide/installation" color="primary" size="lg" trailing-icon="i-lucide-arrow-right">
        Get started
      </UButton>
      <UButton to="https://github.com/onmax/glosslint" target="_blank" color="neutral" variant="outline" size="lg" icon="i-simple-icons-github">
        GitHub
      </UButton>
    </div>
  </section>
</template>

<style scoped>
.glosslint-hero {
  width: 100%;
  max-width: var(--vh-content-width);
  margin-inline: auto;
  padding: 3rem 1rem 2.5rem;
}

@media (min-width: 40rem) {
  .glosslint-hero {
    padding-inline: 1.5rem;
  }
}

/* The sign lights the wall around it: a blurred copy of its colors sits behind the banner and breathes. */
.glosslint-hero-sign {
  position: relative;
  isolation: isolate;
  margin-bottom: 2.5rem;
}

.glosslint-hero-sign::before {
  position: absolute;
  inset: 4% -3% -12%;
  z-index: -1;
  border-radius: 50%;
  background:
    radial-gradient(closest-side at 35% 45%, rgb(34 232 255 / 55%), transparent),
    radial-gradient(closest-side at 68% 45%, rgb(46 245 163 / 45%), transparent),
    radial-gradient(closest-side at 40% 90%, rgb(255 71 112 / 30%), transparent);
  filter: blur(48px);
  opacity: var(--gl-hero-spill, 0.55);
  content: "";
}

/* `:global(.light) .a` compiles to `.light` alone, so the whole selector goes inside `:global()`. */
:global(.light .glosslint-hero-sign::before) {
  --gl-hero-spill: 0.3;
}

.glosslint-hero-banner {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 0 0 1px rgb(34 232 255 / 18%), 0 24px 60px -30px rgb(34 232 255 / 55%);
}

@media (prefers-reduced-motion: no-preference) {
  .glosslint-hero-sign::before {
    animation: glosslint-hero-breathe 4.5s ease-in-out 1.6s infinite alternate;
  }
}

@keyframes glosslint-hero-breathe {
  to {
    opacity: calc(var(--gl-hero-spill, 0.55) * 0.55);
  }
}

.glosslint-hero :deep(h1) {
  max-width: 20ch;
  color: var(--ui-text-highlighted);
  font-size: clamp(2.25rem, 5vw, 3.25rem);
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.03em;
  text-wrap: balance;
}

.glosslint-hero :deep(p) {
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
</style>
