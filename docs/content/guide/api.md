---
title: JavaScript API
description: "Reference for glosslint's JavaScript API: every entry point, including the Oxlint plugin and glossary readers, with functions and types."
navigation.order: 12
navigation.group: Reference
icon: i-lucide-braces
---

glosslint ships six JavaScript package entry points plus a CLI binary. Use this reference when you load or lint a glossary file from code, call the matcher or formatters directly, or wire up [ESLint](/integrations/eslint), [Oxlint](/integrations/oxlint), and [x18n](/integrations/x18n).

## glosslint

The main entry point exports glossary file readers, `defineCorpus`, the matcher, string kind classification, finding formatters, corpus utilities, `GlosslintConfigError`, `CONFIG_ERRORS`, and all core TypeScript types.

### fromGlossary

```ts
function fromGlossary(path?: string | URL): Corpus
```

Reads a glossary Markdown file synchronously and returns a validated flat `Corpus`. Defaults to `".agents/glossary.md"`; a string resolves from `process.cwd()`, and a `URL` resolves as a file URL. Throws `GlosslintConfigError` with `GLOSSLINT_C009` when the file is missing, or with the first `GLOSSLINT_G004` to `GLOSSLINT_G008` problem when the file cannot be loaded. A file with only fixable problems (`G001` to `G003`) loads as its fixed form would. See [The glossary file](/glossary).

### readGlossary

```ts
function readGlossary(text: string): {
  problems: GlossaryProblem[];
  corpus?: Corpus;
  fixed?: string;
}
```

Parses glossary Markdown text without touching disk. Returns every `GlossaryProblem` sorted by line number (including `GLOSSLINT_G009` for failing examples). `corpus` is defined when no `G004` to `G008` problem exists; `fixed` holds the canonical Markdown text when the file can be rewritten without dropping text and differs from `text`.

### defineCorpus

```ts
function defineCorpus(input: CorpusInput): Corpus
```

Validates every field in `input`, merges corpora listed in `extends` from left to right before applying `input.terms`, and returns a frozen flat `Corpus`. Throws `GlosslintConfigError` on an invalid corpus or term. See [defineCorpus](/guide/corpus) for merge order and field details.

### createMatcher

```ts
function createMatcher(corpus: Corpus, options?: MatcherOptions): Matcher
```

Compiles `corpus` into a reusable `Matcher` with a readonly `corpus` property and a `check(text, kind?)` method. Pass `{ identifierAvoid: true }` in `options` to report avoid words when checking text as kind `"identifier"`.

### check

```ts
function check(matcher: Matcher, text: string, kind?: TextKind): Finding[]
```

Calls `matcher.check(text, kind)` and returns every finding in `text`, read as `kind`, which defaults to `"unknown"`. See [Findings format](/guide/findings) for the returned `Finding` shape.

### kindOf

```ts
function kindOf(site: KindSite): TextKind
```

Returns glosslint's default `TextKind` for a string from its key, attribute, or element `name`, its closing punctuation, and, when `shown` is `true`, its length and capitalisation. Adapters use this function unless their custom `kindOf` option returns a kind first.

### formatFinding

```ts
function formatFinding(finding: Finding | CliFinding, options?: FormatOptions): string
```

Formats one `Finding` or `CliFinding` in the tree format, starting with the headline and followed by `why`, `fix`, `term`, and `see` branches when present. Set `options.color` to `true` for ANSI colors; color is off by default.

### formatFindings

```ts
function formatFindings(findings: (Finding | CliFinding)[], options?: FormatOptions): string
```

Formats every finding in the tree format separated by blank lines and appends a summary line. Pass `options.files` to include the file count in the summary, and `options.color` for ANSI colors.

### toJson

```ts
function toJson(findings: CliFinding[], files: number): CliReport
```

Builds the `{ findings, summary }` object printed by `glosslint check --format json`. Counts total findings, total files, and findings per `FindingCode`.

### testCorpus

```ts
function testCorpus(corpus: Corpus): CorpusTestFailure[]
```

Checks every term's `examples.good` and `examples.bad` strings using `createMatcher(corpus)` and `kindOf({ text, shown: true })`. Returns a `CorpusTestFailure` for each `good` example flagged for its term and each `bad` example not flagged for its term.

### printCorpus

```ts
function printCorpus(corpus: Corpus, format: "md" | "json"): string
```

Formats `corpus` as a Markdown glossary (`"md"`) or pretty-printed JSON containing `{ terms, allow }` (`"json"`). In Markdown, terms with more than a spelling get their own `##` section, and bare spelling-only terms appear together under `## Spelling`.

### explain

```ts
function explain(corpus: Corpus, query: string): string
```

Looks up what `corpus` says about a word or phrase, matching terms, abbreviations, locale forms, avoid words, matcher findings, or mentions, and formats each match with its description, nuance, `why`, avoid list, examples, links, and related terms. Returns `No term in the corpus matches "<query>".` when nothing matches.

### toX18nGlossary

```ts
function toX18nGlossary(corpus: Corpus): X18nGlossaryEntry[]
```

Converts each term in `corpus` into an `X18nGlossaryEntry` with `term`, `translations`, `forms`, a `note` combining `description` and `nuance`, and `doNotTranslate: true` for `exact` terms without `translations`.

### GlosslintConfigError

```ts
class GlosslintConfigError extends Error {
  readonly code: string;
  readonly why: string;
  readonly fix: string;
  readonly term?: string;
  constructor(options: { code: string; why: string; fix: string; term?: string });
}
```

Error class thrown by `defineCorpus`, `fromGlossary`, and `glosslint/eslint` on an invalid corpus, missing or broken glossary file, or conflicting ESLint options. See [Config and glossary errors](/guide/config-errors) for every error code and fix.

### CONFIG_ERRORS

```ts
const CONFIG_ERRORS: {
  readonly unknownField: "GLOSSLINT_C001";
  readonly missingTerm: "GLOSSLINT_C002";
  readonly badCase: "GLOSSLINT_C003";
  readonly avoidIsTerm: "GLOSSLINT_C004";
  readonly duplicateTerm: "GLOSSLINT_C005";
  readonly badSkip: "GLOSSLINT_C006";
  readonly badType: "GLOSSLINT_C007";
  readonly notCorpus: "GLOSSLINT_C008";
  readonly noGlossary: "GLOSSLINT_C009";
  readonly badCasing: "GLOSSLINT_C011";
  readonly glossaryAndCorpus: "GLOSSLINT_C012";
};
```

Maps corpus and loader validation error names to their stable `GlosslintConfigError` codes.

## glosslint/eslint

Provides the ESLint flat config factory and its `GlosslintEslintOptions` type. Requires the optional peer dependency `eslint` (`>=9.15.0`). See [ESLint](/integrations/eslint) for setup and rule behavior.

### glosslint (ESLint)

```ts
export default function glosslint(options?: GlosslintEslintOptions): Linter.Config[]
```

Returns a single-element array containing an ESLint flat config object named `"glosslint"` with `glosslint/term`, `glosslint/avoid`, and `glosslint/comment` set to `"error"` and `glosslint/identifier` set to `"warn"`. Uses `options.corpus` if passed, else loads `options.glossary` or `.agents/glossary.md` from `process.cwd()` once when the config is built. Passing both `glossary` and `corpus` throws `GLOSSLINT_C012`. It sets no parser, so your ESLint config supplies `typescript-eslint`, `vue-eslint-parser`, or `yaml-eslint-parser` for the files you lint.

## glosslint/oxlint

Provides the Oxlint JavaScript plugin default export and its `GlosslintOxlintPlugin` and `GlosslintOxlintSettings` types. Requires the optional peer dependency `oxlint` (`>=1.94.0`). Oxlint JS plugins are alpha in Oxlint 1.94. See [Oxlint](/integrations/oxlint).

```ts
declare const plugin: GlosslintOxlintPlugin;
export default plugin;
```

Referenced by module specifier in `.oxlintrc.json` as `"jsPlugins": ["glosslint/oxlint"]`. Exposes `{ meta: { name: "glosslint" }, rules: { term, avoid, comment, identifier } }`. Reads `.agents/glossary.md` (or `settings.glosslint.glossary`) from `context.cwd` on the first file and caches the corpus for the process.

## glosslint/x18n

Provides the x18n plugin factory and its `GlosslintX18nOptions` type. Requires the optional peer dependency `@x18n/core` (`>=0.1.14`). See [x18n](/integrations/x18n) for setup and fix behavior.

### glosslint (x18n)

```ts
export default function glosslint(options?: GlosslintX18nOptions): Plugin
```

Returns an `@x18n/core` plugin named `"glosslint"` that adds the checks `glosslint-term` (`"error"`), `glosslint-avoid` (`"warning"`), and `glosslint-case` (`"error"`) over source-locale messages and hard-coded strings. Importing this entry point also augments `@x18n/core`'s `CheckIds` interface with those three check IDs.

## glosslint/presets/tech

Exports a default `Corpus` containing 477 product and technology names generated from case-police 2.2.1 (each an `exact` term with `skip: ["lower", "upper"]`) and 7 joined spellings in `allow`. In `.agents/glossary.md`, write `Presets: tech`; in `defineCorpus`, pass it inside `extends`. See [Built-in presets](/guide/presets).

```ts
declare const corpus: Corpus;
export default corpus;
```

## glosslint/presets/inclusive

Exports a default `Corpus` containing 37 inclusive-wording terms with reasons on each avoid word, inline examples, and an empty `allow` list. In `.agents/glossary.md`, write `Presets: inclusive`; in `defineCorpus`, pass it inside `extends`. See [Built-in presets](/guide/presets).

```ts
declare const corpus: Corpus;
export default corpus;
```

## glosslint CLI binary

The package registers one executable in `package.json` `bin`: `glosslint` (`./dist/cli.mjs`). It is not listed under `package.json` `exports`, so run it from your shell with `npx glosslint` or `pnpm exec glosslint`.

It provides `glosslint [check] [...paths]` (default command), `glosslint doctor`, `glosslint test`, `glosslint print`, and `glosslint explain <query>`. See [CLI](/integrations/cli) for all flags and exit codes.

## Types

Every type below is exported from `glosslint`, except `GlosslintEslintOptions` (from `glosslint/eslint`), `GlosslintOxlintPlugin` and `GlosslintOxlintSettings` (from `glosslint/oxlint`), and `GlosslintX18nOptions` (from `glosslint/x18n`).

- `Avoid`: Object form of an avoid entry, `{ word: string; why?: string }`.
- `CaseMode`: How capitals are checked on a term: `"exact" | "spelling" | "context"`.
- `CaseStyle`: Case style for a `context` term: `"title" | "sentence" | "lower" | "upper" | "as-written"`.
- `Casing`: `Partial<Record<CasingKind, CaseStyle>>` mapping text kinds to case styles.
- `CasingKind`: Text kinds that accept a case style: `"label" | "header" | "sentence"`.
- `CliFinding`: Finding returned by the CLI, adding `file`, `line`, `column`, `fix.result`, and `TermSummary` in place of the full `Term`.
- `CliReport`: JSON structure printed by `glosslint check --format json` and returned by `toJson`, holding `{ findings, summary }`.
- `Corpus`: Validated, flat corpus returned by `fromGlossary` and `defineCorpus`, with `kind: "glosslint.corpus"`, `terms`, `allow`, optional `casing`, and optional `wholeLabel`.
- `CorpusInput`: Configuration object accepted by `defineCorpus`, with optional `extends`, `terms`, `allow`, `casing`, and `wholeLabel`.
- `CorpusTestFailure`: One failing term example from `testCorpus`, with `term`, `example`, `expected` (`"finding" | "none"`), and `findings`.
- `Finding`: One match returned by `Matcher.check`, with `code`, `start`, `end`, `text`, `message`, full `term`, and optional `why`, `fix`, and `see`.
- `FindingCode`: Union of the three finding codes: `"GLOSSLINT_TERM" | "GLOSSLINT_AVOID" | "GLOSSLINT_CASE"`.
- `Fix`: Replacement attached to a finding, `{ kind: FixKind; replace: string }`.
- `FixKind`: Action safety level of a fix: `"autofix" | "suggestion" | "rename"`.
- `FormatOptions`: Options for `formatFinding` and `formatFindings`: `{ color?: boolean; files?: number }`.
- `GlossaryProblem`: One problem returned by `readGlossary`: `{ code: string; line: number; why: string; fix: string; fixable: boolean; term?: string }`.
- `GlosslintEslintOptions`: Options for `glosslint/eslint`: `{ glossary?: string | URL; corpus?: Corpus; files?: string[]; ignoreCallees?: string[]; identifierAvoid?: boolean; kindOf?: KindOf }`.
- `GlosslintOxlintPlugin`: Oxlint plugin object `{ meta: { name: "glosslint" }; rules: Record<"term" | "avoid" | "comment" | "identifier", OxlintRule> }`.
- `GlosslintOxlintSettings`: Shape of `settings.glosslint` in `.oxlintrc.json`: `{ glossary?: string; ignoreCallees?: string[]; identifierAvoid?: boolean }`.
- `GlosslintX18nOptions`: Options for `glosslint/x18n`: `{ glossary?: string | URL; corpus?: Corpus; sourceLocale?: string; kindOf?: KindOf }`, all optional; `glossary` and `corpus` exclude each other.
- `KindOf`: Custom kind classifier `(site: KindSite) => TextKind | undefined`.
- `KindSite`: String context passed to `kindOf`: `{ text: string; name?: string; file?: string; shown?: boolean }`.
- `Link`: Reference link on a term, `{ title: string; url: string }`.
- `Matcher`: Compiled corpus returned by `createMatcher`, exposing readonly `corpus` and `check(text, kind?)`.
- `MatcherOptions`: Options for `createMatcher`: `{ identifierAvoid?: boolean }`.
- `Term`: Corpus entry with required `term` and optional `description`, `nuance`, `why`, `abbr`, `avoid`, `examples`, `links`, `case`, `casing`, `skip`, `forms`, and `translations`.
- `TermSummary`: `Pick<Term, "term" | "description" | "nuance">`, carried on each `CliFinding`.
- `TextKind`: Context of a checked string: `"label" | "header" | "sentence" | "comment" | "identifier" | "unknown"`.
- `X18nGlossaryEntry`: Entry produced by `toX18nGlossary` with `term` and optional `translations`, `forms`, `note`, and `doNotTranslate`.
