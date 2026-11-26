---
title: Introduction to glosslint
description: Check your product vocabulary from .agents/glossary.md across code, translations, and Markdown docs.
navigation.order: 1
navigation.title: Introduction
icon: i-lucide-book-open
---

glosslint checks your product vocabulary across code, translations, and Markdown docs from one file, [`.agents/glossary.md`](/guide/glossary).

> [!IMPORTANT]
> `.agents/glossary.md` is the source of truth. People, coding agents, and every runner read it directly. Built-in [presets](/guide/presets) and [`defineCorpus`](/guide/corpus) are optional layers on top.

## One glossary file

```md [.agents/glossary.md]
# Glossary

Extends: tech, inclusive

## Dock
What: A powered stand where one bike is locked.
Avoid:
- rack: Racks are unpowered.

## eBike

## Day Pass (DP)
Case: context
```

Four runners read `.agents/glossary.md` by default:

- [ESLint](/integrations/eslint) checks JS, TS, Vue templates, YAML locales, comments, and identifiers.
- [Oxlint](/integrations/oxlint) checks JS, TS, Vue `<script>` blocks, comments, and identifiers.
- [x18n](/integrations/x18n) checks source-locale messages and exports the glossary with `toX18nGlossary`.
- [CLI](/integrations/cli) checks Markdown, MDX, and text files, repairs `.agents/glossary.md` with `doctor`, tests examples, and explains words.

## Three finding codes

| Code | What it reports | Fix |
| --- | --- | --- |
| `GLOSSLINT_TERM` | Wrong word splits or hyphens, such as `e-bike` for `eBike`, or split identifiers | `autofix`, or `rename` on identifiers |
| `GLOSSLINT_AVOID` | Avoid words, such as `rack` instead of `Dock` | `suggestion` with reason and meaning |
| `GLOSSLINT_CASE` | Wrong capitals on `exact`, `context`, or abbreviated terms | `autofix`, or `suggestion` when kind is guessed |

See [Findings](/reference/findings) for the JSON shape. Examples in this guide come from [`examples/basic`](https://github.com/onmax/glosslint/blob/main/examples/basic).

## Next steps

::card-group
:::card{title="Installation" icon="i-lucide-download" to="/guide/installation"}
Install glosslint and run your first check
:::

:::card{title="The glossary file" icon="i-lucide-file-text" to="/guide/glossary"}
Format rules, fields, and `doctor --fix`
:::

:::card{title="Casing rules" icon="i-lucide-case-sensitive" to="/guide/casing"}
Exact, spelling, and context casing
:::

:::card{title="Coding agents" icon="i-lucide-bot" to="/guide/agents"}
Link `.agents/glossary.md` from `AGENTS.md`
:::
::
