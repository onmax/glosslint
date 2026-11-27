---
title: What glosslint doesn't check
description: Code spans, AST positions, and Markdown syntax that glosslint ignores by default.
navigation.order: 6
icon: i-lucide-eye-off
---

glosslint blanks code-like spans before matching so only user-facing words are checked. To ignore a real phrase, add it to `Allow:` in [`.agents/glossary.md`](/guide/glossary) or `allow` in [`defineCorpus`](/guide/corpus).

## Everywhere

Blanked before matching in ESLint, Oxlint, x18n, and the CLI:

- Placeholders like `{name}` and `{{ count }}`, vue-i18n `@:key` links, and ICU syntax. Words inside ICU branches are still checked.
- URLs, email addresses, file paths, and text in backticks.
- Scoped packages like `@nuxt/kit` and repo refs like `nuxt/nuxt#18395`.
- `camelCase`, `snake_case`, and slugs with three or more parts or touching `/`, `#`, `@`, or `=`.

Exact terms and abbreviations like `eBike` stay checked, and possessive `'s` never forms a word. Lowercase words next to a slash like `nuxt/modules` skip casing checks, while spelling and avoid checks still run.

## In ESLint and Oxlint

`glosslint/term` and `glosslint/avoid` skip strings that belong to code:

- Imports, exports, object or class keys without spaces, member names, literal types, comparisons, `switch` cases, directives, enum names, and tagged templates.
- The first argument of `t`, `$t`, `te`, `tm`, and anything in `ignoreCallees`.
- Non-text Vue attributes such as `class`, `id`, `href`, `data-*`, and id-holding `aria-*`.
- YAML and JSON keys. Only string values are checked.
- Spaceless strings shaped like code, including lowercase keys, `camelCase`, paths, and dotted keys like `alarm.activeAlarms`.
- Strings and templates whose every line reads as JS source, such as a module a template writes to disk.

`glosslint/comment` skips directives like `eslint-disable` and `@ts-expect-error`, and `glosslint/identifier` skips shorthand destructuring like `const { daypass } = response`. Strings whose escapes a fix would break, and YAML block scalars, still report findings without an autofix. See [ESLint](/integrations/eslint) and [Oxlint](/integrations/oxlint) for rule options and `ignoreCallees`.

## In Markdown and MDX

[The CLI](/integrations/cli) skips:

- Frontmatter, fenced and inline code, HTML comments and tags, link targets, and reference definitions.
- `import` and `export` lines in `.mdx`.
- Comark markup like `::note`, `#title` slots, YAML props blocks, and styling props. Text inside components, slots, and text props like `title` or `label` is still checked.
- `node_modules`, `.git`, and the glossary file loaded directly.

To skip one line, such as a heading you keep for its anchor, put `<!-- glosslint-ignore -->` on the line above it, or at the end of the line itself. A reason can follow: `<!-- glosslint-ignore: keeps the #pre-rendering anchor -->`.

```md
<!-- glosslint-ignore: keeps the #pre-rendering anchor -->
## Pre-rendering
```
