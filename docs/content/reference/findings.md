---
title: Findings format
description: "Reference for glosslint findings: JSON and tree output, every field, the three finding codes, fix kinds, and matcher output."
navigation.order: 2
icon: i-lucide-list-checks
---

Every time glosslint spots a wrong spelling, wrong capitals, or an avoid word, it produces a finding with the location, reason, replacement, and term context. Use this reference when you parse `glosslint check --format json` in scripts or CI, apply findings as a [coding agent](/guide/agents), or read matcher output from the [JavaScript API](/reference/api).

## JSON output

`glosslint check --format json` prints `{ findings, summary }`:

```sh
npx glosslint check docs/guide/riding.md --format json
```

```json
{
  "findings": [
    {
      "code": "GLOSSLINT_AVOID",
      "file": "docs/guide/riding.md",
      "line": 3,
      "column": 56,
      "start": 71,
      "end": 75,
      "text": "rack",
      "message": "Use \"dock\" instead of \"rack\". Racks are unpowered. Dock: A powered stand where one bike is locked. A station is a group of docks. See https://example.com/docs/docks",
      "why": "Racks are unpowered.",
      "fix": {
        "kind": "suggestion",
        "replace": "dock",
        "result": "Unlock a bike at any station, then return it to a free dock when you finish."
      },
      "term": {
        "term": "Dock",
        "description": "A powered stand where one bike is locked.",
        "nuance": "A station is a group of docks."
      },
      "see": "https://example.com/docs/docks"
    },
    {
      "code": "GLOSSLINT_TERM",
      "file": "docs/guide/riding.md",
      "line": 4,
      "column": 15,
      "start": 107,
      "end": 113,
      "text": "e-bike",
      "message": "\"e-bike\" is spelled \"eBike\".",
      "fix": {
        "kind": "autofix",
        "replace": "eBike",
        "result": "Check out our eBike fleet if the hill feels long."
      },
      "term": {
        "term": "eBike"
      }
    }
  ],
  "summary": {
    "files": 1,
    "findings": 2,
    "GLOSSLINT_TERM": 1,
    "GLOSSLINT_AVOID": 1,
    "GLOSSLINT_CASE": 0
  }
}
```

The `summary` object holds the number of checked files, the total finding count, and a count per finding code. See [CLI](/integrations/cli) for `glosslint check` flags and exit codes.

## Tree format

Without `--format json`, `glosslint check` prints each finding as a tree with its code, reported text, file position, and branches for `why`, `fix`, `term`, and `see` when present. Here is one finding from `glosslint check` on the bike-share docs:

```txt
[GLOSSLINT_AVOID] "rack" in docs/guide/riding.md:3:56
├▶ why: Racks are unpowered.
├▶ fix: Use "dock": "Unlock a bike at any station, then return it to a free dock when you finish."
├▶ term: Dock, a powered stand where one bike is locked.
╰▶ see: https://example.com/docs/docks
```

The [CLI](/integrations/cli) prints a summary line after the last finding, such as `6 findings in 2 of 2 files.`.

## Finding fields

| Field                    | Meaning                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `code`                   | `GLOSSLINT_TERM` for other splits or hyphens, `GLOSSLINT_AVOID` for an avoid word, `GLOSSLINT_CASE` for wrong capitals. |
| `file`, `line`, `column` | Where the text starts. `line` and `column` count from 1.                                                                |
| `start`, `end`           | Offsets of the text in the file.                                                                                        |
| `text`                   | The reported text, as written.                                                                                          |
| `message`                | The one-line message [ESLint](/integrations/eslint) and [Oxlint](/integrations/oxlint) print.                           |
| `why`                    | The avoid word's reason, else the term's `why` (`Why:`), else the term's `nuance` (`How:`). Absent when none exist.     |
| `fix.kind`               | What the fix may do. See [Fix kinds](#fix-kinds).                                                                       |
| `fix.replace`            | The text that replaces `text`.                                                                                          |
| `fix.result`             | The line as it reads once fixed.                                                                                        |
| `term`                   | The term's `term`, `description` and `nuance`.                                                                          |
| `see`                    | The term's first link.                                                                                                  |

`fix` is omitted when a finding cannot be replaced safely in place, such as a match that spans a line break. In [ESLint](/integrations/eslint) and [Oxlint](/integrations/oxlint), strings whose escapes the fix would break (and YAML block scalars in ESLint) also report without a fix.

## Finding codes

Every finding carries one of three stable codes. In [ESLint](/integrations/eslint) and [Oxlint](/integrations/oxlint), the code is also the rule diagnostic's `messageId`.

| Code              | Reported when                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GLOSSLINT_TERM`  | A term is written with different word splits or hyphens, such as `"e-bike"` for `eBike`, or an avoid word shares a term's key, or an identifier splits a term wrongly. |
| `GLOSSLINT_AVOID` | Text contains one of a term's avoid words, such as `"rack"` instead of `Dock`.                                                                   |
| `GLOSSLINT_CASE`  | A term or abbreviation has the wrong capitals for its casing rule or text kind, such as `"day pass"` in a label or `"Apple pay"` for `Apple Pay`. |

## Fix kinds

`fix.kind` tells tools, editors, and [coding agents](/guide/agents) what is safe to change automatically:

- `autofix`: a spelling or casing fix. It is safe to apply without asking. [ESLint](/integrations/eslint), [Oxlint](/integrations/oxlint), and [x18n](/integrations/x18n) offer it as a suggestion instead when only the text's shape decided its kind, as described in [Casing rules](/guide/casing).
- `suggestion`: the term to use instead of an avoid word. Someone has to check that the meaning fits.
- `rename`: a new name for an identifier. It touches every caller, so nothing applies it alone.

> [!NOTE]
> `glosslint check` never modifies files. It reports `fix.kind`, `fix.replace`, and `fix.result` so you or an agent can apply changes yourself.

## Findings in JavaScript

In code, `createMatcher(corpus).check(text, kind)` returns the findings for one string as `Finding[]`. They have the same shape as the JSON output above without `file`, `line`, `column`, and `fix.result`, and `term` is the whole `Term` object rather than the `{ term, description, nuance }` summary. `start` and `end` are character offsets in `text`.

`formatFindings(findings, options)` prints an array of `Finding` or `CliFinding` objects in the tree format shown above, followed by a summary line. For plain `Finding` objects without a `file`, the headline prints `at offset <start>` instead of `in <file>:<line>:<column>`. See [JavaScript API](/reference/api) for `createMatcher`, `formatFinding`, `formatFindings`, and `toJson`.
