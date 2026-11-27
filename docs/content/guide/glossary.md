---
title: glossary.md
navigation.title: glossary.md
navigation.order: 3
description: Define your project's vocabulary in .agents/glossary.md with preferred terms, words to avoid, casing rules, and examples.
icon: i-lucide-file-text
---

`.agents/glossary.md` is a Markdown file that defines your project's vocabulary for people, coding agents, and glosslint. The [CLI](/integrations/cli), ESLint (`glosslint()`), Oxlint, and `fromGlossary()` read it from `.agents/glossary.md` by default, or from another path with `--glossary <path>`, `glossary` in ESLint, `settings.glosslint.glossary` in Oxlint, or `fromGlossary(path)`.

```md [.agents/glossary.md]
# Glossary

<!-- Format and checks: https://glosslint.onmax.me/guide/glossary -->

The words the rider app and the help center use.

Presets: tech, inclusive
Allow: check out our, roof rack
Casing: label sentence, header title

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

## eBike

## Day Pass (DP)
Case: context
```

## Corpus fields

Optional file-level fields sit above the first `##` heading, written as comma lists or `-` lists. Any text between `# Glossary` and the first field is prose for readers that glosslint ignores, and so are HTML comments there. A comment among the fields or inside a term is a `G004` error; move it to the introduction. So is a comment with no closing `-->`, which would hide the rest of the file.

| Field | Example | What it does |
| --- | --- | --- |
| `Presets` | `Presets: tech, inclusive` | Merges built-in term lists (`tech`, `inclusive`) before your own terms. See [Presets](/guide/presets). |
| `Allow` | `Allow: check out our, roof rack` | Lists phrases glosslint never flags, so `check out` in `"check out our"` and `rack` in `"roof rack"` pass. |
| `Casing` | `Casing: label sentence, header title` | Sets how `Case: context` terms are capitalized in labels, headers, and sentences. See [Casing rules](/guide/casing) for all styles. |

## Term fields

Each `##` heading starts one term. All fields below it are optional, so a bare heading like `## eBike` works on its own. Looking at `## Dock` and `## Day Pass (DP)` above:

| Field | What it does |
| --- | --- |
| `What` | One-sentence definition printed on every finding for the term. |
| `How` | How this term differs from nearby ones, such as a dock versus a station. Appears in ESLint and Oxlint messages and as a fallback reason. |
| `Why` | Why the project prefers this term. Appears in `glosslint explain` and as the fallback reason for `Avoid` words. |
| `Avoid` | Words to flag instead of the term, written as a `-` list or comma list. See [Avoid entries](#avoid-entries). |
| `Good` | `-` list of phrases that must pass with no findings for this term. |
| `Bad` | `-` list of phrases that must trigger a finding for this term. |
| `Links` | `-` list of `[title](url)` links using `http://` or `https://`. Findings print the first URL. |
| `Case` | `spelling` by default, `exact` for one form everywhere, or `context` for label, header, and sentence casing. See [Casing rules](/guide/casing). |
| `Casing` | Overrides the glossary's `Casing` for this term, such as `label as-written`. Setting `Casing` without `Case` treats the term as `context`. See [Casing rules](/guide/casing). |

For options this file has no field for, such as `skip`, `forms`, `translations`, `wholeLabel`, or merging corpora, use [`defineCorpus`](/guide/corpus).

## Term headings, abbreviations, and case

Names with a capital after a letter, like `eBike` or `SOS`, infer `exact` casing, and trailing parentheses hold abbreviations checked as `exact`.

::code-group
```md [.agents/glossary.md]
## Dock

## eBike

## Day Pass (DP)
Case: context

## Ride history
Casing: label as-written
```

```json [Parsed]
[
  {
    "term": "Dock"
  },
  {
    "term": "eBike",
    "case": "exact"
  },
  {
    "term": "Day Pass",
    "abbr": ["DP"],
    "case": "context"
  },
  {
    "term": "Ride history",
    "casing": {
      "label": "as-written"
    }
  }
]
```
::

Parentheses only accept comma-separated abbreviations like `(DP, D)`, not notes like `(day ticket)`. Headings with the same letters and digits, such as `Day Pass`, `day-pass`, and `dayPass`, count as the same term.

## Avoid entries

```md
Avoid:
- bay
- rack: Racks are unpowered.
- `zone: west`: Retired name.
```

For short lists, put entries on one line separated by commas, wrapping any word with a comma or colon in backticks:

```md
Avoid: rack, stand, `bay, berth`: Old words.
```

A finding prints the avoid entry's own reason first, then falls back to the term's `Why` and `How`. Plurals ending in `s` or `es` match automatically, so `rack` also flags `"racks"` and suggests `"docks"`. An avoid word cannot be the term itself or another term in the same file, so use `Case: exact` if you only want to enforce capitalization.

## Layout

- Start the file with `# Glossary`, followed by a blank line.
- Put one field per line with no blank lines inside a term or between corpus fields.
- Leave one blank line before each `##` heading and after the introduction.
- Use `-` bullets for list fields, and always write `Good`, `Bad`, and `Links` as `-` lists.
- Keep Markdown formatters such as Prettier off `.agents/glossary.md` because they reflow field lines into one paragraph and indent fields after lists.

Run `glosslint doctor --fix` to put the file into canonical form.

## `glosslint doctor`

`glosslint doctor` checks `.agents/glossary.md` for formatting mistakes, invalid values, and failing examples.

```sh
npx glosslint doctor        # check format, values, and Good/Bad examples
npx glosslint doctor --fix  # rewrite G001 to G003 into canonical form
```

- **Fixable (`GLOSSLINT_G001` to `GLOSSLINT_G003`).** Missing or wrong `# Glossary` title, field-name case, aliases, or close typos, and layout differences. glosslint still loads the file as its fixed form would read, and `doctor --fix` rewrites it.
- **Blocking (`GLOSSLINT_G004` to `GLOSSLINT_G008`).** Unknown or misplaced fields, duplicates, empty or invalid values, bad headings, and avoid-word conflicts. These block loading, and `doctor --fix` leaves the file untouched so it never drops text.

`glosslint doctor` also runs each term's `Good` and `Bad` examples against the file and its `Presets` (`GLOSSLINT_G009`), which does not block loading. `glosslint test` runs those examples against the full loaded corpus, including presets and anything a `--corpus` module adds.

See [Config and glossary errors](/guide/config-errors) for every code and how to fix it.

## Reading the file from your own tool

Import `fromGlossary` or `readGlossary` from `glosslint` to parse a glossary in JavaScript or TypeScript. For exact parsing rules or readers in another language, read [`src/glossary-text.ts`](https://github.com/onmax/glosslint/blob/main/src/glossary-text.ts).

::code-group
```md [.agents/glossary.md]
# Glossary

<!-- Format and checks: https://glosslint.onmax.me/guide/glossary -->

The words the rider app and the help center use.

Allow: check out our, roof rack
Casing: label sentence, header title

## Dock
What: A powered stand where one bike is locked.
How: A station is a group of docks. Say dock for one stand.
Why: Riders read "dock" on the stand itself.
Avoid:
- rack: Racks are unpowered.
- bay
- `zone: west`: Retired name.
Good:
- Return the bike to any dock
Bad:
- Return the bike to any rack
Links:
- [Docks](https://example.com/docs/docks)

## eBike

## Day Pass (DP)
Case: context

## Ride history
Casing: label as-written
```

```json [corpus.json]
{
  "kind": "glosslint.corpus",
  "terms": [
    {
      "term": "Dock",
      "description": "A powered stand where one bike is locked.",
      "nuance": "A station is a group of docks. Say dock for one stand.",
      "why": "Riders read \"dock\" on the stand itself.",
      "avoid": [
        { "word": "rack", "why": "Racks are unpowered." },
        "bay",
        { "word": "zone: west", "why": "Retired name." }
      ],
      "examples": {
        "good": ["Return the bike to any dock"],
        "bad": ["Return the bike to any rack"]
      },
      "links": [
        { "title": "Docks", "url": "https://example.com/docs/docks" }
      ]
    },
    {
      "term": "eBike",
      "case": "exact"
    },
    {
      "term": "Day Pass",
      "abbr": ["DP"],
      "case": "context"
    },
    {
      "term": "Ride history",
      "casing": { "label": "as-written" }
    }
  ],
  "allow": ["check out our", "roof rack"],
  "casing": {
    "label": "sentence",
    "header": "title"
  }
}
```
::
