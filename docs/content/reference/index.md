---
title: Reference overview
description: Reference for glosslint findings, config and glossary error codes, and every JavaScript entry point, function signature, and exported type.
navigation.order: 1
navigation.title: Overview
icon: i-lucide-library
---

Use this section when you parse glosslint output in CI or editor tooling, troubleshoot an error code from `.agents/glossary.md` or `glosslint.config.ts`, or call glosslint directly from JavaScript and TypeScript.

## Reference pages

- [Findings format](/reference/findings): the JSON report printed by `glosslint check --format json`, the tree output format, every finding field, the three finding codes (`GLOSSLINT_TERM`, `GLOSSLINT_AVOID`, `GLOSSLINT_CASE`), and the `fix.kind` rules (`autofix`, `suggestion`, `rename`).
- [Config and glossary errors](/reference/config-errors): `GlosslintConfigError`, exit code `2`, corpus and config codes (`GLOSSLINT_C001` to `GLOSSLINT_C012`), and glossary file problem codes (`GLOSSLINT_G001` to `GLOSSLINT_G009`) reported by `readGlossary`, `fromGlossary`, and `glosslint doctor`.
- [JavaScript API](/reference/api): all six package entry points, every exported function signature, the `glosslint` CLI binary, and every TypeScript type.

## Package entry points

| Entry point | What it exports |
| --- | --- |
| `glosslint` | `fromGlossary`, `readGlossary`, `defineCorpus`, `createMatcher`, `check`, `kindOf`, formatters, corpus utilities, `GlosslintConfigError`, `CONFIG_ERRORS`, and core types. |
| `glosslint/eslint` | ESLint flat config factory `glosslint(options?)` and `GlosslintEslintOptions`. |
| `glosslint/oxlint` | Oxlint JS plugin default export (`GlosslintOxlintPlugin`) and `GlosslintOxlintSettings`. |
| `glosslint/x18n` | `@x18n/core` plugin factory `glosslint(options)` and `GlosslintX18nOptions`. |
| `glosslint/presets/tech` | Built-in corpus of 477 technology names generated from case-police 2.2.1. |
| `glosslint/presets/inclusive` | Built-in corpus of 37 inclusive-wording terms with reasons and examples. |
