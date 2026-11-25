---
title: Defining terms
description: Configure glosslint terms with descriptions, nuance, avoid words, abbreviations, casing options, locale forms, and inline test examples.
navigation.order: 4
icon: i-lucide-book-text
---

Each entry in a [corpus](/guide/corpus) defines one word or phrase from your product vocabulary. Add a term when you want glosslint to enforce its spelling, control its capitals, flag words to avoid, or print a definition alongside every finding.

## A complete term

Only `term` is required, so a minimal entry can be `{ term: "Checkout" }`. Adding descriptions, nuance, avoid words, examples, and links gives people and coding agents the context behind each finding:

```ts
{
  term: "Dock",
  description: "A powered stand where one bike is locked.",
  nuance: "A station is a group of docks.",
  avoid: [{ word: "rack", why: "Racks are unpowered." }, "bay"],
  examples: { good: ["Return the bike to any dock"], bad: ["Return the bike to any rack"] },
  links: [{ title: "Docks", url: "https://example.com/docs/docks" }],
}
```

## Term fields

| Field          | What it does                                                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `term`         | The term as it should be written, such as `Dock` or `eBike`. Required.                                                                                                                                          |
| `description`  | What the concept is, in one sentence. Every finding about the term prints it.                                                                                                                                   |
| `nuance`       | How the term differs from near ones and when not to use it. Every finding's message prints it, and it is the finding's `why` unless an avoid word gives its own reason.                                         |
| `avoid`        | Words to report in favour of this term. Each is a string, or `{ word, why }` where `why` becomes the finding's reason.                                                                                          |
| `examples`     | `{ good, bad }`: strings that `glosslint test` expects to pass and to be reported. They are the term's tests.                                                                                                   |
| `links`        | `[{ title, url }]`, pages that explain the term. The first `url` becomes the finding's `see`.                                                                                                                   |
| `case`         | How capitals are checked: `exact`, `spelling` (the default), or `context`. See [Casing rules](/guide/casing).                                                                                                   |
| `casing`       | This term's case style per kind of text, over the corpus's `casing`, such as `{ label: "as-written" }`. A term with `casing` and no `case` is a `context` term. See [Casing rules](/guide/casing).              |
| `abbr`         | Abbreviations of the term, such as `DP` for Day Pass. They are always checked as `exact`.                                                                                                                       |
| `skip`         | `["lower"]`, `["upper"]`, or both: whole-word casings that always pass. The [tech preset](/guide/presets) sets both, as [case-police](/guide/case-police) does, so `github` and `GITHUB` pass while `Github` is reported. |
| `forms`        | Other forms per locale, such as `{ de: ["Dockingstation", "Dockingstationen"] }`. They go to [x18n](/integrations/x18n)'s glossary as they are, and `glosslint explain` finds a term by its forms.              |
| `translations` | The term's translation per locale, such as `{ de: "Dock" }`, passed to [x18n](/integrations/x18n)'s glossary as it is.                                                                                          |

## Avoid words

Each entry in `avoid` is either a plain string like `"bay"` or an object `{ word, why }` like `{ word: "rack", why: "Racks are unpowered." }`. When `why` is set, it becomes the finding's reason instead of `nuance`.

Matching follows three rules:

- Avoid words match in any case.
- An avoid word with two capitals in a row, such as `SM`, matches only as written.
- An avoid word with the same key as a term, such as `day-pass` for Day Pass, counts as a misspelling of that term and gives `GLOSSLINT_TERM`, not `GLOSSLINT_AVOID`. See [Findings](/reference/findings).

> [!NOTE]
> A term's key is its words joined and lowercased, letters and digits only. See [The corpus](/guide/corpus) for how keys work during merging.

## Plurals

Plurals ending in `s` or `es` match both terms and avoid words. You do not need to list plural forms separately in `avoid`: glosslint reports `"racks"` and suggests `"docks"`.

## Testing terms with examples

The `examples` field holds `{ good, bad }` lists that act as the term's tests. When you run `glosslint test` through the [CLI](/integrations/cli), every string in `good` must pass with no findings, and every string in `bad` must give a finding for that term. Run `glosslint test` in CI and after editing your corpus.
