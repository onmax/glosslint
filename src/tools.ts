import { createMatcher, kindOf } from "./matcher.ts";
import type { Corpus, CorpusTestFailure, Finding, Term, X18nGlossaryEntry } from "./types.ts";
import { splitWords, termKey } from "./words.ts";

/** Checks every term's examples: each `bad` one must be reported and each `good` one must not. */
export function testCorpus(corpus: Corpus): CorpusTestFailure[] {
  const matcher = createMatcher(corpus);
  const failures: CorpusTestFailure[] = [];
  for (const term of corpus.terms) {
    const key = termKey(term.term);
    const about = (finding: Finding) => termKey(finding.term.term) === key;
    for (const example of term.examples?.good ?? []) {
      const findings = matcher.check(example, kindOf(undefined, example));
      if (findings.some(about)) failures.push({ term, example, expected: "none", findings });
    }
    for (const example of term.examples?.bad ?? []) {
      const findings = matcher.check(example, kindOf(undefined, example));
      if (!findings.some(about)) failures.push({ term, example, expected: "finding", findings });
    }
  }
  return failures;
}

/** Whether a term says nothing but how it is spelled, so the Markdown glossary lists it on one line. */
function isBare(term: Term): boolean {
  return (
    !term.description &&
    !term.nuance &&
    !term.avoid?.length &&
    !term.examples?.good?.length &&
    !term.examples?.bad?.length &&
    !term.links?.length &&
    term.case !== "context"
  );
}

function sentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return /[.!?:]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** A reason written as an aside: "Racks are unpowered." reads "racks are unpowered". */
function aside(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ").replace(/[.!]$/, "");
  return /^\p{Lu}(?![\p{Lu}\p{N}])/u.test(trimmed)
    ? trimmed.charAt(0).toLowerCase() + trimmed.slice(1)
    : trimmed;
}

const quoted = (items: readonly string[]): string => items.map((item) => `"${item}"`).join(", ");

function avoidList(term: Term): string | undefined {
  if (!term.avoid?.length) return undefined;
  const words = term.avoid.map((avoid) =>
    typeof avoid === "string"
      ? avoid
      : avoid.why
        ? `${avoid.word} (${aside(avoid.why)})`
        : avoid.word,
  );
  return `${words.join(", ")}.`;
}

function examplesLine(term: Term): string | undefined {
  const parts: string[] = [];
  // "Find a station." already ends the sentence, so no period goes after its closing quote.
  const list = (label: string, items: readonly string[]) =>
    `${label}: ${quoted(items)}${/[.!?]$/.test(items.at(-1)!.trim()) ? "" : "."}`;
  if (term.examples?.good?.length) parts.push(list("Good", term.examples.good));
  if (term.examples?.bad?.length) parts.push(list("Bad", term.examples.bad));
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/** How the term is written, beyond its spelling: abbreviations and casing. */
function writingLines(term: Term): string[] {
  const lines: string[] = [];
  if (term.abbr?.length)
    lines.push(`Abbreviation${term.abbr.length > 1 ? "s" : ""}: ${term.abbr.join(", ")}.`);
  if (term.case === "exact") lines.push(`Always written "${term.term}".`);
  if (term.case === "context") lines.push("Title Case in labels, lowercase in sentences.");
  return lines;
}

function spellingName(term: Term): string {
  return term.abbr?.length ? `${term.term} (${term.abbr.join(", ")})` : term.term;
}

function markdownEntry(term: Term): string {
  const lines = [`## ${term.term}`];
  if (term.description) lines.push(sentence(term.description));
  const bullets = [term.nuance && sentence(term.nuance), ...writingLines(term)];
  const avoid = avoidList(term);
  if (avoid) bullets.push(`Don't write: ${avoid}`);
  bullets.push(examplesLine(term));
  if (term.links?.length)
    bullets.push(`See: ${term.links.map((link) => `[${link.title}](${link.url})`).join(", ")}.`);
  for (const bullet of bullets) if (bullet) lines.push(`- ${bullet}`);
  return lines.join("\n");
}

/**
 * The corpus as a Markdown glossary, for agents to read, or as JSON. The Markdown gives each term that
 * says more than its spelling a section, and lists the rest on one "Spelling" line.
 */
export function printCorpus(corpus: Corpus, format: "md" | "json"): string {
  if (format === "json")
    return `${JSON.stringify({ terms: corpus.terms, allow: corpus.allow }, null, 2)}\n`;
  const sections = corpus.terms.filter((term) => !isBare(term)).map(markdownEntry);
  const bare = corpus.terms.filter(isBare);
  if (bare.length > 0)
    sections.push(`## Spelling\nWrite these as shown: ${bare.map(spellingName).join(", ")}.`);
  return `${sections.join("\n\n")}\n`;
}

/** A term `explain` found, with how the query relates to it. */
export interface ExplainMatch {
  term: Term;
  /** A line on how the query relates to the term, such as `"rack" is an avoid word for Dock.` */
  note?: string;
}

function mentionPattern(term: Term): RegExp {
  const words = splitWords(term.term).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${words.join("[\\s\\-‐‑_]*")}(?:e?s)?(?![\\p{L}\\p{N}])`,
    "iu",
  );
}

/** Looks a key up as written, then as a plural ending in `s` or `es`. */
function byKey<T>(map: ReadonlyMap<string, T>, key: string): T | undefined {
  return (
    map.get(key) ??
    (key.endsWith("s") ? map.get(key.slice(0, -1)) : undefined) ??
    (key.endsWith("es") ? map.get(key.slice(0, -2)) : undefined)
  );
}

const squash = (text: string): string => text.trim().replace(/\s+/g, " ").toLowerCase();

/** The terms a word or phrase is about: as a term, an abbreviation, a form or an avoid word, else the terms it mentions. */
export function explainMatches(corpus: Corpus, query: string): ExplainMatch[] {
  const key = termKey(query);
  if (key === "") return [];
  const terms = new Map<string, Term>();
  const abbrs = new Map<string, Term>();
  const forms = new Map<string, Term>();
  const avoids = new Map<string, { term: Term; word: string; why?: string }>();
  for (const term of corpus.terms) terms.set(termKey(term.term), term);
  for (const term of corpus.terms) {
    for (const abbr of term.abbr ?? [])
      if (!abbrs.has(termKey(abbr))) abbrs.set(termKey(abbr), term);
    for (const list of Object.values(term.forms ?? {}))
      for (const form of list) if (!forms.has(termKey(form))) forms.set(termKey(form), term);
    for (const avoid of term.avoid ?? []) {
      const { word, why } = typeof avoid === "string" ? { word: avoid, why: undefined } : avoid;
      const avoidKey = termKey(word);
      if (!avoids.has(avoidKey)) avoids.set(avoidKey, { term, word, ...(why ? { why } : {}) });
    }
  }
  const matches: ExplainMatch[] = [];
  const add = (term: Term, note?: string) => {
    if (matches.some((match) => match.term === term)) return;
    matches.push(note ? { term, note } : { term });
  };
  const asTerm = byKey(terms, key);
  if (asTerm) {
    // "re-order point" has the key of "Reorder point" but another spelling; "docks" is only its plural.
    const respelled = key === termKey(asTerm.term) && squash(query) !== squash(asTerm.term);
    add(asTerm, respelled ? `"${query.trim()}" is spelled "${asTerm.term}".` : undefined);
  }
  const asAbbr = byKey(abbrs, key);
  if (asAbbr) add(asAbbr, `"${query.trim()}" abbreviates ${asAbbr.term}.`);
  const asForm = byKey(forms, key);
  if (asForm) add(asForm, `"${query.trim()}" is a form of ${asForm.term}.`);
  const asAvoid = byKey(avoids, key);
  if (asAvoid) {
    const why = asAvoid.why ? ` ${sentence(asAvoid.why)}` : "";
    add(asAvoid.term, `"${asAvoid.word}" is an avoid word for ${asAvoid.term.term}.${why}`);
  }
  if (matches.length > 0) return matches;
  for (const finding of createMatcher(corpus).check(query)) {
    const note =
      finding.code === "GLOSSLINT_AVOID"
        ? `"${finding.text}" is an avoid word for ${finding.term.term}.`
        : `"${finding.text}" is spelled "${finding.fix?.replace ?? finding.term.term}".`;
    add(finding.term, note);
  }
  if (matches.length > 0) return matches;
  for (const term of corpus.terms) if (mentionPattern(term).test(query)) add(term);
  return matches;
}

/** Terms with more than a spelling that this term's description or nuance mentions, or whose name contains it. */
function related(corpus: Corpus, term: Term): Term[] {
  const text = [term.description, term.nuance].filter(Boolean).join(" ");
  const own = mentionPattern(term);
  return corpus.terms.filter(
    (other) =>
      other !== term &&
      !isBare(other) &&
      termKey(other.term) !== termKey(term.term) &&
      (mentionPattern(other).test(text) || own.test(other.term)),
  );
}

function explainEntry(corpus: Corpus, match: ExplainMatch): string {
  const { term } = match;
  const lines: (string | undefined)[] = [
    match.note,
    term.description && sentence(term.description),
    term.nuance && sentence(term.nuance),
    ...writingLines(term),
  ];
  const avoid = avoidList(term);
  if (avoid) lines.push(`Avoid: ${avoid}`);
  lines.push(examplesLine(term));
  for (const link of term.links ?? []) lines.push(`See: ${link.title} ${link.url}`);
  const near = related(corpus, term);
  if (near.length > 0) lines.push(`Related: ${near.map((other) => other.term).join(", ")}`);
  return [term.term, ...lines.filter(Boolean).map((line) => `  ${line}`)].join("\n");
}

/** What the corpus says about a word or phrase: the term it belongs to, its meaning and nuance. */
export function explain(corpus: Corpus, query: string): string {
  const matches = explainMatches(corpus, query);
  if (matches.length === 0) return `No term in the corpus matches "${query.trim()}".`;
  return matches.map((match) => explainEntry(corpus, match)).join("\n\n");
}

/** The corpus as x18n `glossary` entries, with only the fields x18n accepts. */
export function toX18nGlossary(corpus: Corpus): X18nGlossaryEntry[] {
  return corpus.terms.map((term) => {
    const note = [term.description, term.nuance]
      .filter((part): part is string => Boolean(part))
      .map(sentence)
      .join(" ");
    const keep = term.case === "exact" && !term.translations;
    return {
      term: term.term,
      ...(term.translations ? { translations: term.translations } : {}),
      ...(term.forms ? { forms: term.forms } : {}),
      ...(note ? { note } : {}),
      ...(keep ? { doNotTranslate: true } : {}),
    };
  });
}
