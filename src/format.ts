import type { GlossaryProblem } from "./glossary-text.ts";
import { capitalise } from "./words.ts";
import type { CliFinding, CliReport, Finding, FindingCode, Term, TermSummary } from "./types.ts";

/** Options for `formatFinding` and `formatFindings`. */
export interface FormatOptions {
  /** Print ANSI colors. Off by default. */
  color?: boolean;
  /** How many files were read, for the summary line. */
  files?: number;
}

const CODES: readonly FindingCode[] = ["GLOSSLINT_TERM", "GLOSSLINT_AVOID", "GLOSSLINT_CASE"];
const FIX_VERBS = { autofix: "Change to", suggestion: "Use", rename: "Rename to" } as const;

const paint = (on: boolean, code: string, text: string): string =>
  on ? `\u001B[${code}m${text}\u001B[0m` : text;

function isCliFinding(finding: Finding | CliFinding): finding is CliFinding {
  return "file" in finding;
}

function termLine(term: Term | TermSummary): string {
  const description = term.description?.trim().replace(/\s+/g, " ");
  if (!description) return term.term;
  // "A powered stand…" reads as "Dock, a powered stand…", but "DP pass…" keeps its capitals.
  const lowered = /^\p{Lu}(?![\p{Lu}\p{N}])/u.test(description)
    ? description.charAt(0).toLowerCase() + description.slice(1)
    : description;
  return `${term.term}, ${lowered}`;
}

/** One finding in the nostics tree format: the headline, then why, fix, term and see. */
export function formatFinding(finding: Finding | CliFinding, options: FormatOptions = {}): string {
  const color = options.color ?? false;
  const where = isCliFinding(finding)
    ? `${finding.file}:${finding.line}:${finding.column}`
    : `offset ${finding.start}`;
  const headline = `${paint(color, "1;31", `[${finding.code}]`)} "${finding.text}" ${isCliFinding(finding) ? "in" : "at"} ${paint(color, "36", where)}`;
  const lines: Array<[string, string]> = [];
  if (finding.why) lines.push(["why", capitalise(finding.why.trim().replace(/\s+/g, " "))]);
  if (finding.fix) {
    const result = "result" in finding.fix ? `: "${String(finding.fix.result).trim()}"` : "";
    lines.push(["fix", `${FIX_VERBS[finding.fix.kind]} "${finding.fix.replace}"${result}`]);
  }
  lines.push(["term", termLine(finding.term)]);
  if (finding.see) lines.push(["see", finding.see]);
  const branches = lines.map(([label, text], index) => {
    const branch = index === lines.length - 1 ? "╰▶" : "├▶";
    return `${paint(color, "2", branch)} ${paint(color, "1", `${label}:`)} ${text}`;
  });
  return [headline, ...branches].join("\n");
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Every finding in the tree format, followed by a summary line. */
export function formatFindings(
  findings: (Finding | CliFinding)[],
  options: FormatOptions = {},
): string {
  const blocks = findings.map((finding) => formatFinding(finding, options));
  const withFiles = new Set(findings.filter(isCliFinding).map((finding) => finding.file)).size;
  let summary: string;
  if (options.files !== undefined) {
    summary =
      findings.length === 0
        ? `No findings in ${plural(options.files, "file")}.`
        : `${plural(findings.length, "finding")} in ${withFiles} of ${plural(options.files, "file")}.`;
  } else {
    summary = findings.length === 0 ? "No findings." : `${plural(findings.length, "finding")}.`;
  }
  return [...blocks, summary].join("\n\n");
}

/** The JSON the CLI prints: `{ findings, summary }`. */
export function toJson(findings: CliFinding[], files: number): CliReport {
  const counts = Object.fromEntries(CODES.map((code) => [code, 0])) as Record<FindingCode, number>;
  for (const finding of findings) counts[finding.code]++;
  return { findings, summary: { files, findings: findings.length, ...counts } };
}

/** What `formatDoctor` prints: the glossary's problems after `--fix`, and how many it fixed. */
export interface DoctorResult {
  /** The glossary, as the output names it. */
  file: string;
  /** The problems left. */
  problems: readonly GlossaryProblem[];
  /** How many problems `--fix` fixed. */
  fixed: number;
  /** Whether the file has a canonical form that `--fix` could write. */
  rewritable: boolean;
}

function formatProblem(problem: GlossaryProblem, file: string, color: boolean): string {
  const lines: Array<[string, string]> = [["fix", problem.fix]];
  if (problem.term && !problem.why.includes(`"${problem.term}"`))
    lines.unshift(["term", problem.term]);
  const branches = lines.map(([label, text], index) => {
    const branch = index === lines.length - 1 ? "╰▶" : "├▶";
    return `${paint(color, "2", branch)} ${paint(color, "1", `${label}:`)} ${text}`;
  });
  const where = paint(color, "36", `${file}:${problem.line}`);
  return [
    `${paint(color, "1;31", `[${problem.code}]`)} ${where}: ${problem.why}`,
    ...branches,
  ].join("\n");
}

/** The text `glosslint doctor` prints: each problem as a tree, then a summary line. */
export function formatDoctor(
  result: DoctorResult,
  options: { color?: boolean; fix?: boolean } = {},
): string {
  const { file, problems, fixed } = result;
  const color = options.color ?? false;
  const fixable = problems.filter((problem) => problem.fixable).length;
  const summary: string[] = [];
  if (fixed > 0) summary.push(`Fixed ${plural(fixed, "problem")} in ${file}.`);
  if (problems.length === 0) {
    if (fixed === 0) summary.push(`No problems in ${file}.`);
  } else if (fixed > 0) summary.push(`${plural(problems.length, "problem")} left.`);
  else {
    const canFix = result.rewritable ? `, ${fixable} fixable with --fix` : "";
    summary.push(`${plural(problems.length, "problem")} in ${file}${canFix}.`);
    if (options.fix && fixable > 0)
      summary.push(
        "The file is unchanged: --fix would drop text, so fix the other problems first.",
      );
  }
  const blocks = problems.map((problem) => formatProblem(problem, file, color));
  return [...blocks, summary.join(" ")].join("\n\n");
}
