# Spec

One Markdown glossary, `.agents/glossary.md`, that people and coding agents read and that ESLint, Oxlint, x18n and a CLI enforce.

## Problem

A product's words (which term to use, what it means, which words to avoid) live in people's heads or in a wiki page nothing checks. Coding agents write a lot of user-facing text and have no file to read the vocabulary from, and no lint tells them they picked the wrong word.

glosslint used to keep the corpus in `glosslint.config.ts` and could also read a Markdown table with `fromGlossaryTable`. A table works for short cells. A term with a meaning, usage notes, several avoid words with reasons, examples and links makes rows hundreds of characters wide that nobody edits by hand, and the TypeScript config is not a file an agent is told to read.

Prior art:

- [case-police](https://github.com/antfu/case-police) fixes the casing of known names from a dictionary. It has no meanings, no avoid words and no project glossary. The `tech` preset comes from its data.
- [Vale](https://vale.sh/docs) keeps substitution rules in YAML styles and lints prose files and code comments. It does not read string literals, Vue templates or locale files, and its rule files are not a glossary a person reads.
- [textlint-rule-terminology](https://github.com/sapegin/textlint-rule-terminology) checks term spelling in Markdown and text from a list of terms and patterns, without meanings.

## Scope

The first user is a Nuxt 4 app of about 390 Vue files with an ESLint flat config (`@nuxt/eslint` with `@antfu/eslint-config`), vue-i18n YAML locales (one source locale, two translated) and agents that read `AGENTS.md` and `.agents/`. What that app needs is in: the glossary file as the one source, ESLint on Vue templates, TypeScript and the source YAML locale, and a CLI that checks Markdown, explains a word and repairs the glossary. Oxlint covers JavaScript and TypeScript only. The x18n plugin reads the glossary file the way the ESLint config does, and `defineCorpus` keeps its API. `fromGlossaryTable` is removed with no alias and no migration. The README and the docs lead with the glossary file and show `defineCorpus` second.

## The glossary file

<!-- prettier-ignore -->
```md
# Glossary

The words the rider app and the help center use.

Presets: tech, inclusive
Allow: check out our, roof rack
Casing: label sentence, header title

## Dock
What: A powered stand where one bike is locked.
How: A station is a group of docks. Say dock for one stand.
Why: Riders read "dock" on the stand itself.
Avoid:
- rack: Racks are unpowered.
- bay
Good:
- Return the bike to any dock
Bad:
- Return the bike to any rack
Links:
- [Docks](https://example.com/docs/docks)

## Day Pass (DP)
Case: context
```

- The H1 is `Glossary`. Each H2 is one term. Prose between the H1 and the first field or H2 is an introduction and is not read.
- A field starts at a line that begins with its name and a colon, in any case, even inside a paragraph, and a term's heading and its fields go on consecutive lines, as do the corpus fields. Names are fixed, in English, written as above. An unknown name is an error, never prose, so a typo is not silently read as text. A paragraph under a text field that does not start with a field continues it.
- Markdown previews such as GitHub's join consecutive field lines into one paragraph, so the file reads best as source, which is how people and agents read it. A Markdown formatter such as Prettier indents a field that follows a list into the list's last item, so add `.agents/glossary.md` to its ignore file.
- Corpus fields, before the first H2: `Presets` (the presets `tech` and `inclusive`, by name, merged in order before the file's terms), `Allow` (`allow`), `Casing` (`casing`, as `kind style` pairs).
- Term fields, in canonical order: `What` (`description`), `How` (`nuance`), `Why` (`why`, new), `Avoid` (`avoid`), `Good` and `Bad` (`examples`), `Links` (`links`), `Case` (`case`: `exact`, `spelling` or `context`), `Casing` (`casing`, the term's own `kind style` pairs; without `Case` it makes the term `context`), `Translations` (`translations`), `Forms` (`forms`).
- `What`, `How` and `Why` are text, kept as written; line and paragraph breaks read as one space. `Avoid`, `Good`, `Bad` and `Links` are `-` lists. `Presets`, `Allow`, `Casing`, `Avoid` and `Translations` also take a comma list on the field's line. `Translations` and `Forms` items are `locale: value`, split at the first colon; a `Forms` value is a comma list.
- An avoid item is `word` or `word: reason`, split at the first colon followed by a space. Backticks around the word are dropped, which is how a word holding a comma or a colon is written. A link is `[title](url)` with an http or https URL.
- `## Day Pass (DP, D)` gives the term and its abbreviations. Parentheses in a heading hold only abbreviations: single words that are one capital or have a capital after their first letter.
- A name with a capital right after a letter (`eBike`, `SOS`) is `exact` unless `Case` or a term-level `Casing` says otherwise. Nothing is inferred from the text of `How`.
- `skip` and `wholeLabel` have no field. A project that needs them writes `defineCorpus({ extends: [fromGlossary()], … })` and passes the corpus to the runner that needs it: `glosslint({ corpus })` in ESLint or x18n, `--corpus <module>` in the CLI. No file is discovered by name besides `.agents/glossary.md`.

## Behaviour

Each scenario names the test file that proves it. Fixtures are in `test/fixtures/glossary/`. A scenario is done when its test passes in `pnpm test run`, or in `pnpm test:dist` for `test/dist.test.ts`.

1. **Read the file.** The file above reads into the same corpus as the `defineCorpus` call with those values, presets included. `test/glossary.test.ts`
2. **Inference.** `eBike` and `SOS` are `exact`, `kiosk` is not, `Case: spelling` on `eBike` wins, and `(DP, D)` becomes `abbr`. `test/glossary.test.ts`
3. **Loaders throw on what they cannot read.** `fromGlossary` throws a `GlosslintConfigError` with the code, `path:line` and the fix for `G004` to `G008`. A file with only fixable problems (`G001` to `G003`) loads as its fixed form would. `test/glossary.test.ts`
4. **No glossary.** A missing file throws `GLOSSLINT_C009`, naming the path it looked for. `test/glossary.test.ts`
5. **`Why` in findings.** An avoid finding prints the avoid word's own reason, else the term's `why`, else its `nuance`. `explain` prints `why`. `test/core/matcher.test.ts`, `test/tools.test.ts`
6. **CLI loading.** `check`, `test`, `print` and `explain` take the corpus from the `--corpus` module's default export, else the `--glossary` file, else `.agents/glossary.md`. A `glosslint.config.*` file is no longer discovered; it loads only when named with `--corpus`. Both flags together exit 2 with `GLOSSLINT_USAGE`. A missing file exits 2 with `GLOSSLINT_C009`. `test/cli/load.test.ts`
7. **`check` leaves the glossary alone.** The file loaded by `--glossary` or by default is never checked, even when named or inside a checked folder. `test/cli/check.test.ts`
8. **`doctor` reports.** On a fixture with one problem of each code it prints each with its line and fix and exits 1. A clean file exits 0. A missing file exits 2. `test/cli/doctor.test.ts`
9. **`doctor --fix` repairs.** A file with `G001` to `G003` problems is rewritten in canonical form, `doctor` then exits 0, and a second `--fix` changes no byte. Term order, introduction and text are kept. `test/cli/doctor.test.ts`
10. **`doctor --fix` never drops text.** With a `G004` or `G007` problem the file is left untouched and the exit code is 1. `test/cli/doctor.test.ts`
11. **Failing examples.** A `Good` item that is reported, or a `Bad` item that is not, is `G009` in `doctor`, checked against the corpus the file alone gives. `test/cli/doctor.test.ts`
12. **ESLint with no options.** `glosslint()` reads `.agents/glossary.md` from `process.cwd()` once, when the config is built. Findings and fixes appear in a Vue template, a TypeScript string and a YAML locale value. `test/eslint/glossary.test.ts`
13. **ESLint and x18n options.** `glossary` reads another path, `corpus` takes a corpus, and both together throw `GLOSSLINT_C012`. The x18n plugin with no options reads `.agents/glossary.md` once, when it is built. `test/eslint/glossary.test.ts`, `test/x18n.test.ts`
14. **Oxlint.** With `jsPlugins: ["glosslint/oxlint"]` and the four rules on, the `oxlint` binary reports term, avoid, comment and identifier findings in `.ts` files and in the `<script>` of a `.vue` file, `--fix` applies the autofixes and leaves the suggestions, and `settings.glosslint.glossary` changes the path. `test/oxlint.test.ts`
15. **The package.** `glosslint` exports `fromGlossary` and `readGlossary` and no `fromGlossaryTable`, `glosslint/oxlint` resolves, and the built plugin loads in `oxlint`. `test/dist.test.ts`
16. **The example.** `examples/basic` has `.agents/glossary.md` and no corpus module. Every CLI output the README and docs show, `doctor` included, is what the CLI prints there. `test/example.test.ts`

## Shape

```ts
// glosslint
fromGlossary(path?: string | URL): Corpus // ".agents/glossary.md"; a string resolves from process.cwd()
readGlossary(text: string): { problems: GlossaryProblem[], corpus?: Corpus, fixed?: string }
interface GlossaryProblem { code: string, line: number, why: string, fix: string, fixable: boolean, term?: string }
interface Term { /* the existing fields, plus */ why?: string }

// glosslint/eslint — options are optional now; `corpus` and `glossary` exclude each other
glosslint(options?: { glossary?: string | URL, corpus?: Corpus, files?, ignoreCallees?, identifierAvoid?, kindOf? }): Linter.Config[]

// glosslint/x18n — the same `glossary` and `corpus` rule
glosslint(options?: { glossary?: string | URL, corpus?: Corpus, sourceLocale?, kindOf? }): Plugin

// glosslint/oxlint — default export { meta: { name: "glosslint" }, rules: { term, avoid, comment, identifier } }
// .oxlintrc.json: { "jsPlugins": ["glosslint/oxlint"], "rules": { "glosslint/term": "error", … },
//   "settings": { "glosslint": { "glossary"?: string, "ignoreCallees"?: string[], "identifierAvoid"?: boolean } } }

// CLI
// glosslint [check] [...paths] [--glossary <path> | --corpus <module>] [--format text|json] [--ext <list>]
// glosslint doctor [--glossary <path>] [--fix]
// glosslint test | print | explain <query>   (same two flags)
```

- **`readGlossary`** (`src/glossary.ts`) is the one parser. `fromGlossary`, `doctor` and every adapter go through it. `corpus` is set when no `G004` to `G008` problem exists; `fixed` is the canonical text, set when the file can be rewritten and differs from it.
- **Problems `--fix` rewrites.** `GLOSSLINT_G001`: the H1 is missing or not `Glossary` (inserted or retitled). `G002`: a field name in another case, an alias (`Description` or `Meaning` for `What`, `Notes` or `Nuance` for `How`, `See`, `Related` or `Related links` for `Links`, `Extends` for `Presets`), or a near miss by the `nearest` rule of `src/corpus.ts`. `G003`: layout, meaning a blank line after a term's heading or between fields, `*` or `+` bullets, a bare URL under `Links` (becomes `[url](url)`), fields out of canonical order, or spacing.
- **Problems only reported.** `G004`: an unknown field, or content the format has no place for (text before a term's first field or after a list, a table, a code fence, an H3, an HTML comment among the fields or with no closing `-->`). `G005`: a term or a field written twice, or a locale listed twice in `Translations` or `Forms`. `G006`: a bad value (`Case`, `Casing`, an unknown preset, a link that is not `[title](http…)`, an empty field, a `Translations` or `Forms` item with no locale, a locale that is not a BCP 47 tag, or no value). `G007`: a term heading with no words, or with parentheses that are not abbreviations. `G008`: an avoid word that is a term of the file. `G009`: a failing example, which `doctor` reports and loaders ignore.
- **Canonical form.** `# Glossary`, the introduction as written, the corpus fields, then each term in file order with its fields in canonical order. A list stays in the form it was written, on the field's line or as `-` items. One blank line before each heading, between introduction blocks, after the introduction and between the paragraphs of a text field, and none after a `##` heading or between fields. LF line endings and one final newline.
- **`doctor`** reads only the glossary file, never a corpus module. Exit 0 with no problems, 1 with problems left, 2 when the file is missing.
- **ESLint** sets no parser: the app's config supplies typescript-eslint, vue-eslint-parser and yaml-eslint-parser. `files` picks the source locale file.
- **Oxlint** has no config hook, so the rules read the glossary on the first file, from `context.cwd`, and keep it for the process. It takes a path only: plugin entries are module specifiers and settings are JSON, so there is no `corpus` and no `kindOf`. Oxlint offers no parser services, so Vue templates are not visited, and it does not lint YAML. JS plugins are alpha in Oxlint 1.94, so `oxlint` is an optional peer and the entry may change with it.
- **Removed.** `fromGlossaryTable`, `GlossaryTableColumns`, `src/table.ts`, its test and fixture, the codes `GLOSSLINT_NO_GLOSSARY_TABLE` and `GLOSSLINT_DUPLICATE_TERM`, and the docs page about tables.
- **Unchanged.** `defineCorpus` (it accepts `why`), the matcher, `kindOf`, the `test`, `print` and `explain` commands, and the presets.

## Out of scope

Oxlint on Vue templates and YAML. Markdown through ESLint or Oxlint; the CLI checks Markdown. Checking translated locales, and per-locale glossaries. Reading or converting glossary tables, and writing a glossary file from a TypeScript corpus. An `init` command; `doctor --fix` on a file with a few terms is the start. Several glossary files or includes, and presets other than the two bundled ones. Field names in other languages or chosen by the project. An editor extension or language server. Rereading the glossary while an ESLint or Oxlint process runs. Free Markdown inside a term, such as tables, images or sub-headings.
