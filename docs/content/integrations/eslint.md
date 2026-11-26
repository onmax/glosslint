---
title: ESLint integration
navigation.title: ESLint
description: Lint JavaScript, TypeScript, Vue templates, YAML and JSON locales, comments, and identifiers against your glossary with ESLint flat config.
navigation.order: 2
icon: i-simple-icons-eslint
---

`glosslint/eslint` checks JavaScript, TypeScript, Vue templates, YAML and JSON locale files, comments, and declared identifiers. It requires ESLint 9.15 or later and reads [`.agents/glossary.md`](/guide/glossary) by default.

For Nuxt projects using `@nuxt/eslint` and `vue-i18n`, see [Nuxt and vue-i18n](/integrations/nuxt).

## Setup

Spread `glosslint()` into your flat config after the parsers your project uses:

```ts [eslint.config.ts]
import glosslint from "glosslint/eslint";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";
import * as yamlParser from "yaml-eslint-parser";

export default [
  { files: ["**/*.ts"], languageOptions: { parser: tseslint.parser } },
  {
    files: ["**/*.vue"],
    languageOptions: { parser: vueParser, parserOptions: { parser: tseslint.parser } },
  },
  { files: ["**/*.yml"], languageOptions: { parser: yamlParser } },
  ...glosslint({ files: ["src/**/*.{ts,vue}", "locales/en.yml"] }),
];
```

glosslint sets no parser of its own. Supply `typescript-eslint` for `.ts`, `vue-eslint-parser` for `.vue`, `yaml-eslint-parser` for YAML locales, and `jsonc-eslint-parser` for JSON locales. Scope locale files to your source locale. Plain JavaScript needs no extra parser.

Pass `glossary` to read another path, or `corpus` to pass a [`defineCorpus`](/guide/corpus) object instead. Passing both throws `GLOSSLINT_C012`.

```ts [eslint.config.ts]
import { defineCorpus, fromGlossary } from "glosslint";
import glosslint from "glosslint/eslint";

const corpus = defineCorpus({ extends: [fromGlossary()], wholeLabel: true });

export default [
  // ...parsers
  ...glosslint({ corpus, files: ["src/**/*.{ts,vue}", "locales/en.yml"] }),
];
```

> [!NOTE]
> ESLint needs `jiti` or `--flag unstable_native_nodejs_ts_config` to load `eslint.config.ts`. An `eslint.config.mjs` with the same contents needs neither on Node 22.18+.

## Options

All options on `glosslint(options?)` are optional.

### `glossary`

Default: `".agents/glossary.md"`.

Path resolved from `process.cwd()`, or a `URL`, to your glossary file, read once when the config builds. Cannot be combined with `corpus`.

### `corpus`

Default: none.

A `Corpus` object from [`defineCorpus`](/guide/corpus) to use instead of reading a glossary file. Cannot be combined with `glossary`.

### `files`

Default: every file.

Glob patterns limiting which files the rules run on.

### `ignoreCallees`

Default: `["endsWith", "startsWith", "includes", "querySelector*"]`.

Functions whose first argument is never checked. A trailing `*` matches a prefix, and passing a list replaces the default. `t`, `$t`, `te`, and `tm` are always skipped.

### `identifierAvoid`

Default: `false`.

Reports avoid words inside declared names too. Off by default because renaming an identifier touches every caller.

### `kindOf`

Default: none.

Decides a string's kind before glosslint's built-in classifier runs. See [Casing rules](/guide/casing).

To change rule severities or disable a rule, add a config object after the spread:

```ts [eslint.config.ts]
export default [
  // ...parsers
  ...glosslint({ files: ["src/**/*.{ts,vue}", "locales/en.yml"] }),
  { rules: { "glosslint/identifier": "off" } },
];
```

## Rules

| Rule                   | Severity | Reports                                       | Fix                                                          |
| ---------------------- | -------- | --------------------------------------------- | ------------------------------------------------------------ |
| `glosslint/term`       | error    | `GLOSSLINT_TERM`, `GLOSSLINT_CASE` in strings | autofix, or a suggestion where the text's shape set its kind |
| `glosslint/avoid`      | error    | `GLOSSLINT_AVOID` in strings                  | suggestion                                                   |
| `glosslint/comment`    | error    | all three codes in comments                   | autofix for spelling and casing, suggestion for avoid words  |
| `glosslint/identifier` | warn     | how a declared name splits into words         | none, the message names the rename                           |

### `glosslint/term` and `glosslint/avoid`

Both rules check JS/TS string and template literals, Vue template text and static attributes, and YAML or JSON string values. `glosslint/term` autofixes spelling and casing, falling back to a suggestion when a `context` term's kind was guessed from text shape, while `glosslint/avoid` always offers an editor suggestion. See [Casing rules](/guide/casing) and [What glosslint doesn't check](/guide/ignored-text) for skipped code strings, Vue attributes, and blanked spans.

### `glosslint/comment`

Checks line, block, and Vue HTML comments for spellings, avoid words, and `exact` or abbreviated casing, ignoring `context` casing and tool directives like `eslint-disable`. Spelling and casing findings autofix; avoid words offer a suggestion.

### `glosslint/identifier`

Checks how declared variable, function, parameter, class, and property names split multi-word non-`exact` terms, keeping camel, snake, kebab, or `SCREAMING_SNAKE` style. It skips shorthand destructuring, never autofixes, and checks avoid words only when `identifierAvoid` is `true`.

## Message format

Each diagnostic is one line combining the headline, the avoid or term reason, `Term: description`, the nuance, and `See <url>` when those fields exist. Its ESLint `messageId` is the finding code, listed in [Findings](/reference/findings).

## Worked example

With the `eslint.config.ts` above and the bike-share `.agents/glossary.md`, these three files:

```yaml [locales/en.yml]
# locales/en.yml
station:
  title: Buy a day pass
  description: Check-out starts when the dock lets go.
```

```vue [src/StationCard.vue]
<!-- src/StationCard.vue -->
<template>
  <button title="Buy a Day pass">Find a hub near you</button>
</template>
```

```ts [src/rides.ts]
// src/rides.ts
// Free the rack when the ride ends.
export const endRide = () => "Return your e-bike to any dock.";
export const daypassTotal = 2;
```

produce this output from `eslint .`:

```txt
locales/en.yml
  2:16  error  "day pass" is written "Day Pass" in labels  glosslint/term
  3:16  error  "Check-out" is spelled "Checkout"           glosslint/term

src/StationCard.vue
  2:24  error  "Day pass" is written "Day Pass" in labels                                                                                                               glosslint/term
  2:41  error  Use "station" instead of "hub". Riders confuse it with the depot. Station: A group of docks on one street corner. See https://example.com/docs/stations  glosslint/avoid

src/rides.ts
  1:13  error    Use "dock" instead of "rack". Racks are unpowered. Dock: A powered stand where one bike is locked. A station is a group of docks. See https://example.com/docs/docks  glosslint/comment
  2:43  error    "e-bike" is spelled "eBike"                                                                                                                                           glosslint/term
  3:14  warning  Rename "daypass" to "dayPass": the term is "Day Pass"                                                                                                                 glosslint/identifier

✖ 7 problems (6 errors, 1 warning)
  4 errors and 0 warnings potentially fixable with the `--fix` option.
```

Running `eslint --fix` applies the four autofixable `glosslint/term` findings: it rewrites `locales/en.yml` to `title: Buy a Day Pass` and `description: Checkout starts when the dock lets go.`, fixes `"Day pass"` in `src/StationCard.vue` and `"e-bike"` in `src/rides.ts`, and leaves `"hub"` and `"rack"` as suggestions for a person alongside the `daypassTotal` rename warning.
