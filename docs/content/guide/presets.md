---
title: Built-in presets
description: Use the tech and inclusive presets in .agents/glossary.md or defineCorpus to check 477 tech names and 37 inclusive terms, then override entries.
navigation.order: 8
icon: i-lucide-layers
---

glosslint ships two built-in corpora that you can merge into your project before adding your own product terms. Use `tech` to enforce standard casing on product and technology names, and `inclusive` to flag non-inclusive wording with reasons and replacements.

## Tech preset

`tech` (`glosslint/presets/tech`) contains 477 product and technology names, such as `GitHub`, `iOS`, `Wi-Fi` and `Apple Pay`. Every entry is an `exact` term with `skip: ["lower", "upper"]`. Words written all lowercase or all uppercase pass, so `github` and `GITHUB` pass while `Github` is reported.

[`scripts/tech.ts`](https://github.com/onmax/glosslint/blob/main/scripts/tech.ts) generates the preset from the dictionaries of [case-police](https://github.com/antfu/case-police) 2.2.1 by Anthony Fu, under the MIT License. The third-party license notice lives in [`NOTICE`](https://github.com/onmax/glosslint/blob/main/NOTICE).

case-police lists 488 entries across five dictionaries, which collapse into 477 distinct keys. Seven joined spellings share a key with a spaced form in the preset: `AntDesign`, `AntDesignVue`, `CompositionAPI`, `GraphRAG`, `NaiveUI`, `TailwindCSS` and `WindiCSS`. The preset keeps the spaced form as the term and puts those 7 joined spellings in its `allow` list, so both forms pass. For a full comparison with case-police, see [Coming from case-police](/guide/case-police).

## Inclusive preset

`inclusive` (`glosslint/presets/inclusive`) contains 37 terms for inclusive wording, such as `allowlist` for "whitelist", `staffed` for "manned", and `placeholder` for "dummy data". Every term has a description, avoid words with reasons, and good and bad examples that `glosslint test` checks.

Words that also have a plain technical sense, such as `master` for a git branch, never appear on their own. The preset lists them only inside phrases that pin the meaning, such as `"master server"`, `"master node"`, `"master database"`, `"master process"` and `"dummy data"`.

The inclusive preset shares no keys with the tech preset, so you can extend both together without collisions.

## Extending presets

In [`.agents/glossary.md`](/guide/glossary), list preset names in `Extends:` above the first `##` term heading:

```md [.agents/glossary.md]
# Glossary

Extends: tech, inclusive

Allow: check out our, roof rack

## Dock

What: A powered stand where one bike is locked.

Avoid:

- rack: Racks are unpowered.
- bay

## eBike

## Day Pass (DP)

Case: context
```

In [`defineCorpus`](/guide/corpus), import the presets and pass them in `extends`:

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
      avoid: [{ word: "rack", why: "Racks are unpowered." }, "bay"],
    },
    { term: "eBike", case: "exact" },
    { term: "Day Pass", abbr: ["DP"], case: "context" },
  ],
  allow: ["check out our", "roof rack"],
});
```

## Replacing a preset term

glosslint merges terms by key. A key is the term's words joined and lowercased, letters and digits only. `"Re-charge point"` and `"recharge point"` share a key.

1. Presets listed in `Extends:` (or `extends`) are merged from left to right. A later corpus replaces an earlier term with the same key.
2. Your glossary file's own `##` sections (or `defineCorpus`'s `terms`) replace every term from `Extends` with the same key. Listing two of your own terms with the same key reports `GLOSSLINT_G005` in a glossary file or throws `GLOSSLINT_C005` in `defineCorpus`.
3. A term is replaced whole. Fields are not merged.
4. `Allow` lists add up, starting with each extended corpus and ending with your own.

Because replacement is whole, include every field you want on your override. For example, adding `## GitHub` in `.agents/glossary.md` replaces the `tech` preset's `GitHub` without `skip: ["lower", "upper"]`, which turns on checks for lowercase `github` and uppercase `GITHUB` too:

```md [.agents/glossary.md]
# Glossary

Extends: tech

## GitHub
```

See [defineCorpus](/guide/corpus#merge-order) for full merge rules when combining `fromGlossary()` with presets and TypeScript overrides.

## Switching a preset term off

To turn off a preset term without replacing it, add its spellings to `Allow:` (or `allow`). glosslint drops any finding that sits inside an allowed phrase.

Entries in `Allow:` match in any case, match across spaces, hyphens and underscores, and match plurals ending in `s` or `es`. To stop flagging an avoid word from the inclusive preset, add it to `Allow:`, such as `whitelist`. To turn off a multi-word tech term, allow both the spaced form and the joined form, such as `Apple Pay` and `ApplePay`, because spaces in `Allow:` match separators rather than joined words:

```md [.agents/glossary.md]
# Glossary

Extends: tech, inclusive

Allow: Apple Pay, ApplePay, whitelist
```
