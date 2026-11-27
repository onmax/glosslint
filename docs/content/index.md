---
title: glosslint
description: Keep one .agents/glossary.md file and enforce your product vocabulary in ESLint, Oxlint, x18n source messages and Markdown docs.
layout: home
seo.title: glosslint · Lint your product vocabulary
---

::glosslint-hero
# Lint your product's words

Keep your terms in `.agents/glossary.md` and check code, source-locale messages, and docs against it.

#agents
```text
Install glosslint as a dev dependency.
Write our product's terms to .agents/glossary.md following https://glosslint.onmax.me/guide/glossary, with a comment under the title that links that page.
Run npx glosslint doctor --fix until it passes.
Add the glosslint/eslint or glosslint/oxlint plugin.
```

#humans
```sh pm
pnpm add -D glosslint
```
::

## One glossary, four runners

Every runner reads [`.agents/glossary.md`](/guide/glossary) by default, with optional `tech` and `inclusive` [presets](/guide/presets).

::card-group
:::card{title="ESLint" icon="i-simple-icons-eslint" to="/integrations/eslint"}
JS, TS, Vue, and YAML locales
:::

:::card{title="Oxlint" icon="i-simple-icons-oxc" to="/integrations/oxlint"}
JS, TS, and Vue script blocks
:::

:::card{title="x18n" icon="i-lucide-languages" to="/integrations/x18n"}
Source messages and translator glossary export
:::

:::card{title="CLI" icon="i-lucide-terminal" to="/integrations/cli"}
Markdown docs, doctor, test, and explain
:::
::

## What a check catches

Every [finding](/guide/findings) carries the reason, the term's meaning, and a typed fix for people and [agents](/guide/agents).

::code-group
```md [.agents/glossary.md]
## Dock
Avoid:
- rack: Racks are unpowered.

## eBike
```

```diff [locales/en.yml]
- hint: Return your e-bike to any rack.
+ hint: Return your eBike to any dock.
```
::

- `autofix` applies spelling and casing fixes like `e-bike` to `eBike`.
- `suggestion` flags avoid words like `rack` to `dock` with the reason and meaning.
- `rename` flags split identifier names like `daypassTotal` without auto-editing callers.
