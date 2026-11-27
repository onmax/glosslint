---
title: Coding agents
description: Wire glosslint into package.json and AGENTS.md so coding agents read your glossary and check their own edits.
navigation.order: 9
icon: i-lucide-bot
---

Coding agents read [`.agents/glossary.md`](/guide/glossary) directly, the same file ESLint, Oxlint, x18n, and the CLI check. Add a script in `package.json` and run it in CI:

```json [package.json]
{
  "scripts": {
    "lint:terms": "glosslint doctor && glosslint check docs"
  }
}
```

Both commands exit `0` when clean and `1` on problems or findings, so `lint:terms` fails CI when the glossary is broken or docs drift. Point agents at the glossary and the script in `AGENTS.md`:

```md [AGENTS.md]
## Vocabulary

Read `.agents/glossary.md` before writing UI copy or docs. Run `npm run lint:terms` after edits, and `npx glosslint doctor --fix` after changing the glossary.
```

Put a link to the format guide under the glossary's title so an agent opening the file alone can still check its syntax:

```md [.agents/glossary.md]
# Glossary

<!-- Format and checks: https://glosslint.onmax.me/guide/glossary -->
```

If you also use [`defineCorpus`](/guide/corpus), pass its module with `--corpus`: export the merged corpus with `npx glosslint print --corpus <module>` and run `npx glosslint test --corpus <module>` after changes. See [CLI](/integrations/cli#print).

## Agent workflow

1. Read `.agents/glossary.md` before writing copy or docs, or run `npx glosslint explain <word>` when unsure which term to use.
2. Run your project linter, such as [ESLint](/integrations/eslint) or [Oxlint](/integrations/oxlint), and `lint:terms`, or pass `--format json` to `glosslint check` for structured output.
3. Follow each finding's `fix.kind`: apply `autofix` as given, read `why` and `nuance` before applying a `suggestion`, and update every caller for a `rename`.

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

Every page on this site has a raw Markdown copy at `/raw/<page>.md`, such as `/raw/guide/agents.md`, and a full index at `/llms.txt`.
