---
title: Glossary tables
description: Load a Markdown glossary table straight into your glosslint corpus with fromGlossaryTable, including avoid words, abbreviations, notes and links.
navigation.order: 7
icon: i-lucide-table
---

If your team already keeps a glossary page in Markdown, you do not have to copy every entry into TypeScript. `fromGlossaryTable` reads a Markdown table and turns each row into a term in your corpus.

## Loading a table

Call `fromGlossaryTable(path, columns?)` inside `extends` in `glosslint.config.ts`. Pass a `URL` built from `import.meta.url` to resolve the path relative to the config file. A plain string resolves from the current working folder instead.

```ts [glosslint.config.ts]
import { defineCorpus, fromGlossaryTable } from "glosslint";

export default defineCorpus({
  extends: [fromGlossaryTable(new URL("./docs/glossary.md", import.meta.url))],
});
```

Because `fromGlossaryTable` returns a corpus, it follows the merge rules described in [The corpus](/guide/corpus). Place it after a preset in `extends` so table entries override preset terms with the same key. Any term you also list under `terms` replaces the table row whole.

## Example table

This is [`examples/basic/docs/glossary.md`](https://github.com/onmax/glosslint/blob/main/examples/basic/docs/glossary.md):

```md [docs/glossary.md]
| Use            | Avoid                                  | Meaning                                        | Notes                                      | Links                                         |
| -------------- | -------------------------------------- | ---------------------------------------------- | ------------------------------------------ | --------------------------------------------- |
| Station        | hub (riders confuse it with the depot) | A group of docks on one street corner.         |                                            | [Stations](https://example.com/docs/stations) |
| Rider          | customer                               | A person with an account who can unlock bikes. | Staff who move bikes are crew, not riders. |                                               |
| Ride           | trip                                   | The time from unlocking a bike to docking it.  |                                            |                                               |
| Week Pass (WP) | weekly ticket                          | Unlimited 30-minute rides for seven days.      |                                            | https://example.com/docs/passes               |
| kiosk          | terminal                               | The screen at a station where you buy passes.  | Always lowercase.                          |                                               |
```

## How it is read

The reader maps columns by header name and parses each cell with a small set of rules:

- The reader takes the first table whose header has a `Use` or `Term` column, in any case. It skips tables inside code fences, and stops at the first blank line.
- `Avoid` becomes the avoid list. Commas separate words, and `word (reason)` gives the reason.
- `Description` or `Meaning` becomes `description`, and `Notes` becomes `nuance`.
- Top-level commas in the term cell make several terms. The row's avoid words go to the first one.
- `Week Pass (WP)` gives the term and its abbreviation. Parentheses holding more than single words, such as `Rider (anyone with an account)`, go to the nuance instead.
- A name with an inner capital, such as `eBike`, or all capitals, such as `SOS`, is `exact`. So is a term whose notes say "lowercase".
- Markdown links in any cell, and bare URLs in a `Links` column, become `links`.
- The reader drops backticks, and bold or italic markers around a whole cell. A cell holding only `-` or `—` counts as empty.

If the file has no table with a matching term column, `fromGlossaryTable` throws `GLOSSLINT_NO_GLOSSARY_TABLE`. If the table lists two rows with the same term key, it throws `GLOSSLINT_DUPLICATE_TERM`. See [Config errors](/reference/config-errors) for every load-time code, and [Casing](/guide/casing) for how `exact` terms behave.

## Custom column names

Pass a second argument when your table uses other header names. Header matching is case-insensitive.

| Option | Default header | Term field |
| --- | --- | --- |
| `term` | `Use` or `Term` | `term` |
| `avoid` | `Avoid` | `avoid` |
| `description` | `Description` or `Meaning` | `description` |
| `notes` | `Notes` | `nuance` |
| `links` | `Links` | `links` |

Other header names go in the second argument:

```ts [glosslint.config.ts]
fromGlossaryTable(new URL("./glossary.md", import.meta.url), {
  term: "Word",
  avoid: "Instead of",
  description: "Definition",
  notes: "Usage",
  links: "See",
});
```

## Keeping the glossary out of checks

> [!WARNING]
> A table full of avoid words reports itself, so keep the glossary page out of the paths that `glosslint check` reads.

When your glossary sits at `docs/glossary.md`, point [the CLI](/integrations/cli) at the docs subfolder you want checked instead of the whole `docs` directory:

```sh
npx glosslint check docs/guide
```
