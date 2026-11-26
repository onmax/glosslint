---
title: Integrations overview
description: Connect .agents/glossary.md to ESLint, Oxlint, x18n, and the CLI to check JavaScript, TypeScript, Vue, YAML locales, and Markdown docs.
navigation.order: 1
navigation.title: Overview
icon: i-lucide-plug
---

Every glosslint integration feeds text into the same matcher backed by [`.agents/glossary.md`](/guide/glossary), or by a [`defineCorpus`](/guide/corpus) config when you need TypeScript-only options. Pick the tools that match the files in your repository.

## Comparing integrations

| Integration | Files checked | Loads `.agents/glossary.md` | Autofix | Notes |
| --- | --- | --- | --- | --- |
| [ESLint](/integrations/eslint) | JS, TS, Vue templates and `<script>`, YAML locales, comments, identifiers | By default (`glosslint()`) | Yes (`eslint --fix`) | Supports `glossary`, `corpus`, and `kindOf`. Requires ESLint `>=9.15.0`. |
| [Oxlint](/integrations/oxlint) | JS, TS, Vue `<script>`, comments, identifiers | By default (`"jsPlugins": ["glosslint/oxlint"]`) | Yes (`oxlint --fix`) | No Vue `<template>`, no YAML, no `corpus` or `kindOf`. JS plugins are alpha in Oxlint `>=1.94.0`. |
| [x18n](/integrations/x18n) | Source-locale messages and hard-coded strings | Reads `.agents/glossary.md`, or `glossary` or `corpus` | Safe and quick fixes in `x18n check --fix` | Also exports terms to x18n's `glossary` via `toX18nGlossary`. Requires `@x18n/core >=0.1.14`. |
| [CLI](/integrations/cli) | Markdown, MDX, and plain text files | By default (after `glosslint.config.*`) | `doctor --fix` repairs `.agents/glossary.md` | Also runs `doctor`, `test`, `print`, and `explain`. No peer dependencies needed. |

## Typical setups

- **Nuxt or Vue app with YAML locales and docs:** run [ESLint](/integrations/eslint) on `.ts`, `.vue`, and your source `.yml` locale file, and run the [CLI](/integrations/cli) in CI on `docs/` and with `glosslint doctor`.
- **TypeScript repo using Oxlint:** add `"glosslint/oxlint"` in `.oxlintrc.json` for fast checks on `.js` and `.ts` files, and pair it with the [CLI](/integrations/cli) for Markdown documentation.
- **Localized app using x18n:** wire `glosslint/x18n` and `toX18nGlossary` in `x18n.config.ts` so source messages and translator glossaries stay aligned with `.agents/glossary.md`.

## Integration guides

- [ESLint](/integrations/eslint): flat config setup, parsers for TypeScript, Vue, and YAML, rule details, and options.
- [Oxlint](/integrations/oxlint): `.oxlintrc.json` setup, `settings.glosslint`, rule behavior, and current limits.
- [x18n](/integrations/x18n): plugin setup, check severities, safe vs. quick fixes, and `toX18nGlossary`.
- [Command line](/integrations/cli): `check`, `doctor`, `test`, `print`, `explain`, flags, and exit codes.
