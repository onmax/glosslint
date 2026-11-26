---
title: What glosslint skips
description: See what text glosslint blanks before matching, which code strings ESLint and Oxlint ignore, and what Markdown syntax the CLI skips.
navigation.order: 7
icon: i-lucide-eye-off
---

glosslint checks the words people read, not code syntax, identifiers inside strings, or markup. Knowing what gets skipped helps you predict when a term will be flagged and when you need to add a phrase to `Allow:` in [`.agents/glossary.md`](/guide/glossary) or `allow` in [`defineCorpus`](/guide/corpus).

## Text never read as words anywhere

Before matching any string in ESLint, Oxlint, x18n, or the CLI, glosslint blanks out spans that are code rather than words:

- `{placeholders}` and `{{ mustaches }}`
- ICU syntax, while still reading the words inside ICU branches
- URLs and email addresses
- file paths
- text in backticks
- `camelCase`, `snake_case`, and `kebab-slug` tokens

Two rules keep real words from disappearing:

- A token that is an `exact` term or abbreviation itself stays, so `eBike` is still checked.
- The `s` of a possessive never forms a word, so `"the Dock's light"` does not read `"s"`.

For example, with `rack` as an avoid word for Dock and `eBike` as an `exact` term:

- `"Check {rack} availability at https://example.com/rack."` produces no findings. Both `{rack}` and the URL are blanked before matching.
- `"Return your e-bike to {rack} at https://example.com/rack."` reports `"e-bike"` as `"eBike"` and still skips `{rack}` and the URL.

## What ESLint and Oxlint skip in code

When linting JavaScript and TypeScript through [ESLint](/integrations/eslint) or [Oxlint](/integrations/oxlint) (plus Vue templates and YAML files in ESLint), `glosslint/term` and `glosslint/avoid` skip strings that are code:

- Import and export sources, object and class keys, member names, and TypeScript literal types. A quoted object key with a space in it is text, so the rules read it.
- Operands of comparisons and `switch` cases, directives such as `"use strict"`, enum member names, and tagged templates.
- The first argument of `t`, `$t`, `te`, `tm`, and any callee matched by `ignoreCallees`, which defaults to `endsWith`, `startsWith`, `includes`, and `querySelector*`.
- In ESLint on Vue files: the attributes `class`, `style`, `id`, `key`, `ref`, `name`, `to`, `href`, `src`, `icon`, `type`, `variant`, `color`, `size`, `slot`, `is`, `for`, the `aria-*` attributes that hold ids (`aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-owns`), and every `data-*` attribute.
- In ESLint on YAML files: YAML keys. Only YAML string values are checked.
- Strings with no spaces shaped like code: all lowercase, kebab, snake, camelCase, or a path.

The rules also skip offering a fix when the source cannot take it as written. A string whose escapes the fix would break, or a YAML block scalar in ESLint, still reports the finding without a fix.

In comments, `glosslint/comment` skips tool directives such as `eslint-disable`, `@ts-expect-error`, `prettier-ignore`, and `#region`. In identifiers, `glosslint/identifier` skips shorthand destructuring such as `const { daypass } = response`, because that name comes from somewhere else.

## What the CLI skips in Markdown and MDX

When checking documentation with the [CLI](/integrations/cli), `glosslint check` strips non-prose syntax before reading headings, table cells, paragraphs, and list items:

- In Markdown, it skips frontmatter, fenced and inline code, HTML comments and tags, link targets, and reference definitions.
- In MDX, it also skips `import` and `export` lines.
- When given a folder, it reads `.md`, `.mdx`, and `.txt` files and skips `node_modules` and `.git`.
- When the CLI loads a glossary file directly (`.agents/glossary.md` by default, or `--glossary <path>`), it never checks that glossary file, even if you name it on the command line or check its parent folder.

> [!TIP]
> If your project loads `.agents/glossary.md` inside `glosslint.config.ts` via `fromGlossary()`, pass your docs folder (such as `glosslint check docs`) so `check` does not scan `.agents/glossary.md`.
