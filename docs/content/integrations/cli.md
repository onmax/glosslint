---
title: Command line
description: Run glosslint from the terminal to check Markdown and MDX docs, test corpus examples, print a glossary, and explain terms.
navigation.order: 3
icon: i-lucide-terminal
---

Use the glosslint CLI to check files that ESLint does not read, such as Markdown and MDX docs, test your corpus examples in CI, export a Markdown glossary for coding agents, and look up terms from the terminal.

## Config discovery and flags

Run `glosslint` from the folder that holds `glosslint.config.ts`, or point to another file with `--config <path>`. Without `--config`, the CLI looks for these files in order:

1. `glosslint.config.ts`
2. `glosslint.config.mts`
3. `glosslint.config.js`
4. `glosslint.config.mjs`

Every command accepts `--config <path>`. The `check` and `test` commands also accept `--color`, which is on by default when writing to a terminal unless `NO_COLOR` is set.

| Command                               | What it does                                                   |
| ------------------------------------- | -------------------------------------------------------------- |
| `glosslint [check] [...paths]`        | Check Markdown and text files. `check` is the default command. |
| `glosslint test`                      | Check every term's good and bad examples.                      |
| `glosslint print [--format md\|json]` | Print the corpus as a Markdown glossary or as JSON.            |
| `glosslint explain <query>`           | Show what the corpus says about a word or phrase.              |

> [!NOTE]
> There is no `--fix`. The CLI only reports findings. To autofix spelling and casing in code and YAML locales, use [ESLint](/integrations/eslint).

## Exit codes

| Exit code | Meaning                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------- |
| `0`       | No findings, every example passes, or `explain` found a term.                                  |
| `1`       | `check` found something, a `test` example failed, or `explain` found no term.                  |
| `2`       | The config failed to load or is wrong, or the command line is wrong. The error goes to stderr. |

See [Config errors](/reference/config-errors) for every error code that causes exit code `2`.

## check

`check` is the default command. It reads files, folders, and glob patterns. With no path, it reads the current folder.

When given a folder, `check` reads `.md`, `.mdx`, and `.txt` files while skipping `node_modules` and `.git`. Pass `--ext md,mdx` to change which extensions it reads in folders. Pass `--format json` to print machine-readable output; see [Findings](/reference/findings) for the JSON schema.

In Markdown files, `check` skips frontmatter, fenced and inline code, HTML comments and tags, link targets, and reference definitions. In MDX files, it also skips `import` and `export` lines. It reads headings as labels, each table cell on its own with the first row as headers, and paragraphs and list items as sentences.

```sh
npx glosslint check docs/guide
```

```txt
[GLOSSLINT_CASE] "day pass" in docs/guide/passes.md:1:12
├▶ fix: Change to "Day Pass": "# Buying a Day Pass"
╰▶ term: Day Pass

[GLOSSLINT_CASE] "Day Pass" in docs/guide/passes.md:3:7
├▶ fix: Change to "day pass": "Buy a day pass at the kiosk, or pay with Apple pay in the app."
╰▶ term: Day Pass

[GLOSSLINT_CASE] "Apple pay" in docs/guide/passes.md:3:42
├▶ fix: Change to "Apple Pay": "Buy a Day Pass at the kiosk, or pay with Apple Pay in the app."
╰▶ term: Apple Pay

[GLOSSLINT_AVOID] "Manned" in docs/guide/passes.md:4:1
├▶ why: It assumes the people on duty are men.
├▶ fix: Use "Staffed": "Staffed stations sell passes from 7:00 to 19:00."
╰▶ term: staffed, having people on duty.

[GLOSSLINT_AVOID] "rack" in docs/guide/riding.md:3:56
├▶ why: Racks are unpowered.
├▶ fix: Use "dock": "Unlock a bike at any station, then return it to a free dock when you finish."
├▶ term: Dock, a powered stand where one bike is locked.
╰▶ see: https://example.com/docs/docks

[GLOSSLINT_TERM] "e-bike" in docs/guide/riding.md:4:15
├▶ fix: Change to "eBike": "Check out our eBike fleet if the hill feels long."
╰▶ term: eBike

6 findings in 2 of 2 files.
```

The heading "Buying a day pass" is a label, so Day Pass takes Title Case there. In the next line it sits inside a sentence, so it takes lowercase. "Check out our" and "roof rack" are in `allow`, and the CLI never reads the code block. Apple Pay comes from the tech preset and "Manned" from the inclusive preset.

## test

`test` checks every term's `examples` field, defined in [Defining terms](/guide/terms). Every `good` string must pass with no findings for that term, and every `bad` string must give a finding for that term. Run it in CI and after editing the corpus.

```sh
npx glosslint test | tail -n 3
```

```txt
✓ Dock                    1 good, 1 bad

38 terms, 0 failing.
```

A failing term shows why it failed and what to change:

```txt
✗ Dock  good example "Return the bike to a dock bay" was flagged:
        "bay" is an avoid word for Dock.
        └ narrow the avoid word or move the example
        bad example "Return the bike to a station" was not flagged.
        └ add the wording to "avoid" or fix the example

1 term, 1 failing.
```

## print

`print` writes the corpus as a Markdown glossary, with one section per term that says more than its spelling and one "Spelling" line for the rest. Pass `--format json` to write `{ terms, allow }` instead.

Redirect the Markdown output to a file that coding agents read, as described in [Coding agents](/guide/agents):

```sh
npx glosslint print > .agents/terms.md
```

The Dock section of that file:

```txt
## Dock
A powered stand where one bike is locked.
- A station is a group of docks.
- Don't write: rack (racks are unpowered), bay.
- Good: "Return the bike to any dock". Bad: "Return the bike to any rack".
- See: [Docks](https://example.com/docs/docks).
```

## explain

`explain` finds the term a word or phrase belongs to. The query may be the term itself, an abbreviation, a form, an avoid word, a misspelling, or a mention.

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

```sh
npx glosslint explain e-bike
```

```txt
eBike
  "e-bike" is spelled "eBike".
  Always written "eBike".
```

A word the corpus does not know prints `No term in the corpus matches "scooter".` and exits `1`.
