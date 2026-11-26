---
title: Installation
description: Install glosslint, check Node 22.18 and peer requirements, create .agents/glossary.md, and run your first check and doctor commands.
navigation.order: 2
icon: i-lucide-download
---

This page walks you through installing glosslint, checking its runtime and peer requirements, writing a starter `.agents/glossary.md`, and running the CLI for the first time.

## Install the package

Install `glosslint` as a dev dependency with your package manager.

::code-group
```sh [pnpm]
pnpm add -D glosslint
```

```sh [npm]
npm install -D glosslint
```

```sh [yarn]
yarn add -D glosslint
```

```sh [bun]
bun add -d glosslint
```
::

## Requirements

glosslint needs Node 22.18 or later, which includes native type stripping when loading optional `glosslint.config.ts` files.

ESLint (`>=9.15.0`), Oxlint (`>=1.94.0`), and `@x18n/core` (`>=0.1.14`) are optional peer dependencies. Install only the ones you use. If you only run the CLI on Markdown docs, you need no peer dependencies.

## First setup

Create `.agents/glossary.md`, check that its format and examples are clean, and run `glosslint check` on your docs.

::steps
### Write `.agents/glossary.md`

Create `.agents/glossary.md` in your repository. This starter file defines two terms from the bike-share app, `Dock` and `eBike`, and allows `"roof rack"` so that second meaning of `rack` is never reported.

```md [.agents/glossary.md]
# Glossary

The words the rider app and the help center use.

Allow: roof rack

## Dock

What: A powered stand where one bike is locked.

How: A station is a group of docks.

Why: Riders read "dock" on the stand itself.

Avoid:

- rack: Racks are unpowered.
- bay

Good:

- Return the bike to any dock

Bad:

- Return the bike to any rack

Links:

- [Docks](https://example.com/docs/docks)

## eBike
```

`eBike` automatically gets `Case: exact` because of its inner capital. See [The glossary file](/guide/glossary) for every corpus and term field.

### Validate the glossary with `doctor`

Run `glosslint doctor` to check the glossary file's syntax, values, and `Good`/`Bad` examples:

```sh
npx glosslint doctor
```

Pass `--fix` to rewrite fixable layout, heading, or field-name issues into canonical form. Run `glosslint doctor` in CI and whenever you edit `.agents/glossary.md`.

### Check your Markdown docs

Run `glosslint check` on your docs folder:

```sh
npx glosslint check docs
```

In a folder, `check` reads `.md`, `.mdx`, and `.txt` files while skipping `node_modules`, `.git`, and `.agents/glossary.md` itself. In Markdown it skips frontmatter, fenced and inline code, HTML comments and tags, link targets, and reference definitions. It exits `0` when there are no findings, `1` when it finds something, and `2` when the glossary, config, or command line has an error.
::

## Example output

To see all three finding codes together, [`examples/basic`](https://github.com/onmax/glosslint/blob/main/examples/basic) keeps `.agents/glossary.md` with `Station`, `Rider`, `Ride`, `Week Pass (WP)`, `kiosk`, `Dock`, `Checkout`, `eBike`, `Day Pass (DP)`, and the `tech` and `inclusive` presets, with no TypeScript config file. Running `check` on `docs/guide` prints:

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

Running `glosslint test` checks every term's `Good` and `Bad` examples, including those from the `inclusive` preset:

```sh
npx glosslint test | tail -n 3
```

```txt
✓ Dock                    1 good, 1 bad

38 terms, 0 failing.
```

## Next

- [The glossary file](/guide/glossary): every field, syntax detail, and how `glosslint doctor --fix` works.
- [ESLint](/integrations/eslint): lint JavaScript, TypeScript, Vue templates, YAML locales, comments, and identifiers with `glosslint()`.
- [Oxlint](/integrations/oxlint): run the four rules as an Oxlint JS plugin on JavaScript and TypeScript.
- [x18n](/integrations/x18n): check source locale messages and share your glossary with x18n.
- [CLI](/integrations/cli): explore `check`, `doctor`, `test`, `print`, and `explain`, plus flags and exit codes.
