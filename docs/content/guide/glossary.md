---
title: glossary.md
navigation.title: glossary.md
navigation.order: 3
description: "Write and parse .agents/glossary.md: corpus and term fields, file structure, value syntax, validation codes, parsed JSON, and the doctor command."
icon: i-lucide-file-text
---

`.agents/glossary.md` is a plain UTF-8 Markdown file without a byte order mark. It defines a project's vocabulary: preferred terms, meanings, usage notes, words to avoid, examples, links, and casing rules. People and coding agents read it as raw source. Linters, editor plugins, translation tools, and documentation scripts parse it for structured data.

The [CLI](/integrations/cli), ESLint (`glosslint()`), Oxlint, and `fromGlossary()` load `.agents/glossary.md` relative to the project root by default. Override the path with `--glossary <path>`, `glossary` in ESLint, `settings.glosslint.glossary` in Oxlint, or `fromGlossary(path)`.

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

In the rules below, **must** marks a rule that invalidates the file when broken, **should** marks canonical form that a tolerant reader accepts and normalizes, and **may** marks an optional feature.

## Corpus fields

Corpus fields appear after the introduction and before the first `##` heading. All are optional and should appear in this canonical order:

| Field | Form | Parsed property | What it sets |
| --- | --- | --- | --- |
| `Presets` | Comma or `-` list | Merged into `terms`, `allow`, `casing` | Preset names (`tech`, `inclusive`) merged left to right before the file's own entries ([Presets](/guide/presets)). |
| `Allow` | Comma or `-` list | `allow` | Non-empty phrases never reported, such as `check out our, roof rack`. Appended after presets' `allow` lists. |
| `Casing` | Comma or `-` list | `casing` | `<kind> <style>` pairs for `context` terms, merged over presets' `casing` ([Casing rules](/guide/casing)). Kind: `label`, `header`, `sentence`. Style: `title`, `sentence`, `lower`, `upper`, `as-written`. |

Each corpus field must appear at most once. Writing `Presets` or `Allow` inside a `##` term section must be rejected. `Casing` is valid in both sections.

## Term fields

Each `##` heading defines one term. All fields below it are optional, so a bare heading such as `## eBike` or `## Checkout` is valid. Fields should appear in this canonical order:

| Field | Form | `defineCorpus` property | What it does |
| --- | --- | --- | --- |
| `## Heading` | Heading (required) | `term` | Term as written, such as `Dock` or `eBike`. |
| `## Term (AB)` | Heading suffix | `abbr` | Single-word abbreviations in parentheses, such as `DP`. Always checked as `exact`. |
| `What` | Text | `description` | Definition printed on every finding. |
| `How` | Text | `nuance` | Distinction from nearby terms. Shown in ESLint and Oxlint messages, and fallback `why`. |
| `Why` | Text | `why` | Reason for the term. Fallback `why` for avoid items, and shown in `glosslint explain`. |
| `Avoid` | Comma or `-` list | `avoid` | Words to avoid, written as `word` or `word: reason` ([Avoid entries](#avoid-entries)). |
| `Good` | `-` list | `examples.good` | Strings that must pass with no findings for the term. |
| `Bad` | `-` list | `examples.bad` | Strings that must trigger a finding for the term. |
| `Links` | `-` list | `links` | `[title](url)` links (`http://` or `https://`). First URL becomes `see`. |
| `Case` | Single value | `case` | `exact`, `spelling` (default), or `context` ([Casing rules](/guide/casing)). |
| `Casing` | Comma or `-` list | `casing` | `<kind> <style>` pairs overriding the glossary's `Casing`, such as `label as-written`. Without `Case`, makes the term `context` ([Casing rules](/guide/casing)). |

Each term field must appear at most once per term. Writing any term field other than `Casing` before the first `##` heading must be rejected.

Plurals ending in `s` or `es` match terms and avoid words: listing `rack` also flags `"racks"` and suggests `"docks"`.

`glosslint doctor` runs each term's `Good` and `Bad` examples against the file and its `Presets` (`GLOSSLINT_G009`). `glosslint test` runs them against the full loaded corpus, including presets and anything a `--corpus` module adds.

Options the glossary has no field for (`skip`, `forms`, `translations`, `wholeLabel`) and multi-corpus merging live in [`defineCorpus`](/guide/corpus), built on top of `.agents/glossary.md`.

## Term headings

Headings follow ATX Markdown syntax: up to 3 leading spaces, `##`, at least one space or tab, the heading text, and optional closing `#` characters preceded by space or tab. `##Dock` without a space is not a heading. Canonical files should omit closing `#` characters and leading spaces.

```md
## Dock
## Day Pass (DP)
## Day Pass (DP, D)
```

- **Term name.** The heading text before any trailing parenthetical `(...)`, trimmed. It must contain at least one Unicode letter or digit (`termKey(name)` must be non-empty) and must not contain `(` or `)`.
- **Abbreviations.** An optional single parenthetical at the end of the heading holds one or more comma-separated abbreviations parsed into `abbr`. Each entry is trimmed, and empty entries such as `## Day Pass ()` or `## Day Pass (DP,)` must be rejected. Every entry must match `/^(?:\p{Lu}|\S+\p{Lu}\S*)$/u`: a single non-whitespace token that is either one Unicode uppercase letter (`D`) or contains a Unicode uppercase letter after its first character (`DP`, `eB`, `2FA`). Multi-word notes or regular capitalized words such as `(day ticket)` or `(Pass)` must be rejected (`GLOSSLINT_G007`).
- **Uniqueness (`termKey`).** Readers normalize term identity with `termKey`: split on whitespace, `-`, `‐`, `‑`, `_`, `/`, `.`, and camelCase boundaries, join with no separator, lowercase, and remove everything outside Unicode letters and digits (`/[^\p{L}\p{N}]/gu`). For example, `Day Pass`, `day-pass`, and `dayPass` all produce `daypass`. Two `##` headings in the same file must not share a `termKey` (`GLOSSLINT_G005`). A term in the file may share a `termKey` with a term from `Presets`, replacing the preset entry completely.

### Casing inference

When building a term object, the parser resolves `case` in this order:

1. If `Case:` is present, set `case` to that value. Explicit `Case:` always wins; `## eBike` with `Case: spelling` produces `"case": "spelling"`.
2. Otherwise, if term-level `Casing:` is present, omit `case`, even if the heading has inner capitals. Consumers treat a term with `casing` and no `case` as `context`.
3. Otherwise, if the term name contains a Unicode letter immediately followed by a Unicode uppercase letter (`/\p{L}\p{Lu}/u`, such as `eBike`, `SOS`, or `GitHub`), set `case` to `"exact"`. Regular capitalized words like `Dock` or `Day Pass` do not match because no letter directly precedes the uppercase letter, and lowercase names like `kiosk` need explicit `Case: exact`.
4. Otherwise, omit `case`. Consumers treat an omitted `case` with no term `casing` as `spelling`.
5. Nothing is inferred from `What`, `How`, or `Why`.

## Document structure

A glossary file has four regions in top-to-bottom order:

1. **Title.** A canonical file should begin with `# Glossary` in exact case as its first non-blank block. A missing or differently titled H1 is a non-blocking canonical-form issue (`GLOSSLINT_G001`). A second H1 anywhere in the file must be rejected (`GLOSSLINT_G004`).
2. **Introduction (optional).** Every Markdown block after the H1 and before either the first `##` heading or the first paragraph whose first line matches a field header (`Name:`) is introduction content. Readers ignore the introduction when building structured data, and formatters keep it as written with trailing whitespace trimmed. Any Markdown block except another H1 may appear here, including prose, lists, tables, fenced code blocks, `###` to `######` headings, and HTML comments (`<!-- ... -->`). Because any paragraph starting with 1 to 3 ASCII-letter words followed by `:` ends the introduction, an introduction paragraph must not start with an unknown `Name:` label such as `Note:`.
3. **Corpus fields (optional).** Zero or more file-level fields (`Presets`, `Allow`, `Casing`) between the introduction and the first `##` heading.
4. **Term sections (optional).** Zero or more `##` headings, one per term. Each term section runs until the next `##` heading or end of file. Term order is preserved, and a file may contain zero terms.

### Encoding, line endings, and blank lines

- Readers must decode UTF-8 without a byte order mark and accept both LF (`\n`) and CRLF (`\r\n`) line endings.
- Canonical files should use LF line endings, no trailing spaces on any line, and exactly one final newline.
- Blank lines (lines containing only whitespace) end every block except fenced code blocks, which are only valid in the introduction.
- Canonical files should place **one blank line** after `# Glossary`, between introduction blocks, after the introduction, before every `##` heading, and between paragraphs of a multi-paragraph text field.
- Canonical files should place **no blank line** between a `##` heading and its first field, between consecutive corpus fields, between consecutive term fields, or between a list field header and its `-` items.

Markdown previewers collapse consecutive field lines into one paragraph, and Markdown formatters such as Prettier indent a field line after a list into the last bullet. Exclude `.agents/glossary.md` from Markdown formatters and read it as source.

## Field syntax

### Field headers, case sensitivity, and aliases

A field header matches:

```regex
/^ {0,3}([A-Za-z]+(?: [A-Za-z]+){0,2}):(?:[ \t]+(.*))?$/
```

This matches up to 3 leading spaces, 1 to 3 ASCII-letter words separated by single spaces, a colon `:`, and either end-of-line or at least one space or tab before the value. A line with no space after the colon, such as `What:text`, does not match as a field header.

Canonical field names are exact English Title Case: `Presets`, `Allow`, `Casing`, `What`, `How`, `Why`, `Avoid`, `Good`, `Bad`, `Links`, and `Case`. A tolerant reader may also accept these forms while flagging `GLOSSLINT_G002`, and `doctor --fix` renames them:

- Other capitalizations of a canonical name, such as `what:` or `AVOID:`.
- Case-insensitive aliases: `Extends` for `Presets`, `Description` and `Meaning` for `What`, `Notes` and `Nuance` for `How`, and `See`, `Related`, and `Related links` for `Links`.
- Close typos of canonical names in the same section within Levenshtein edit distance `max(2, floor(name.length / 3))`, as long as the name is not a field or alias of the other section.

A field name that is not canonical, an alias, or a close typo for the current section must be rejected (`GLOSSLINT_G004`).

### Consecutive lines and continuations

Inside a paragraph of consecutive non-blank lines, a subsequent line starts a new field when its header name is a known field or alias in any case, or a single word of 4 or more ASCII letters within Levenshtein edit distance 1 of one. Any other non-blank line continues the field above it:

```md
## Dock
What: A powered stand
see below: it charges.
```

Here `see below: it charges.` stays part of `What` because `see below` is not a known field or near-miss typo. By contrast, `Avod: rack` on the next line starts a new field because `avod` is 1 edit from `avoid`. At the start of a new paragraph (after a blank line or a list), any line matching the field header pattern is treated as a field header, so an unknown label such as `Example: ...` on its own paragraph is rejected instead of continuing a text field.

### Text, value, and list fields

- **Text fields (`What`, `How`, `Why`).** May span multiple lines and multiple paragraphs separated by blank lines, provided no paragraph starts with a field header. On load, the parser trims all non-empty lines across all paragraphs and joins them with a single space. Formatters keep original line and paragraph breaks. An empty text field must be rejected (`GLOSSLINT_G006`).
- **Value field (`Case`).** Takes a single value on the field line, with consecutive non-blank continuation lines trimmed and joined with a single space. It must not be empty (`GLOSSLINT_G006`) and must not be followed by a list or another paragraph (`GLOSSLINT_G004`).
- **List fields (`Presets`, `Allow`, `Casing`, `Avoid`, `Good`, `Bad`, `Links`).**
  - Canonical bullets start with `-`, preceded by up to 3 leading spaces and followed by a space or tab and item text. A tolerant reader may accept `*` and `+` bullets as layout issues (`GLOSSLINT_G003`).
  - Indented continuation lines under a bullet (starting with spaces or tabs, not starting another block, and not matching a field line) are trimmed and joined to that item with a single space. A list ends when an indented line with up to 3 leading spaces matches a field line, even if a Markdown formatter indented it after the list.
  - `Presets`, `Allow`, `Casing`, and `Avoid` may be written either as a `-` list or as an inline comma-separated list on the field line, with consecutive non-blank continuation lines joined with a single space before splitting.
  - `Good`, `Bad`, and `Links` should be written as `-` lists. A tolerant reader may read an inline value on one of those fields as a single item without comma splitting and flag a layout issue (`GLOSSLINT_G003`).
  - A tolerant reader may merge inline entries with a following bullet list, or merge bullet lists split by blank lines, while flagging a layout issue (`GLOSSLINT_G003`).
  - An empty list field or an empty bullet item such as a bare `-` must be rejected (`GLOSSLINT_G006`).

### Comments and disallowed blocks

This format has no comment syntax. HTML comments (`<!-- ... -->`) are scanned as ordinary paragraphs:

- In the introduction, an HTML comment is ignored as introduction prose and kept verbatim by formatters.
- Inside a text field (`What`, `How`, `Why`), an HTML comment becomes literal text in that field's value.
- Anywhere else (between corpus fields, before a term's first field, or after a list or value field), an HTML comment must be rejected as stray text (`GLOSSLINT_G004`).

Outside the introduction, readers must reject stray prose before a term's first field or after a list or value field, a list before the first field or after a text or value field, Markdown tables (`| ...`), fenced code blocks (`` ``` `` or `~~~`), sub-headings (`###` to `######`), and a second `#` heading (`GLOSSLINT_G004`).

## Value rules

### Comma splitting

Inline lists (`Presets`, `Allow`, `Casing`, `Avoid`) split on `,` characters outside backticks, where `` ` `` toggles backtick mode. Each piece is trimmed and empty pieces such as a trailing comma are dropped. Only `Avoid` strips backticks from the resulting item; in `Allow`, backticks remain literal characters.

### Avoid entries

Write one entry per line as a `-` list, each as `word` or `word: reason`:

```md
Avoid:
- bay
- rack: Racks are unpowered.
- slot: Ops: only
- `zone: west`: Retired name.
```

For short lists, put entries on one line separated by commas, wrapping any word that contains a comma or colon in backticks:

```md
Avoid: rack, stand, `bay, berth`: Old words.
```

- **Backticked word.** If the item matches `` /^`([^`]*)`(?::(?:\s+([\s\S]*))?)?$/ ``, the text inside backticks is trimmed as `word` with the backticks dropped, and any trimmed text after `:` and whitespace becomes `why`. Use backticks when `word` contains `,` in an inline list or `: ` before a reason. Space or tab is required between `:` and the reason.
- **Plain word.** Otherwise, split at the first colon followed by whitespace or end-of-string (`/:(?:\s|$)/`) and trim both sides. A colon with no following space, such as `pod:x`, does not split, and later colons stay inside `why`, so `slot: Ops: only` parses as word `"slot"` and reason `"Ops: only"`.
- **Output shape.** An item with a non-empty `why` parses as `{ "word": "...", "why": "..." }`. An item with no `why`, including a trailing `word:`, parses as the plain string `"word"`.
- **Matching and reasons.** An avoid finding's `why` uses the entry's own reason first, then the term's `Why`, then `How`. Avoid words match in any case unless they contain two consecutive capitals like `SM`, which matches as written. An avoid word sharing a `termKey` with its own term, such as `day-pass` for `Day Pass`, reports `GLOSSLINT_TERM` instead of `GLOSSLINT_AVOID`.
- **Conflict rules.** `termKey(word)` must be non-empty (`GLOSSLINT_G006`). An avoid word must not equal its own term after trimming, collapsing internal whitespace to single spaces, and lowercasing (`GLOSSLINT_G008`). Its `termKey` must not match another term defined in the same file (`GLOSSLINT_G008`). An avoid word with the same `termKey` as its own term but different spelling or punctuation, such as `check-out` under `## Checkout`, is allowed. Conflicts are checked against terms defined in the same file, not terms imported through `Presets`.

### Links entries

Each item of `Links` should match `[title](url)` where `title` has at least one non-whitespace character and no `]`, and `url` starts with `http://` or `https://` with no whitespace or parentheses:

```regex
/^\[([^\]]*\S[^\]]*)\]\((https?:\/\/[^\s()]+)\)$/
```

`title` is trimmed on load, producing `{ "title": "...", "url": "..." }`. A tolerant reader may accept a bare `http://` or `https://` URL (optionally wrapped in `<...>`) as `{ "title": url, "url": url }`, rewriting it to `[url](url)` as a layout fix (`GLOSSLINT_G003`). Any other scheme, relative path, empty title, or plain text must be rejected (`GLOSSLINT_G006`).

### Case, Casing, and Presets values

- **`Case`** must be `exact`, `spelling`, or `context` in exact lowercase (`GLOSSLINT_G006`).
- **`Casing`** items must match `/^(label|header|sentence)\s+(title|sentence|lower|upper|as-written)$/` in exact lowercase (`GLOSSLINT_G006`). Pairs collect into an object keyed by kind; if a kind repeats in one field, the later value overwrites the earlier one.
- **`Presets`** accepts `tech` and `inclusive` in exact lowercase (`GLOSSLINT_G006`). Other tools that do not bundle `tech` and `inclusive` either reject unknown preset names or define their own preset map.

## Validation and doctor

```sh
npx glosslint doctor        # validate format, values, and Good/Bad examples
npx glosslint doctor --fix  # rewrite G001-G003 into canonical form
```

Loaders read files with only `GLOSSLINT_G001` to `GLOSSLINT_G003` as their fixed form would read, and `doctor --fix` rewrites them into canonical form. Any `GLOSSLINT_G004` to `GLOSSLINT_G008` error blocks loading and causes `doctor --fix` to leave the file untouched so it never drops text. `glosslint check` always skips the glossary file it loaded directly.

For `GlosslintConfigError` fields, exit codes, and detailed examples of every code, see [Config and glossary errors](/guide/config-errors).

### Blocking errors

A reader must reject the file and produce no corpus when any of these occur:

| Condition | Code |
| --- | --- |
| Unknown field, misplaced field, second `#` heading, or disallowed block outside the introduction (stray text, misplaced list, table, code fence, `###` to `######` heading) | `GLOSSLINT_G004` |
| Duplicate term (`termKey`) or duplicate field in the same section | `GLOSSLINT_G005` |
| Empty field, empty list item, invalid `Case`, invalid `Casing` pair, unknown `Presets` name, `Avoid` word with no letters or digits, or invalid `Links` item | `GLOSSLINT_G006` |
| Term heading with no letters or digits, parentheses outside a trailing abbreviation group, or a non-abbreviation token in parentheses | `GLOSSLINT_G007` |
| `Avoid` word matching its own term (case and whitespace insensitive) or another term's `termKey` in the same file | `GLOSSLINT_G008` |

### Non-canonical warnings

A tolerant reader may load the file as its normalized form while reporting these issues, and a formatter should rewrite them into canonical form:

| Condition | Code |
| --- | --- |
| Missing `# Glossary` H1 or an H1 with another title | `GLOSSLINT_G001` |
| Field name in another case, a known alias, or a close typo | `GLOSSLINT_G002` |
| Layout differences: wrong blank-line counts, out-of-order fields, `*` or `+` bullets, split lists, mixed inline and bullet items, inline entry on `Good`/`Bad`/`Links`, bare `http(s)` URL under `Links`, leading spaces or closing `#`s on headings, CRLF endings, trailing spaces, or missing/extra final newline | `GLOSSLINT_G003` |

Failing `Good` or `Bad` examples (`GLOSSLINT_G009`) do not invalidate the file structure and should not block loading.

## Full example

This canonical glossary file parses with no warnings into the JSON object in the second tab:

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
        {
          "word": "rack",
          "why": "Racks are unpowered."
        },
        "bay",
        {
          "word": "zone: west",
          "why": "Retired name."
        }
      ],
      "examples": {
        "good": [
          "Return the bike to any dock"
        ],
        "bad": [
          "Return the bike to any rack"
        ]
      },
      "links": [
        {
          "title": "Docks",
          "url": "https://example.com/docs/docks"
        }
      ]
    },
    {
      "term": "eBike",
      "case": "exact"
    },
    {
      "term": "Day Pass",
      "abbr": [
        "DP"
      ],
      "case": "context"
    },
    {
      "term": "Ride history",
      "casing": {
        "label": "as-written"
      }
    }
  ],
  "allow": [
    "check out our",
    "roof rack"
  ],
  "casing": {
    "label": "sentence",
    "header": "title"
  }
}
```
::

`allow` is always an array (`[]` when `Allow:` is omitted). `casing` on the corpus and optional properties on each term are omitted when unset.

Including `Presets: tech, inclusive` before `Allow:` prepends the `tech` and `inclusive` terms, `allow` phrases, and `casing` defaults ahead of the file's own entries in listed order.

## Implementing a reader

1. Decode UTF-8 without a BOM, split on `/\r?\n/`, and drop one trailing empty line if the file ended with a newline.
2. Scan lines into blocks: fenced code blocks, ATX headings (`#` to `######`), pipe tables, unordered lists (stopping indented continuations at field lines), and paragraphs.
3. Read `# Glossary` as the first block, then collect introduction blocks until the first `##` heading or the first paragraph whose first line matches the field header regex. Reject any second H1.
4. Parse blocks before the first `##` as corpus fields (`Presets`, `Allow`, `Casing`) and each `##` section as a term heading plus term fields (`What`, `How`, `Why`, `Avoid`, `Good`, `Bad`, `Links`, `Case`, `Casing`).
5. Validate heading names, trailing `(Abbr, ...)` tokens, `termKey` uniqueness, field placement and uniqueness, and value syntax. Reject blocking errors (`G004` to `G008`) instead of dropping unknown content.
6. Join text field lines and paragraphs with single spaces, split comma lists outside backticks, parse `Avoid` entries (`word` vs `word: reason`, dropping backticks around `word`), and infer `"case": "exact"` from `/\p{L}\p{Lu}/u` only when neither `Case` nor term `Casing` is present.
7. Check `Avoid` entries against the file's own terms (trimmed, collapsed, lowercased equality for the same term; `termKey` equality for other terms), then merge any supported `Presets` left to right beneath the file's terms, `allow`, and `casing`.
