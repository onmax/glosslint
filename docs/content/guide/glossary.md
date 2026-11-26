---
title: The glossary file
description: "Write your product glossary in .agents/glossary.md: format rules, every field, casing inference, canonical layout, and migrating from 0.0.1."
navigation.order: 3
icon: i-lucide-file-text
---

`.agents/glossary.md` is the default source of truth for glosslint. People and coding agents read it directly, and the CLI, ESLint (`glosslint()` with no options), Oxlint, and `fromGlossary()` all load it automatically. Pass `--glossary <path>` on the CLI, `glossary` in ESLint, `settings.glosslint.glossary` in Oxlint, or a path to `fromGlossary(path)` when you keep the file somewhere else.

## Full example

A glossary starts with `# Glossary`, optional introduction prose, optional corpus fields (`Extends`, `Allow`, `Casing`), and one `##` section per term:

```md [.agents/glossary.md]
# Glossary

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

Any paragraph between `# Glossary` and the first field or `##` heading is introduction prose. glosslint keeps it when formatting the file and does not parse it as fields.

## File structure and syntax

Every field is a paragraph whose first line starts with one to three words and a colon (`What:`, `Avoid:`, `Case:`). Field names are fixed English names. An unknown field name raises an error (`GLOSSLINT_G004`) rather than being treated as prose, so a typo never disappears quietly.

- Text fields (`What`, `How`, `Why`) hold plain text. Line breaks and continuation paragraphs under a text field are kept as written in the file and joined by one space when loaded into the corpus.
- List fields (`Avoid`, `Good`, `Bad`, `Links`) take `-` bullet items. `Extends`, `Allow`, `Casing`, and `Avoid` also accept a comma-separated list on the field's own line, such as `Avoid: customer, rider account`.
- Headings above `##` (such as a second `#` heading) and sub-headings (`###` to `######`), tables, code fences, and stray text outside a text field are not allowed in a glossary file and report `GLOSSLINT_G004`.

## Corpus fields

Corpus fields appear before the first `##` term heading, in this canonical order:

| Field     | Syntax                                                    | What it sets                                                                                                              |
| --------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Extends` | Comma list or `-` list of preset names                    | Presets merged in order before the file's terms. Valid names are `tech` and `inclusive`. See [Presets](/guide/presets).   |
| `Allow`   | Comma list or `-` list of phrases                         | Phrases never reported, such as `check out our, roof rack`.                                                               |
| `Casing`  | Comma list or `-` list of `<kind> <style>` pairs          | Default style for `context` terms. Kind is `label`, `header` or `sentence`; style is `title`, `sentence`, `lower`, `upper` or `as-written`. |

## Term fields

Each `##` heading defines one term. Term fields appear in this canonical order:

| Field   | Corpus property | Syntax                                 | What it does                                                                                                               |
| ------- | --------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `What`  | `description`   | Text                                   | What the concept is, printed on every finding about the term.                                                              |
| `How`   | `nuance`        | Text                                   | How the term differs from nearby concepts and when not to use it. Fallback `why` when neither the avoid word nor `Why` gives one. |
| `Why`   | `why`           | Text                                   | Why the project uses this term. Used as `why` on avoid findings whose avoid item has no reason of its own.                 |
| `Avoid` | `avoid`         | Comma list or `-` list                 | Words to avoid, written as `word` or `word: reason`.                                                                       |
| `Good`  | `examples.good` | `-` list                               | Example strings that must pass with no findings for this term.                                                             |
| `Bad`   | `examples.bad`  | `-` list                               | Example strings that must produce a finding for this term.                                                                 |
| `Links` | `links`         | `-` list of `[title](url)`             | Reference pages with `http://` or `https://` URLs. The first URL becomes the finding's `see`.                              |
| `Case`  | `case`          | `exact`, `spelling` or `context`       | How capitals are checked on this term. See [Casing rules](/guide/casing).                                                  |

Every field is optional. A minimal term can be just `## Checkout`.

### Writing `Avoid` entries

Each item in `Avoid` is either `word` or `word: reason`, split at the first colon followed by a space. Wrap a word in backticks when it contains a comma or a colon; glosslint drops the backticks when loading:

```md
Avoid: rack, `bay, berth`: Old words., `pod:x`, slot: Ops: only
```

That line defines four avoid entries: `"rack"`, `{ word: "bay, berth", why: "Old words." }`, `"pod:x"`, and `{ word: "slot", why: "Ops: only" }`.

## How headings and casing are inferred

Two rules apply when reading `##` headings:

- **Abbreviations in parentheses.** `## Day Pass (DP)` or `## Day Pass (DP, D)` sets the term to `Day Pass` and `abbr` to `["DP"]` or `["DP", "D"]`. Parentheses in a heading may hold only abbreviations: single words that are one uppercase letter or contain an uppercase letter after the first character (such as `DP`, `D`, or `eB`). Explanatory text in parentheses reports `GLOSSLINT_G007`; move it to `How:`.
- **Automatic `exact` casing.** A term whose name has an uppercase letter immediately after any letter, such as `eBike` or `SOS`, defaults to `Case: exact` unless `Case:` sets another mode. A lowercase word like `kiosk` does not infer `exact` from prose in `How:` (even if `How:` says "Always lowercase."); write `Case: exact` explicitly.

## Canonical layout and `glosslint doctor`

`glosslint doctor` checks `.agents/glossary.md` against the format rules and tests its `Good` and `Bad` examples (`GLOSSLINT_G009`).

```sh
npx glosslint doctor --fix
```

Problems `GLOSSLINT_G001` through `GLOSSLINT_G003` are fixable:

- `GLOSSLINT_G001`: missing `# Glossary` title, or a different H1 title.
- `GLOSSLINT_G002`: wrong casing on a field name (`what:`), an alias (`Description` or `Meaning` for `What`, `Notes` or `Nuance` for `How`, `See`, `Related` or `Related links` for `Links`), or a typo close to a valid field name.
- `GLOSSLINT_G003`: layout issues such as two fields in one paragraph, `*` or `+` bullets, a bare URL under `Links` (rewritten to `[url](url)`), fields out of canonical order, wrong blank lines, CRLF endings, trailing spaces, or a missing final newline.

Loaders (`fromGlossary`, ESLint, Oxlint, and `glosslint check`) still read a file that has only `G001` to `G003` problems as its fixed form would read. Problems `GLOSSLINT_G004` through `GLOSSLINT_G008` block loading, and `doctor --fix` leaves the file untouched when one is present so it never drops text. See [Config and glossary errors](/reference/config-errors) for every `GLOSSLINT_G00x` code.

Canonical form uses `# Glossary`, the introduction as written, corpus fields in order, then terms in file order with fields in order, one blank line between blocks (including between a list field's label and its `-` list), LF line endings, and one final newline. Running `glosslint doctor --fix` a second time makes no changes.

> [!NOTE]
> `glosslint check` automatically skips the glossary file it loaded, whether `.agents/glossary.md` or `--glossary <path>`, even if you pass that file or its folder on the command line.

## When to use `defineCorpus` instead

Five advanced corpus options have no field in `.agents/glossary.md`: `skip`, `forms`, `translations`, per-term `casing`, and `wholeLabel`. Keep your main glossary in `.agents/glossary.md` and extend it from `glosslint.config.ts` with `defineCorpus({ extends: [fromGlossary()], ... })` when you need them. See [defineCorpus](/guide/corpus).

## Coming from 0.0.1

glosslint 0.0.2 removes the Markdown table reader (breaking change). Move your 0.0.1 table rows into `.agents/glossary.md`:

1. Create `.agents/glossary.md` starting with `# Glossary`.
2. Turn each table row into a `## Term` section using `What:` for `Meaning`/`Description`, `How:` for `Notes`, `Avoid:` for `Avoid`, and `Links:` for `Links`. Move any presets and `allow` phrases to `Extends:` and `Allow:` at the top.
3. Run `npx glosslint doctor --fix` to normalize the layout and check your examples.
4. Remove the table loader call from `glosslint.config.ts`, or delete `glosslint.config.ts` if `.agents/glossary.md` covers every field you use.
