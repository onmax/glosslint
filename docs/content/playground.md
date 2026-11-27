---
title: Playground
description: Edit a small bike-share app, run glosslint check, ESLint, x18n and doctor in your browser, and apply each fix from its hover card.
icon: i-lucide-play
layout: playground
render: app/playground/render.ts
tabs:
  - value: terminal
    label: Terminal
examples:
  - id: bike-share
    label: Bike share
    description: A small Vue app with a glossary, a checkout card, its English messages and a help page.
    dir: playground/bike-share
    open: src/components/CheckoutCard.vue
seo.title: glosslint playground
# The playground renders in the browser only, so its prerendered page has no text for search engines.
seo.index: false
---

The example is a small Vue app for a bike-share service, with a few wrong words. Its glossary, `.agents/glossary.md`, says to write "eBike", to say "dock" instead of "rack", and to call people riders, not customers.

- **Lint** runs `glosslint check` on `docs/`, ESLint with the glosslint rules on the components and scripts in `src/`, and `x18n check` on `locales/en.json`.
- **Doctor** checks the glossary file itself.
- Hover or tap a finding to see what it means and to apply its fix. **Fix all** applies every fix that needs no choice, as each tool's `--fix` does.

Everything runs in your browser with glosslint's own code. Edit any file and the output updates.
