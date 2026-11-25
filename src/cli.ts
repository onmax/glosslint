#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { cac } from "cac";
import { escapePath, glob, isDynamicPattern } from "tinyglobby";
import pkg from "../package.json" with { type: "json" };
import { formatFindings, toJson } from "./format.ts";
import { kindOf } from "./kind.ts";
import { createMatcher } from "./matcher.ts";
import { explain, explainMatches, printCorpus, testCorpus } from "./tools.ts";
import type {
  CliFinding,
  Corpus,
  CorpusTestFailure,
  Finding,
  Matcher,
  Term,
  TermSummary,
  TextKind,
} from "./types.ts";

/** Where a command reads and writes, so tests can run commands without a process. */
export interface CliIo {
  /** The folder paths and the config are resolved from. */
  cwd: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  /** Whether stdout is a terminal that takes colors, used when `--color` is not given. */
  color?: boolean;
}

/** Options every command takes. */
export interface CommandOptions {
  /** The config file. Default: `glosslint.config.{ts,mts,js,mjs}` in `cwd`. */
  config?: string;
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

/** Codes of the errors the CLI prints itself, next to the corpus's `GLOSSLINT_C00x`. */
export const CLI_ERRORS = {
  noConfig: "GLOSSLINT_C009",
  loadConfig: "GLOSSLINT_C010",
  notCorpus: "GLOSSLINT_C008",
  usage: "GLOSSLINT_USAGE",
  failed: "GLOSSLINT_ERROR",
} as const;

const CONFIG_FILES = [
  "glosslint.config.ts",
  "glosslint.config.mts",
  "glosslint.config.js",
  "glosslint.config.mjs",
];
const DEFAULT_EXTENSIONS = ["md", "mdx", "txt"];
const MARKDOWN = new Set([".md", ".mdx", ".markdown"]);

/** An error the CLI prints as a tree and exits 2 on: a bad config or a bad command line. */
class CliError extends Error {
  readonly code: string;
  readonly why: string;
  readonly fix: string;
  readonly config?: string;

  constructor(options: { code: string; why: string; fix: string; config?: string }) {
    super(options.why);
    this.code = options.code;
    this.why = options.why;
    this.fix = options.fix;
    if (options.config !== undefined) this.config = options.config;
  }
}

interface ConfigErrorLike {
  code: string;
  why: string;
  fix: string;
  term?: string;
}

// Matched by shape: a config that imports another copy of glosslint throws that copy's class.
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

/** Finds and imports the config, and returns its default export, which must be a corpus. */
export async function loadCorpus(
  cwd: string,
  config?: string,
): Promise<{ corpus: Corpus; file: string }> {
  let file: string | undefined;
  if (config !== undefined) {
    file = resolve(cwd, config);
    if (!existsSync(file))
      throw new CliError({
        code: CLI_ERRORS.noConfig,
        why: `The config "${config}" does not exist.`,
        fix: "Check the path given to --config.",
      });
  } else {
    file = CONFIG_FILES.map((name) => resolve(cwd, name)).find((path) => existsSync(path));
    if (!file)
      throw new CliError({
        code: CLI_ERRORS.noConfig,
        why: "No glosslint.config.ts, .mts, .js or .mjs in the current folder.",
        fix: "Create glosslint.config.ts with `export default defineCorpus({ … })`, or pass --config <path>.",
      });
  }
  const shown = displayPath(cwd, file);
  let loaded: { default?: unknown };
  try {
    loaded = (await import(pathToFileURL(file).href)) as { default?: unknown };
  } catch (error) {
    if (isConfigError(error)) throw Object.assign(error, { config: shown });
    throw new CliError({
      code: CLI_ERRORS.loadConfig,
      why: `Could not load ${shown}: ${error instanceof Error ? error.message : String(error)}`,
      fix: "Fix the error in the config, then run glosslint again.",
      config: shown,
    });
  }
  if (!isCorpus(loaded.default))
    throw new CliError({
      code: CLI_ERRORS.notCorpus,
      why: `${shown} does not export a corpus as its default export.`,
      fix: "End the config with `export default defineCorpus({ … })`.",
      config: shown,
    });
  return { corpus: loaded.default, file };
}

/** Blanks a span with spaces, keeping line breaks, so every offset and line stays where it was. */
function blank(text: string): string {
  return text.replace(/[^\n\r]/g, " ");
}

const FRONTMATTER = /^(?:---|\+\+\+)\r?\n[\s\S]*?\r?\n(?:---|\+\+\+|\.\.\.)[ \t]*(?:\r?\n|$)/;
// A fence may sit in a list item or a blockquote: `- ```ts`, `> ~~~`.
const FENCE = /^[ \t]*((?:>[ \t]?)*)[ \t]*((?:[-*+]|\d{1,9}[.)])[ \t]+)?(`{3,}|~{3,})([^\n]*)$/;
const HTML_COMMENT = /<!--[\s\S]*?(?:-->|$)/g;
// A code span never crosses a blank line, written with LF or CRLF.
const INLINE_CODE = /(?<!`)(`+)(?!`)(?:(?!\r?\n[ \t]*\r?\n)[\s\S])*?[^`]\1(?!`)/g;
const LINK_TARGET =
  /(?<=\])\((?:[^()\s]|\([^()\s]*\))*(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?\s*\)/g;
const LINK_REFERENCE = /(?<=\])\[[^\]\n]*\]/g;
const REFERENCE_DEFINITION = /^ {0,3}\[[^\]\n]+\]:[ \t]*\S.*$/gm;
const AUTOLINK = /<(?:[a-z][a-z\d+.-]*:[^\s<>]*|[^\s<>@]+@[^\s<>]+)>/gi;
const TAG = /<\/?[A-Za-z][^<>]*>/g;
const LINE_PREFIX =
  /^( {0,3}(?:>[ \t]?)*)(#{1,6}(?=[ \t]|\r?$)|[-*+](?=[ \t])|\d{1,9}[.)](?=[ \t]))?([ \t]+\[[ xX]\](?=[ \t]))?/;
const HEADING = /^ {0,3}#{1,6}(?:[ \t]|\r?$)/;
const LIST_ITEM = /^ {0,3}(?:>[ \t]?)*(?:[-*+]|\d{1,9}[.)])[ \t]/;

/**
 * Blanks what is not prose in Markdown, keeping every offset: frontmatter, fenced code, HTML
 * comments and tags, inline code, link targets and references, and the markers of headings, lists
 * and quotes. In MDX, `import` and `export` lines too.
 */
export function maskMarkdown(text: string, options: { mdx?: boolean } = {}): string {
  let out = text.replace(FRONTMATTER, blank);
  const lines = out.split("\n");
  // The open fence's marker and blockquote depth; it closes only at the same depth, never on a list item.
  let fence: { marker: string; depth: number } | undefined;
  for (const [index, line] of lines.entries()) {
    const match = FENCE.exec(line);
    const marker = match?.[3];
    const depth = match?.[1]?.split(">").length ?? 0;
    if (fence !== undefined) {
      if (
        marker &&
        !match![2] &&
        depth === fence.depth &&
        marker[0] === fence.marker[0] &&
        marker.length >= fence.marker.length &&
        match![4]!.trim() === ""
      )
        fence = undefined;
      lines[index] = blank(line);
    } else if (marker) {
      fence = { marker, depth };
      lines[index] = blank(line);
    } else if (options.mdx && /^(?:import|export)\s/.test(line)) {
      lines[index] = blank(line);
    }
  }
  out = lines.join("\n");
  out = out.replace(HTML_COMMENT, blank);
  out = out.replace(INLINE_CODE, blank);
  out = out.replace(REFERENCE_DEFINITION, blank);
  out = out.replace(LINK_TARGET, blank);
  out = out.replace(LINK_REFERENCE, blank);
  out = out.replace(AUTOLINK, blank);
  out = out.replace(TAG, blank);
  return out
    .split("\n")
    .map((line) => {
      let masked = line.replace(LINE_PREFIX, blank);
      if (HEADING.test(line)) masked = masked.replace(/[ \t]#+[ \t]*(?=\r?$)/, blank);
      return masked;
    })
    .join("\n");
}

const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*\r?$/;

interface Block {
  start: number;
  end: number;
  kind: TextKind;
}

/** Splits text into the pieces checked one at a time: headings, table cells, list items and paragraphs. */
function blocks(original: string, masked: string, markdown: boolean): Block[] {
  const found: Block[] = [];
  let current: Block | undefined;
  const flush = () => {
    if (current) found.push(current);
    current = undefined;
  };
  let start = 0;
  const lines = masked.split("\n");
  for (const [index, line] of lines.entries()) {
    const end = start + line.length;
    const source = original.slice(start, end);
    if (line.trim() === "") flush();
    else if (markdown && HEADING.test(source)) {
      flush();
      found.push({ start, end, kind: "label" });
    } else if (markdown && source.trimStart().startsWith("|")) {
      flush();
      // A row right above the `| --- |` delimiter row is the table's header.
      const header = TABLE_DELIMITER.test(lines[index + 1] ?? "");
      let cellStart = start;
      for (const cell of line.split("|")) {
        if (cell.trim() !== "")
          found.push({
            start: cellStart,
            end: cellStart + cell.length,
            kind: header ? "header" : kindOf({ text: cell }),
          });
        cellStart += cell.length + 1;
      }
    } else if (markdown && LIST_ITEM.test(source)) {
      flush();
      current = { start, end, kind: "sentence" };
    } else if (current) current.end = end;
    else current = { start, end, kind: "sentence" };
    start = end + 1;
  }
  flush();
  return found;
}

function summarize(term: Term): TermSummary {
  return {
    term: term.term,
    ...(term.description ? { description: term.description } : {}),
    ...(term.nuance ? { nuance: term.nuance } : {}),
  };
}

/** Checks one file's text. Markdown is masked first, so code and link targets are never reported. */
export function checkFileText(
  matcher: Matcher,
  text: string,
  file: string,
  options: { markdown?: boolean; mdx?: boolean } = {},
): CliFinding[] {
  const markdown = options.markdown ?? false;
  const masked = markdown ? maskMarkdown(text, { mdx: options.mdx ?? false }) : text;
  const lineStarts = [0];
  for (let index = text.indexOf("\n"); index !== -1; index = text.indexOf("\n", index + 1))
    lineStarts.push(index + 1);
  const lineOf = (offset: number): number => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (lineStarts[mid]! <= offset) low = mid;
      else high = mid - 1;
    }
    return low;
  };
  const lineEnd = (line: number): number => (lineStarts[line + 1] ?? text.length + 1) - 1;
  const findings: CliFinding[] = [];
  for (const block of blocks(text, masked, markdown)) {
    for (const finding of matcher.check(masked.slice(block.start, block.end), block.kind)) {
      const start = block.start + finding.start;
      const end = block.start + finding.end;
      const line = lineOf(start);
      const lineStart = lineStarts[line]!;
      findings.push(
        toCliFinding(finding, {
          file,
          text,
          start,
          end,
          line,
          lineStart,
          lineEnd: lineEnd(lineOf(end)),
        }),
      );
    }
  }
  return findings;
}

function toCliFinding(
  finding: Finding,
  at: {
    file: string;
    text: string;
    start: number;
    end: number;
    line: number;
    lineStart: number;
    lineEnd: number;
  },
): CliFinding {
  const { fix, term, start: _start, end: _end, ...rest } = finding;
  const result = fix
    ? (at.text.slice(at.lineStart, at.start) + fix.replace + at.text.slice(at.end, at.lineEnd))
        .replace(/\s+/g, " ")
        .trim()
    : undefined;
  return {
    code: rest.code,
    file: at.file,
    line: at.line + 1,
    column: at.start - at.lineStart + 1,
    start: at.start,
    end: at.end,
    text: at.text.slice(at.start, at.end),
    message: rest.message,
    ...(rest.why ? { why: rest.why } : {}),
    ...(fix && result !== undefined ? { fix: { ...fix, result } } : {}),
    term: summarize(term),
    ...(rest.see ? { see: rest.see } : {}),
  };
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
  const { corpus } = await loadCorpus(io.cwd, options.config);
  const matcher = createMatcher(corpus);
  const files = await collectFiles(paths, io.cwd, extensions);
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
  const { corpus } = await loadCorpus(io.cwd, options.config);
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
  const { corpus } = await loadCorpus(io.cwd, options.config);
  io.stdout(printCorpus(corpus, format));
  return 0;
}

/** `glosslint explain`: what the corpus says about a word or phrase. Exits 1 when no term matches. */
export async function runExplain(
  query: string,
  options: CommandOptions,
  io: CliIo,
): Promise<number> {
  const { corpus } = await loadCorpus(io.cwd, options.config);
  io.stdout(`${explain(corpus, query)}\n`);
  return explainMatches(corpus, query).length > 0 ? 0 : 1;
}

/** Prints a config or usage error as a tree on stderr. */
function printError(error: ConfigErrorLike & { config?: string }, io: CliIo, color: boolean): void {
  const branches: Array<[string, string]> = [];
  if (error.term && !error.why.includes(`"${error.term}"`)) branches.push(["term", error.term]);
  branches.push(["fix", error.fix]);
  if (error.config) branches.push(["config", error.config]);
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
  const configOption = "Config file (default: glosslint.config.{ts,mts,js,mjs})";
  const colorOption = "Color the output (default: when writing to a terminal)";

  cli
    .command("[...paths]", "Check Markdown and text files against the corpus")
    .alias("check")
    .option("--config <path>", configOption)
    .option("--format <format>", "Output format: text or json", { default: "text" })
    .option("--ext <list>", "Extensions read in folders, comma-separated (default: md,mdx,txt)")
    .option("--color", colorOption)
    .action((paths: string[], options: CheckOptions) => {
      run = () => runCheck(paths, options, io);
    });

  cli
    .command("test", "Check every term's good and bad examples")
    .option("--config <path>", configOption)
    .option("--color", colorOption)
    .action((options: CommandOptions) => {
      run = () => runTest(options, io);
    });

  cli
    .command("print", "Print the corpus as a Markdown glossary or JSON")
    .option("--config <path>", configOption)
    .option("--format <format>", "Output format: md or json", { default: "md" })
    .action((options: PrintOptions) => {
      run = () => runPrint(options, io);
    });

  cli
    .command("explain <query>", "Show what the corpus says about a word or phrase")
    .option("--config <path>", configOption)
    .action((query: string, options: CommandOptions) => {
      run = () => runExplain(String(query), options, io);
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
