---
title: Coding agents
description: Let coding agents read .agents/glossary.md directly, follow the editing workflow by fix.kind, and run glosslint doctor.
navigation.order: 10
icon: i-lucide-bot
---

This page shows how coding agents read `.agents/glossary.md` directly and the workflow an agent follows when editing text or the glossary.

## Set up a project for coding agents

Because your vocabulary lives in [`.agents/glossary.md`](/guide/glossary), coding agents read the exact file that ESLint, Oxlint, x18n, and the CLI enforce. No separate generated file is needed. Link `.agents/glossary.md` from `AGENTS.md` so every agent reads it before writing copy, labels, comments, or docs:

```md [AGENTS.md]
## Vocabulary

Read `.agents/glossary.md` before writing UI copy, comments, or docs. Run `npx glosslint doctor --fix` after editing it.
```

If your project defines extra terms or overrides in `glosslint.config.ts` with [`defineCorpus`](/guide/corpus), you can still run `npx glosslint print` to export the merged corpus as Markdown or JSON. See [CLI](/integrations/cli#print).

## Workflow for coding agents

When an agent works in a project that uses glosslint, follow these five steps:

1. Read `.agents/glossary.md` before writing user-facing text.
2. When you are unsure which word to use, run `glosslint explain "<word>"` first. It prints the term, what it means, its nuance, why the project uses it, and the words to avoid.
3. After editing, run the project's linter ([ESLint](/integrations/eslint) or [Oxlint](/integrations/oxlint)) and `glosslint check --format json` on the docs you touched.
4. Apply findings by `fix.kind`:
   - `autofix`: apply it as given.
   - `suggestion`: read the finding's `why` and the term's `nuance`, then pick the word that fits the meaning. The suggested term is often right, but not always.
   - `rename`: do not apply it alone. Rename every caller in the same change, or report it.
5. After editing `.agents/glossary.md`, run `glosslint doctor --fix` to normalize the layout and check every `Good` and `Bad` example. If the project also has `glosslint.config.ts`, run `glosslint test`.

When you run `glosslint explain` in step 2, it matches the term itself, an abbreviation, a locale form, an avoid word, a misspelling, or a mention. If no term matches, it exits `1`.

```sh
npx glosslint explain rack
```

```txt
Dock
  "rack" is an avoid word for Dock. Racks are unpowered.
  A powered stand where one bike is locked.
  A station is a group of docks.
  Avoid: rack (racks are unpowered), bay.
  Good: "Return the bike to any dock". Bad: "Return the bike to any rack".
  See: Docks https://example.com/docs/docks
  Related: Station
```

See [Findings](/reference/findings) for the JSON output of `glosslint check --format json` and every field on a finding, and [CLI](/integrations/cli) for all commands and exit codes.

## Markdown docs

Every page on this site also has a raw Markdown copy at `/raw/<page>.md`, such as `/raw/guide/agents.md`, plus a full index at `/llms.txt` that agents and tools can fetch without parsing HTML.
