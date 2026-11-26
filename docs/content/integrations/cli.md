---
title: Command line
description: Run the glosslint CLI to check Markdown docs, lint and fix .agents/glossary.md with doctor, test examples, print corpora, and explain words.
navigation.order: 5
icon: i-lucide-terminal
---

Use the glosslint CLI to check Markdown and text files, validate and repair `.agents/glossary.md` with `doctor`, test term examples in CI, print a merged corpus, and look up terms from the terminal.

## Corpus discovery and flags

For `check`, `test`, `print`, and `explain`, the CLI loads your corpus in this order:

1. `--config <path>`
2. `--glossary <path>`
3. `glosslint.config.ts`, `.mts`, `.js`, or `.mjs` in the current folder
4. `.agents/glossary.md` in the current folder

Passing both `--config` and `--glossary` exits `2` with `GLOSSLINT_USAGE`. Finding neither a config nor `.agents/glossary.md` exits `2` with `GLOSSLINT_C009`.

`glosslint doctor` reads only the glossary file (`.agents/glossary.md` or `--glossary <path>`), never a JS/TS config. `check`, `test`, and `doctor` also accept `--color`, which is on by default when writing to a terminal unless `NO_COLOR` is set.

| Command | What it does |
| --- | --- |
| `glosslint [check] [...paths]` | Check Markdown, MDX, and text files. `check` is the default command. |
| `glosslint doctor [--glossary <path>] [--fix]` | Check `.agents/glossary.md` for format, value, and example problems, and rewrite fixable ones with `--fix`. |
| `glosslint test` | Check every term's good and bad examples across the loaded corpus. |
| `glosslint print [--format md\|json]` | Print the corpus as a Markdown glossary or as JSON. |
| `glosslint explain <query>` | Show what the corpus says about a word or phrase. |

> [!NOTE]
> `glosslint check` has no `--fix` and never edits checked docs. Use `glosslint doctor --fix` to repair `.agents/glossary.md`, and [ESLint](/integrations/eslint) or [Oxlint](/integrations/oxlint) to autofix code.

## Exit codes

| Exit code | Meaning |
| --- | --- |
| `0` | No findings, no `doctor` problems left, every `test` example passes, or `explain` found a term. |
| `1` | `check` found something, `doctor` has problems remaining, a `test` example failed, or `explain` found no term. |
| `2` | The glossary or config is missing or invalid, or the command line is wrong. The error goes to stderr. |

See [Config and glossary errors](/reference/config-errors) for every error code.

## check

`check` is the default command. It reads files, folders, and glob patterns. With no path, it reads the current folder.

When given a folder, `check` reads `.md`, `.mdx`, and `.txt` files while skipping `node_modules` and `.git`. The glossary file loaded directly (`.agents/glossary.md` or `--glossary <path>`) is always skipped, even if you name it or check its parent folder. Pass `--ext md,mdx` to change which extensions it reads in folders. Pass `--format json` to print machine-readable output; see [Findings](/reference/findings) for the JSON schema.

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

The heading "Buying a day pass" is a label, so Day Pass takes Title Case there. In the next line it sits inside a sentence, so it takes lowercase. "Check out our" and "roof rack" are in `Allow:`, and the CLI never reads the code block. Apple Pay comes from `Extends: tech` and "Manned" from `inclusive`.

## doctor

`doctor` lints `.agents/glossary.md` (or `--glossary <path>`) against the [glossary file format](/guide/glossary) (`GLOSSLINT_G001` to `GLOSSLINT_G008`) and tests every term's `Good` and `Bad` examples against the file's own corpus (`GLOSSLINT_G009`). Pass `--format json` to print `{ problems, summary }`.

On a clean file such as `examples/basic/.agents/glossary.md`, `doctor` exits `0`:

```sh
npx glosslint doctor
```

```txt
No problems in .agents/glossary.md.
```

When the file has problems, `doctor` prints each one with its code, file and line number, term (when inside one), and fix, then exits `1`:

```txt
[GLOSSLINT_G001] .agents/glossary.md:1: The title is "Words", not "Glossary".
╰▶ fix: Retitle it "# Glossary".

[GLOSSLINT_G002] .agents/glossary.md:4: "description" is another name for "What".
├▶ term: Dock
╰▶ fix: Rename it to "What".

[GLOSSLINT_G008] .agents/glossary.md:5: "station" is an avoid word of "Dock" and a term of its own.
╰▶ fix: Remove it from the Avoid list of "Dock", or remove the term "station".

[GLOSSLINT_G004] .agents/glossary.md:6: "Note" is not a field.
├▶ term: Dock
╰▶ fix: Use "What", "How", "Why", "Avoid", "Good", "Bad", "Links" or "Case", or reword the line so it does not start with "Note:".

[GLOSSLINT_G006] .agents/glossary.md:7: Case is "loud".
├▶ term: Dock
╰▶ fix: Use "exact", "spelling" or "context".

[GLOSSLINT_G003] .agents/glossary.md:11: A blank line before this line.
╰▶ fix: Remove it: a term's heading and its fields go on consecutive lines.

[GLOSSLINT_G005] .agents/glossary.md:14: "station" is written twice: "Station" is the same term.
╰▶ fix: Merge the two sections into one.

[GLOSSLINT_G007] .agents/glossary.md:16: The parentheses in "## Day Pass (day ticket)" hold more than abbreviations.
├▶ term: Day Pass
╰▶ fix: Keep only abbreviations in parentheses, such as `## Day Pass (DP)`, and move the rest to `How`.

8 problems in .agents/glossary.md.
```

Pass `--fix` to rewrite fixable problems (`GLOSSLINT_G001` to `GLOSSLINT_G003`) into canonical form while keeping term order, introduction prose, and field text. If any problem from `GLOSSLINT_G004` to `GLOSSLINT_G008` is present, `--fix` leaves the file untouched so it never drops text and exits `1`. Running `doctor --fix` a second time on a clean file changes no byte.

See [Config and glossary errors](/reference/config-errors#glossary-problem-codes) for every `GLOSSLINT_G00x` code.

## test

`test` checks every term's `Good` and `Bad` examples across the loaded corpus, including presets and any `defineCorpus` additions. Every `Good` string must pass with no findings for that term, and every `Bad` string must give a finding for that term. Run it in CI and after editing your glossary or config.

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

`print` writes the loaded corpus as a Markdown summary (one section per term that says more than its spelling and one "Spelling" line for the rest), or as JSON with `--format json` (`{ terms, allow }`).

Projects that keep their terms in `.agents/glossary.md` do not need `print` for coding agents, because agents read `.agents/glossary.md` directly. `print` is useful when your corpus is composed in `glosslint.config.ts` or when you want a JSON export.

```sh
npx glosslint print
```

The Dock section of `print`'s Markdown output:

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
