---
title: Nuxt and vue-i18n
navigation.title: Nuxt
description: Lint product terms in Nuxt apps and vue-i18n locale files through the Nuxt ESLint module.
navigation.order: 2.5
icon: i-simple-icons-nuxt
---

There is no Nuxt module. glosslint runs in the ESLint config `@nuxt/eslint` gives you, as one spread in `eslint.config.mjs`. It reads [`.agents/glossary.md`](/guide/glossary) by default and takes the same options as the [ESLint integration](/integrations/eslint).

## Setup

`withNuxt` has no JSON or YAML parser. Install `jsonc-eslint-parser`, give it your locale files, and spread `glosslint()` after it:

```js [eslint.config.mjs]
import glosslint from "glosslint/eslint";
import * as jsoncParser from "jsonc-eslint-parser";
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  { files: ["i18n/locales/*.json"], languageOptions: { parser: jsoncParser } },
  ...glosslint({ files: ["app/**/*.{ts,vue}", "shared/**/*.ts", "i18n/locales/en.json"] }),
);
```

Use `yaml-eslint-parser` for `.yml` locales. Drop the parser object if your config already lints JSON or YAML, such as `withNuxt(antfu(...))`. Scope `files` to the source locale only, the language your glossary uses. `@nuxtjs/i18n` v10 keeps locales in `i18n/locales/` unless `langDir` sets another folder. For other locales, use the [x18n integration](/integrations/x18n).

## vue-i18n

glosslint reads locale string values, never keys, and uses the key above each value to set its text kind. See [Casing rules](/guide/casing). You can run it alongside `@intlify/eslint-plugin-vue-i18n` in the same config, since they do different jobs.

In code, glosslint skips vue-i18n keys: `<i18n-t keypath>`, dotted key strings, and the first argument of `t`, `$t`, `te`, and `tm`. Inside messages, it skips placeholders like `{count}`, linked messages like `@:common.save`, and plural `|` pipes. See [What glosslint skips](/guide/ignored-text) for the full list.

## Limits

- `<i18n>` custom blocks in `.vue` files are not read.
- Files parsed by `@eslint/json` are not read. Use `jsonc-eslint-parser` instead.
