---
title: Coming from case-police
description: Parity between glosslint's tech preset and case-police 2.2.1 across 488 entries, the 7 joined-spelling differences, and moving over.
navigation.order: 8
icon: i-lucide-arrow-right-left
---

glosslint builds its `tech` preset from [case-police](https://github.com/antfu/case-police) 2.2.1 (MIT License, see [`NOTICE`](https://github.com/onmax/glosslint/blob/main/NOTICE)) so you can keep the same casing rules alongside your own glossary.

## Coverage and parity

[`scripts/tech.ts`](https://github.com/onmax/glosslint/blob/main/scripts/tech.ts) reads all 5 case-police dictionaries (488 entries: 309 `softwares`, 118 `abbreviates`, 30 `brands`, 18 `general`, 13 `products`) and outputs 477 keys plus 7 allowed joined spellings, each with `case: "exact"` and `skip: ["lower", "upper"]`.

[`test/tech-parity.test.ts`](https://github.com/onmax/glosslint/blob/main/test/tech-parity.test.ts) tests all 488 entries in 4 forms (Capitalised, lower, UPPER, canonical: 1,952 cases). 1,945 match case-police verbatim. The 7 differences are joined spellings placed in `allow` alongside their spaced terms (`Antdesign` stays as written, while `Ant design` still becomes `Ant Design`):

| Term in `tech` | Joined spelling in `allow` |
| --- | --- |
| `Ant Design` | `AntDesign` |
| `Ant Design Vue` | `AntDesignVue` |
| `Composition API` | `CompositionAPI` |
| `Graph RAG` | `GraphRAG` |
| `Naive UI` | `NaiveUI` |
| `Tailwind CSS` | `TailwindCSS` |
| `Windi CSS` | `WindiCSS` |

## What glosslint adds

- Your own product terms and [built-in presets](/guide/presets) in [`.agents/glossary.md`](/guide/glossary).
- Avoid words with reasons, descriptions, and links printed on every finding.
- [Context casing](/guide/casing) that adapts between labels, headers, and sentences.
- Checks across [ESLint](/integrations/eslint), [Oxlint](/integrations/oxlint), [x18n](/integrations/x18n), and [the CLI](/integrations/cli).

## Moving over

```sh pm
pnpm add -D glosslint
```

```md [.agents/glossary.md]
# Glossary

Extends: tech
```

```sh
npx glosslint check  # report findings in Markdown and text files (read-only)
```

For code autofixes, add `...glosslint()` in [ESLint](/integrations/eslint) (`eslint --fix`) or `"glosslint/oxlint"` in [Oxlint](/integrations/oxlint) (`oxlint --fix`).
