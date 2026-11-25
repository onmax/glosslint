---
title: Installation
description: Install glosslint, check the Node 22.18 and optional peer requirements, write your first glosslint.config.ts, and run check and test.
navigation.order: 2
icon: i-lucide-download
---

This page walks you through installing glosslint, checking its runtime and peer requirements, writing a small `glosslint.config.ts`, and running the CLI for the first time.

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

glosslint needs Node 22.18 or later, because it loads `glosslint.config.ts` with Node's own `import()` and type stripping. You do not need a bundler or TypeScript loader to run the CLI against a `.ts` config file.

ESLint 9.15 or later and `@x18n/core` are optional peer dependencies. Install only the ones you use. If you only run the CLI on Markdown docs, you need neither peer.

## First setup

Create a corpus file at the root of your repository, then run the CLI to check your docs and test your term examples.

::steps
### Write `glosslint.config.ts`

Create `glosslint.config.ts` at the project root. This starter corpus defines two terms from the bike-share app, `Dock` and `eBike`, and allows `"roof rack"` so that second meaning of `rack` is never reported.

```ts [glosslint.config.ts]
import { defineCorpus } from "glosslint";

export default defineCorpus({
  terms: [
    {
      term: "Dock",
      description: "A powered stand where one bike is locked.",
      nuance: "A station is a group of docks.",
      avoid: [{ word: "rack", why: "Racks are unpowered." }, "bay"],
      examples: { good: ["Return the bike to any dock"], bad: ["Return the bike to any rack"] },
      links: [{ title: "Docks", url: "https://example.com/docs/docks" }],
    },
    { term: "eBike", case: "exact" },
  ],
  allow: ["roof rack"],
});
```

`defineCorpus` checks every field when the config loads and throws a `GlosslintConfigError` on a mistake, as listed in [Config errors](/reference/config-errors). It returns a flat corpus that ESLint, x18n and the CLI all read.

### Check your Markdown docs

Run `glosslint check` on your docs folder:

```sh
npx glosslint check docs
```

In a folder, `check` reads `.md`, `.mdx` and `.txt` files while skipping `node_modules` and `.git`. In Markdown it skips frontmatter, fenced and inline code, HTML comments and tags, link targets and reference definitions. It exits `0` when there are no findings, `1` when it finds something, and `2` when the config or command line is wrong.

### Test your corpus examples

Run `glosslint test` to verify every term's `examples`:

```sh
npx glosslint test
```

Every `good` string must pass, and every `bad` string must produce a finding for that term. Run `glosslint test` in CI and whenever you edit `glosslint.config.ts`.
::

## Example output

To see all three finding codes together, [`examples/basic`](https://github.com/onmax/glosslint/blob/main/examples/basic) extends this setup with `Checkout`, `Day Pass`, a Markdown glossary table, and the tech and inclusive presets. Running `check` on `docs/guide` skips `docs/glossary.md`, whose avoid column would report itself, and prints:

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

And testing that corpus prints each tested term and a summary count:

```sh
npx glosslint test | tail -n 3
```

```txt
✓ Dock                    1 good, 1 bad

38 terms, 0 failing.
```

## Next

- [The corpus](/guide/corpus): add presets, load a Markdown glossary table, and configure casing and `allow` lists.
- [ESLint](/integrations/eslint): lint strings, Vue templates, YAML locales, comments and identifiers in your codebase.
- [x18n](/integrations/x18n): check source locale messages and share your corpus with x18n's glossary.
- [CLI](/integrations/cli): explore `check`, `test`, `print` and `explain`, plus flags and exit codes.
