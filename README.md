<h1><img src="./.github/assets/banner.svg" alt="glosslint" width="100%"></h1>

<!-- automd:comark-badges packages=glosslint -->

[![npm version](https://comark-ui.onmax.me/badge.svg?source=npm-version&package=glosslint&label=glosslint&icon=npm)](https://www.npmjs.com/package/glosslint)
[![npm downloads](https://comark-ui.onmax.me/badge.svg?source=npm-downloads&package=glosslint&period=month&icon=npm)](https://www.npmjs.com/package/glosslint)
[![CI](https://comark-ui.onmax.me/badge.svg?source=github-actions&repository=onmax%2Fglosslint&workflow=pkg-pr-new.yml&icon=github)](https://github.com/onmax/glosslint/actions/workflows/pkg-pr-new.yml)
[![license: MIT](https://comark-ui.onmax.me/badge.svg?label=license&value=MIT)](./LICENSE)

<!-- /automd -->

[![docs](https://comark-ui.onmax.me/badge.svg?label=docs&value=glosslint.onmax.me)](https://glosslint.onmax.me)

glosslint checks that your product's words are spelled, cased and chosen the way your glossary says. You keep one corpus of terms, each with its meaning and the words to avoid. glosslint reports problems in code through ESLint, in translations through x18n, and in Markdown docs through its CLI. Every finding carries the reason and meaning, so people and coding agents learn the vocabulary as they work.

[Docs](https://glosslint.onmax.me) · [Installation](https://glosslint.onmax.me/guide/installation) · [The corpus](https://glosslint.onmax.me/guide/corpus) · [ESLint](https://glosslint.onmax.me/integrations/eslint) · [x18n](https://glosslint.onmax.me/integrations/x18n) · [CLI](https://glosslint.onmax.me/integrations/cli) · [For agents](https://glosslint.onmax.me/guide/agents)

## Install

```sh
pnpm add -D glosslint
```

glosslint needs Node 22.18 or later, because it loads `glosslint.config.ts` with Node's own `import()` and type stripping. ESLint 9.15 or later and `@x18n/core` are optional peer dependencies. Install the ones you use.

## Example

This example comes from the bike-share app in [`examples/basic`](https://github.com/onmax/glosslint/tree/main/examples/basic).

```diff
  # locales/en.yml
- hint: Return your e-bike to any rack.
+ hint: Return your eBike to any dock.
```

Define your terms in `glosslint.config.ts`:

```ts
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
});
```

Run the CLI on Markdown docs. Here is one finding from `examples/basic`:

```sh
npx glosslint check docs/guide
```

```txt
[GLOSSLINT_AVOID] "rack" in docs/guide/riding.md:3:56
├▶ why: Racks are unpowered.
├▶ fix: Use "dock": "Unlock a bike at any station, then return it to a free dock when you finish."
├▶ term: Dock, a powered stand where one bike is locked.
╰▶ see: https://example.com/docs/docks
```

## Where it checks

- [ESLint](https://glosslint.onmax.me/integrations/eslint) checks strings, comments and declared identifiers in JavaScript, TypeScript and Vue, plus YAML locale values.
- [x18n](https://glosslint.onmax.me/integrations/x18n) checks the source locale's messages and hard-coded strings, and `toX18nGlossary` turns the corpus into x18n's glossary.
- [The CLI](https://glosslint.onmax.me/integrations/cli) checks Markdown, MDX and text files, tests term examples, prints the corpus and explains words.

## For agents

Write your glossary for coding agents with `glosslint print > .agents/terms.md` and link it from `AGENTS.md`. When an agent is unsure which word to use, `glosslint explain "<word>"` prints the term, its meaning, its nuance and the words to avoid. [For agents](https://glosslint.onmax.me/guide/agents) explains how to apply findings by `fix.kind`.

## License

MIT. The tech preset includes data from case-police, also MIT. See [NOTICE](./NOTICE).
