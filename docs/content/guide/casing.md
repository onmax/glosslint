---
title: Casing rules
description: How glosslint checks capitals with exact, spelling and context terms, and how case styles set the casing of labels, headers and sentences.
navigation.order: 5
icon: i-lucide-case-sensitive
---

Product terms follow different capitalisation rules depending on what they are. Brands like `eBike` stay fixed everywhere, plain nouns like `Checkout` only care about word splits, and UI concepts like `Day Pass` change case between buttons and sentences. Set `case` and `casing` on your [corpus](/guide/corpus) or individual [terms](/guide/terms) to match how your team writes.

## Case modes

Set `case` on a term to choose how glosslint checks its capitals. If you set `casing` on a term without `case`, it becomes a `context` term.

| `case`     | What is reported                                                                                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spelling` | The default. Only splits and hyphens: "Check-out" and "check out" are spelled "Checkout". Capitals are free. The fix keeps the writer's capitals, so "check-out" becomes "checkout".                                                |
| `exact`    | One form everywhere. "E-bike" and "Ebike" are both reported, and the fix is always "eBike".                                                                                                                                         |
| `context`  | Title Case in labels and lowercase in sentences, capitalised at the start of a sentence. A button "Buy a day pass" becomes "Buy a Day Pass", and the sentence "Buy a Day Pass at the kiosk." becomes "Buy a day pass at the kiosk." |

## How context decides the kind of text

To check a `context` term, glosslint needs to know whether a string is a label, a table header, or a sentence. It guesses from the key, attribute, or element name, and from the text itself.

### Names, limits, and elements

- **Headers.** A string is a header when its name holds `header`, `column`, `col`, or `th`, as AG Grid's `headerName` does.
- **Labels.** A string is a label when its name holds a word such as `label`, `title`, `button`, `tab`, or `heading`, or ends in `name`.
- **Length and stop limit.** Both headers and labels need at most seven words and no closing period.
- **Sentences.** A string is a sentence when its name holds a word such as `description`, `tooltip`, `text`, `message`, `hint`, or `help`, or when it ends in `.`, `!`, or `?`.
- **Everything else.** In anything else, comments included, `context` terms get no casing check.
- **Vue templates.** Text takes its kind from its element: a `<template #header>` slot is a header, and `<h2>` is a label.

### Shape fallback and fix kind

Template text and YAML values that their name does not place are classified by their shape:

- At four words or fewer with no closing stop, they count as labels, unless they open like a sentence ("There is", "This", "Are you").
- Longer strings count as labels when they are already in Title Case, and as sentences otherwise.

Because only the text's shape placed those strings, a `context` fix there is offered as a suggestion rather than an autofix.

### Markdown files

In Markdown checked by the [CLI](/integrations/cli), headings are labels, a table's first row is headers, and paragraphs and list items are sentences.

### Overriding with kindOf

The [ESLint](/integrations/eslint) config and the [x18n](/integrations/x18n) plugin both take a `kindOf` option that decides first. It receives `{ text, name, file, shown }`, where `name` is the key, attribute, or element and `shown` says the text is shown as it is. Return `"label"`, `"header"`, `"sentence"`, or `undefined` to leave the string to glosslint. Because your callback's answer counts as certain, its fixes are autofixes:

```ts
kindOf: ({ name, file }) => (file?.includes("/charts/") && name === "text" ? "label" : undefined),
```

> [!NOTE]
> The name words, sentence openers, and Title Case rules are English, so `context` expects English source text.

## Case styles

`casing` sets how `context` terms are written in labels, headers, and sentences. Set it on the corpus for every `context` term, and on a term for that term alone.

| Style        | Day Pass is written                                                             |
| ------------ | ------------------------------------------------------------------------------- |
| `title`      | `Day Pass`. The default in labels and headers.                                  |
| `sentence`   | `day pass`, or `Day pass` at the start of a sentence. The default in sentences. |
| `lower`      | `day pass`                                                                      |
| `upper`      | `DAY PASS`                                                                      |
| `as-written` | As the term is written in the corpus.                                           |

A header takes the label style unless `casing.header` sets its own. Words with an inner capital, such as `eBike`, keep it in every style except `upper`.

### Whole-label casing

By default only the term itself is checked, so the label `"Day pass price"` becomes `"Day Pass price"`. With `wholeLabel: true` on the corpus, a label or header that holds a `context` term follows the term's style as a whole when that style is `title` or `upper`: `"Day pass price"` becomes `"Day Pass Price"`, in one fix that also holds the term's own fix.

When checking a whole label in `title` style:

- Small words such as `"a"` and `"of"` stay lowercase unless they start the label or follow a dash or colon.
- Text in parentheses keeps its case.

### Configuring styles per kind

```ts [glosslint.config.ts]
export default defineCorpus({
  casing: { header: "upper" },
  terms: [
    { term: "Day Pass", abbr: ["DP"], case: "context" },
    // "Ride history" in labels, "ride history" in sentences, "RIDE HISTORY" in headers.
    { term: "Ride history", casing: { label: "as-written" } },
  ],
});
```

With this corpus, the AG Grid column `{ headerName: "Day pass" }` is reported with the fix `DAY PASS`, and a button `"Buy a day pass"` still becomes `"Buy a Day Pass"`. In an `upper` header any term written all in capitals passes, abbreviations and `exact` terms too, so `DP` and `EBIKE` are not reported there.

### Lowercase abbreviations

An abbreviation written all in lowercase is not reported, so `"dp"` in prose passes while `"Dp"` is reported.
