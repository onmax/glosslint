---
title: Built-in presets
description: Use the tech and inclusive presets in glosslint to check 477 technology names and 37 inclusive terms, then override or turn off entries.
navigation.order: 8
icon: i-lucide-layers
---

glosslint ships two built-in corpora that you can merge into your project before adding your own product terms. Use `glosslint/presets/tech` to enforce standard casing on product and technology names, and `glosslint/presets/inclusive` to flag non-inclusive wording with reasons and replacements.

## Tech preset

`glosslint/presets/tech` contains 477 product and technology names, such as `GitHub`, `iOS`, `Wi-Fi` and `Apple Pay`. Every entry is an `exact` term with `skip: ["lower", "upper"]`. Words written all lowercase or all uppercase pass, so `github` and `GITHUB` pass while `Github` is reported.

[`scripts/tech.ts`](https://github.com/onmax/glosslint/blob/main/scripts/tech.ts) generates the preset from the dictionaries of [case-police](https://github.com/antfu/case-police) 2.2.1 by Anthony Fu, under the MIT License. The third-party license notice lives in [`NOTICE`](https://github.com/onmax/glosslint/blob/main/NOTICE).

case-police lists 488 entries across five dictionaries, which collapse into 477 distinct keys. Seven joined spellings share a key with a spaced form in the preset: `AntDesign`, `AntDesignVue`, `CompositionAPI`, `GraphRAG`, `NaiveUI`, `TailwindCSS` and `WindiCSS`. The preset keeps the spaced form as the term and puts those 7 joined spellings in its `allow` list, so both forms pass. For a full comparison with case-police, see [Coming from case-police](/guide/case-police).

## Inclusive preset

`glosslint/presets/inclusive` contains 37 terms for inclusive wording, such as `allowlist` for "whitelist", `staffed` for "manned", and `placeholder` for "dummy data". Every term has a description, avoid words with reasons, and good and bad examples that `glosslint test` checks.

Words that also have a plain technical sense, such as `master` for a git branch, never appear on their own. The preset lists them only inside phrases that pin the meaning, such as `"master server"`, `"master node"`, `"master database"`, `"master process"` and `"dummy data"`.

The inclusive preset shares no keys with the tech preset, so you can extend both together without collisions.

## Extending presets

Import the presets you want and list them in `extends` inside `glosslint.config.ts`:

```ts [glosslint.config.ts]
import { defineCorpus } from "glosslint";
import inclusive from "glosslint/presets/inclusive";
import tech from "glosslint/presets/tech";

export default defineCorpus({
  extends: [tech, inclusive],
  terms: [
    {
      term: "Dock",
      description: "A powered stand where one bike is locked.",
      nuance: "A station is a group of docks.",
      avoid: [{ word: "rack", why: "Racks are unpowered." }, "bay"],
      examples: { good: ["Return the bike to any dock"], bad: ["Return the bike to any rack"] },
      links: [{ title: "Docks", url: "https://example.com/docs/docks" }],
    },
    { term: "Checkout" },
    { term: "eBike", case: "exact" },
    { term: "Day Pass", abbr: ["DP"], case: "context" },
  ],
  allow: ["check out our", "roof rack"],
});
```

You can also combine presets with a [Glossary table](/guide/glossary-table) in the same `extends` array.

## Replacing a preset term

glosslint merges terms by key. A key is the term's words joined and lowercased, letters and digits only. `"Re-charge point"` and `"recharge point"` share a key.

1. glosslint reads `extends` from left to right. A later corpus replaces an earlier term with the same key. If a glossary table sits after `tech` and `inclusive` in `extends`, a table row replaces any preset term with the same words.
2. Your corpus's own `terms` replace every term from `extends` with the same key. Listing two of your own terms with the same key throws `GLOSSLINT_C005`.
3. A term is replaced whole. Fields are not merged.
4. `allow` lists add up, starting with each `extends` entry and ending with your own.

Because replacement is whole, include every field you want on your override. For example, replacing `GitHub` without `skip` turns on checks for lowercase `github` and uppercase `GITHUB` too:

```ts [glosslint.config.ts]
import { defineCorpus } from "glosslint";
import tech from "glosslint/presets/tech";

export default defineCorpus({
  extends: [tech],
  terms: [{ term: "GitHub", case: "exact" }],
});
```

See [The corpus](/guide/corpus) for every corpus field and merge detail.

## Switching a preset term off

To turn off a preset term without replacing it, add its spellings to `allow`. glosslint drops any finding that sits inside an allowed phrase.

Entries in `allow` match in any case, match across spaces, hyphens and underscores, and match plurals ending in `s` or `es`. To stop flagging an avoid word from the inclusive preset, add it to `allow`, such as `"whitelist"`. To turn off a multi-word tech term, allow both the spaced form and the joined form, such as `"Apple Pay"` and `"ApplePay"`, because spaces in `allow` match separators rather than joined words:

```ts [glosslint.config.ts]
import { defineCorpus } from "glosslint";
import inclusive from "glosslint/presets/inclusive";
import tech from "glosslint/presets/tech";

export default defineCorpus({
  extends: [tech, inclusive],
  allow: ["Apple Pay", "ApplePay", "whitelist"],
});
```
