---
title: Defining terms
description: Define glosslint terms in .agents/glossary.md or defineCorpus with What, How, Why, avoid words, abbreviations, casing, examples, and links.
navigation.order: 5
icon: i-lucide-book-text
---

Each term defines one word or phrase from your product vocabulary. Add a term when you want glosslint to enforce its spelling, control its capitals, flag words to avoid, or print its definition alongside every finding.

## A complete term

In [`.agents/glossary.md`](/guide/glossary), a minimal term is just `## Checkout`. Adding `What`, `How`, `Why`, `Avoid`, `Good`, `Bad`, and `Links` gives people and coding agents the context behind each finding:

```md [.agents/glossary.md]
## Dock

What: A powered stand where one bike is locked.

How: A station is a group of docks. Say dock for one stand.

Why: Riders read "dock" on the stand itself.

Avoid:

- rack: Racks are unpowered.
- bay

Good:

- Return the bike to any dock

Bad:

- Return the bike to any rack

Links:

- [Docks](https://example.com/docs/docks)
```

The same term in [`defineCorpus`](/guide/corpus) looks like this:

```ts
{
  term: "Dock",
  description: "A powered stand where one bike is locked.",
  nuance: "A station is a group of docks. Say dock for one stand.",
  why: 'Riders read "dock" on the stand itself.',
  avoid: [{ word: "rack", why: "Racks are unpowered." }, "bay"],
  examples: { good: ["Return the bike to any dock"], bad: ["Return the bike to any rack"] },
  links: [{ title: "Docks", url: "https://example.com/docs/docks" }],
}
```

## Term fields

The first column shows the field name in `.agents/glossary.md`; the second shows the matching property in `defineCorpus`. Rows marked "config only" exist only in `defineCorpus`.

| Glossary field | `defineCorpus` property | What it does |
| --- | --- | --- |
| `## Heading` | `term` | The term as it should be written, such as `Dock` or `eBike`. Required. |
| `## Term (AB)` | `abbr` | Abbreviations of the term, such as `DP` for `Day Pass`. Always checked as `exact`. |
| `What` | `description` | What the concept is, in one sentence. Every finding about the term prints it. |
| `How` | `nuance` | How the term differs from near ones and when not to use it. Printed in ESLint and Oxlint messages, and used as `why` if neither the avoid word nor `Why` gives one. |
| `Why` | `why` | Why the project uses this term. Printed as the finding's `why` when an avoid word has no reason of its own, and shown in `glosslint explain`. |
| `Avoid` | `avoid` | Words to report in favour of this term. Each is `word` or `word: reason` (`string` or `{ word, why }` in config). |
| `Good` / `Bad` | `examples` | Strings that `glosslint test` and `glosslint doctor` expect to pass (`Good`) and to be reported (`Bad`). |
| `Links` | `links` | Pages that explain the term (`[title](url)` or `{ title, url }`). The first URL becomes the finding's `see`. |
| `Case` | `case` | How capitals are checked: `exact`, `spelling` (the default), or `context`. Names with an inner capital like `eBike` infer `exact` in `.agents/glossary.md`. See [Casing rules](/guide/casing). |
| config only | `casing` | This term's case style per kind of text, over the corpus's `casing`, such as `{ label: "as-written" }`. Setting `casing` without `case` makes the term `context`. |
| config only | `skip` | `["lower"]`, `["upper"]`, or both: whole-word casings that always pass. The [tech preset](/guide/presets) sets both so `github` and `GITHUB` pass while `Github` is reported. |
| config only | `forms` | Other forms per locale, such as `{ de: ["Dockingstation", "Dockingstationen"] }`. Passed to [x18n](/integrations/x18n)'s glossary as written, and matched by `glosslint explain`. |
| config only | `translations` | The term's translation per locale, such as `{ de: "Dock" }`, passed to [x18n](/integrations/x18n)'s glossary as written. |

## Avoid words and reasons

Each entry in `Avoid` is either a plain word (`bay`) or a word with a reason (`rack: Racks are unpowered.`, or `{ word: "rack", why: "Racks are unpowered." }` in `defineCorpus`).

When glosslint reports an avoid word, it chooses the finding's `why` in this order:

1. The avoid word's own reason (`Racks are unpowered.` for `rack`).
2. The term's `Why` field (`Riders read "dock" on the stand itself.` for `bay`).
3. The term's `How` (`nuance`) field, when neither of the above is set.

Matching follows three rules:

- Avoid words match in any case.
- An avoid word with two capitals in a row, such as `SM`, matches only as written.
- An avoid word with the same key as a term, such as `day-pass` for `Day Pass`, counts as a misspelling of that term and gives `GLOSSLINT_TERM`, not `GLOSSLINT_AVOID`. See [Findings](/reference/findings).

> [!NOTE]
> A term's key is its words joined and lowercased, letters and digits only. See [defineCorpus](/guide/corpus#merge-order) for how keys work during merging.

## Plurals

Plurals ending in `s` or `es` match both terms and avoid words. You do not need to list plural forms separately in `Avoid`: glosslint reports `"racks"` and suggests `"docks"`.

## Testing terms with examples

`Good` and `Bad` (or `examples: { good, bad }`) act as tests for the term. Every `Good` string must pass with no findings for that term, and every `Bad` string must produce a finding for that term.

- Run `glosslint doctor` to test examples in `.agents/glossary.md` against the glossary file's own corpus (failures report `GLOSSLINT_G009`).
- Run `glosslint test` to test examples across the loaded corpus, including presets and any `defineCorpus` additions. Run it in CI and after editing your glossary.
