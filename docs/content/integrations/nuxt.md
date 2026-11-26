---
title: Nuxt and vue-i18n
navigation.title: Nuxt
description: Lint product terms in Nuxt apps and vue-i18n JSON or YAML locale files through the Nuxt ESLint module and your glossary.
navigation.order: 2.5
icon: i-lucide-triangle
---

There is no Nuxt module. glosslint runs inside the ESLint config Nuxt already has through `@nuxt/eslint`, so a Nuxt app adds one spread to `eslint.config.mjs`. It reads [`.agents/glossary.md`](/guide/glossary) by default and takes the same options as the [ESLint integration](/integrations/eslint).

## Setup

`withNuxt` supplies the TypeScript and Vue parsers, so `.ts` and `.vue` files need no setup, but it has no parser for JSON or YAML. Install `jsonc-eslint-parser`, give it the locale files, and spread `glosslint()` after it in `eslint.config.mjs`:

```js [eslint.config.mjs]
import glosslint from "glosslint/eslint";
import * as jsoncParser from "jsonc-eslint-parser";
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  { files: ["i18n/locales/*.json"], languageOptions: { parser: jsoncParser } },
  ...glosslint({ files: ["app/**/*.{ts,vue}", "shared/**/*.ts", "i18n/locales/en.json"] }),
);
```

For `.yml` locale files, use `yaml-eslint-parser` on `i18n/locales/*.yml` instead. If your config already lints JSON and YAML, as `@antfu/eslint-config` does in `withNuxt(antfu(...))`, leave out the parser object and keep only the `glosslint()` spread.

Scope `files` in `glosslint()` to the source locale only, the language your glossary is written in. `@nuxtjs/i18n` v10 keeps locale files in `i18n/locales/` by default, and `langDir` changes that folder. Other locales are in other languages, so the glossary's words would only produce noise there.

## Locale files

glosslint reads string values in JSON and YAML locale files and never their keys.

The last key above a value decides whether it is a label, header, or sentence, the same as for an object property in TypeScript:

```json [i18n/locales/en.json]
{
  "pass": {
    "buttonLabel": "Buy a Day Pass",
    "title": "Day Pass",
    "description": "Buy a day pass at any station."
  }
}
```

Keys such as `buttonLabel`, `title`, and `description` set the kind for the value under them. See [Casing rules](/guide/casing) for how key names map to text kinds.

Locale files written as `.ts` objects are read as TypeScript.

## What glosslint skips in vue-i18n

glosslint skips vue-i18n keys in code:

- The first argument of `t`, `$t`, `te`, and `tm`, including `i18n.global.t`
- The `keypath` attribute of `<i18n-t>`
- Any string shaped like a dotted key, such as `alarm.activeAlarms`

Inside messages, glosslint does not read placeholders like `{count}`, linked messages like `@:common.save`, or the `|` between plural forms as words. See [What glosslint skips](/guide/ignored-text) for the full list.

## Running beside `@intlify/eslint-plugin-vue-i18n`

`glosslint/eslint` and `@intlify/eslint-plugin-vue-i18n` do different jobs and can share one config. `@intlify/eslint-plugin-vue-i18n` checks keys for missing keys, unused keys, and raw text. glosslint checks the words in the values.

## Other locales and translators

ESLint checks the source locale only. For other locales and translators, use the [x18n integration](/integrations/x18n). `toX18nGlossary` passes the glossary, with per-locale `translations` from a [`defineCorpus`](/guide/corpus) config, to x18n.

## Limits

- `<i18n>` custom blocks inside `.vue` files are not read.
- Files parsed by `@eslint/json`, ESLint's JSON language, are not read. Use `jsonc-eslint-parser` for locale files.
