export { CONFIG_ERRORS, defineCorpus } from "./corpus.ts";
export { GlosslintConfigError } from "./errors.ts";
export { formatFinding, formatFindings, toJson } from "./format.ts";
export type { FormatOptions } from "./format.ts";
export { check, createMatcher, kindOf } from "./matcher.ts";
export type { MatcherOptions } from "./matcher.ts";
export { fromGlossaryTable } from "./table.ts";
export type { GlossaryTableColumns } from "./table.ts";
export { explain, printCorpus, testCorpus, toX18nGlossary } from "./tools.ts";
export type {
  Avoid,
  CaseMode,
  CliFinding,
  CliReport,
  Corpus,
  CorpusInput,
  CorpusTestFailure,
  Finding,
  FindingCode,
  Fix,
  FixKind,
  Link,
  Matcher,
  Term,
  TermSummary,
  TextKind,
  X18nGlossaryEntry,
} from "./types.ts";
