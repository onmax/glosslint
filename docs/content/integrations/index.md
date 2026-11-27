---
title: Integrations overview
description: Connect your glossary to ESLint, Oxlint, x18n, and the CLI to check JavaScript, TypeScript, Vue, YAML and JSON locales, and Markdown docs.
navigation.order: 1
navigation.title: Overview
icon: i-lucide-plug
---

Every integration reads [`.agents/glossary.md`](/guide/glossary) by default, or a [`defineCorpus`](/guide/corpus) corpus you pass in when you need TypeScript options. Pick the ones that fit your repository.

- **[ESLint](/integrations/eslint).** Checks JS, TS, Vue templates and `<script>`, YAML and JSON locales, comments, and identifiers, with autofixes via `eslint --fix`.
- **[Nuxt](/integrations/nuxt).** Runs `glosslint/eslint` inside `withNuxt()` on `.ts`, `.vue`, and `vue-i18n` locale files, with autofixes via `eslint --fix`.
- **[Oxlint](/integrations/oxlint).** Checks JS, TS, Vue `<script>`, comments, and identifiers via Oxlint's alpha JS plugins without Vue templates or YAML, with autofixes via `oxlint --fix`.
- **[x18n](/integrations/x18n).** Checks source-locale messages and hard-coded strings, fixes messages with `x18n check --fix`, and exports terms through `toX18nGlossary`.
- **[CLI](/integrations/cli).** Checks Markdown, MDX, and plain text files read-only, and repairs `.agents/glossary.md` with `doctor --fix`.

## Typical setups

- **Nuxt or Vue.** Spread `glosslint()` inside `withNuxt()` for `.ts`, `.vue`, and your source locale, then check docs with the CLI in CI.
- **Oxlint.** Add `"glosslint/oxlint"` to `.oxlintrc.json` for JS and TS, and run the CLI on Markdown docs.
- **x18n.** Wire `glosslint/x18n` and `toX18nGlossary` in `x18n.config.ts` to check source messages and feed translator glossaries.
