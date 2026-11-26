---
title: The glossary file
description: Format rules, corpus and term fields, avoid reasons, casing inference, and how doctor repairs the glossary file.
navigation.order: 3
icon: i-lucide-file-text
---

The CLI, ESLint (`glosslint()`), Oxlint, and `fromGlossary()` load `.agents/glossary.md` by default. Override the path with `--glossary <path>`, `glossary` in ESLint, `settings.glosslint.glossary` in Oxlint, or `fromGlossary(path)`.

```md [.agents/glossary.md]
# Glossary

<!-- Format and checks: https://glosslint.onmax.me/guide/glossary -->

The words the rider app and the help center use.

Extends: tech, inclusive
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

Paragraphs between `# Glossary` and the first field or `##` heading stay as introduction prose.

## Syntax rules

- Fields start with `Name:` on consecutive lines under `# Glossary` or `##`. Unknown names, other heading levels, tables, code fences, and stray text report `GLOSSLINT_G004`.
- Text fields (`What`, `How`, `Why`) join multiple lines with a space on load.
- List fields (`Avoid`, `Good`, `Bad`, `Links`) take `-` bullets. `Extends`, `Allow`, `Casing`, and `Avoid` also accept comma-separated items on one line.
- Ignore `.agents/glossary.md` in Prettier; Markdown formatters indent a field after a list into the last item.

## Corpus fields

Place before the first `##` heading in canonical order:

| Field | Syntax | What it sets |
| --- | --- | --- |
| `Extends` | Comma or `-` list | Presets merged first: `tech`, `inclusive` ([Presets](/guide/presets)). |
| `Allow` | Comma or `-` list | Phrases never reported, such as `check out our, roof rack`. |
| `Casing` | `<kind> <style>` list | Style for `context` terms. Kind: `label`, `header`, `sentence`. Style: `title`, `sentence`, `lower`, `upper`, `as-written`. |

## Term fields

Each `##` heading defines one term. Fields go in canonical order and all are optional; a minimal term is `## Checkout`:

| Glossary field | `defineCorpus` | What it does |
| --- | --- | --- |
| `## Heading` | `term` | Required. Term as written, such as `Dock` or `eBike`. |
| `## Term (AB)` | `abbr` | Abbreviations in parentheses, such as `DP`. Always `exact`. |
| `What` | `description` | Definition printed on every finding. |
| `How` | `nuance` | Distinction from nearby terms. Shown in ESLint and Oxlint messages, and fallback `why`. |
| `Why` | `why` | Reason for the term. Fallback `why` for avoid items, and shown in `glosslint explain`. |
| `Avoid` | `avoid` | Comma or `-` list of `word` or `word: reason`. |
| `Good` / `Bad` | `examples` | `-` list of test strings run by `doctor` (`GLOSSLINT_G009`) and `glosslint test`. |
| `Links` | `links` | `-` list of `[title](url)` (`http://` or `https://`). First URL becomes `see`. |
| `Case` | `case` | `exact`, `spelling` (default), or `context` ([Casing rules](/guide/casing)). |

Plurals ending in `s` or `es` match terms and avoid words: listing `rack` also flags `"racks"` and suggests `"docks"`.

`Good` strings must pass with no findings for the term; `Bad` strings must trigger one. `glosslint doctor` runs them against the file and its `Extends` presets; `glosslint test` runs them against the full loaded corpus, including presets and config.

### Avoid entries

Write one entry per line as a `-` list:

```md
Avoid:
- bay
- rack: Racks are unpowered.
- slot: Ops: only
- `zone: west`: Retired name.
```

- `bay` is a plain avoid word with no custom reason.
- `rack: Racks are unpowered.` splits at the first colon followed by a space into the word `"rack"` and its reason.
- `slot: Ops: only` splits only at the first `: `, so `"Ops: only"` stays intact as the reason.
- `` `zone: west`: Retired name. `` wraps the word in backticks because it contains a colon followed by a space; glosslint strips the backticks on load.

For short lists you can put entries on one line separated by commas, wrapping any word that contains a comma or colon in backticks:

```md
Avoid: rack, stand, `bay, berth`: Old words.
```

An avoid finding's `why` uses the entry's own reason first, then the term's `Why`, then `How`. Avoid words match in any case unless they contain two consecutive capitals like `SM`, which matches as written. An avoid word sharing a key with the term, such as `day-pass` for `Day Pass`, reports `GLOSSLINT_TERM` instead of `GLOSSLINT_AVOID`.

## Heading inference

- **Abbreviations.** `## Day Pass (DP)` or `## Day Pass (DP, D)` sets `abbr`. Only single-word abbreviations with one uppercase letter or an uppercase letter after the first character (`DP`, `D`, `eB`) are allowed; prose in parentheses reports `GLOSSLINT_G007`.
- **Automatic `exact`.** Names with a capital right after a letter (`eBike`, `SOS`) default to `Case: exact` unless `Case:` sets another mode. Lowercase names like `kiosk` need `Case: exact`.

## Canonical layout and `doctor`

```sh
npx glosslint doctor        # validate format, values, and Good/Bad examples
npx glosslint doctor --fix  # rewrite G001-G003 into canonical form
```

- `GLOSSLINT_G001`: missing or wrong `# Glossary` title.
- `GLOSSLINT_G002`: wrong field casing (`what:`), aliases (`Description` or `Meaning` for `What`, `Notes` or `Nuance` for `How`, `See`, `Related`, or `Related links` for `Links`), or close typos.
- `GLOSSLINT_G003`: layout issues: blank lines inside a term, `*` or `+` bullets, bare URLs under `Links`, out-of-order fields, CRLF, trailing spaces, or missing final newline.

Loaders still read files with only `G001` to `G003` as their fixed form would read. `GLOSSLINT_G004` through `GLOSSLINT_G008` block loading, and `doctor --fix` leaves the file untouched ([Config and glossary errors](/reference/config-errors)). `glosslint check` always skips the glossary file it loaded directly.

For config-only options (`skip`, `forms`, `translations`, per-term `casing`, `wholeLabel`), layer [`defineCorpus`](/guide/corpus) on top of `.agents/glossary.md`.
