import { GlosslintConfigError } from "./errors.ts";
import type { Casing, Corpus, CorpusInput, Term } from "./types.ts";
import { termKey } from "./words.ts";

const INPUT_FIELDS = ["extends", "terms", "allow", "casing", "wholeLabel"] as const;
const TERM_FIELDS = [
  "term",
  "description",
  "nuance",
  "why",
  "abbr",
  "avoid",
  "examples",
  "links",
  "case",
  "casing",
  "skip",
  "forms",
  "translations",
  "decisions",
  "patterns",
  "hints",
] as const;
const AVOID_FIELDS = ["word", "why"] as const;
const LINK_FIELDS = ["title", "url"] as const;
const EXAMPLE_FIELDS = ["good", "bad"] as const;
const CASE_MODES = ["exact", "spelling", "context"] as const;
const SKIPS = ["lower", "upper"] as const;
const CASING_KINDS = ["label", "header", "sentence"] as const;
const CASE_STYLES = ["title", "sentence", "lower", "upper", "as-written"] as const;

/** Stable codes of `GlosslintConfigError`. */
export const CONFIG_ERRORS = {
  unknownField: "GLOSSLINT_C001",
  missingTerm: "GLOSSLINT_C002",
  badCase: "GLOSSLINT_C003",
  avoidIsTerm: "GLOSSLINT_C004",
  duplicateTerm: "GLOSSLINT_C005",
  badSkip: "GLOSSLINT_C006",
  badType: "GLOSSLINT_C007",
  notCorpus: "GLOSSLINT_C008",
  noGlossary: "GLOSSLINT_C009",
  badCasing: "GLOSSLINT_C011",
  glossaryAndCorpus: "GLOSSLINT_C012",
} as const;

type Fail = (code: string, why: string, fix: string) => never;

export function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length]!;
}

/** The field nearest to `name` by edit distance, when it is close enough to be a typo. */
export function nearest(name: string, fields: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const field of fields) {
    const d = distance(name.toLowerCase(), field);
    if (d < bestDistance) {
      best = field;
      bestDistance = d;
    }
  }
  return bestDistance <= Math.max(2, Math.floor(name.length / 3)) ? best : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function quoteList(values: readonly string[]): string {
  const quoted = values.map((value) => `"${value}"`);
  return quoted.length > 1
    ? `${quoted.slice(0, -1).join(", ")} or ${quoted.at(-1)}`
    : (quoted[0] ?? "");
}

function checkFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  where: string,
  fail: Fail,
): void {
  for (const name of Object.keys(value)) {
    if (fields.includes(name)) continue;
    const near = nearest(name, fields);
    fail(
      CONFIG_ERRORS.unknownField,
      `Unknown field "${name}" in ${where}.`,
      near ? `Rename it to "${near}".` : `Remove it. The fields are ${quoteList(fields)}.`,
    );
  }
}

function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim() !== "")
  );
}

function checkStringList(value: unknown, field: string, fail: Fail): void {
  if (value !== undefined && !isStringList(value))
    fail(
      CONFIG_ERRORS.badType,
      `"${field}" must be a list of non-empty strings.`,
      `Write it as ["…", "…"].`,
    );
}

function checkLocaleMap(value: unknown, field: string, list: boolean, fail: Fail): void {
  if (value === undefined) return;
  const valid =
    isRecord(value) &&
    Object.values(value).every((item) => (list ? isStringList(item) : typeof item === "string"));
  if (!valid)
    fail(
      CONFIG_ERRORS.badType,
      `"${field}" must map each locale to ${list ? "a list of strings" : "a string"}.`,
      list ? `Write it as { de: ["…"] }.` : `Write it as { de: "…" }.`,
    );
}

function isDecision(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const { decision, gloss, target } = value;
  const keys = Object.keys(value).filter((key) => key !== "decision");
  if (decision === "keep") return keys.length === 0;
  if (decision === "keep-gloss")
    return keys.join() === "gloss" && typeof gloss === "string" && gloss.trim() !== "";
  if (decision === "translate")
    return keys.length === 0 || (keys.join() === "target" && typeof target === "string");
  return false;
}

function checkDecisions(value: unknown, fail: Fail): void {
  if (value === undefined) return;
  if (!isRecord(value) || !Object.values(value).every(isDecision))
    fail(
      CONFIG_ERRORS.badType,
      `"decisions" must map each locale to a decision.`,
      `Write it as { de: { decision: "keep" } }, { decision: "keep-gloss", gloss: "…" } or { decision: "translate", target?: "…" }.`,
    );
}

function checkTerm(input: unknown, index: number): Term {
  const name = isRecord(input) && typeof input.term === "string" ? input.term : undefined;
  const fail: Fail = (code, why, fix) => {
    throw new GlosslintConfigError({
      code,
      why,
      fix,
      ...(name === undefined ? {} : { term: name }),
    });
  };
  if (!isRecord(input))
    fail(
      CONFIG_ERRORS.badType,
      `Entry ${index + 1} of "terms" is not an object.`,
      `Write it as { term: "…" }.`,
    );
  const term = input as Record<string, unknown>;
  checkFields(
    term,
    TERM_FIELDS,
    name === undefined ? `entry ${index + 1} of "terms"` : `term "${name}"`,
    fail,
  );
  if (name === undefined || termKey(name) === "")
    fail(
      CONFIG_ERRORS.missingTerm,
      name === undefined
        ? `Entry ${index + 1} of "terms" has no "term".`
        : `The term "${name}" has no letters or digits.`,
      `Add the words to use, such as { term: "Dock" }.`,
    );
  for (const field of ["description", "nuance", "why"] as const) {
    if (term[field] !== undefined && typeof term[field] !== "string")
      fail(
        CONFIG_ERRORS.badType,
        `"${field}" must be a string.`,
        `Write it as one sentence in quotes.`,
      );
  }
  if (term.case !== undefined && !CASE_MODES.includes(term.case as never))
    fail(
      CONFIG_ERRORS.badCase,
      `"case" is ${JSON.stringify(term.case)}.`,
      `Use ${quoteList(CASE_MODES)}.`,
    );
  checkCasing(term.casing, `term "${name}"`, fail);
  if (term.skip !== undefined) {
    const bad = Array.isArray(term.skip)
      ? term.skip.find((item) => !SKIPS.includes(item as never))
      : term.skip;
    if (!Array.isArray(term.skip) || bad !== undefined)
      fail(
        CONFIG_ERRORS.badSkip,
        `"skip" has ${JSON.stringify(bad)}.`,
        `Use a list of ${quoteList(SKIPS)}, such as ["lower", "upper"].`,
      );
  }
  checkStringList(term.abbr, "abbr", fail);
  if (term.avoid !== undefined) {
    if (!Array.isArray(term.avoid))
      fail(
        CONFIG_ERRORS.badType,
        `"avoid" must be a list.`,
        `Write it as ["word", { word: "…", why: "…" }].`,
      );
    for (const avoid of term.avoid as unknown[]) {
      if (isRecord(avoid)) {
        checkFields(avoid, AVOID_FIELDS, `an avoid word of "${name}"`, fail);
        if (avoid.why !== undefined && typeof avoid.why !== "string")
          fail(
            CONFIG_ERRORS.badType,
            `The "why" of an avoid word must be a string.`,
            `Write the reason in quotes.`,
          );
      }
      const word = isRecord(avoid) ? avoid.word : avoid;
      if (typeof word !== "string" || termKey(word) === "")
        fail(
          CONFIG_ERRORS.badType,
          `An avoid word of "${name}" is empty or not a string.`,
          `Write each one as "word" or { word: "…", why: "…" }.`,
        );
      if (
        (word as string).trim().replace(/\s+/g, " ").toLowerCase() ===
        name.trim().replace(/\s+/g, " ").toLowerCase()
      )
        fail(
          CONFIG_ERRORS.avoidIsTerm,
          `"${word as string}" is both the term and one of its avoid words.`,
          `Remove it from "avoid". To require one casing, set case: "exact".`,
        );
    }
  }
  if (term.examples !== undefined) {
    if (!isRecord(term.examples))
      fail(
        CONFIG_ERRORS.badType,
        `"examples" must be an object.`,
        `Write it as { good: ["…"], bad: ["…"] }.`,
      );
    checkFields(term.examples, EXAMPLE_FIELDS, `the examples of "${name}"`, fail);
    checkStringList(term.examples.good, "examples.good", fail);
    checkStringList(term.examples.bad, "examples.bad", fail);
  }
  if (term.links !== undefined) {
    if (!Array.isArray(term.links))
      fail(
        CONFIG_ERRORS.badType,
        `"links" must be a list.`,
        `Write it as [{ title: "…", url: "https://…" }].`,
      );
    for (const link of term.links as unknown[]) {
      if (!isRecord(link))
        fail(
          CONFIG_ERRORS.badType,
          `A link of "${name}" is not an object.`,
          `Write it as { title: "…", url: "https://…" }.`,
        );
      checkFields(link, LINK_FIELDS, `a link of "${name}"`, fail);
      if (typeof link.title !== "string" || typeof link.url !== "string")
        fail(
          CONFIG_ERRORS.badType,
          `A link of "${name}" needs a "title" and a "url".`,
          `Write it as { title: "…", url: "https://…" }.`,
        );
    }
  }
  checkLocaleMap(term.forms, "forms", true, fail);
  checkLocaleMap(term.translations, "translations", false, fail);
  checkLocaleMap(term.patterns, "patterns", true, fail);
  checkLocaleMap(term.hints, "hints", false, fail);
  checkDecisions(term.decisions, fail);
  return term as unknown as Term;
}

function checkCasing(value: unknown, where: string, fail: Fail): void {
  if (value === undefined) return;
  if (!isRecord(value))
    fail(
      CONFIG_ERRORS.badCasing,
      `"casing" of ${where} must be an object.`,
      `Write it as { label: "title", header: "upper", sentence: "sentence" }.`,
    );
  for (const [kind, style] of Object.entries(value as Record<string, unknown>)) {
    if (!CASING_KINDS.includes(kind as never))
      fail(
        CONFIG_ERRORS.badCasing,
        `"casing" of ${where} has the kind "${kind}".`,
        `Use ${quoteList(CASING_KINDS)}.`,
      );
    if (!CASE_STYLES.includes(style as never))
      fail(
        CONFIG_ERRORS.badCasing,
        `"casing.${kind}" of ${where} is ${JSON.stringify(style)}.`,
        `Use ${quoteList(CASE_STYLES)}.`,
      );
  }
}

function isCorpus(value: unknown): value is Corpus {
  return (
    isRecord(value) &&
    value.kind === "glosslint.corpus" &&
    Array.isArray(value.terms) &&
    Array.isArray(value.allow)
  );
}

/**
 * Sets `key` and moves it to the end, so `terms` lists them from lowest to highest precedence and a term's
 * abbreviations and avoid words beat those of the terms before it.
 */
function setLast(map: Map<string, Term>, key: string, term: Term): void {
  map.delete(key);
  map.set(key, term);
}

/** Validates a corpus, merges what it extends, and returns it flat. Throws a `GlosslintConfigError` on a bad term. */
export function defineCorpus(input: CorpusInput): Corpus {
  const fail: Fail = (code, why, fix) => {
    throw new GlosslintConfigError({ code, why, fix });
  };
  const raw: unknown = input;
  if (!isRecord(raw))
    fail(CONFIG_ERRORS.badType, `defineCorpus takes an object.`, `Pass { extends, terms, allow }.`);
  checkFields(raw as Record<string, unknown>, INPUT_FIELDS, "the corpus", fail);
  if (input.extends !== undefined && !Array.isArray(input.extends))
    fail(
      CONFIG_ERRORS.badType,
      `"extends" must be a list of corpora.`,
      `Write it as [tech, inclusive].`,
    );
  if (input.terms !== undefined && !Array.isArray(input.terms))
    fail(CONFIG_ERRORS.badType, `"terms" must be a list.`, `Write it as [{ term: "…" }].`);
  checkStringList(input.allow, "allow", fail);
  checkCasing(input.casing, "the corpus", fail);
  if (input.wholeLabel !== undefined && typeof input.wholeLabel !== "boolean")
    fail(
      CONFIG_ERRORS.badType,
      `"wholeLabel" must be true or false.`,
      `Write it as wholeLabel: true.`,
    );

  const merged = new Map<string, Term>();
  const allow: string[] = [];
  const casing: Casing = {};
  let wholeLabel: boolean | undefined;
  for (const [index, corpus] of (input.extends ?? []).entries()) {
    if (!isCorpus(corpus))
      fail(
        CONFIG_ERRORS.notCorpus,
        `Entry ${index + 1} of "extends" is not a corpus.`,
        `Pass a preset, fromGlossary(…) or the result of defineCorpus(…).`,
      );
    for (const term of corpus.terms) setLast(merged, termKey(term.term), term);
    allow.push(...corpus.allow);
    Object.assign(casing, corpus.casing);
    wholeLabel = corpus.wholeLabel ?? wholeLabel;
  }

  const own = new Map<string, Term>();
  for (const [index, raw] of (input.terms ?? []).entries()) {
    const term = checkTerm(raw, index);
    const key = termKey(term.term);
    const previous = own.get(key);
    if (previous)
      throw new GlosslintConfigError({
        code: CONFIG_ERRORS.duplicateTerm,
        why: `"${previous.term}" and "${term.term}" are the same words, so they are one term.`,
        fix: `Keep one of them. A spelling to report goes in that term's "avoid" list.`,
        term: term.term,
      });
    own.set(key, term);
  }
  for (const [key, term] of own) setLast(merged, key, term);
  allow.push(...(input.allow ?? []));
  Object.assign(casing, input.casing);
  wholeLabel = input.wholeLabel ?? wholeLabel;

  return Object.freeze({
    kind: "glosslint.corpus",
    terms: Object.freeze([...merged.values()]),
    allow: Object.freeze(allow),
    ...(Object.keys(casing).length > 0 ? { casing: Object.freeze(casing) } : {}),
    ...(wholeLabel !== undefined ? { wholeLabel } : {}),
  });
}
