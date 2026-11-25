import type { CliFinding, CliReport, Finding } from "./types.ts";

/** One finding in the nostics tree format: the headline, then why, fix, term and see. */
export function formatFinding(_finding: Finding | CliFinding): string {
  throw new Error("not implemented");
}

/** Every finding in the tree format, followed by a summary line. */
export function formatFindings(_findings: (Finding | CliFinding)[]): string {
  throw new Error("not implemented");
}

/** The JSON the CLI prints: `{ findings, summary }`. */
export function toJson(_findings: CliFinding[], _files: number): CliReport {
  throw new Error("not implemented");
}
