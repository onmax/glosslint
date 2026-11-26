---
title: Coding agents
description: Point coding agents at your glossary from their instructions file, follow each finding's fix kind, and use glosslint explain and doctor.
navigation.order: 9
icon: i-lucide-bot
---

Coding agents read [`.agents/glossary.md`](/guide/glossary) directly, the same file ESLint, Oxlint, x18n, and the CLI enforce. Link it from `AGENTS.md`:

```md [AGENTS.md]
## Vocabulary

Read `.agents/glossary.md` before writing UI copy, comments, or docs. Run `npx glosslint doctor --fix` after editing it.
```

Put a comment under the glossary's title that links the format guide, so an agent that opens the file without `AGENTS.md` can still look up its fields:

```md [.agents/glossary.md]
# Glossary

<!-- Format and checks: https://glosslint.onmax.me/guide/glossary -->
```

If you also use [`defineCorpus`](/guide/corpus), export the merged corpus as Markdown or JSON with `npx glosslint print` ([CLI](/integrations/cli#print)).

## Agent workflow

1. Read `.agents/glossary.md` before writing UI copy, comments, or docs.
2. Run `glosslint explain "<word>"` when unsure which word to use. It matches terms, abbreviations, locale forms, avoid words, misspellings, and mentions, and exits `1` if none match.
3. Run the project linter ([ESLint](/integrations/eslint) or [Oxlint](/integrations/oxlint)) and `glosslint check --format json` on touched docs.
4. Apply findings by `fix.kind`:
   - `autofix`: apply as given.
   - `suggestion`: read `why` and `nuance`, then pick the word that fits.
   - `rename`: rename every caller in the same change, or report it.
5. After editing `.agents/glossary.md`, run `glosslint doctor --fix`, and run `glosslint test` if `glosslint.config.ts` exists.

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

See [Findings](/reference/findings) for the JSON output and [CLI](/integrations/cli) for all commands.

## Markdown docs

Every page on this site has a raw Markdown copy at `/raw/<page>.md` (such as `/raw/guide/agents.md`) and a full index at `/llms.txt`.
