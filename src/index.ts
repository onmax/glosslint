export { CONFIG_ERRORS, defineCorpus } from "./corpus.ts";
export { GlosslintConfigError } from "./errors.ts";
export { formatFinding, formatFindings, toJson } from "./format.ts";
export type { FormatOptions } from "./format.ts";
export { kindOf } from "./kind.ts";
export { check, createMatcher } from "./matcher.ts";
export type { MatcherOptions } from "./matcher.ts";
export { fromGlossary, readGlossary } from "./glossary.ts";
export type { GlossaryProblem } from "./glossary.ts";
export { explain, printCorpus, testCorpus, toX18nGlossary } from "./tools.ts";
export type {
  Avoid,
  CaseMode,
  CaseStyle,
  Casing,
  CasingKind,
  CliFinding,
  CliReport,
  Corpus,
  CorpusInput,
  CorpusTestFailure,
  Finding,
  FindingCode,
  Fix,
  FixKind,
  KindOf,
  KindSite,
  Link,
  Matcher,
  Term,
  TermSummary,
  TextKind,
  X18nGlossaryEntry,
} from "./types.ts";
