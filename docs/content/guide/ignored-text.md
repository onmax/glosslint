---
title: What glosslint skips
description: Spans glosslint blanks everywhere, code strings ESLint and Oxlint ignore, and Markdown syntax the CLI skips.
navigation.order: 6
icon: i-lucide-eye-off
---

glosslint blanks code-like spans before matching so only user-facing words are checked. To skip a real phrase, add it to `Allow:` in [`.agents/glossary.md`](/guide/glossary) or `allow` in [`defineCorpus`](/guide/corpus).

## Skipped everywhere

Blanked before matching in ESLint, Oxlint, x18n, and the CLI:

- `{placeholders}` and `{{ mustaches }}`
- ICU syntax, while still reading words inside ICU branches
- URLs, email addresses, and file paths
- Text in backticks
- Scoped packages such as `@nuxt/kit`, and repository refs such as `nuxt/nuxt#18395` or `nuxt/nuxt@v3`
- `camelCase` and `snake_case` tokens, and kebab slugs with three or more parts or next to `/`, `#`, `@`, or `=`

Two exceptions keep real words intact: tokens matching an `exact` term or abbreviation stay (`eBike` is still checked), and possessive `'s` never forms a word (`"the Dock's light"`). For example, `"Return your e-bike to {rack} at https://example.com/rack."` reports `"e-bike"` as `"eBike"` while skipping `{rack}` and the URL.

Words on either side of a slash stay, since `and/or` is prose as often as `nuxt/nuxt` is a repository. A term written all lowercase against a slash, as in `nuxt/modules`, gets no casing finding, but its spelling and avoid words are still checked.

## Skipped in ESLint and Oxlint

`glosslint/term` and `glosslint/avoid` skip code strings in [ESLint](/integrations/eslint) and [Oxlint](/integrations/oxlint):

- Import and export sources, object and class keys, member names, and TypeScript literal types (quoted object keys with a space are still checked)
- Comparison operands, `switch` cases, directives such as `"use strict"`, enum member names, and tagged templates
- First argument of `t`, `$t`, `te`, `tm`, and `ignoreCallees` (defaults: `endsWith`, `startsWith`, `includes`, `querySelector*`)
- Vue attributes in ESLint: `class`, `style`, `id`, `key`, `ref`, `name`, `to`, `href`, `src`, `icon`, `type`, `variant`, `color`, `size`, `slot`, `is`, `for`, id-holding `aria-*` (`aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-owns`), and all `data-*`
- YAML keys in ESLint (only string values are checked)
- Spaceless strings shaped like code: all lowercase, kebab, snake, camelCase, or paths

Strings whose escapes a fix would break, and YAML block scalars in ESLint, still report findings without a fix. `glosslint/comment` skips directives such as `eslint-disable`, `@ts-expect-error`, `prettier-ignore`, and `#region`. `glosslint/identifier` skips shorthand destructuring such as `const { daypass } = response`.

## Skipped by the CLI in Markdown and MDX

[The CLI](/integrations/cli) skips:

- Frontmatter, fenced and inline code, HTML comments and tags, link targets, and reference definitions
- `import` and `export` lines in MDX
- Comark (MDC) markup in `.md` and `.markdown` files: `::note` and closing `::` lines, `#title` slot lines, YAML props between `---` lines, standalone `:read-more{to="/docs"}` lines, and props such as `to`, `icon`, and `color`. Text inside components and slots is still checked, and so are `title`, `label`, `description`, and `name` props unless shaped like code
- `node_modules` and `.git` when given a folder (reads `.md`, `.mdx`, and `.txt`)
- The glossary file loaded directly (`.agents/glossary.md` or `--glossary <path>`)
