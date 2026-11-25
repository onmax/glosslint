---
title: The corpus
description: Define your glosslint corpus in glosslint.config.ts, combine presets and glossary tables, allow phrases, and control merge order.
navigation.order: 3
icon: i-lucide-book-marked
---

Your corpus holds every term, description, avoid word, and casing rule for your product. Put it in `glosslint.config.ts` at the root of your project when you set up glosslint or add new rules. ESLint, x18n, and the CLI all read the same exported corpus.

## Defining a corpus

A corpus can extend built-in [presets](/guide/presets), read terms from a Markdown [glossary table](/guide/glossary-table), and add project-specific [terms](/guide/terms) of its own. Here is a full config for a bike-share app:

```ts [glosslint.config.ts]
import { defineCorpus, fromGlossaryTable } from "glosslint";
import inclusive from "glosslint/presets/inclusive";
import tech from "glosslint/presets/tech";

export default defineCorpus({
  extends: [tech, inclusive, fromGlossaryTable(new URL("./docs/glossary.md", import.meta.url))],
  terms: [
    {
      term: "Dock",
      description: "A powered stand where one bike is locked.",
      nuance: "A station is a group of docks.",
      avoid: [{ word: "rack", why: "Racks are unpowered." }, "bay"],
      examples: { good: ["Return the bike to any dock"], bad: ["Return the bike to any rack"] },
      links: [{ title: "Docks", url: "https://example.com/docs/docks" }],
    },
    { term: "Checkout" },
    { term: "eBike", case: "exact" },
    { term: "Day Pass", abbr: ["DP"], case: "context" },
  ],
  allow: ["check out our", "roof rack"],
});
```

`defineCorpus` checks every field when the config loads and throws a `GlosslintConfigError` on a mistake, as [Config errors](/reference/config-errors) lists. It returns a flat corpus that [ESLint](/integrations/eslint), [x18n](/integrations/x18n), and the [CLI](/integrations/cli) all read.

## Corpus fields

| Field        | What it does                                                                                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extends`    | Corpora to merge in first: [presets](/guide/presets), `fromGlossaryTable(...)`, or another `defineCorpus(...)`. See [Merge order](#merge-order).                                                                |
| `terms`      | Your own terms. See [Defining terms](/guide/terms).                                                                                                                                                             |
| `allow`      | Phrases that are never reported. A finding that sits inside an allowed phrase is dropped. Words in a phrase match across spaces, hyphens and underscores, and a plural `s` or `es` matches too.                 |
| `casing`     | The case style of `context` terms per kind of text: `{ label, header, sentence }`. See [Casing rules](/guide/casing).                                                                                           |
| `wholeLabel` | `true` to check every word of a label or header that holds a `context` term, not only the term. See [Casing rules](/guide/casing).                                                                              |

## Allowing phrases

`allow` handles a word that has a second meaning. In the config above, `rack` is an avoid word for Dock, but "roof rack" is a different thing, so `"roof rack"` goes in `allow`. The same applies to `"check out our"`, which is a verb phrase and not the noun Checkout.

When glosslint finds a problem whose text sits inside an allowed phrase, it drops that finding. Words in an allowed phrase match across spaces, hyphens, and underscores, and plurals ending in `s` or `es` match too.

> [!TIP]
> To switch off a term from a preset, add its spellings to `allow`.

## Merge order

glosslint merges terms by key. A key is the term's words joined and lowercased, letters and digits only. For example, `"Re-charge point"` and `"recharge point"` share the same key.

1. glosslint reads `extends` from left to right. A later corpus replaces an earlier term with the same key. In the config above, a term from the [glossary table](/guide/glossary-table) replaces a preset term with the same words.
2. The corpus's own `terms` replace every term from `extends` with the same key. Two of your own terms with the same key throw `GLOSSLINT_C005`, listed in [Config errors](/reference/config-errors).
3. A term is replaced whole. Fields are not merged.
4. `allow` lists add up, with every `extends` entry's list first and then your own.
