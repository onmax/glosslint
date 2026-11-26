---
title: Config and glossary errors
navigation.title: Config errors
description: "Reference for glosslint config and glossary errors: GlosslintConfigError, GLOSSLINT_C001 to C012, GLOSSLINT_G001 to G009, and fixes."
navigation.order: 3
icon: i-lucide-shield-alert
---

glosslint validates [`.agents/glossary.md`](/guide/glossary) and [`defineCorpus`](/guide/corpus) as soon as they load, so typos, bad fields, and invalid glossary entries fail with a stable code, a reason, and a fix. Read this reference when `fromGlossary`, `readGlossary`, `defineCorpus`, `glosslint/eslint`, or the CLI reports a config or glossary problem.

## Error output and exit code

A wrong config or broken glossary file fails at load time with a code, the reason, and the fix. The [CLI](/integrations/cli) prints load and usage errors to stderr in tree format and exits `2`:

```txt
[GLOSSLINT_C001] Unknown field "avoids" in term "Dock".
├▶ fix: Rename it to "avoid".
╰▶ config: bad.config.ts
```

Exit code `2` separates configuration, glossary-loading, and command-line errors from lint findings, `doctor` problems, or failing term tests, which exit `1`.

## GlosslintConfigError

In code, `defineCorpus`, `fromGlossary`, and `glosslint/eslint` throw a `GlosslintConfigError`, a subclass of `Error`, with four fields:

- `code`: the stable error code, such as `"GLOSSLINT_C001"`, `"GLOSSLINT_C009"`, or `"GLOSSLINT_G004"`.
- `why`: why the config, glossary file, or ESLint option is wrong.
- `fix`: what to change.
- `term`: the term name when the problem sits inside a single term, omitted otherwise.

The error's `message` is `why`, with ` (term "<term>")` appended when `term` is set.

`CONFIG_ERRORS`, exported from `glosslint`, maps corpus and loader error names to their codes (`GLOSSLINT_C001` through `GLOSSLINT_C009`, `GLOSSLINT_C011`, and `GLOSSLINT_C012`). The CLI also reports `GLOSSLINT_C010` when importing a config throws and `GLOSSLINT_USAGE` when command-line flags or paths are wrong. See [JavaScript API](/reference/api).

## All error codes

| Code | Meaning |
| --- | --- |
| `GLOSSLINT_C001` | Unknown field in `defineCorpus`. The fix names the closest field when there is one. |
| `GLOSSLINT_C002` | A term has no `term`, or it holds no letters or digits. |
| `GLOSSLINT_C003` | `case` is not `exact`, `spelling`, or `context`. |
| `GLOSSLINT_C004` | An avoid word is the term itself. To require one casing, use `case: "exact"`. |
| `GLOSSLINT_C005` | Two terms in the same `defineCorpus` call have the same key. |
| `GLOSSLINT_C006` | `skip` holds something other than `lower` or `upper`. |
| `GLOSSLINT_C007` | A field has the wrong type, such as `abbr: "DP"`. |
| `GLOSSLINT_C008` | An `extends` entry is not a corpus, or the config's default export is not one. |
| `GLOSSLINT_C009` | No glossary file or config was found, or `--glossary` / `--config` names a missing file. |
| `GLOSSLINT_C010` | The config threw while loading, such as on a syntax error. |
| `GLOSSLINT_C011` | `casing` names a kind other than `label`, `header`, or `sentence`, or an unknown style. |
| `GLOSSLINT_C012` | `glosslint()` in ESLint or x18n received both `glossary` and `corpus`. |
| `GLOSSLINT_G001` | Missing `# Glossary` H1, or an H1 with another title. Fixable with `doctor --fix`. |
| `GLOSSLINT_G002` | Field name in another case, a known alias, or a close typo. Fixable with `doctor --fix`. |
| `GLOSSLINT_G003` | Glossary layout problem (bullets, bare URL, field order, blank lines, endings). Fixable with `doctor --fix`. |
| `GLOSSLINT_G004` | Unknown field, misplaced field, second H1, or disallowed block (stray text, table, fence, H3+). |
| `GLOSSLINT_G005` | Duplicate term or duplicate field in the glossary file. |
| `GLOSSLINT_G006` | Invalid or empty field value in the glossary file (`Case`, `Casing`, `Extends`, `Avoid`, `Links`). |
| `GLOSSLINT_G007` | Term heading has no words, or parentheses hold something other than abbreviations. |
| `GLOSSLINT_G008` | An avoid word matches the term itself or another term defined in the same glossary file. |
| `GLOSSLINT_G009` | A `Good` example was reported or a `Bad` example was not reported in `doctor` / `readGlossary`. |
| `GLOSSLINT_USAGE` | The command line is wrong, such as both `--config` and `--glossary`, an unknown `--format`, or a missing path. |

## Glossary problem codes

`readGlossary` returns every `GLOSSLINT_G001` to `GLOSSLINT_G009` problem as a `GlossaryProblem` (`{ code, line, why, fix, fixable, term? }`), and `glosslint doctor` prints them.

- **`G001` to `G003` (`fixable: true`):** `glosslint doctor --fix` rewrites them in canonical form. `fromGlossary`, ESLint, Oxlint, and `glosslint check` still load a file that has only `G001` to `G003` problems as its fixed form would load.
- **`G004` to `G008` (`fixable: false`):** Only a person can fix them. `fromGlossary` and the CLI throw `GlosslintConfigError` (exit `2`) with the first blocking problem's code, `path:line`, and fix. `doctor --fix` leaves the file untouched when one is present so it never drops text.
- **`G009` (`fixable: false`):** Failing `Good` or `Bad` example, checked against the corpus produced by the glossary file alone. `doctor` reports it and exits `1`; `fromGlossary` and `check` ignore it.

### GLOSSLINT_G001

The file does not start with `# Glossary`, or starts with an H1 holding another title.

```md
# Bike words
```

Fix: retitle it `# Glossary`, or run `npx glosslint doctor --fix`.

### GLOSSLINT_G002

A field name uses the wrong case (`what:`), a known alias (`Description` or `Meaning` for `What`; `Notes` or `Nuance` for `How`; `See`, `Related`, or `Related links` for `Links`), or a typo close to a valid field name (`Avod:` for `Avoid:`).

```md
## Dock

Description: A powered stand where one bike is locked.
```

Fix: rename it to the canonical field name (`What:`), or run `npx glosslint doctor --fix`.

### GLOSSLINT_G003

The file differs from canonical layout: two fields share a paragraph, a list uses `*` or `+` bullets, blank lines split a list, a comma list field has entries both on its line and in a list below, a `-`-only field (`Good`, `Bad`, `Links`) has an entry on its line, a link is a bare URL (rewritten to `[url](url)`), fields are out of canonical order, or blank lines, CRLF endings, trailing spaces, or the final newline do not match canonical form.

Fix: run `npx glosslint doctor --fix`.

### GLOSSLINT_G004

The file contains an unknown field name (such as `Note:`), a term field written before the first `##` heading, a corpus field written inside a term, a second `#` heading, or content the glossary format has no place for: text before a term's first field or after a list or value field, a list after a text or value field, a Markdown table, a code fence, or a sub-heading (`###` to `######`).

```md
## Dock

Note: Only powered stands count.
```

Fix: move the text into an accepted field such as `How:`, reword the line so it does not start with `Word:`, or remove the unsupported block.

### GLOSSLINT_G005

The same term (by normalized key) or the same field appears twice in the same section.

```md
## Station

## station
```

Fix: merge the two sections or duplicate fields into one.

### GLOSSLINT_G006

A field or list item is empty, or holds an invalid value:

- `Extends` names something other than `tech` or `inclusive`
- `Case` is not `exact`, `spelling`, or `context`
- `Casing` is not a `<kind> <style>` pair (`label`, `header`, `sentence` with `title`, `sentence`, `lower`, `upper`, `as-written`)
- `Avoid` has an item with no letters or digits
- `Links` has an item that is neither `[title](http(s)://...)` nor a bare http/https URL

Fix: replace the value with a valid one, or remove the empty field.

### GLOSSLINT_G007

A `##` term heading has no words (`## ---`), or its parentheses hold something other than abbreviations (single words that are one uppercase letter or contain an uppercase letter after the first character, such as `DP`, `D`, or `eB`).

```md
## Day Pass (day ticket)
```

Fix: keep only abbreviations in parentheses (`## Day Pass (DP)`) and move explanations to `How:`.

### GLOSSLINT_G008

An `Avoid` item matches the term itself or another term defined in the same glossary file.

```md
## Dock

Avoid: station

## Station
```

Fix: remove the word from `Avoid`, remove the conflicting term, or use `Case: exact` if you meant to enforce capitalization on the term itself.

### GLOSSLINT_G009

A `Good` example was reported for its term, or a `Bad` example was not reported for its term, when checked against the corpus built from the glossary file alone.

Fix: narrow the avoid word or adjust the example so `Good` passes and `Bad` triggers a finding.

## Corpus and config codes

### GLOSSLINT_C001

`defineCorpus` throws `GLOSSLINT_C001` when the corpus input, a term, an avoid entry, a link, or `examples` has an unrecognized property name. The fix suggests the closest valid field when one is nearby, or lists every valid field.

```ts
// Triggers GLOSSLINT_C001: Unknown field "avoids" in term "Dock".
{ term: "Dock", avoids: ["rack"] }

// Fix: rename to a valid term field
{ term: "Dock", avoid: ["rack"] }
```

See [defineCorpus](/guide/corpus) and [Defining terms](/guide/terms) for all accepted field names.

### GLOSSLINT_C002

`defineCorpus` throws `GLOSSLINT_C002` when an entry in `terms` omits `term`, sets `term` to a non-string, or sets `term` to punctuation with no letters or digits.

```ts
// Triggers GLOSSLINT_C002: Entry 1 of "terms" has no "term".
{ description: "A powered stand where one bike is locked." }

// Also triggers GLOSSLINT_C002: The term "--" has no letters or digits.
{ term: "--" }

// Fix: provide a term containing letters or digits
{ term: "Dock", description: "A powered stand where one bike is locked." }
```

### GLOSSLINT_C003

`defineCorpus` throws `GLOSSLINT_C003` when a term sets `case` to anything other than `"exact"`, `"spelling"`, or `"context"`.

```ts
// Triggers GLOSSLINT_C003: "case" is "title".
{ term: "Day Pass", case: "title" }

// Fix: use "exact", "spelling", or "context"
{ term: "Day Pass", case: "context" }
```

To set a specific style such as `"title"` or `"upper"` per text kind, use `casing` instead of `case`. See [Casing rules](/guide/casing).

### GLOSSLINT_C004

`defineCorpus` throws `GLOSSLINT_C004` when an entry in `avoid` matches the term's own text after trimming, collapsing whitespace, and lowercasing. A different spelling with the same key, such as `"check-out"` for `Checkout`, does not throw this error.

```ts
// Triggers GLOSSLINT_C004: "ebike" is both the term and one of its avoid words.
{ term: "eBike", avoid: ["ebike"] }

// Fix: remove it from avoid and set case: "exact" to enforce capitals
{ term: "eBike", case: "exact" }
```

### GLOSSLINT_C005

`defineCorpus` throws `GLOSSLINT_C005` when two entries in the same corpus's `terms` array share a key, which joins the term's words in lowercase with letters and digits only. Replacing a term from `extends` with the same key is allowed and does not throw this error.

```ts
// Triggers GLOSSLINT_C005: "Day Pass" and "day-pass" are the same words, so they are one term.
terms: [{ term: "Day Pass" }, { term: "day-pass" }]

// Fix: keep one term entry
terms: [{ term: "Day Pass" }]
```

### GLOSSLINT_C006

`defineCorpus` throws `GLOSSLINT_C006` when `skip` is not an array or contains a value other than `"lower"` or `"upper"`.

```ts
// Triggers GLOSSLINT_C006: "skip" has "title".
{ term: "eBike", skip: ["title"] }

// Fix: pass a list of "lower" and/or "upper"
{ term: "eBike", skip: ["lower", "upper"] }
```

### GLOSSLINT_C007

`defineCorpus` throws `GLOSSLINT_C007` when a corpus or term field has the wrong type, such as a string where an array of non-empty strings is required, a non-boolean `wholeLabel`, or a link missing `title` or `url`.

```ts
// Triggers GLOSSLINT_C007: "abbr" must be a list of non-empty strings.
{ term: "Day Pass", abbr: "DP" }

// Fix: wrap it in an array of non-empty strings
{ term: "Day Pass", abbr: ["DP"] }
```

### GLOSSLINT_C008

`defineCorpus` throws `GLOSSLINT_C008` when an entry in `extends` is not a corpus created by `defineCorpus`, `fromGlossary`, or a preset. The CLI also reports `GLOSSLINT_C008` when a config file's default export is not a corpus.

```ts
// Triggers GLOSSLINT_C008: Entry 1 of "extends" is not a corpus.
export default defineCorpus({
  extends: [{ terms: [{ term: "Dock" }] }],
});

// Fix: pass a preset, fromGlossary(...), or defineCorpus(...)
export default defineCorpus({
  extends: [fromGlossary()],
});
```

If the CLI reports `<file> does not export a corpus as its default export.`, end the file with `export default defineCorpus({ ... })`.

### GLOSSLINT_C009

`fromGlossary` throws `GLOSSLINT_C009` when `.agents/glossary.md` (or the path given to it) does not exist. The CLI reports `GLOSSLINT_C009` when neither `.agents/glossary.md` nor `glosslint.config.{ts,mts,js,mjs}` exists in the current folder, or when `--glossary` or `--config` points to a missing file.

```sh
# Triggers GLOSSLINT_C009: The glossary "missing.md" does not exist.
npx glosslint check --glossary missing.md

# Fix: create .agents/glossary.md or pass an existing path
npx glosslint check --glossary .agents/glossary.md
```

### GLOSSLINT_C010

The CLI reports `GLOSSLINT_C010` when Node's `import()` throws while loading the config file, such as on a syntax error or a broken import path.

```ts
// Triggers GLOSSLINT_C010: Could not load glosslint.config.ts: ...
import missing from "./does-not-exist.ts";
export default defineCorpus({ extends: [missing] });

// Fix: correct the import or syntax error in glosslint.config.ts
import tech from "glosslint/presets/tech";
export default defineCorpus({ extends: [tech] });
```

### GLOSSLINT_C011

`defineCorpus` throws `GLOSSLINT_C011` when `casing` on the corpus or a term is not an object, names a kind other than `"label"`, `"header"`, or `"sentence"`, or uses a style other than `"title"`, `"sentence"`, `"lower"`, `"upper"`, or `"as-written"`.

```ts
// Triggers GLOSSLINT_C011: "casing.header" of term "Day Pass" is "caps".
{ term: "Day Pass", casing: { header: "caps" } }

// Fix: use a valid kind and case style
{ term: "Day Pass", casing: { header: "upper" } }
```

### GLOSSLINT_C012

`glosslint/eslint` throws `GLOSSLINT_C012` when `glosslint()` receives both `glossary` and `corpus`.

```ts
// Triggers GLOSSLINT_C012: glosslint() takes `glossary` or `corpus`, not both.
glosslint({ glossary: "docs/glossary.md", corpus });

// Fix: pass one of them, or load the file inside defineCorpus({ extends: [fromGlossary(...)] })
glosslint({ corpus });
```
