---
title: Built-in presets
description: Extend the built-in tech and inclusive presets from your glossary or config file, and override or turn off entries.
navigation.order: 7
icon: i-lucide-layers
---

glosslint ships two presets, `tech` and `inclusive`. Their keys do not overlap, so you can extend both at once.

## Tech

`glosslint/presets/tech` checks the casing of product and technology names like `GitHub` and `Apple Pay`. It is built from [case-police](https://github.com/antfu/case-police) and skips all-lowercase and all-uppercase words, so `github` and `GITHUB` pass while `Github` is reported. Browse [`src/presets/tech.ts`](https://github.com/onmax/glosslint/blob/main/src/presets/tech.ts) or read [Coming from case-police](/guide/case-police).

## Inclusive

`glosslint/presets/inclusive` flags non-inclusive terms and suggests replacements, such as `allowlist` for `"whitelist"` or `placeholder` for `"dummy data"`. Everyday technical uses like a git `master` branch are left alone; only specific phrases like `"master server"` are flagged. See [`src/presets/inclusive.ts`](https://github.com/onmax/glosslint/blob/main/src/presets/inclusive.ts) for the full list.

## Use a preset

List presets under `Presets:` in [`.agents/glossary.md`](/glossary):

```md [.agents/glossary.md]
# Glossary

Presets: tech, inclusive
```

Or import them in [`defineCorpus`](/guide/corpus):

```ts
import { defineCorpus, fromGlossary } from "glosslint";
import inclusive from "glosslint/presets/inclusive";
import tech from "glosslint/presets/tech";

const corpus = defineCorpus({
  extends: [tech, inclusive, fromGlossary()],
});
```

## Override a term

Defining a term with the same name replaces the preset entry completely, so `## GitHub` drops `tech`'s `skip` setting and checks `github` and `GITHUB` too. See [Merge order](/guide/corpus#merge-order).

```md [.agents/glossary.md]
# Glossary

Presets: tech

## GitHub
```

## Turn a term off

Add a word to `Allow:` to silence it, listing both spaced and joined forms for multi-word terms because spaces only match separators.

```md [.agents/glossary.md]
# Glossary

Presets: tech, inclusive
Allow: Apple Pay, ApplePay, whitelist
```
