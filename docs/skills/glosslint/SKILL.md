---
name: glosslint
description: Use when writing or editing user-facing text in a project that has a glosslint.config.ts, when a lint or CLI finding has a GLOSSLINT_ code, or when setting up or changing a glosslint corpus.
---

# glosslint

glosslint checks a project's product words against one corpus in `glosslint.config.ts`. Each term has its spelling, its meaning, a nuance and the words to avoid. Findings come from ESLint (`glosslint/eslint`), x18n (`glosslint/x18n`) and the `glosslint` CLI, which checks Markdown.

## Before you write user-facing text

1. Read the project's glossary. It is usually `.agents/terms.md` (written by `glosslint print`) or a Markdown table that `glosslint.config.ts` reads with `fromGlossaryTable`.
2. When unsure which word to use, run `npx glosslint explain "<word>"`. It prints the term, its meaning, its nuance and the words to avoid. Exit code 1 means no term matches.

## After you edit

1. Run the project's lint.
2. Run `npx glosslint check --format json <files or folders>` on the Markdown you touched.
3. Apply each finding by `fix.kind`:
   - `autofix`: apply `fix.replace` as given.
   - `suggestion`: read `why` and `term.nuance`, then pick the word that fits the meaning. The suggested term is often right, not always.
   - `rename`: never apply it alone. Rename every caller in the same change, or report it.
4. After you edit `glosslint.config.ts`, run `npx glosslint test`. Every `good` example must pass and every `bad` example must be reported.

## Codes

- `GLOSSLINT_TERM`: the term written with other splits or hyphens, such as `e-bike` for `eBike`.
- `GLOSSLINT_AVOID`: an avoid word; `why` gives the reason.
- `GLOSSLINT_CASE`: wrong capitals for an `exact`, `context` or abbreviated term.
- `GLOSSLINT_C001` to `GLOSSLINT_C011`, `GLOSSLINT_NO_GLOSSARY_TABLE`, `GLOSSLINT_DUPLICATE_TERM`, `GLOSSLINT_USAGE`: config or command-line errors. The CLI exits 2 and prints the fix.

## Corpus changes

- A word with a second meaning goes in `allow` as a phrase, such as `"roof rack"`, not out of the term's `avoid`.
- `case: "context"` terms are Title Case in labels and lowercase in sentences. A `kindOf` option in the ESLint config or x18n plugin decides a string's kind before glosslint guesses.
- Keep the glossary page out of the paths `glosslint check` reads, because its avoid column reports itself.

Full docs: https://glosslint.onmax.me. Markdown copies of every page: https://glosslint.onmax.me/llms.txt.
