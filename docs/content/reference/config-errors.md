---
title: Config errors
description: "Reference for glosslint config errors: GlosslintConfigError fields, exit code 2, all error codes, and fixes for GLOSSLINT_C001 to GLOSSLINT_C011."
navigation.order: 2
icon: i-lucide-shield-alert
---

glosslint validates your [corpus](/guide/corpus) as soon as the config loads, so typos and wrong field types fail immediately with a stable code, a reason, and a fix. Read this reference when `defineCorpus`, `fromGlossaryTable`, or the CLI rejects your config file or command line.

## Error output and exit code

A wrong config fails at load time with a code, the reason, and the fix. The [CLI](/integrations/cli) prints the error to stderr in tree format and exits `2`:

```txt
[GLOSSLINT_C001] Unknown field "avoids" in term "Dock".
├▶ fix: Rename it to "avoid".
╰▶ config: bad.config.ts
```

Exit code `2` distinguishes configuration and command-line errors from lint findings or failing term tests, which exit `1`.

## GlosslintConfigError

In code, `defineCorpus` and `fromGlossaryTable` throw a `GlosslintConfigError`, a subclass of `Error`, with four fields:

- `code`: the stable error code, such as `"GLOSSLINT_C001"` or `"GLOSSLINT_DUPLICATE_TERM"`.
- `why`: why the config or glossary table is wrong.
- `fix`: what to change.
- `term`: the term name when the problem sits inside a single term, omitted otherwise.

The error's `message` is `why`, with ` (term "<term>")` appended when `term` is set.

`CONFIG_ERRORS`, exported from `glosslint`, maps corpus validation names to their codes: `GLOSSLINT_C001` through `GLOSSLINT_C008`, plus `GLOSSLINT_C011`. The CLI reports `GLOSSLINT_C009`, `GLOSSLINT_C010`, and `GLOSSLINT_USAGE` when loading a config or parsing arguments. See [JavaScript API](/reference/api) for the class and constant definitions.

## All error codes

| Code                          | Meaning                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `GLOSSLINT_C001`              | Unknown field. The fix names the closest field when there is one.                       |
| `GLOSSLINT_C002`              | A term has no `term`, or it holds no letters or digits.                                 |
| `GLOSSLINT_C003`              | `case` is not `exact`, `spelling` or `context`.                                         |
| `GLOSSLINT_C004`              | An avoid word is the term itself. To require one casing, use `case: "exact"`.           |
| `GLOSSLINT_C005`              | Two of your terms have the same key.                                                    |
| `GLOSSLINT_C006`              | `skip` holds something other than `lower` or `upper`.                                   |
| `GLOSSLINT_C007`              | A field has the wrong type, such as `abbr: "DP"`.                                       |
| `GLOSSLINT_C008`              | An `extends` entry is not a corpus, or the config's default export is not one.          |
| `GLOSSLINT_C009`              | The CLI found no config, or `--config` names a file that does not exist.                |
| `GLOSSLINT_C010`              | The config threw while loading, such as on a syntax error.                              |
| `GLOSSLINT_C011`              | `casing` names a kind other than `label`, `header` or `sentence`, or an unknown style.  |
| `GLOSSLINT_NO_GLOSSARY_TABLE` | `fromGlossaryTable` found no table with a term column.                                  |
| `GLOSSLINT_DUPLICATE_TERM`    | `fromGlossaryTable` read the same term twice.                                           |
| `GLOSSLINT_USAGE`             | The command line is wrong, such as an unknown `--format` or a path that does not exist. |

For table header rules and duplicate-row handling on `GLOSSLINT_NO_GLOSSARY_TABLE` and `GLOSSLINT_DUPLICATE_TERM`, see [Glossary tables](/guide/glossary-table).

## Corpus and config codes

### GLOSSLINT_C001

`defineCorpus` throws `GLOSSLINT_C001` when the corpus input, a term, an avoid entry, a link, or `examples` has an unrecognized property name. The fix suggests the closest valid field when one is nearby, or lists every valid field.

```ts
// Triggers GLOSSLINT_C001: Unknown field "avoids" in term "Dock".
{ term: "Dock", avoids: ["rack"] }

// Fix: rename to a valid term field
{ term: "Dock", avoid: ["rack"] }
```

See [The corpus](/guide/corpus) and [Defining terms](/guide/terms) for all accepted field names.

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

`defineCorpus` throws `GLOSSLINT_C008` when an entry in `extends` is not a corpus created by `defineCorpus`, `fromGlossaryTable`, or a preset. The CLI also reports `GLOSSLINT_C008` when a config file's default export is not a corpus.

```ts
// Triggers GLOSSLINT_C008: Entry 1 of "extends" is not a corpus.
export default defineCorpus({
  extends: [{ terms: [{ term: "Dock" }] }],
});

// Fix: pass a preset, fromGlossaryTable(...), or defineCorpus(...)
export default defineCorpus({
  extends: [defineCorpus({ terms: [{ term: "Dock" }] })],
});
```

If the CLI reports `<file> does not export a corpus as its default export.`, end the file with `export default defineCorpus({ ... })`.

### GLOSSLINT_C009

The CLI reports `GLOSSLINT_C009` when the current folder has no `glosslint.config.ts`, `.mts`, `.js`, or `.mjs`, or when `--config <path>` points to a file that does not exist.

```sh
# Triggers GLOSSLINT_C009: The config "missing.config.ts" does not exist.
npx glosslint check --config missing.config.ts

# Fix: pass an existing config path, or run from the folder with glosslint.config.ts
npx glosslint check --config glosslint.config.ts
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
