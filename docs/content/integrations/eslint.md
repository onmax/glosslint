---
title: ESLint integration
navigation.title: ESLint
description: Lint JavaScript, TypeScript, Vue templates, YAML locales, comments and identifiers against your glosslint corpus with ESLint flat config.
navigation.order: 1
icon: i-lucide-file-code
---

Use `glosslint/eslint` to check product terms in JavaScript, TypeScript, Vue templates, YAML locale files, comments, and declared identifiers as you code. It requires ESLint 9.15 or later as a peer dependency and reads the same [corpus](/guide/corpus) you use with the CLI and x18n.

## Setup

`glosslint/eslint` returns ESLint flat config objects. Spread them into `eslint.config.ts`:

```ts [eslint.config.ts]
import glosslint from "glosslint/eslint";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";
import * as yamlParser from "yaml-eslint-parser";
import corpus from "./glosslint.config.ts";

export default [
  { files: ["**/*.ts"], languageOptions: { parser: tseslint.parser } },
  {
    files: ["**/*.vue"],
    languageOptions: { parser: vueParser, parserOptions: { parser: tseslint.parser } },
  },
  { files: ["**/*.yml"], languageOptions: { parser: yamlParser } },
  ...glosslint({ corpus, files: ["src/**/*.{ts,vue}", "locales/*.yml"] }),
];
```

glosslint sets no parser. Your ESLint config supplies the parser for each file type:

- `typescript-eslint` for TypeScript files
- `vue-eslint-parser` for Vue templates, with `typescript-eslint` as `parserOptions.parser` for TypeScript script blocks
- `yaml-eslint-parser` for YAML locale files
- Plain JavaScript files need no extra parser

> [!NOTE]
> ESLint needs `jiti` installed to read `eslint.config.ts`, or the flag `--flag unstable_native_nodejs_ts_config`. An `eslint.config.mjs` with the same contents needs neither, because Node 22.18 imports `./glosslint.config.ts` itself.

## Options

Pass an options object to `glosslint(...)`:

| Option            | Default                                                    | What it does                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corpus`          | required                                                   | The corpus, from `import corpus from "./glosslint.config.ts"`.                                                                                                 |
| `files`           | every file                                                 | Globs the rules run on.                                                                                                                                        |
| `ignoreCallees`   | `["endsWith", "startsWith", "includes", "querySelector*"]` | Functions whose first argument is never checked. A trailing `*` matches a prefix. Your list replaces the default. `t`, `$t`, `te` and `tm` are always skipped. |
| `identifierAvoid` | `false`                                                    | Report avoid words in declared names too. Off by default, because a rename touches every caller.                                                               |
| `kindOf`          | none                                                       | Decides a string's kind before glosslint does. See [Casing rules](/guide/casing).                                                                              |

The rules themselves take no options. To change a severity or turn a rule off, add a config object after the spread:

```ts [eslint.config.ts]
export default [
  // ...parsers
  ...glosslint({ corpus, files: ["src/**/*.{ts,vue}", "locales/*.yml"] }),
  { rules: { "glosslint/identifier": "off" } },
];
```

## Rules

| Rule                   | Severity | Reports                                       | Fix                                                          |
| ---------------------- | -------- | --------------------------------------------- | ------------------------------------------------------------ |
| `glosslint/term`       | error    | `GLOSSLINT_TERM`, `GLOSSLINT_CASE` in strings | autofix, or a suggestion where the text's shape set its kind |
| `glosslint/avoid`      | error    | `GLOSSLINT_AVOID` in strings                  | suggestion                                                   |
| `glosslint/comment`    | error    | all three codes in comments                   | autofix for spelling and casing, suggestion for avoid words  |
| `glosslint/identifier` | warn     | how a declared name splits into words         | none: the message names the rename                           |

### `glosslint/term` and `glosslint/avoid`

`glosslint/term` reports a term written with other splits or hyphens, and wrong capitals for `exact`, `context`, and abbreviated terms. `eslint --fix` applies the fix and keeps the writer's capitals. When a `context` term sits in a string whose kind was decided only by its shape rather than by a key, attribute, element, or `kindOf`, the rule offers a suggestion instead of an autofix. See [Casing rules](/guide/casing) for how `context` and `kindOf` work.

`glosslint/avoid` reports avoid words. It offers the term as an editor suggestion and never autofixes, because someone has to check the meaning first.

Both rules read the same places:

- String literals and the text parts of template literals in JavaScript and TypeScript
- Text in Vue templates, and static attribute values
- YAML string values. Keys are never read.

Both rules skip strings that are code:

- Import and export sources, object and class keys, member names, and TypeScript literal types. A quoted object key with a space in it is text, so ESLint reads it.
- Operands of comparisons and `switch` cases, directives such as `"use strict"`, enum member names, and tagged templates.
- The first argument of `t`, `$t`, `te`, `tm`, and of `ignoreCallees`.
- The Vue attributes `class`, `style`, `id`, `key`, `ref`, `name`, `to`, `href`, `src`, `icon`, `type`, `variant`, `color`, `size`, `slot`, `is`, `for`, the `aria-*` attributes that hold ids (`aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-owns`), and every `data-*`.
- Strings with no spaces shaped like code: all lowercase, kebab, snake, camelCase, or a path.

Before matching inside any checked string, glosslint also blanks placeholders, URLs, backticks, and code tokens. See [What glosslint skips](/guide/ignored-text) for the full list.

The rules offer a fix only where the source can take it as written. A string whose escapes the fix would break, or a YAML block scalar, gets the finding without a fix.

### `glosslint/comment`

`glosslint/comment` reads line and block comments, and HTML comments in Vue templates. It reports spellings, avoid words, and casing, with one limit on casing: only `exact` terms and abbreviations count for casing in comments, not `context` terms.

It skips tool directives such as `eslint-disable`, `@ts-expect-error`, `prettier-ignore`, and `#region`. Spelling and casing findings get an autofix; avoid words get a suggestion.

### `glosslint/identifier`

`glosslint/identifier` reads the names of variables, functions, parameters, classes, object properties, and class members, and checks how they split into words. With the term `Day Pass`, `daypassTotal` gets `Rename "daypass" to "dayPass": the term is "Day Pass"`, while `dayPassCount` and `day_pass_id` pass.

The rule keeps the identifier's style: camel, snake, kebab, or `SCREAMING_SNAKE`. It checks only terms of two or more words and never `exact` terms. It skips shorthand destructuring such as `const { daypass } = response`, because that name came from somewhere else. It offers no fix, because a rename touches every caller.

Set `identifierAvoid: true` in the `glosslint(...)` options if you also want `glosslint/identifier` to report avoid words in declared names.

## Message format

Each ESLint message is one line made of the headline, the reason, `Term: description`, the nuance, and `See <url>` when those fields exist on the term. The ESLint `messageId` is the finding code, such as `GLOSSLINT_AVOID`. See [Findings](/reference/findings) for all three codes and every field a finding carries.

## Worked example

With the `eslint.config.ts` above and the bike-share corpus, these three files:

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
