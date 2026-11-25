---
title: Coming from case-police
description: How glosslint's tech preset matches case-police 2.2.1 across 488 entries, where the 7 joined spellings differ, and how to migrate.
navigation.order: 9
icon: i-lucide-arrow-right-left
---

[case-police](https://github.com/antfu/case-police), by Anthony Fu, is a CLI that checks and fixes the casing of technology names such as `GitHub` and `macOS`. glosslint builds its tech preset directly from case-police's dictionaries so you can keep the same casing rules and add your own product glossary in one place.

## Dictionary coverage

`glosslint/presets/tech` is generated from all five dictionaries of case-police 2.2.1 under the MIT License. The third-party license notice is in [`NOTICE`](https://github.com/onmax/glosslint/blob/main/NOTICE). [`scripts/tech.ts`](https://github.com/onmax/glosslint/blob/main/scripts/tech.ts) reads every JSON dictionary and writes 477 distinct keys plus 7 allowed spellings.

| Dictionary | Entries |
| --- | --- |
| `softwares` | 309 |
| `abbreviates` | 118 |
| `brands` | 30 |
| `general` | 18 |
| `products` | 13 |
| **Total** | **488** |

## Casing parity and the 7 differences

glosslint matches case-police's casing rule: a word written all lowercase or all uppercase passes, so `github` and `GITHUB` pass while `Github` becomes `GitHub`. [`scripts/tech.ts`](https://github.com/onmax/glosslint/blob/main/scripts/tech.ts) sets `case: "exact"` and `skip: ["lower", "upper"]` on every term in the tech preset for that reason.

[`test/tech-parity.test.ts`](https://github.com/onmax/glosslint/blob/main/test/tech-parity.test.ts) checks parity against case-police 2.2.1 directly. It places each of the 488 entries inside a sentence in four forms: Capitalised, lower, UPPER and the canonical spelling, making 1,952 cases. Both tools fix every sentence and the test compares the results.

Of the 1,952 cases, 1,945 produce the same output. The only 7 differences come from joined spellings that case-police lists beside a spaced form with the same key:

| Term in `glosslint/presets/tech` | Joined spelling in `allow` |
| --- | --- |
| `Ant Design` | `AntDesign` |
| `Ant Design Vue` | `AntDesignVue` |
| `Composition API` | `CompositionAPI` |
| `Graph RAG` | `GraphRAG` |
| `Naive UI` | `NaiveUI` |
| `Tailwind CSS` | `TailwindCSS` |
| `Windi CSS` | `WindiCSS` |

A glosslint corpus holds one term per key, so the preset keeps the spaced form, such as `Tailwind CSS`, as the term and puts the joined spelling, `TailwindCSS`, in `allow`. Because `allow` matches in any case, glosslint leaves `Antdesign` as written where case-police rewrites it to `AntDesign`. The spaced form still gets checked, so `Ant design` still rewrites to `Ant Design`.

## What glosslint adds

Extending `glosslint/presets/tech` puts technology names into the same corpus as the rest of your product vocabulary:

- **Your own product terms.** Define terms like `Dock`, `eBike` and `Day Pass` alongside the tech preset, or load them from a [Glossary table](/guide/glossary-table) and combine them with other [Built-in presets](/guide/presets).
- **Avoid words with reasons.** Flag discouraged terms such as `rack` or `hub` with a `why` message explaining what to use instead.
- **Context casing.** Apply different styles in labels, table headers and sentences with `case: "context"`, such as `Day Pass` in a button and `day pass` in a sentence. See [Casing](/guide/casing).
- **Meaning on every finding.** Every finding prints the term's description, nuance and documentation link so writers and coding agents learn the vocabulary as they work.
- **Code, translations and docs.** Run the same corpus through [ESLint](/integrations/eslint) for JavaScript, TypeScript, Vue templates and YAML locales, [x18n](/integrations/x18n) for translations, and [the CLI](/integrations/cli) for Markdown docs.

## Moving over

::steps

### Install glosslint

Install `glosslint` as a dev dependency. glosslint needs Node 22.18 or later.

::code-group
```sh [pnpm]
pnpm add -D glosslint
```
```sh [npm]
npm install -D glosslint
```
::

### Extend the tech preset

Create `glosslint.config.ts` at the root of your repository and extend `glosslint/presets/tech`:

```ts [glosslint.config.ts]
import { defineCorpus } from "glosslint";
import tech from "glosslint/presets/tech";

export default defineCorpus({
  extends: [tech],
});
```

### Check Markdown and fix code

Run the CLI to check Markdown and text files:

```sh
npx glosslint check
```

> [!NOTE]
> The glosslint CLI only reports findings and has no `--fix` flag.

To autofix casing in JavaScript, TypeScript, Vue templates and YAML locale files, wire your corpus into [ESLint](/integrations/eslint) and run `eslint --fix`.

::
