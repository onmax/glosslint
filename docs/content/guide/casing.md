---
title: Casing rules
description: Configure exact, spelling, and context casing modes, text-kind detection, kindOf, case styles, and wholeLabel.
navigation.order: 5
icon: i-lucide-case-sensitive
---

Set `Case:` on a term in [`.agents/glossary.md`](/guide/glossary) to control capital checks, and `Casing:` to set styles for labels, headers, and sentences. Per-term `casing` and `wholeLabel` live in [`defineCorpus`](/guide/corpus).

## Case modes

| Mode | What is reported |
| --- | --- |
| `spelling` | Default. Splits and hyphens only: `"Check-out"` becomes `"Checkout"`, `"check-out"` becomes `"checkout"`. Capitals stay as written. |
| `exact` | One form everywhere: `"E-bike"` and `"Ebike"` both become `"eBike"`. Inferred in `.agents/glossary.md` for names with an inner capital (`eBike`, `SOS`). |
| `context` | Title Case in labels (`"Buy a Day Pass"`), lowercase in sentences (`"Buy a day pass at the kiosk."`). Setting per-term `casing` without `case` in `defineCorpus` implies `context`. |

Lowercase abbreviations always pass: `"dp"` passes, `"Dp"` is reported.

## How context picks text kind

- **Headers.** Names containing `header`, `column`, `col`, or `th` (like AG Grid's `headerName`), max 7 words, no closing `.`, `!`, or `?`.
- **Labels.** Names such as `label`, `title`, `button`, `tab`, `heading`, or ending in `name`, max 7 words, no closing `.`, `!`, or `?`.
- **Sentences.** Names such as `description`, `tooltip`, `text`, `message`, `hint`, or `help`, or ending in `.`, `!`, or `?`.
- **Vue templates (ESLint).** Element decides: `<template #header>` is a header, `<h2>` is a label.
- **Markdown (CLI).** Headings are labels, table first rows are headers, paragraphs and list items are sentences.
- **Shape fallback.** Template text and YAML values whose name doesn't place them, with 4 or fewer words and no closing stop count as labels unless they open like a sentence (`"There is"`, `"This"`, `"Are you"`). Longer strings count as labels only if already in Title Case. Shape-guessed fixes for `context` terms are suggestions, not autofixes.
- **Other strings.** Comments and unmatched strings skip `context` checks.

Name matching, sentence openers, and Title Case rules assume English source text.

### Overriding with `kindOf`

```ts
kindOf: ({ name, file }) => (file?.includes("/charts/") && name === "text" ? "label" : undefined),
```

Available in [ESLint](/integrations/eslint) and [x18n](/integrations/x18n), not [Oxlint](/integrations/oxlint). Runs first with `{ text, name, file, shown }` and returns `"label"`, `"header"`, `"sentence"`, or `undefined`. Its fixes are autofixes.

## Case styles

| Style | `Day Pass` becomes |
| --- | --- |
| `title` | `Day Pass` (default in labels and headers) |
| `sentence` | `day pass`, or `Day pass` at sentence start (default in sentences) |
| `lower` | `day pass` |
| `upper` | `DAY PASS` |
| `as-written` | As written in the corpus |

Headers inherit the label style unless set. Words with an inner capital like `eBike` keep it in every style except `upper`.

```md [.agents/glossary.md]
# Glossary

Casing: header upper

## Day Pass (DP)
Case: context
```

`{ headerName: "Day pass" }` fixes to `DAY PASS`, while `"Buy a day pass"` on a button becomes `"Buy a Day Pass"`. In `upper` headers, all-caps forms pass for `exact` terms and abbreviations too (`EBIKE`, `DP`).

## Per-term styles and `wholeLabel`

```ts [glosslint.config.ts]
import { defineCorpus, fromGlossary } from "glosslint";

export default defineCorpus({
  extends: [fromGlossary()],
  terms: [
    // "Ride history" in labels, "ride history" in sentences, "RIDE HISTORY" in headers
    { term: "Ride history", casing: { label: "as-written" } },
  ],
  wholeLabel: true,
});
```

By default only the term is checked (`"Day pass price"` becomes `"Day Pass price"`). With `wholeLabel: true`, every word of a `title` or `upper` label or header holding a `context` term is checked in one fix (`"Day Pass Price"`). In `title` style, small words like `"a"` and `"of"` stay lowercase unless first or after a dash or colon, and text in parentheses keeps its case.
