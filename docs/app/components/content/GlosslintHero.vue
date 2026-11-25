<script setup lang="ts">
// `::glosslint-hero`: the home page's headline and pitch, then the ways in.
</script>

<template>
  <section class="glosslint-hero">
    <img src="/banner.svg" alt="" class="glosslint-hero-banner" width="1280" height="400">
    <slot />
    <div class="glosslint-hero-links">
      <UButton to="/guide/installation" color="neutral" size="lg" trailing-icon="i-lucide-arrow-right">
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

.glosslint-hero-banner {
  width: 100%;
  height: auto;
  margin-bottom: 2.5rem;
  border-radius: 8px;
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
