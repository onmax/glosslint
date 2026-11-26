---
title: defineCorpus
description: Configure glosslint with defineCorpus in glosslint.config.ts when you need skip, forms, translations, per-term casing, wholeLabel, or merging.
navigation.order: 4
icon: i-lucide-book-marked
---

Most projects keep their vocabulary in [`.agents/glossary.md`](/guide/glossary) and need no JavaScript or TypeScript config file. `defineCorpus` in `glosslint.config.ts` is the second way to build a corpus. Reach for it when you need options the Markdown file has no field for:

- `skip` (`["lower"]`, `["upper"]`, or both) to allow all-lowercase or all-uppercase spellings on a term
- `forms` and `translations` per locale, passed to [x18n](/integrations/x18n)'s glossary
- per-term `casing` overrides
- `wholeLabel: true` to enforce label casing across every word of a label containing a `context` term
- sharing or composing corpora across packages in TypeScript

## Extending `.agents/glossary.md`

You do not have to move terms out of `.agents/glossary.md` to use `defineCorpus`. Load the glossary file with `fromGlossary()` inside `extends`, then layer on the TypeScript-only fields you need:

```ts [glosslint.config.ts]
import { defineCorpus, fromGlossary } from "glosslint";

export default defineCorpus({
  extends: [fromGlossary()],
  terms: [
    {
      term: "Dock",
      description: "A powered stand where one bike is locked.",
      nuance: "A station is a group of docks.",
      why: 'Riders read "dock" on the stand itself.',
      avoid: [{ word: "rack", why: "Racks are unpowered." }, "bay"],
      examples: { good: ["Return the bike to any dock"], bad: ["Return the bike to any rack"] },
      links: [{ title: "Docks", url: "https://example.com/docs/docks" }],
      translations: { de: "Dock" },
      forms: { de: ["Dockingstation", "Dockingstationen"] },
    },
    { term: "Ride history", casing: { label: "as-written" } },
  ],
  wholeLabel: true,
});
```

`fromGlossary()` reads `.agents/glossary.md` from the current working folder by default. Pass a `URL` built from `import.meta.url` to resolve another path relative to `glosslint.config.ts`:

```ts
fromGlossary(new URL("./docs/glossary.md", import.meta.url));
```

You can also define a full corpus in `glosslint.config.ts` without a Markdown file by listing presets in `extends` and your terms in `terms`:

```ts [glosslint.config.ts]
import { defineCorpus } from "glosslint";
import inclusive from "glosslint/presets/inclusive";
import tech from "glosslint/presets/tech";

export default defineCorpus({
  extends: [tech, inclusive],
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

`defineCorpus` validates every field when the config loads and throws a `GlosslintConfigError` on a mistake, listed in [Config and glossary errors](/reference/config-errors).

## How tools pick up `glosslint.config.ts`

- **CLI:** `check`, `test`, `print`, and `explain` look for `glosslint.config.{ts,mts,js,mjs}` before falling back to `.agents/glossary.md`, unless `--glossary` is passed. `glosslint doctor` reads only the glossary Markdown file, never a config.
- **ESLint:** Import your config and pass `{ corpus }` to `glosslint({ corpus })`. See [ESLint](/integrations/eslint).
- **x18n:** Import your config and pass `{ corpus }` to the plugin and `toX18nGlossary(corpus)`. See [x18n](/integrations/x18n).
- **Oxlint:** Reads `.agents/glossary.md` (or `settings.glosslint.glossary`) directly; it does not load `glosslint.config.ts`. See [Oxlint](/integrations/oxlint).

## Corpus fields

| Field        | What it does                                                                                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extends`    | Corpora to merge in first: `fromGlossary(...)`, [presets](/guide/presets), or another `defineCorpus(...)`. See [Merge order](#merge-order).                                                                     |
| `terms`      | Your own terms. See [Defining terms](/guide/terms).                                                                                                                                                             |
| `allow`      | Phrases that are never reported. A finding that sits inside an allowed phrase is dropped. Words in a phrase match across spaces, hyphens and underscores, and a plural `s` or `es` matches too.                 |
| `casing`     | The case style of `context` terms per kind of text: `{ label, header, sentence }`. See [Casing rules](/guide/casing).                                                                                           |
| `wholeLabel` | `true` to check every word of a label or header that holds a `context` term, not only the term. See [Casing rules](/guide/casing).                                                                              |

## Allowing phrases

`allow` (or `Allow:` in `.agents/glossary.md`) handles a word that has a second meaning. With `rack` as an avoid word for Dock, "roof rack" means something else, so `"roof rack"` goes in `allow`. The same applies to `"check out our"`, which is a verb phrase rather than the noun Checkout.

When glosslint finds a problem whose text sits inside an allowed phrase, it drops that finding. Words in an allowed phrase match across spaces, hyphens, and underscores, and plurals ending in `s` or `es` match too.

> [!TIP]
> To switch off a term from a preset, add its spellings to `Allow:` in `.agents/glossary.md` or `allow` in `defineCorpus`.

## Merge order

glosslint merges terms by key. A key is the term's words joined and lowercased, letters and digits only. For example, `"Re-charge point"` and `"recharge point"` share the same key.

1. glosslint reads `extends` from left to right. A later corpus replaces an earlier term with the same key. If `fromGlossary()` sits after `tech` and `inclusive`, terms from `.agents/glossary.md` replace preset terms with the same words.
2. The corpus's own `terms` replace every term from `extends` with the same key. Two of your own terms with the same key throw `GLOSSLINT_C005`.
3. A term is replaced whole. Fields are not merged.
4. `allow` lists add up, with every `extends` entry's list first and then your own.
5. `casing` merges per kind (`label`, `header`, `sentence`), with later entries winning; `wholeLabel` takes the last defined boolean.
