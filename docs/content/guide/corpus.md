---
title: defineCorpus
description: Layer a config file on top of your glossary for skip lists, word forms, translations, per-term casing, and merging corpora.
navigation.order: 4
icon: i-lucide-book-marked
---

Most projects only need [`.agents/glossary.md`](/guide/glossary). Add `glosslint.config.ts` when you need config-only options (`skip`, `forms`, `translations`, per-term `casing`, `wholeLabel`) or shared corpora across packages.

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

`fromGlossary()` reads `.agents/glossary.md` from the working directory; pass `fromGlossary(new URL("./docs/glossary.md", import.meta.url))` for another path. `defineCorpus` validates on load and throws `GlosslintConfigError` on mistakes ([Config and glossary errors](/reference/config-errors)).

## How tools load `glosslint.config.ts`

- **CLI.** `check`, `test`, `print`, and `explain` load `glosslint.config.{ts,mts,js,mjs}` before `.agents/glossary.md` unless `--glossary` is passed. `doctor` reads only the Markdown glossary.
- **ESLint.** Pass `{ corpus }` to `glosslint({ corpus })` ([ESLint](/integrations/eslint)).
- **x18n.** Pass `{ corpus }` to the plugin and `toX18nGlossary(corpus)` ([x18n](/integrations/x18n)).
- **Oxlint.** Reads `.agents/glossary.md` or `settings.glosslint.glossary`, never `glosslint.config.ts` ([Oxlint](/integrations/oxlint)).

## Corpus fields

| Field | What it does |
| --- | --- |
| `extends` | Corpora merged first: `fromGlossary(...)`, [presets](/guide/presets), or another `defineCorpus(...)` ([Merge order](#merge-order)). |
| `terms` | Term objects. Shared fields match [The glossary file](/guide/glossary); config-only fields follow below. |
| `allow` | Phrases never reported ([Allowing phrases](#allowing-phrases)). |
| `casing` | Default style for `context` terms: `{ label, header, sentence }` ([Casing rules](/guide/casing)). |
| `wholeLabel` | Set `true` to check every word of a label or header holding a `context` term ([Casing rules](/guide/casing)). |

## Config-only term fields

Shared term fields (`term`, `abbr`, `description`, `nuance`, `why`, `avoid`, `examples`, `links`, `case`) are documented in [The glossary file](/guide/glossary). These four exist only in `defineCorpus`:

| Property | What it does |
| --- | --- |
| `casing` | Per-term style over corpus `casing`, such as `{ label: "as-written" }`. Setting `casing` without `case` makes the term `context`. |
| `skip` | `["lower"]`, `["upper"]`, or both: whole-word casings that always pass (`tech` sets both so `github` and `GITHUB` pass while `Github` fails). |
| `forms` | Locale forms such as `{ de: ["Dockingstation", "Dockingstationen"] }`, passed to [x18n](/integrations/x18n) and matched by `glosslint explain`. |
| `translations` | Locale translations such as `{ de: "Dock" }`, passed to [x18n](/integrations/x18n). |

## Allowing phrases

Findings inside an `allow` or `Allow:` phrase are dropped. Use it for second meanings like `"roof rack"` or `"check out our"`, or to silence a preset term. Words match in any case, across spaces, hyphens, and underscores, and with `s` or `es` plurals.

## Merge order

Terms merge by key: words joined and lowercased, letters and digits only (`"Re-charge point"` and `"recharge point"` share a key).

1. `extends` merges left to right; later corpora replace earlier terms with the same key.
2. Your own `terms` replace matching keys from `extends`. Duplicate keys throw `GLOSSLINT_C005` (`GLOSSLINT_G005` in Markdown).
3. Replacement is whole; fields do not merge.
4. `allow` lists concatenate, `extends` first, then yours.
5. `casing` merges per kind (`label`, `header`, `sentence`), last wins; `wholeLabel` takes the last defined boolean.
