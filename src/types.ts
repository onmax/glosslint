/** A word or phrase to avoid, with the reason a finding prints. */
export interface Avoid {
  /** The word or phrase to avoid, matched in any case unless it has two capitals in a row. */
  word: string;
  /** Why to avoid it, printed as the finding's `why`. */
  why?: string;
}

/** A link printed as a finding's `see`. */
export interface Link {
  /** The link's text, such as the title of the page. */
  title: string;
  /** Where the term is explained. */
  url: string;
}

/** How a term's capitals are checked. */
export type CaseMode = "exact" | "spelling" | "context";

/**
 * How a `context` term is written in one kind of text: `title` (Title Case), `sentence` (lowercase, with a capital at
 * the start of a sentence), `lower`, `upper` (ALL CAPS) or `as-written` (the term exactly as the corpus writes it).
 */
export type CaseStyle = "title" | "sentence" | "lower" | "upper" | "as-written";

/** The kinds of text whose casing a corpus or a term can set. */
export type CasingKind = "label" | "header" | "sentence";

/** The case style per kind of text. A header takes the label's style unless it sets its own. */
export type Casing = Partial<Record<CasingKind, CaseStyle>>;

/** One term of the corpus: the words to use, what they mean, and the words to avoid. */
export interface Term {
  /** The term as it should be written, such as `Dock` or `eBike`. */
  term: string;
  /** What the concept is, in one sentence. Printed in every finding about the term. */
  description?: string;
  /** How it differs from near terms and when not to use it. Printed in findings for avoid words. */
  nuance?: string;
  /** Why the project uses this term. Printed in findings for avoid words that give no reason of their own. */
  why?: string;
  /** Abbreviations of the term, always checked as `exact`, such as `DP` for `Day Pass`. */
  abbr?: string[];
  /** Words to avoid in favour of this term, each a word or `{ word, why }`. */
  avoid?: (string | Avoid)[];
  /** Strings `glosslint test` expects to pass (`good`) or to be reported (`bad`). */
  examples?: { good?: string[]; bad?: string[] };
  /** Pages that explain the term; the first is printed as the finding's `see`. */
  links?: Link[];
  /** `exact`: one form everywhere. `spelling` (default): word splits and hyphens only, in any case. `context`: Title Case in labels, lowercase in sentences. */
  case?: CaseMode;
  /** This term's case style per kind of text, over the corpus's `casing`. Setting it makes the term `context` unless `case` says otherwise. */
  casing?: Casing;
  /** Whole-word casings that always pass, as case-police skips `github` and `GITHUB`. */
  skip?: ("lower" | "upper")[];
  /** Other forms per locale, such as inflections, passed to x18n's glossary as they are. */
  forms?: Record<string, string[]>;
  /** The term's translation per locale, passed to x18n's glossary as it is. */
  translations?: Record<string, string>;
  /**
   * Per locale, a decision other than a translation: keep the term, keep it with a gloss, or translate it
   * with no set target. A locale here wins over the same locale in `translations`; `termDecisions` reads both.
   */
  decisions?: Record<string, TranslationDecision>;
  /** Regular expression sources per locale that a translation of the term may also be written as, compiled with the `u` flag. */
  patterns?: Record<string, string[]>;
  /** A note for translators per locale, such as the article to use or the word not to write. */
  hints?: Record<string, string>;
}

/**
 * What translators do with a term in one locale: `keep` it as it is, keep it and explain it once with a
 * `gloss` (`keep-gloss`), or `translate` it, to `target` when one is set.
 */
export type TranslationDecision =
  | { decision: "keep" }
  | { decision: "keep-gloss"; gloss: string }
  | { decision: "translate"; target?: string };

/** What `defineCorpus` takes: presets and other corpora to extend, your own terms, and allowed phrases. */
export interface CorpusInput {
  /** Corpora to merge first, such as presets. Later ones win per term, and `terms` win over all of them. */
  extends?: Corpus[];
  /** Your own terms, which win over every term from `extends` with the same words. */
  terms?: Term[];
  /** Phrases that are never reported, such as `roof rack`. A finding inside one is dropped. */
  allow?: string[];
  /** The case style of `context` terms per kind of text. Default: `title` in labels and headers, `sentence` in sentences. */
  casing?: Casing;
  /**
   * Also write a label or header that holds a `context` term wholly in its style, when that style is
   * `title` or `upper`, so "Day pass price" becomes "Day Pass Price". Off by default: only the term is checked.
   */
  wholeLabel?: boolean;
}

/** A validated, flattened corpus, as `defineCorpus` returns it. */
export interface Corpus {
  /** Marks the object as the output of `defineCorpus`. */
  readonly kind: "glosslint.corpus";
  /** Every term after merging, one per key. */
  readonly terms: readonly Term[];
  /** Every allowed phrase, from `extends` first. */
  readonly allow: readonly string[];
  /** The case style per kind of text, from `extends` first, then the corpus's own. */
  readonly casing?: Readonly<Casing>;
  /** Whether labels and headers holding a `context` term follow their style as a whole. */
  readonly wholeLabel?: boolean;
}

/** What a string is, which decides how `context` terms are cased and which checks run. */
export type TextKind = "label" | "header" | "sentence" | "comment" | "identifier" | "unknown";

/** A string an adapter is about to check, as the `kindOf` option sees it. */
export interface KindSite {
  /** The string. */
  text: string;
  /** The key, attribute, variable, slot or element tag the string belongs to, such as `headerName` or `h2`. */
  name?: string;
  /** The file the string is in, when the adapter knows it. */
  file?: string;
  /** Whether a person reads the string as it stands, as template text and locale messages are, so its shape may place it. */
  shown?: boolean;
}

/** Decides the kind of a string an adapter checks, or returns `undefined` to leave it to glosslint's `kindOf`. */
export type KindOf = (site: KindSite) => TextKind | undefined;

/** What a finding may do: `autofix` applies alone, `suggestion` needs a person to pick it, `rename` touches every caller. */
export type FixKind = "autofix" | "suggestion" | "rename";

/** The code of a finding: a different spelling of a term, an avoid word, or wrong capitals. */
export type FindingCode = "GLOSSLINT_TERM" | "GLOSSLINT_AVOID" | "GLOSSLINT_CASE";

/** A replacement for the reported text. */
export interface Fix {
  /** Whether the fix applies alone, needs a person, or renames a symbol. */
  kind: FixKind;
  /** The text that replaces `text`, between `start` and `end`. */
  replace: string;
}

/** One problem the matcher found in a string. */
export interface Finding {
  /** Which kind of problem it is. */
  code: FindingCode;
  /** Offset of the reported text's first character in the checked string. */
  start: number;
  /** Offset just past the reported text's last character. */
  end: number;
  /** The reported text, as written. */
  text: string;
  /** The one-line headline, such as `Use "dock" instead of "rack".` */
  message: string;
  /** Why it is reported: the avoid word's reason, else the term's `why`, else its nuance. */
  why?: string;
  /** The replacement, when there is one. */
  fix?: Fix;
  /** The corpus term the finding is about. */
  term: Term;
  /** The first of the term's links. */
  see?: string;
}

/** The parts of a term that a CLI finding carries. */
export type TermSummary = Pick<Term, "term" | "description" | "nuance">;

/** A finding as the CLI prints it, in a file. */
export interface CliFinding extends Omit<Finding, "fix" | "term"> {
  /** The file's path, relative to the current folder. */
  file: string;
  /** 1-based line of `start`. */
  line: number;
  /** 1-based column of `start`. */
  column: number;
  /** The replacement, with `result`, the line as it reads once fixed. */
  fix?: Fix & { result: string };
  /** The term's name, description and nuance. */
  term: TermSummary;
}

/** What `glosslint check --format json` prints. */
export interface CliReport {
  /** Every finding, in file order. */
  findings: CliFinding[];
  /** How many files were read and how many findings each code has. */
  summary: { files: number; findings: number } & Record<FindingCode, number>;
}

/** A corpus compiled for matching, from `createMatcher`. */
export interface Matcher {
  /** The corpus the matcher was built from. */
  readonly corpus: Corpus;
  /** Finds every problem in `text`, read as `kind` (default `unknown`). */
  check(text: string, kind?: TextKind): Finding[];
}

/** An example of a term that did not behave as `examples` says. */
export interface CorpusTestFailure {
  /** The term whose example failed. */
  term: Term;
  /** The example string. */
  example: string;
  /** `finding` for a `bad` example that passed, `none` for a `good` example that was reported. */
  expected: "finding" | "none";
  /** What the matcher reported for the example. */
  findings: Finding[];
}

/** One entry of x18n's `glossary`, the fields x18n accepts. */
export interface X18nGlossaryEntry {
  /** The term in the source locale. */
  term: string;
  /** The translation per locale. */
  translations?: Record<string, string>;
  /** Other forms per locale. */
  forms?: Record<string, string[]>;
  /** The description and nuance, for translators. */
  note?: string;
  /** Whether every locale keeps the term as it is, as for brands. */
  doNotTranslate?: boolean;
}
