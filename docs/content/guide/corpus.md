---
title: defineCorpus
description: Build a corpus in TypeScript with defineCorpus for skip, wholeLabel, and merging corpora, then pass it to the tool that needs it.
navigation.order: 4
icon: i-lucide-book-marked
---

Most projects only need [`.agents/glossary.md`](/guide/glossary). Build a corpus in TypeScript with `defineCorpus` when you need options the glossary has no field for (`skip`, `wholeLabel`) or want to merge corpora across packages, then pass it to the tool that needs it. There is no config file that glosslint finds on its own.

```ts
import { defineCorpus, fromGlossary } from "glosslint";

const corpus = defineCorpus({
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
  ],
  wholeLabel: true,
});
```

`fromGlossary()` reads `.agents/glossary.md` from the working directory; pass `fromGlossary(new URL("./docs/glossary.md", import.meta.url))` for another path. `defineCorpus` validates on load and throws `GlosslintConfigError` on mistakes ([Config and glossary errors](/guide/config-errors)).

## Pass the corpus to a tool

Write the corpus inline in the tool's config, or export it from any module and import it where you need it.

- **ESLint.** `glosslint({ corpus })` in `eslint.config.ts` ([ESLint](/integrations/eslint)).
- **x18n.** `glosslint({ corpus })` in `x18n.config.ts`, and `toX18nGlossary(corpus)` for the translation glossary ([x18n](/integrations/x18n)).
- **CLI.** `--corpus <module>` on `check`, `test`, `print`, and `explain`, where the module's default export is the corpus ([CLI](/integrations/cli)). `doctor` reads only the Markdown glossary.
- **Oxlint.** Takes no corpus: it reads `.agents/glossary.md` or `settings.glosslint.glossary` ([Oxlint](/integrations/oxlint)).

## Corpus fields

| Field | What it does |
| --- | --- |
| `extends` | Corpora merged first: `fromGlossary(...)`, [presets](/guide/presets), or another `defineCorpus(...)` ([Merge order](#merge-order)). |
| `terms` | Term objects. Shared fields match [The glossary file](/guide/glossary); TypeScript-only fields follow below. |
| `allow` | Phrases never reported ([Allowing phrases](#allowing-phrases)). |
| `casing` | Default style for `context` terms: `{ label, header, sentence }` ([Casing rules](/guide/casing)). |
| `wholeLabel` | Set `true` to check every word of a label or header holding a `context` term ([Casing rules](/guide/casing)). |

## TypeScript-only term fields

Shared term fields (`term`, `abbr`, `description`, `nuance`, `why`, `avoid`, `examples`, `links`, `case`, `casing`, `translations`, `forms`) are documented in [The glossary file](/guide/glossary). `skip` exists only in `defineCorpus`, and `forms` and `translations` are written as objects here:

| Property | What it does |
| --- | --- |
| `skip` | `["lower"]`, `["upper"]`, or both: whole-word casings that always pass (`tech` sets both so `github` and `GITHUB` pass while `Github` fails). |
| `forms` | Locale forms such as `{ de: ["Dockingstation", "Dockingstationen"] }`, passed to [x18n](/integrations/x18n) and matched by `glosslint explain`. |
| `translations` | Locale translations such as `{ de: "Dock" }`, passed to [x18n](/integrations/x18n). |

In `.agents/glossary.md` they are the `Forms` and `Translations` fields ([Translations and forms](/guide/glossary#translations-and-forms)).

## Allowing phrases

Findings inside an `allow` or `Allow:` phrase are dropped. Use it for second meanings like `"roof rack"` or `"check out our"`, or to silence a preset term. Words match in any case, across spaces, hyphens, and underscores, and with `s` or `es` plurals.

## Merge order

Terms merge by key: words joined and lowercased, letters and digits only (`"Re-charge point"` and `"recharge point"` share a key).

1. `extends` merges left to right; later corpora replace earlier terms with the same key.
2. Your own `terms` replace matching keys from `extends`. Duplicate keys throw `GLOSSLINT_C005` (`GLOSSLINT_G005` in Markdown).
3. Replacement is whole; fields do not merge.
4. `allow` lists concatenate, `extends` first, then yours.
5. `casing` merges per kind (`label`, `header`, `sentence`), last wins; `wholeLabel` takes the last defined boolean.
