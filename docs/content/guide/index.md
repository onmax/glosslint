---
title: Introduction to glosslint
description: Check your product vocabulary from one glossary file across code, source-locale messages, and Markdown docs.
navigation.order: 1
navigation.title: Introduction
icon: i-lucide-book-open
---

glosslint checks your product vocabulary across code, source-locale messages, and Markdown docs from one file, [`.agents/glossary.md`](/guide/glossary). It doesn't check translated messages: [`toX18nGlossary`](/integrations/x18n) passes your terms, with any `translations` and `forms`, to x18n's glossary for translators, and `glosslint explain` also finds a term by its `forms`.

```md [.agents/glossary.md]
# Glossary

Presets: tech, inclusive

## Dock
What: A powered stand where one bike is locked.
Avoid:
- rack: Racks are unpowered.

## eBike

## Day Pass (DP)
Case: context
```

Four runners read it by default:

::card-group
:::card{title="ESLint" icon="i-simple-icons-eslint" to="/integrations/eslint"}
JS, TS, Vue, and YAML locales
:::

:::card{title="Oxlint" icon="i-simple-icons-oxc" to="/integrations/oxlint"}
JS, TS, and Vue script blocks
:::

:::card{title="x18n" icon="i-lucide-languages" to="/integrations/x18n"}
Source messages and translator glossary export
:::

:::card{title="CLI" icon="i-lucide-terminal" to="/integrations/cli"}
Markdown docs, doctor, test, and explain
:::
::

## Three finding codes

| Code | What it reports | Fix |
| --- | --- | --- |
| `GLOSSLINT_TERM` | Wrong word splits or hyphens, such as `e-bike` for `eBike`, or split identifiers | `autofix`, or `rename` on identifiers |
| `GLOSSLINT_AVOID` | Avoid words, such as `rack` instead of `Dock` | `suggestion` with reason and meaning |
| `GLOSSLINT_CASE` | Wrong capitals on `exact`, `context`, or abbreviated terms | `autofix`, or `suggestion` when kind is guessed |

See [Findings](/guide/findings) for the JSON shape. Examples in this guide come from [`examples/basic`](https://github.com/onmax/glosslint/blob/main/examples/basic).
