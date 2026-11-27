---
title: Glossary format spec
navigation.title: Spec
navigation.order: 5
description: File format specification for .agents/glossary.md, covering structure, fields, value rules, validation, and parsed JSON output.
icon: i-lucide-file-code
---

`.agents/glossary.md` is a plain UTF-8 Markdown file (without a byte order mark) that defines a project's vocabulary: preferred terms, meanings, usage notes, words to avoid, examples, links, and casing rules. It is written to be read as raw source by people and coding agents, and parsed by any tool that needs a shared glossary, such as a linter, editor plugin, translation tool, or documentation script.

Tools look for `.agents/glossary.md` relative to the project root by default. For glosslint's CLI, linter integrations, and `doctor` command, see [The glossary file](/guide/glossary).

In this spec, **must** marks a rule that makes a file invalid when broken, **should** marks canonical form that a tolerant reader may still accept and normalize, and **may** marks an optional feature.

## Document structure

A glossary file consists of four regions in top-to-bottom order:

1. **Title.** A canonical file should begin with `# Glossary` (exact case) as its first non-blank block. A missing or differently titled H1 is a non-blocking canonical-form issue; a second H1 anywhere in the file must be rejected.
2. **Introduction (optional).** Every Markdown block after the H1 and before either the first `##` heading or the first paragraph whose first line matches a field header (`Name:`) is introduction content. Readers ignore the introduction when building structured data, and formatters keep it as written with trailing whitespace trimmed. Any Markdown block except another H1 may appear here, including prose, lists, tables, fenced code blocks, `###` to `######` headings, and HTML comments (`<!-- ... -->`).
3. **Corpus fields (optional).** Zero or more file-level fields (`Presets`, `Allow`, `Casing`) between the introduction and the first `##` heading.
4. **Term sections (optional).** Zero or more `##` headings, one per term. Each term section runs until the next `##` heading or end of file. Term order is preserved. A file may contain zero terms.

Because any paragraph starting with 1 to 3 ASCII-letter words followed by `:` ends the introduction, an introduction paragraph must not start with an unknown `Name:` label such as `Note:`.

### Encoding, line endings, and blank lines

- Readers must decode UTF-8 and accept both LF (`\n`) and CRLF (`\r\n`) line endings.
- Canonical files should use LF line endings, no trailing spaces on any line, and exactly one final newline.
- Blank lines (lines containing only whitespace) end every block except fenced code blocks, which are only valid in the introduction.
- Canonical files should place **one blank line** after `# Glossary`, between introduction blocks, after the introduction, before every `##` heading, and between paragraphs of a multi-paragraph text field.
- Canonical files should place **no blank line** between a `##` heading and its first field, between consecutive corpus fields, between consecutive term fields, or between a list field header and its `-` items.

Markdown previewers collapse consecutive field lines into one paragraph, and Markdown formatters such as Prettier indent a field line after a list into the last bullet. Exclude `.agents/glossary.md` from Markdown formatters and read it as source.

## Corpus fields

Corpus fields appear after the introduction and before the first `##` heading. All are optional and should appear in this canonical order:

| Field | Form | Parsed property | Rules |
| --- | --- | --- | --- |
| `Presets` | Comma or `-` list | Merged into `terms`, `allow`, `casing` | Preset names (`tech`, `inclusive`), exact lowercase, merged left to right before the file's own terms. |
| `Allow` | Comma or `-` list | `allow` | Non-empty phrases to ignore. Appended after presets' `allow` lists. |
| `Casing` | Comma or `-` list | `casing` | `<kind> <style>` pairs for `context` terms. Merged over presets' `casing`. |

- Each corpus field must appear at most once.
- Writing `Presets` or `Allow` inside a `##` term section must be rejected. (`Casing` is valid in both sections.)
- `Extends` is a legacy alias for `Presets` that tolerant readers may accept and rename.

## Term headings

Each `##` heading defines one term:

```md
## Dock
## Day Pass (DP)
## Day Pass (DP, D)
```

Headings follow ATX Markdown syntax: up to 3 leading spaces, `##`, at least one space or tab, the heading text, and optional closing `#` characters preceded by space or tab. `##Dock` without a space is not a heading. Canonical files should omit closing `#` characters and leading spaces.

- **Term name.** The heading text before any trailing parenthetical `(...)`, trimmed. It must contain at least one Unicode letter or digit (`termKey(name)` must be non-empty) and must not contain `(` or `)`.
- **Abbreviations.** An optional single parenthetical at the end of the heading holds one or more comma-separated abbreviations parsed into `abbr`. Each entry is trimmed; empty entries (such as `## Day Pass ()` or `## Day Pass (DP,)`) must be rejected. Every entry must match `/^(?:\p{Lu}|\S+\p{Lu}\S*)$/u`: a single non-whitespace token that is either one Unicode uppercase letter (`D`) or contains a Unicode uppercase letter after its first character (`DP`, `eB`, `2FA`). Multi-word notes or regular capitalized words such as `(day ticket)` or `(Pass)` must be rejected.
- **Uniqueness (`termKey`).** Readers normalize term identity with `termKey`: split on whitespace, `-`, `‐`, `‑`, `_`, `/`, `.`, and camelCase boundaries, join with no separator, lowercase, and remove everything outside Unicode letters and digits (`/[^\p{L}\p{N}]/gu`). For example, `Day Pass`, `day-pass`, and `dayPass` all produce `daypass`. Two `##` headings in the same file must not share a `termKey`. A term in the file may share a `termKey` with a term from `Presets`, replacing the preset entry completely.

## Term fields

All term fields are optional; a bare heading such as `## eBike` is valid. Fields should appear in this canonical order:

| Field | Kind | Form | Parsed property |
| --- | --- | --- | --- |
| `What` | text | Single or multi-line prose | `description` |
| `How` | text | Single or multi-line prose | `nuance` |
| `Why` | text | Single or multi-line prose | `why` |
| `Avoid` | list | Comma or `-` list | `avoid` |
| `Good` | list | `-` list | `examples.good` |
| `Bad` | list | `-` list | `examples.bad` |
| `Links` | list | `-` list | `links` |
| `Case` | value | Single token | `case` |
| `Casing` | list | Comma or `-` list | `casing` |

- Each term field must appear at most once per term.
- Writing any term field other than `Casing` before the first `##` heading must be rejected.
- Corpus options `skip`, `forms`, `translations`, and `wholeLabel` have no fields in this Markdown format.

## Field syntax

### Field headers, case sensitivity, and aliases

A field header matches:

```regex
/^ {0,3}([A-Za-z]+(?: [A-Za-z]+){0,2}):(?:[ \t]+(.*))?$/
```

Up to 3 leading spaces, 1 to 3 ASCII-letter words separated by single spaces, a colon `:`, and either end-of-line or at least one space or tab before the value. A line with no space after the colon (such as `What:text`) does not match as a field header.

Canonical field names are exact English Title Case (`Presets`, `Allow`, `Casing`, `What`, `How`, `Why`, `Avoid`, `Good`, `Bad`, `Links`, `Case`). A tolerant reader may also accept:

- Other capitalizations of a canonical name (such as `what:` or `AVOID:`).
- Case-insensitive aliases: `Extends` for `Presets`, `Description` and `Meaning` for `What`, `Notes` and `Nuance` for `How`, and `See`, `Related`, and `Related links` for `Links`.
- Close typos of canonical names in the same section within Levenshtein edit distance `max(2, floor(name.length / 3))`, as long as the name is not a field or alias of the other section.

A field name that is not canonical, an alias, or a close typo for the current section must be rejected.

### Consecutive lines and continuations

Inside a paragraph of consecutive non-blank lines, a subsequent line starts a new field when its header name is a known field or alias (in any case) or a single word of 4 or more ASCII letters within Levenshtein edit distance 1 of one. Any other non-blank line continues the field above it:

```md
## Dock
What: A powered stand
see below: it charges.
```

Here `see below: it charges.` stays part of `What` because `see below` is not a known field or near-miss typo. By contrast, `Avod: rack` on the next line starts a new field because `avod` is 1 edit from `avoid`. At the start of a new paragraph (after a blank line or a list), any line matching the field header pattern is treated as a field header, so an unknown label such as `Example: ...` on its own paragraph is rejected instead of continuing a text field.

### Text, value, and list fields

- **Text fields (`What`, `How`, `Why`).** May span multiple lines and multiple paragraphs separated by blank lines (provided no paragraph starts with a field header). On load, all non-empty lines across all paragraphs are trimmed and joined with a single space. Formatters keep original line and paragraph breaks. An empty text field must be rejected.
- **Value field (`Case`).** Takes a single value on the field line (consecutive non-blank continuation lines are trimmed and joined with a single space). Must not be empty, and must not be followed by a list or another paragraph.
- **List fields (`Presets`, `Allow`, `Casing`, `Avoid`, `Good`, `Bad`, `Links`).**
  - Canonical bullets start with `-` (up to 3 leading spaces, then space or tab and item text). A tolerant reader may accept `*` and `+` bullets as layout issues.
  - Indented continuation lines under a bullet (starting with spaces or tabs, not starting another block, and not matching a field line) are trimmed and joined to that item with a single space. A list ends when an indented line (up to 3 leading spaces) matches a field line, even if a Markdown formatter indented it after the list.
  - `Presets`, `Allow`, `Casing`, and `Avoid` may be written either as a `-` list or as an inline comma-separated list on the field line (with consecutive non-blank continuation lines joined with a single space before splitting).
  - `Good`, `Bad`, and `Links` should be written as `-` lists. A tolerant reader may read an inline value on one of those fields as a single item (without comma splitting) and flag a layout issue.
  - A tolerant reader may merge inline entries with a following bullet list, or merge bullet lists split by blank lines, while flagging a layout issue.
  - An empty list field or an empty bullet item (such as a bare `-`) must be rejected.

### Comments and extra prose

This format has no comment syntax. HTML comments (`<!-- ... -->`) are scanned as ordinary paragraphs:

- In the introduction, an HTML comment is ignored as introduction prose and kept verbatim by formatters.
- Inside a text field (`What`, `How`, `Why`), an HTML comment becomes literal text in that field's value.
- Anywhere else (between corpus fields, before a term's first field, or after a list or value field), an HTML comment must be rejected as stray text.

Outside the introduction, any of the following must be rejected: stray prose before a term's first field or after a list or value field, a list before the first field or after a text or value field, Markdown tables (`| ...`), fenced code blocks (`` ``` `` or `~~~`), sub-headings (`###` to `######`), and a second `#` heading.

## Value rules

### Comma splitting

Inline lists (`Presets`, `Allow`, `Casing`, `Avoid`) split on `,` characters outside backticks (`` ` `` toggles backtick mode). Each piece is trimmed and empty pieces (such as a trailing comma) are dropped. Only `Avoid` strips backticks from the resulting item; in `Allow`, backticks remain literal characters.

### Avoid entries

Each item of `Avoid` is parsed as `word` or `word: reason`:

```md
Avoid:
- bay
- rack: Racks are unpowered.
- slot: Ops: only
- `zone: west`: Retired name.
```

- **Backticked word.** If the item matches `` /^`([^`]*)`(?::(?:\s+([\s\S]*))?)?$/ ``, the text inside backticks is trimmed as `word` (backticks dropped), and any trimmed text after `:` and whitespace becomes `why`. Use backticks when `word` contains `,` in an inline list or `: ` before a reason, such as `` `bay, berth`: Old words. ``. Space or tab is required between `:` and the reason.
- **Plain word.** Otherwise, split at the first colon followed by whitespace or end-of-string (`/:(?:\s|$)/`). Trim both sides. A colon with no following space (such as `pod:x`) does not split, and later colons remain inside `why` (`slot: Ops: only` parses as word `"slot"` and reason `"Ops: only"`).
- **Output shape.** An item with a non-empty `why` parses as `{ "word": "...", "why": "..." }`. An item with no `why` (including a trailing `word:`) parses as the plain string `"word"`.
- **Conflict rules.** `termKey(word)` must be non-empty. An avoid word must not equal its own term after trimming, collapsing internal whitespace to single spaces, and lowercasing. Its `termKey` must not match another term defined in the same file. An avoid word with the same `termKey` as its own term but different spelling or punctuation (such as `check-out` under `## Checkout`) is allowed. Conflicts are checked against terms defined in the same file, not terms imported through `Presets`.

### Links entries

Each item of `Links` should match `[title](url)` where `title` has at least one non-whitespace character and no `]`, and `url` starts with `http://` or `https://` with no whitespace or parentheses:

```regex
/^\[([^\]]*\S[^\]]*)\]\((https?:\/\/[^\s()]+)\)$/
```

`title` is trimmed on load, producing `{ "title": "...", "url": "..." }`. A tolerant reader may accept a bare `http://` or `https://` URL (optionally wrapped in `<...>`) as `{ "title": url, "url": url }`, rewriting it to `[url](url)` as a layout fix. Any other scheme, relative path, empty title, or plain text must be rejected.

### Case and Casing values

- **`Case`** must be `exact`, `spelling`, or `context` (exact lowercase).
- **`Casing`** items must match `/^(label|header|sentence)\s+(title|sentence|lower|upper|as-written)$/` (exact lowercase). Kinds are `label`, `header`, and `sentence`. Styles are `title`, `sentence`, `lower`, `upper`, and `as-written`. Pairs collect into an object keyed by kind; if a kind repeats in one field, the later value overwrites the earlier one.

### Casing inference from the heading

When building a term object:

1. If `Case:` is present, set `case` to that value. Explicit `Case:` always wins (for example, `## eBike` with `Case: spelling` gives `"case": "spelling"`).
2. Otherwise, if term-level `Casing:` is present, omit `case`, even if the heading has inner capitals. Consumers treat a term with `casing` and no `case` as `context`.
3. Otherwise, if the term name contains a Unicode letter immediately followed by a Unicode uppercase letter (`/\p{L}\p{Lu}/u`, such as `eBike`, `SOS`, or `GitHub`), set `case` to `"exact"`. Regular capitalized words such as `Dock` or `Day Pass` do not match because no letter directly precedes the uppercase letter.
4. Otherwise, omit `case`. Consumers treat an omitted `case` with no term `casing` as `spelling`.
5. Nothing is inferred from `What`, `How`, or `Why`.

### Preset names

`Presets` accepts `tech` and `inclusive` (exact lowercase). Any other name must be rejected. Other tools that do not bundle `tech` and `inclusive` either reject unknown preset names or define their own preset map.

## Validation and errors

Readers separate structural errors (which must reject the file) from canonical-form warnings (which tolerant readers may normalize and load). For glosslint's exact error codes, `GlosslintConfigError` shape, and exit codes, see [Config and glossary errors](/reference/config-errors).

### Blocking errors

A reader must reject the file and produce no corpus when any of these occur:

| Condition | glosslint code |
| --- | --- |
| Unknown field, misplaced field, second `#` heading, or disallowed block outside the introduction (stray text, misplaced list, table, code fence, `###` to `######` heading) | `GLOSSLINT_G004` |
| Duplicate term (`termKey`) or duplicate field in the same section | `GLOSSLINT_G005` |
| Empty field, empty list item, invalid `Case`, invalid `Casing` pair, unknown `Presets` name, `Avoid` word with no letters or digits, or invalid `Links` item | `GLOSSLINT_G006` |
| Term heading with no letters or digits, parentheses outside a trailing abbreviation group, or a non-abbreviation token in parentheses | `GLOSSLINT_G007` |
| `Avoid` word matching its own term (case and whitespace insensitive) or another term's `termKey` in the same file | `GLOSSLINT_G008` |

### Non-canonical warnings

A tolerant reader may load the file as its normalized form while reporting these issues; a formatter should rewrite them into canonical form:

| Condition | glosslint code |
| --- | --- |
| Missing `# Glossary` H1 or an H1 with another title | `GLOSSLINT_G001` |
| Field name in another case, a known alias, or a close typo | `GLOSSLINT_G002` |
| Layout differences: wrong blank-line counts, out-of-order fields, `*` or `+` bullets, split lists, mixed inline and bullet items, inline entry on `Good`/`Bad`/`Links`, bare `http(s)` URL under `Links`, closing `#`s on headings, CRLF endings, trailing spaces, or missing/extra final newline | `GLOSSLINT_G003` |

Validators may also run each term's `Good` and `Bad` strings against the parsed corpus (`GLOSSLINT_G009` in glosslint). Failing examples do not invalidate the file structure and should not block loading.

## Full example

This canonical glossary file parses with no warnings into the JSON object shown in the second tab:

::code-group
```md [.agents/glossary.md]
# Glossary

<!-- Format spec: https://glosslint.onmax.me/spec -->

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

When `Presets: tech, inclusive` is included before `Allow:`, the parser merges `tech` and `inclusive` into `terms` and `allow` in listed order before the file's own entries. Any term in the file with the same `termKey` replaces the preset entry completely.

## Implementing a reader

1. Decode UTF-8 without a BOM, split on `/\r?\n/`, and drop one trailing empty line if the file ended with a newline.
2. Scan lines into blocks: fenced code blocks, ATX headings (`#` to `######`), pipe tables, unordered lists (stopping indented continuations at field lines), and paragraphs.
3. Read `# Glossary` as the first block, then collect introduction blocks until the first `##` heading or the first paragraph whose first line matches the field header regex. Reject any second H1.
4. Parse blocks before the first `##` as corpus fields (`Presets`, `Allow`, `Casing`) and each `##` section as a term heading plus term fields (`What`, `How`, `Why`, `Avoid`, `Good`, `Bad`, `Links`, `Case`, `Casing`).
5. Validate heading names, trailing `(Abbr, ...)` tokens, `termKey` uniqueness, field placement and uniqueness, and value syntax. Reject blocking errors (`G004` to `G008`) instead of dropping unknown content.
6. Join text field lines and paragraphs with single spaces, split comma lists outside backticks, parse `Avoid` entries (`word` vs `word: reason`, dropping backticks around `word`), and infer `"case": "exact"` from `/\p{L}\p{Lu}/u` only when neither `Case` nor term `Casing` is present.
7. Check `Avoid` entries against the file's own terms (trimmed, collapsed, lowercased equality for the same term; `termKey` equality for other terms), then merge any supported `Presets` left to right beneath the file's terms, `allow`, and `casing`.
