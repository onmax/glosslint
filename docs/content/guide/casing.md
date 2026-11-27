---
title: Casing rules
description: Pick exact, spelling, or context casing per term, see how glosslint tells labels from sentences, and set case styles per kind of text.
navigation.order: 5
icon: i-lucide-case-sensitive
---

Use the default `spelling` mode for most terms, `exact` for names that keep one form, and `context` when capitals change between labels and sentences. Set `Case:` per term in [`.agents/glossary.md`](/guide/glossary), and `Casing:` to style `context` terms in labels, headers, and sentences, at the top for the whole glossary or under one term. `wholeLabel` lives in [`defineCorpus`](/guide/corpus).

## Case modes

| Mode | Pick this when | Example |
| --- | --- | --- |
| `spelling` | Default. Only word splits and hyphens matter. Capitals stay as written. | `"Check-out"` → `"Checkout"`, `"check-out"` → `"checkout"` |
| `exact` | One form must appear everywhere. | `"E-bike"` and `"Ebike"` → `"eBike"` |
| `context` | Capitals depend on where the text is: Title Case in labels, lowercase in sentences. | `"Buy a day pass"` → `"Buy a Day Pass"` on a button; `"Buy a day pass at the kiosk."` in a sentence |

```md [.agents/glossary.md]
# Glossary

## Checkout
Case: spelling

## eBike
Case: exact

## Day Pass (DP)
Case: context
```

An `exact` name written as one word, like `NuxtApp`, doesn't match the same words with spaces between them: "a Nuxt app" passes, while "Nuxt-app" is reported. A one-letter word still counts as part of the name, so "E Bike" → "eBike". To report a spaced form too, list it under the term's `Avoid:`, as the `tech` preset does with `web assembly` for `WebAssembly`.

Omit `Case:` when you want `spelling`. In `.agents/glossary.md`, names with a capital after the first letter (`eBike`, `SOS`) pick `exact` without a `Case:` line. A term's `Casing:` without `Case:` makes it `context`, as `casing` without `case` does in `defineCorpus`. glosslint always checks abbreviations like `DP` as `exact`, except all-lowercase forms pass: `"dp"` passes, `"Dp"` is reported.

## How context picks text kind

- **Headers.** Names containing `header`, `column`, `col`, or `th` (like AG Grid's `headerName`), max 7 words, no closing `.`, `!`, or `?`.
- **Labels.** Names such as `label`, `title`, `button`, `tab`, `heading`, or ending in `name`, max 7 words, no closing `.`, `!`, or `?`.
- **Sentences.** Names such as `description`, `tooltip`, `text`, `message`, `hint`, or `help`, or ending in `.`, `!`, or `?`. A name that ends in one of these words is a sentence even when an earlier word places it, so `headerTooltip` is a sentence.
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

## Per-term styles

A term's own `Casing:` wins over the glossary's for that term. It takes the same `<kind> <style>` pairs:

```md [.agents/glossary.md]
# Glossary

Casing: header upper

## Ride history
Casing: label as-written
```

"Ride history" stays as written in labels, takes lowercase in sentences, and "RIDE HISTORY" in headers, from the glossary's `header upper`. In `defineCorpus`, the same term is `{ term: "Ride history", casing: { label: "as-written" } }`.

## `wholeLabel`

`wholeLabel` has no glossary field. Set it in a [`defineCorpus`](/guide/corpus) corpus:

```ts
import { defineCorpus, fromGlossary } from "glosslint";

const corpus = defineCorpus({ extends: [fromGlossary()], wholeLabel: true });
```

By default only the term is checked (`"Day pass price"` becomes `"Day Pass price"`). With `wholeLabel: true`, every word of a `title` or `upper` label or header holding a `context` term is checked in one fix (`"Day Pass Price"`). In `title` style, small words like `"a"` and `"of"` stay lowercase unless first or after a dash or colon, and text in parentheses keeps its case.
