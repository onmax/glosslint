---
title: Oxlint integration
navigation.title: Oxlint
description: Run glosslint's four rules as an Oxlint JS plugin on JavaScript, TypeScript, and Vue script blocks, using your glossary file.
navigation.order: 3
icon: i-simple-icons-oxc
---

Use `glosslint/oxlint` to run glosslint's four rules inside [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) on JavaScript, TypeScript, and `<script>` blocks inside Vue files. It reads [`.agents/glossary.md`](/glossary) from Oxlint's working directory on the first file and requires Oxlint 1.94 or later as an optional peer dependency.

> [!WARNING]
> JavaScript plugins in Oxlint 1.94 are alpha. The `glosslint/oxlint` entry point or `.oxlintrc.json` shape may change as Oxlint's JS plugin API evolves.

## Setup

Add `"glosslint/oxlint"` to `jsPlugins` and enable the four rules in `.oxlintrc.json`:

```json [.oxlintrc.json]
{
  "jsPlugins": ["glosslint/oxlint"],
  "rules": {
    "glosslint/term": "error",
    "glosslint/avoid": "error",
    "glosslint/comment": "error",
    "glosslint/identifier": "warn"
  }
}
```

Run Oxlint as usual, and pass `--fix` to apply autofixes:

```sh
npx oxlint
npx oxlint --fix
```

Because Oxlint has no config hook that runs before the first file, the plugin reads `.agents/glossary.md` (or `settings.glosslint.glossary`) from `context.cwd` when the first file is linted and caches the corpus for the rest of the process.

## Settings

Configure the plugin under `settings.glosslint` in `.oxlintrc.json`:

```json [.oxlintrc.json]
{
  "jsPlugins": ["glosslint/oxlint"],
  "settings": {
    "glosslint": {
      "glossary": "docs/glossary.md",
      "ignoreCallees": ["endsWith", "startsWith", "includes", "querySelector*"],
      "identifierAvoid": false
    }
  },
  "rules": {
    "glosslint/term": "error",
    "glosslint/avoid": "error",
    "glosslint/comment": "error",
    "glosslint/identifier": "warn"
  }
}
```

| Setting | Default | What it does |
| --- | --- | --- |
| `glossary` | `".agents/glossary.md"` | Path to the glossary file, resolved from Oxlint's working directory. |
| `ignoreCallees` | `["endsWith", "startsWith", "includes", "querySelector*"]` | Functions whose first argument is never checked. A trailing `*` matches a prefix. Your list replaces the default. `t`, `$t`, `te` and `tm` are always skipped. |
| `identifierAvoid` | `false` | Report avoid words in declared identifier names too. Off by default, because a rename touches every caller. |

## Rules and fixes

`glosslint/oxlint` exports the same four rules as [ESLint](/integrations/eslint) and uses the same string, comment, and identifier skipping logic described in [What glosslint skips](/guide/ignored-text):

| Rule | Reports | `oxlint --fix` |
| --- | --- | --- |
| `glosslint/term` | `GLOSSLINT_TERM` and `GLOSSLINT_CASE` in strings | Applies autofixes; leaves shape-guessed `context` suggestions alone |
| `glosslint/avoid` | `GLOSSLINT_AVOID` in strings | Never autofixes (suggestions only) |
| `glosslint/comment` | All three codes in JS/TS line and block comments | Applies spelling and casing autofixes; leaves avoid-word suggestions alone |
| `glosslint/identifier` | How a declared name splits into words (and avoid words if `identifierAvoid` is `true`) | Never autofixes (the message names the rename) |

## Limits compared to ESLint

Use [ESLint](/integrations/eslint) instead of or alongside Oxlint when your project needs any of the following:

- **Vue `<template>` blocks.** Oxlint lints `<script>` inside `.vue` files, not `<template>`, because Oxlint JS plugins do not expose Vue template parser services.
- **YAML locale files.** Oxlint does not lint `.yml` or `.yaml` files.
- **`defineCorpus` or `kindOf`.** Oxlint `jsPlugins` entries are module specifiers and `settings` are JSON, so `glosslint/oxlint` takes a glossary file path only and cannot accept a `Corpus` object or a `kindOf` callback.

## Worked example

With the `.oxlintrc.json` above and the bike-share `.agents/glossary.md`, Oxlint checks these two files:

```ts [src/rides.ts]
// Return the bike to any rack.
export const label = "Return your e-bike to any rack";
export const daypassTotal = 2;
```

```vue [src/ReturnCard.vue]
<template>
  <!-- Not checked by Oxlint -->
  <p>Start the check-out at the bay.</p>
</template>

<script setup lang="ts">
// Free the rack when the ride ends.
const title = "Return your e-bike to a dock";
const daypassCount = [title];
</script>
```

Running `oxlint` reports the comment, string, avoid-word, and identifier findings in `src/rides.ts` and in the `<script>` block of `src/ReturnCard.vue`, while skipping `<template>`. Running `oxlint --fix` rewrites `"e-bike"` to `"eBike"` in both files and leaves `"rack"` and the `daypassTotal` / `daypassCount` warnings for a person to review.
