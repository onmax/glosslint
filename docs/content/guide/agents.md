---
title: Coding agents
description: Export your glossary for coding agents, follow the five-step editing workflow by fix.kind, and install the glosslint agent skill.
navigation.order: 10
icon: i-lucide-bot
---

This page shows how to give coding agents your glosslint glossary, the five-step workflow an agent follows when editing text or the corpus, and how to install the glosslint agent skill from this site.

## Set up a project for coding agents

To set a project up for coding agents, put the glossary where they read it. `glosslint print` writes your corpus as a Markdown glossary, with one section per term that says more than its spelling and one "Spelling" line for the rest.

```sh
npx glosslint print > .agents/terms.md
```

For the bike-share corpus, the `Dock` section of `.agents/terms.md` looks like this:

```txt
## Dock
A powered stand where one bike is locked.
- A station is a group of docks.
- Don't write: rack (racks are unpowered), bay.
- Good: "Return the bike to any dock". Bad: "Return the bike to any rack".
- See: [Docks](https://example.com/docs/docks).
```

Link `.agents/terms.md` from `AGENTS.md`, or paste the sections you care about into `AGENTS.md` itself. Rerun `npx glosslint print > .agents/terms.md` whenever the corpus changes so the file stays in sync with `glosslint.config.ts`.

If your project already keeps a Markdown glossary table that `fromGlossaryTable` reads, link that table from `AGENTS.md` instead of generating a second file. See [Glossary table](/guide/glossary-table) for the table format and [CLI](/integrations/cli) for `glosslint print` options.

## Workflow for coding agents

If you are an agent working in a project that uses glosslint, follow these five steps:

1. Read the glossary before you write user-facing text.
2. When you are unsure which word to use, run `glosslint explain "<word>"` first. It prints the term, what it means, the nuance and the words to avoid.
3. After editing, run the project's lint, and `glosslint check --format json` on the docs you touched.
4. Apply findings by `fix.kind`:
   - `autofix`: apply it as given.
   - `suggestion`: read the term's `nuance` and the finding's `why`, then pick the word that fits the meaning. The suggested term is often right. Not always.
   - `rename`: do not apply it alone. Rename every caller in the same change, or report it.
5. After editing the corpus, run `glosslint test`.

When you run `glosslint explain` in step 2, it matches the term itself, an abbreviation, a form, an avoid word, a misspelling, or a mention. If no term matches, it exits `1`.

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

## Agent skill and Markdown docs

This site serves an agent skill that teaches coding agents how to work with glosslint. Install the `glosslint` skill with:

```sh
npx skills add https://glosslint.onmax.me/
```

Every page on this site also has a raw Markdown copy at `/raw/<page>.md`, such as `/raw/guide/agents.md`, plus a full index at `/llms.txt` that agents and tools can fetch without parsing HTML.
