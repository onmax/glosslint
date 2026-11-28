#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { cac } from "cac";
import { escapePath, glob, isDynamicPattern } from "tinyglobby";
import pkg from "../package.json" with { type: "json" };
import { checkFileText } from "./check-text.ts";
import { formatDoctor, formatFindings, toJson } from "./format.ts";
import { DEFAULT_GLOSSARY, GLOSSARY_PROBLEMS, readGlossary } from "./glossary.ts";
import type { GlossaryProblem } from "./glossary.ts";
import { createMatcher } from "./matcher.ts";
import {
  explain,
  explainMatches,
  printCorpus,
  testCorpus,
  toDiglotGlossary,
  toX18nGlossary,
} from "./tools.ts";
import type { CliFinding, Corpus, CorpusTestFailure, Finding } from "./types.ts";

export { checkFileText, maskMarkdown } from "./check-text.ts";

/** Where a command reads and writes, so tests can run commands without a process. */
export interface CliIo {
  /** The folder paths and the corpus module are resolved from. */
  cwd: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  /** Whether stdout is a terminal that takes colors, used when `--color` is not given. */
  color?: boolean;
}

/** Options every command takes. */
export interface CommandOptions {
  /** A module whose default export is a corpus, such as one that calls `defineCorpus`. */
  corpus?: string;
  /** The glossary file, read when there is no `corpus`. Default: `.agents/glossary.md` in `cwd`. */
  glossary?: string;
  /** Color the output. Default: `io.color`. */
  color?: boolean;
}

/** Options of `glosslint check`. */
export interface CheckOptions extends CommandOptions {
  /** `text` (default) or `json`. */
  format?: string;
  /** File extensions read in folders, comma-separated. Default: `md,mdx,txt`. */
  ext?: string;
}

/** Options of `glosslint print`. */
export interface PrintOptions extends CommandOptions {
  /** `md` (default) or `json`. */
  format?: string;
}

/** Options of `glosslint export`. */
export interface ExportOptions extends CommandOptions {
  /** A BCP 47 locale, such as `fr`: export that locale's diglot glossary, a `terms:` map, instead of the x18n glossary. */
  diglot?: string;
  /** A glossary YAML file to merge the corpus into, written in place: x18n's, or diglot's with `diglot`. Without it the YAML goes to stdout. */
  merge?: string;
  /** `full` (default): the note is the term's What and How. `short`: its What alone. Not read with `diglot`, whose note is the locale's hint. */
  note?: string;
  /** The locale whose `forms` spell the term itself, used to match entries in `merge` and, with `diglot`, in each `match`. Default: `en`. */
  sourceLocale?: string;
}

/** Options of `glosslint doctor`. */
export interface DoctorOptions {
  /** The glossary file. Default: `.agents/glossary.md` in `cwd`. */
  glossary?: string;
  /** Rewrite the file in canonical form when that drops no text. */
  fix?: boolean;
  /** `text` (default) or `json`. */
  format?: string;
  /** Color the output. Default: `io.color`. */
  color?: boolean;
}

/** One problem of the glossary, as `glosslint doctor --format json` prints it. */
export interface DoctorProblem extends GlossaryProblem {
  /** The glossary, relative to `cwd`. */
  file: string;
}

/** The JSON `glosslint doctor` prints: the problems left, and how many `--fix` fixed. */
export interface DoctorReport {
  problems: DoctorProblem[];
  summary: { file: string; problems: number; fixable: number; fixed: number };
}

/** Codes of the errors the CLI prints itself, next to the corpus's `GLOSSLINT_C00x`. */
export const CLI_ERRORS = {
  noCorpus: "GLOSSLINT_C009",
  loadModule: "GLOSSLINT_C010",
  notCorpus: "GLOSSLINT_C008",
  usage: "GLOSSLINT_USAGE",
  failed: "GLOSSLINT_ERROR",
} as const;

const DEFAULT_EXTENSIONS = ["md", "mdx", "txt"];
const MARKDOWN = new Set([".md", ".mdx", ".markdown"]);

/** An error the CLI prints as a tree and exits 2 on: a bad corpus or a bad command line. */
class CliError extends Error {
  readonly code: string;
  readonly why: string;
  readonly fix: string;
  readonly term?: string;
  readonly corpus?: string;

  constructor(options: { code: string; why: string; fix: string; term?: string; corpus?: string }) {
    super(options.why);
    this.code = options.code;
    this.why = options.why;
    this.fix = options.fix;
    if (options.term !== undefined) this.term = options.term;
    if (options.corpus !== undefined) this.corpus = options.corpus;
  }
}

interface ConfigErrorLike {
  code: string;
  why: string;
  fix: string;
  term?: string;
}

// Matched by shape: a corpus module that imports another copy of glosslint throws that copy's class.
function isConfigError(error: unknown): error is Error & ConfigErrorLike {
  return (
    error instanceof Error &&
    error.name === "GlosslintConfigError" &&
    typeof (error as Partial<ConfigErrorLike>).code === "string" &&
    typeof (error as Partial<ConfigErrorLike>).fix === "string"
  );
}

function isCorpus(value: unknown): value is Corpus {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Corpus).kind === "glosslint.corpus" &&
    Array.isArray((value as Corpus).terms) &&
    Array.isArray((value as Corpus).allow)
  );
}

const paint = (on: boolean, code: string, text: string): string =>
  on ? `\u001B[${code}m${text}\u001B[0m` : text;

const toPosix = (path: string): string => path.split(sep).join("/");

function displayPath(cwd: string, file: string): string {
  return toPosix(relative(cwd, file)) || ".";
}

/** What `loadCorpus` read: a corpus module, or a glossary file it then never checks. */
export interface LoadedCorpus {
  corpus: Corpus;
  /** The absolute path of the file read. */
  file: string;
  from: "module" | "glossary";
}

/** Finds the corpus: the `corpus` module, else the `glossary` file, else `.agents/glossary.md` in `cwd`. */
export async function loadCorpus(
  cwd: string,
  options: { corpus?: string; glossary?: string } = {},
): Promise<LoadedCorpus> {
  const { corpus, glossary } = options;
  if (corpus !== undefined && glossary !== undefined)
    throw usage(
      "--corpus and --glossary both name the corpus.",
      "Pass one of them: --glossary for a glossary file, --corpus for a module that exports a corpus.",
    );
  if (corpus !== undefined) return importCorpus(cwd, corpus);
  return loadGlossary(cwd, glossary ?? DEFAULT_GLOSSARY, glossary !== undefined);
}

/** `G004` to `G008`: the problems only a person can fix, which leave no corpus. */
function leavesNoCorpus(problem: GlossaryProblem): boolean {
  return !problem.fixable && problem.code !== GLOSSARY_PROBLEMS.failingExample;
}

/** `takesCorpus`: whether the command also takes `--corpus`, which `doctor` does not. */
function missingGlossary(
  cwd: string,
  file: string,
  given: boolean,
  takesCorpus: boolean,
): CliError {
  const shown = displayPath(cwd, file);
  const pass = takesCorpus ? "--glossary <path> or --corpus <module>" : "--glossary <path>";
  return new CliError({
    code: CLI_ERRORS.noCorpus,
    why: given ? `The glossary "${shown}" does not exist.` : `No glossary at ${shown}.`,
    fix: given
      ? "Check the path given to --glossary."
      : `Create ${shown} with \`# Glossary\` and a \`## Term\` section per term, or pass ${pass}.`,
  });
}

/** Reads a glossary file as a corpus, or throws its first problem that leaves no corpus. */
function loadGlossary(cwd: string, path: string, given: boolean): LoadedCorpus {
  const file = resolve(cwd, path);
  if (!existsSync(file)) throw missingGlossary(cwd, file, given, true);
  const { problems, corpus } = readGlossary(readFileSync(file, "utf8"));
  if (corpus) return { corpus, file, from: "glossary" };
  const blocking = problems.filter(leavesNoCorpus);
  const first = blocking[0]!;
  const doctor = given ? `glosslint doctor --glossary ${path}` : "glosslint doctor";
  const more =
    blocking.length > 1
      ? ` ${count(blocking.length - 1, "more problem")}: run \`${doctor}\` to list them.`
      : "";
  throw new CliError({
    code: first.code,
    why: `${displayPath(cwd, file)}:${first.line}: ${first.why}`,
    fix: `${first.fix}${more}`,
    ...(first.term === undefined ? {} : { term: first.term }),
  });
}

/** Imports the module given to `--corpus` and returns its default export, which must be a corpus. */
async function importCorpus(cwd: string, given: string): Promise<LoadedCorpus> {
  const file = resolve(cwd, given);
  if (!existsSync(file))
    throw new CliError({
      code: CLI_ERRORS.noCorpus,
      why: `The corpus module "${given}" does not exist.`,
      fix: "Check the path given to --corpus.",
    });
  const shown = displayPath(cwd, file);
  let loaded: { default?: unknown };
  try {
    loaded = (await import(pathToFileURL(file).href)) as { default?: unknown };
  } catch (error) {
    if (isConfigError(error)) throw Object.assign(error, { corpus: shown });
    throw new CliError({
      code: CLI_ERRORS.loadModule,
      why: `Could not load ${shown}: ${error instanceof Error ? error.message : String(error)}`,
      fix: "Fix the error in the module, then run glosslint again.",
      corpus: shown,
    });
  }
  if (!isCorpus(loaded.default))
    throw new CliError({
      code: CLI_ERRORS.notCorpus,
      why: `${shown} does not export a corpus as its default export.`,
      fix: "End the module with `export default defineCorpus({ … })`.",
      corpus: shown,
    });
  return { corpus: loaded.default, file, from: "module" };
}

function usage(why: string, fix: string): CliError {
  return new CliError({ code: CLI_ERRORS.usage, why, fix });
}

/** The files `check` reads: named files as they are, folders by extension, and glob patterns. */
export async function collectFiles(
  paths: readonly string[],
  cwd: string,
  extensions: readonly string[] = DEFAULT_EXTENSIONS,
): Promise<string[]> {
  const files = new Set<string>();
  const patterns: string[] = [];
  const ext = extensions.length === 1 ? extensions[0]! : `{${extensions.join(",")}}`;
  for (const path of paths.length > 0 ? paths : ["."]) {
    if (isDynamicPattern(path)) {
      patterns.push(path);
      continue;
    }
    const absolute = resolve(cwd, path);
    if (!existsSync(absolute))
      throw usage(`"${path}" does not exist.`, "Pass files, folders or glob patterns that exist.");
    if (statSync(absolute).isDirectory()) {
      const folder = toPosix(relative(cwd, absolute));
      patterns.push(folder ? `${escapePath(folder)}/**/*.${ext}` : `**/*.${ext}`);
    } else files.add(absolute);
  }
  if (patterns.length > 0)
    for (const file of await glob(patterns, {
      cwd,
      absolute: true,
      ignore: ["**/node_modules/**", "**/.git/**"],
    }))
      files.add(resolve(file));
  return [...files].sort((a, b) => displayPath(cwd, a).localeCompare(displayPath(cwd, b)));
}

function useColor(options: CommandOptions, io: CliIo): boolean {
  return options.color ?? io.color ?? false;
}

function parseExtensions(ext: string | undefined): string[] {
  if (ext === undefined) return DEFAULT_EXTENSIONS;
  const list = String(ext)
    .split(",")
    .map((item) => item.trim().replace(/^\./, ""))
    .filter(Boolean);
  if (list.length === 0) throw usage(`--ext is empty.`, "Pass extensions such as --ext md,mdx.");
  return list;
}

/** `glosslint check`: reports every finding in the files, as text or JSON. Exits 1 on findings. */
export async function runCheck(
  paths: readonly string[],
  options: CheckOptions,
  io: CliIo,
): Promise<number> {
  const format = options.format ?? "text";
  if (format !== "text" && format !== "json")
    throw usage(`--format is "${format}".`, "Use --format text or --format json.");
  const extensions = parseExtensions(options.ext);
  const loaded = await loadCorpus(io.cwd, options);
  const matcher = createMatcher(loaded.corpus);
  // The glossary names every avoid word, so checking it would only report the glossary itself.
  const files = (await collectFiles(paths, io.cwd, extensions)).filter(
    (file) => loaded.from !== "glossary" || file !== loaded.file,
  );
  const findings: CliFinding[] = [];
  for (const file of files) {
    const extension = extname(file).toLowerCase();
    findings.push(
      ...checkFileText(matcher, readFileSync(file, "utf8"), displayPath(io.cwd, file), {
        markdown: MARKDOWN.has(extension),
        mdx: extension === ".mdx",
      }),
    );
  }
  if (format === "json") io.stdout(`${JSON.stringify(toJson(findings, files.length), null, 2)}\n`);
  else
    io.stdout(
      `${formatFindings(findings, { color: useColor(options, io), files: files.length })}\n`,
    );
  return findings.length > 0 ? 1 : 0;
}

function describe(finding: Finding): string {
  if (finding.code === "GLOSSLINT_AVOID")
    return `"${finding.text}" is an avoid word for ${finding.term.term}.`;
  const replace = finding.fix?.replace ?? finding.term.term;
  return finding.code === "GLOSSLINT_CASE"
    ? `"${finding.text}" is written "${replace}".`
    : `"${finding.text}" is spelled "${replace}".`;
}

function failureLines(failure: CorpusTestFailure): string[] {
  const key = failure.term.term;
  if (failure.expected === "none") {
    const about = failure.findings.filter((finding) => finding.term.term === key);
    const avoid = about.some((finding) => finding.code === "GLOSSLINT_AVOID");
    return [
      `good example "${failure.example}" was flagged:`,
      ...about.map(describe),
      avoid
        ? "└ narrow the avoid word or move the example"
        : "└ fix the example or the term's spelling",
    ];
  }
  if (failure.findings.length === 0)
    return [
      `bad example "${failure.example}" was not flagged.`,
      '└ add the wording to "avoid" or fix the example',
    ];
  return [
    `bad example "${failure.example}" was flagged only for other terms:`,
    ...failure.findings.map(describe),
    '└ add the wording to "avoid" or fix the example',
  ];
}

const count = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

/** `glosslint test`: checks every term's good and bad examples. Exits 1 when one fails. */
export async function runTest(options: CommandOptions, io: CliIo): Promise<number> {
  const { corpus } = await loadCorpus(io.cwd, options);
  const color = useColor(options, io);
  const tested = corpus.terms.filter(
    (term) => (term.examples?.good?.length ?? 0) + (term.examples?.bad?.length ?? 0) > 0,
  );
  if (tested.length === 0) {
    io.stdout("No term has examples.\n");
    return 0;
  }
  const failures = testCorpus(corpus);
  const width = Math.max(...tested.map((term) => term.term.length)) + 2;
  const indent = " ".repeat(width + 2);
  const lines: string[] = [];
  let failing = 0;
  for (const term of tested) {
    const own = failures.filter((failure) => failure.term === term);
    const name = term.term.padEnd(width);
    if (own.length === 0) {
      const good = term.examples?.good?.length ?? 0;
      const bad = term.examples?.bad?.length ?? 0;
      lines.push(`${paint(color, "32", "✓")} ${name}${good} good, ${bad} bad`);
      continue;
    }
    failing++;
    const details = own.flatMap(failureLines);
    lines.push(`${paint(color, "31", "✗")} ${name}${details[0]}`);
    for (const detail of details.slice(1)) lines.push(`${indent}${detail}`);
  }
  io.stdout(`${lines.join("\n")}\n\n${count(tested.length, "term")}, ${failing} failing.\n`);
  return failing > 0 ? 1 : 0;
}

/** `glosslint print`: writes the corpus as a Markdown glossary or as JSON. */
export async function runPrint(options: PrintOptions, io: CliIo): Promise<number> {
  const format = options.format ?? "md";
  if (format !== "md" && format !== "json")
    throw usage(`--format is "${format}".`, "Use --format md or --format json.");
  const { corpus } = await loadCorpus(io.cwd, options);
  io.stdout(printCorpus(corpus, format));
  return 0;
}

/**
 * `glosslint export`: prints the corpus as an x18n glossary in YAML, or with `merge` merges it into that file
 * and prints what changed.
 */
export async function runExport(options: ExportOptions, io: CliIo): Promise<number> {
  if (options.diglot !== undefined) return runDiglotExport(options, io);
  const note = options.note ?? "full";
  if (note !== "full" && note !== "short")
    throw usage(`--note is "${note}".`, "Use --note full or --note short.");
  const { corpus } = await loadCorpus(io.cwd, options);
  const entries = toX18nGlossary(corpus, { note });
  // `yaml` loads only for this command.
  const { mergeX18nGlossary, stringifyX18nGlossary, X18nMergeError } =
    await import("./x18n-merge.ts");
  if (options.merge === undefined) {
    io.stdout(stringifyX18nGlossary(entries));
    return 0;
  }
  const file = resolve(io.cwd, String(options.merge));
  const shown = displayPath(io.cwd, file);
  if (!existsSync(file))
    throw usage(
      `The x18n glossary "${shown}" does not exist.`,
      "Check the path given to --merge, or run glosslint export without it and save the output.",
    );
  let result;
  try {
    result = mergeX18nGlossary(
      readFileSync(file, "utf8"),
      entries,
      options.sourceLocale === undefined ? {} : { sourceLocale: String(options.sourceLocale) },
    );
  } catch (error) {
    if (!(error instanceof X18nMergeError)) throw error;
    throw new CliError({
      code: CLI_ERRORS.failed,
      why: `${shown}: ${error.message}`,
      fix:
        error.fix ?? "Pass --merge an x18n glossary: a YAML list of entries, each with a `term`.",
    });
  }
  writeFileSync(file, result.text);
  const lines = [
    `${shown}: ${count(entries.length, "term")} merged, ${result.added.length} added, ${result.updated.length} updated, ${result.unchanged.length} unchanged.`,
    ...result.added.map((term) => `+ ${term}`),
    ...result.updated.map(
      ({ term, from, fields }) =>
        `~ ${term}${from === term ? "" : ` (${from})`}: ${fields.join(", ")}`,
    ),
    ...result.conflicts.map(
      ({ term, locale, kept, dropped }) =>
        `! ${term}: kept ${locale} "${kept}" over "${dropped}" from the glossary`,
    ),
  ];
  io.stdout(`${lines.join("\n")}\n`);
  return 0;
}

/** Whether `locale` is a BCP 47 language tag, such as `fr` or `pt-BR`. */
function isLocale(locale: string): boolean {
  try {
    return Intl.getCanonicalLocales(locale).length === 1;
  } catch {
    return false;
  }
}

/**
 * `glosslint export --diglot <locale>`: prints the locale's diglot glossary in YAML, or with `merge` merges
 * it into that file and prints what changed. Nothing is written when the merge fails.
 */
async function runDiglotExport(options: ExportOptions, io: CliIo): Promise<number> {
  const locale = options.diglot;
  if (typeof locale !== "string" || !isLocale(locale))
    throw usage(
      typeof locale !== "string"
        ? "--diglot needs a locale."
        : `--diglot is "${locale}", which is not a BCP 47 locale.`,
      "Pass the locale of the diglot glossary, such as --diglot fr.",
    );
  const { corpus } = await loadCorpus(io.cwd, options);
  const sourceLocale =
    options.sourceLocale === undefined ? undefined : String(options.sourceLocale);
  const entries = toDiglotGlossary(corpus, locale, sourceLocale);
  if (entries.length === 0)
    throw usage(
      `No term in the glossary has ${locale} in Translations.`,
      `Add a "${locale}: …" item to the Translations of the terms that ${locale} translators decide on, such as "- ${locale}: keep".`,
    );
  // `yaml` loads only for this command.
  const { mergeDiglotGlossary } = await import("./diglot-merge.ts");
  const { X18nMergeError } = await import("./x18n-merge.ts");
  if (options.merge === undefined) {
    io.stdout(mergeDiglotGlossary(undefined, entries).text);
    return 0;
  }
  const file = resolve(io.cwd, String(options.merge));
  const shown = displayPath(io.cwd, file);
  if (!existsSync(file))
    throw usage(
      `The diglot glossary "${shown}" does not exist.`,
      "Check the path given to --merge, or run glosslint export --diglot without it and save the output.",
    );
  const source = readFileSync(file, "utf8");
  let result;
  try {
    result = mergeDiglotGlossary(source, entries);
  } catch (error) {
    if (!(error instanceof X18nMergeError)) throw error;
    throw new CliError({
      code: CLI_ERRORS.failed,
      why: `${shown}: ${error.message}`,
      fix:
        error.fix ?? "Pass --merge a diglot glossary: a YAML map with a `terms:` list of entries.",
    });
  }
  if (result.text !== source) writeFileSync(file, result.text);
  const lines = [
    `${shown}: ${count(entries.length, "term")} merged, ${result.added.length} added, ${result.updated.length} updated, ${result.unchanged.length} unchanged, ${result.keptMatch.length} kept \`match\`.`,
    ...result.added.map((term) => `+ ${term}`),
    ...result.updated.map(({ term, changes }) => `~ ${term}: ${changes.join(", ")}`),
  ];
  io.stdout(`${lines.join("\n")}\n`);
  return 0;
}

/** `glosslint explain`: what the corpus says about a word or phrase. Exits 1 when no term matches. */
export async function runExplain(
  query: string,
  options: CommandOptions,
  io: CliIo,
): Promise<number> {
  const { corpus } = await loadCorpus(io.cwd, options);
  io.stdout(`${explain(corpus, query)}\n`);
  return explainMatches(corpus, query).length > 0 ? 0 : 1;
}

/**
 * `glosslint doctor`: reports the problems of the glossary file, and with `fix` rewrites it in canonical
 * form when no problem would drop text. Exits 0 with no problems left, 1 with problems, 2 with no file.
 */
export async function runDoctor(options: DoctorOptions, io: CliIo): Promise<number> {
  const format = options.format ?? "text";
  if (format !== "text" && format !== "json")
    throw usage(`--format is "${format}".`, "Use --format text or --format json.");
  const file = resolve(io.cwd, options.glossary ?? DEFAULT_GLOSSARY);
  if (!existsSync(file)) throw missingGlossary(io.cwd, file, options.glossary !== undefined, false);
  const shown = displayPath(io.cwd, file);
  let result = readGlossary(readFileSync(file, "utf8"));
  let fixed = 0;
  if (options.fix && result.fixed !== undefined) {
    fixed = result.problems.filter((problem) => problem.fixable).length;
    writeFileSync(file, result.fixed);
    result = readGlossary(result.fixed);
  }
  const problems = result.problems.map((problem) => ({ file: shown, ...problem }));
  const fixable = problems.filter((problem) => problem.fixable).length;
  if (format === "json") {
    const report: DoctorReport = {
      problems,
      summary: { file: shown, problems: problems.length, fixable, fixed },
    };
    io.stdout(`${JSON.stringify(report, null, 2)}\n`);
    return problems.length > 0 ? 1 : 0;
  }
  const text = formatDoctor(
    { file: shown, problems: result.problems, fixed, rewritable: result.fixed !== undefined },
    { color: useColor(options, io), fix: options.fix ?? false },
  );
  io.stdout(`${text}\n`);
  return problems.length > 0 ? 1 : 0;
}

/** Prints a corpus or usage error as a tree on stderr. */
function printError(error: ConfigErrorLike & { corpus?: string }, io: CliIo, color: boolean): void {
  const branches: Array<[string, string]> = [];
  if (error.term && !error.why.includes(`"${error.term}"`)) branches.push(["term", error.term]);
  branches.push(["fix", error.fix]);
  if (error.corpus) branches.push(["corpus", error.corpus]);
  const lines = branches.map(([label, text], index) => {
    const branch = index === branches.length - 1 ? "╰▶" : "├▶";
    return `${paint(color, "2", branch)} ${paint(color, "1", `${label}:`)} ${text}`;
  });
  io.stderr(
    `${[`${paint(color, "1;31", `[${error.code}]`)} ${error.why}`, ...lines].join("\n")}\n`,
  );
}

function defaultIo(): CliIo {
  return {
    cwd: process.cwd(),
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    color: Boolean(process.stdout.isTTY) && !process.env.NO_COLOR,
  };
}

/** Runs the CLI on `argv` (the arguments after the program name) and resolves to the exit code. */
export async function main(argv: readonly string[], io: CliIo = defaultIo()): Promise<number> {
  const cli = cac("glosslint");
  let run: (() => Promise<number>) | undefined;
  let color = io.color ?? false;
  const corpusOption = "Module whose default export is a corpus, instead of a glossary file";
  const glossaryOption = `Glossary file (default: ${DEFAULT_GLOSSARY})`;
  const colorOption = "Color the output (default: when writing to a terminal)";

  cli
    .command("[...paths]", "Check Markdown and text files against the corpus")
    .alias("check")
    .option("--glossary <path>", glossaryOption)
    .option("--corpus <module>", corpusOption)
    .option("--format <format>", "Output format: text or json", { default: "text" })
    .option("--ext <list>", "Extensions read in folders, comma-separated (default: md,mdx,txt)")
    .option("--color", colorOption)
    .action((paths: string[], options: CheckOptions) => {
      run = () => runCheck(paths, options, io);
    });

  cli
    .command("test", "Check every term's good and bad examples")
    .option("--glossary <path>", glossaryOption)
    .option("--corpus <module>", corpusOption)
    .option("--color", colorOption)
    .action((options: CommandOptions) => {
      run = () => runTest(options, io);
    });

  cli
    .command("print", "Print the corpus as a Markdown glossary or JSON")
    .option("--glossary <path>", glossaryOption)
    .option("--corpus <module>", corpusOption)
    .option("--format <format>", "Output format: md or json", { default: "md" })
    .action((options: PrintOptions) => {
      run = () => runPrint(options, io);
    });

  cli
    .command("explain <query>", "Show what the corpus says about a word or phrase")
    .option("--glossary <path>", glossaryOption)
    .option("--corpus <module>", corpusOption)
    .action((query: string, options: CommandOptions) => {
      run = () => runExplain(String(query), options, io);
    });

  cli
    .command(
      "export",
      "Print the corpus as an x18n or diglot glossary in YAML, or merge it into one",
    )
    .option("--glossary <path>", glossaryOption)
    .option("--corpus <module>", corpusOption)
    .option("--diglot <locale>", "Export the locale's diglot glossary instead of the x18n one")
    .option("--merge <file>", "Glossary YAML to merge into, keeping its entries and comments")
    .option("--note <length>", "Note per term: full (What and How) or short (What)", {
      default: "full",
    })
    .option(
      "--source-locale <locale>",
      "Locale whose forms spell the term, matching entries in --merge (default: en)",
    )
    .action((options: ExportOptions) => {
      run = () => runExport(options, io);
    });

  cli
    .command("doctor", "Report the glossary file's problems, and fix the ones it can with --fix")
    .option("--glossary <path>", `Glossary file (default: ${DEFAULT_GLOSSARY})`)
    .option("--fix", "Rewrite the file in canonical form, unless that would drop text")
    .option("--format <format>", "Output format: text or json", { default: "text" })
    .option("--color", colorOption)
    .action((options: DoctorOptions) => {
      run = () => runDoctor(options, io);
    });

  cli.help();
  cli.version(pkg.version);

  try {
    const parsed = cli.parse(["node", "glosslint", ...argv], { run: false });
    if (typeof parsed.options.color === "boolean") color = parsed.options.color;
    if (!cli.matchedCommand) return 0;
    cli.runMatchedCommand();
    return run ? await run() : 0;
  } catch (error) {
    if (error instanceof CliError || isConfigError(error)) {
      printError(error, io, color);
      return 2;
    }
    if (error instanceof Error && error.name === "CACError") {
      printError(
        {
          code: CLI_ERRORS.usage,
          why: `${error.message}.`,
          fix: "Run glosslint --help for the commands and options.",
        },
        io,
        color,
      );
      return 2;
    }
    // Anything else, such as a file it may not read, is one line on stderr, not a stack trace.
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${paint(color, "1;31", `[${CLI_ERRORS.failed}]`)} ${message.split("\n")[0]}\n`);
    return 2;
  }
}

function isBin(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isBin()) process.exitCode = await main(process.argv.slice(2));
