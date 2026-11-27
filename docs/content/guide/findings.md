---
title: Findings format
description: "Reference for glosslint findings: the JSON and tree output, every field, the three codes, and fix kinds."
navigation.order: 10
navigation.group: Reference
icon: i-lucide-list-checks
---

Every finding reports a location, matched text, replacement, and term context.

## JSON output

`glosslint check --format json` prints `{ findings, summary }`. With `--fix`, `summary` also has `fixed`, the number of fixes written, and `findings` lists what is left. See [CLI](/integrations/cli) for flags and exit codes.

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

## Tree format

Without `--format json`, `glosslint check` prints each finding as a tree, followed by a summary line:

```txt
[GLOSSLINT_AVOID] "rack" in docs/guide/riding.md:3:56
├▶ why: Racks are unpowered.
├▶ fix: Use "dock": "Unlock a bike at any station, then return it to a free dock when you finish."
├▶ term: Dock, a powered stand where one bike is locked.
╰▶ see: https://example.com/docs/docks
```

## Fields

| Field | Meaning |
| --- | --- |
| `code` | `GLOSSLINT_TERM`, `GLOSSLINT_AVOID`, or `GLOSSLINT_CASE`. |
| `file`, `line`, `column` | 1-based start position in the file. |
| `start`, `end` | Character offsets in the file. |
| `text` | Matched text as written. |
| `message` | One-line diagnostic printed by [ESLint](/integrations/eslint) and [Oxlint](/integrations/oxlint). |
| `why` | Avoid reason, else `Why`, else `How`. Omitted when none exist. |
| `fix` | `{ kind, replace, result }`. Omitted when an in-place fix isn't safe, such as across a line break. |
| `term` | `{ term, description, nuance }` summary. |
| `see` | First URL from `Links`. |

## Codes

In [ESLint](/integrations/eslint) and [Oxlint](/integrations/oxlint), the finding code is also the rule's `messageId`.

| Code | Reported when |
| --- | --- |
| `GLOSSLINT_TERM` | Wrong word splits or hyphens, an avoid word sharing a term's key, or a mis-split identifier. |
| `GLOSSLINT_AVOID` | Text contains an avoid word. |
| `GLOSSLINT_CASE` | Wrong capitalization for a term's casing rule or text kind. |

## Fix kinds

- `autofix`. Safe spelling or casing fix. [ESLint](/integrations/eslint), [Oxlint](/integrations/oxlint), and [x18n](/integrations/x18n) downgrade it to a suggestion when a `context` term's kind was guessed from text shape. See [Casing rules](/guide/casing).
- `suggestion`. Replacement for an avoid word that a person needs to confirm.
- `rename`. New identifier name, never applied automatically because it touches callers.

`glosslint check` never modifies files; it only reports fixes for you or a [coding agent](/guide/agents) to apply.

## Findings in JavaScript

`createMatcher(corpus).check(text, kind)` returns `Finding[]`, which drops `file`, `line`, `column`, and `fix.result` and attaches the full `Term` object. Pass them to `formatFindings` or `toJson` to format them; see [JavaScript API](/guide/api).
