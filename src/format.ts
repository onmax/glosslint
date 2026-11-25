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
  if (finding.why) lines.push(["why", finding.why.trim().replace(/\s+/g, " ")]);
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
