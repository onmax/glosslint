import type {
  CaseMode,
  CaseStyle,
  Corpus,
  Finding,
  FindingCode,
  FixKind,
  Matcher,
  Term,
  TextKind,
} from "./types.ts";
import { caseModeOf } from "./kind.ts";
import {
  capitalise,
  isUpper,
  SMALL_WORDS,
  splitWords,
  termKey,
  tokenize,
  WORD,
  WORD_GAP,
} from "./words.ts";

/** Options for `createMatcher`. */
export interface MatcherOptions {
  /** Report avoid words inside identifiers too. Off by default, since renaming touches every caller. */
  identifierAvoid?: boolean;
}

interface Entry {
  term: Term;
  /** The form to write, with any leading or trailing symbols such as the `++` of `Notepad++`. */
  canonical: string;
  mode: CaseMode | "abbr";
  skip: ReadonlySet<string>;
  /** The canonical form's words without its symbols, lowercased. */
  words: string[];
  /** Symbols the canonical form starts with, such as the `.` of `.NET`, which must stand right before the word. */
  lead: string;
  /** Symbols the canonical form ends with, such as the `#` of `C#`, which must stand right after the word. */
  trail: string;
}

interface AvoidEntry {
  term: Term;
  entry: Entry;
  word: string;
  why?: string;
  caseSensitive: boolean;
  /** The `ed` or `ing` the avoid word ends with, which the fix keeps, or "". */
  ending: string;
}

interface Hit<T> {
  value: T;
  start: number;
  end: number;
  /** Index of the first word past the hit. */
  next: number;
  /** The ending as written past the matched form, such as `s`, `ES`, `ed` or `ing`, or "". */
  suffix: string;
  /** Letters to drop from the end of the canonical form before the ending goes on: the `e` of `cache` before `ing`, the `ing` of `prerendering`. */
  cut: number;
  /** Whether the ending is `ed` or `ing`, or a form of a term that ends in `ing`, which only a different spelling reports. */
  verb: boolean;
}

/** A key found as written or as one of its inflected forms. */
interface Found<T> {
  value: T;
  /** Letters of the key past the form, which the text holds as the ending. */
  suffix: number;
  cut?: number;
  verb?: boolean;
}

interface Word {
  key: string;
  start: number;
  end: number;
}

const ALNUM = /[\p{L}\p{N}]/u;

const hasLower = (text: string): boolean => /\p{Ll}/u.test(text);
const isAllCaps = (text: string): boolean => /\p{Lu}.*\p{Lu}/u.test(text) && !hasLower(text);
const upperFirst = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Keeps a word's capitals when it has one past its first letter, such as `DP` or `eBike`. */
const keepsCapitals = (word: string): boolean => /^.+\p{Lu}/u.test(word);

/**
 * Words in parentheses keep their case ("(from dock)"), and the first word after a dash or colon
 * starts again, as in "Rentals - At Another Dock".
 */
function titleCase(text: string): string {
  return text.replace(WORD, (word, offset: number) => {
    const before = text.slice(0, offset);
    if (before.split("(").length > before.split(")").length) return word;
    const first = !/\p{L}/u.test(before) || /[-–—:]\s*$/.test(before);
    if (!first && SMALL_WORDS.has(word.toLowerCase())) return word.toLowerCase();
    return word === word.toLowerCase() ? upperFirst(word) : word;
  });
}

function lowerCase(text: string): string {
  return text.replace(WORD, (word) => (keepsCapitals(word) ? word : word.toLowerCase()));
}

function sentenceCase(text: string, atStart: boolean): string {
  const lower = lowerCase(text);
  return atStart ? upperFirst(lower) : lower;
}

function applyStyle(style: CaseStyle, text: string, atStart: boolean): string {
  if (style === "title") return titleCase(text);
  if (style === "sentence") return sentenceCase(text, atStart);
  if (style === "lower") return lowerCase(text);
  if (style === "upper") return text.toUpperCase();
  return text;
}

function squash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

/** Words joined by single spaces, without periods, so `Approx. time` and `Approx-time` compare equal. */
function spaced(text: string): string {
  return text
    .replace(/\./g, "")
    .replace(/[\s\-‐‑_]+/g, " ")
    .trim();
}

/** Whether `written` is `word` with some of its periods left out, ignoring case and word gaps. */
function periodsFit(written: string, word: string): boolean {
  // A period inside a word, as in `Node.js`, is part of that word, not a gap.
  const flat = (text: string) =>
    text
      .toLowerCase()
      .replace(/(?<=[\p{L}\p{N}])\.(?=[\p{L}\p{N}])/gu, "")
      .replace(/[\s\-‐‑_]+/g, "");
  const w = flat(written);
  const a = flat(word);
  let j = 0;
  for (const char of a) {
    if (char === w[j]) j++;
    else if (char !== ".") return false;
  }
  return j === w.length;
}

/** Splits `C++` into "", "C" and "++": the symbols before the first letter or digit, the rest, and the symbols after the last. */
function symbols(text: string): { lead: string; core: string; trail: string } {
  const lead = /^[^\p{L}\p{N}]*/u.exec(text)![0];
  const trail = /[^\p{L}\p{N}]*$/u.exec(text.slice(lead.length))![0];
  return { lead, core: text.slice(lead.length, text.length - trail.length), trail };
}

/** Writes `canonical` with the writer's capitals: each word starts as the writer's letter at that place does. */
function keepCapitals(canonical: string, surface: string): string {
  if (isAllCaps(surface)) return canonical.toUpperCase();
  const letters = Array.from(surface).filter((char) => ALNUM.test(char));
  const chars = Array.from(canonical);
  let index = 0;
  let out = "";
  for (const [position, char] of chars.entries()) {
    if (!ALNUM.test(char)) {
      out += char;
      continue;
    }
    const wordStart = position === 0 || !ALNUM.test(chars[position - 1]!);
    const written = letters[index++];
    out +=
      wordStart && written !== undefined
        ? isUpper(written)
          ? char.toUpperCase()
          : char.toLowerCase()
        : char;
  }
  return index === letters.length ? out : canonical;
}

function plural(word: string): string {
  const ending = /(?:s|x|z|ch|sh)$/i.test(word) ? "es" : "s";
  return word + (isAllCaps(word) ? ending.toUpperCase() : ending);
}

/**
 * The `ed` or `ing` that `word` ends with where `canonical` ends with the same word without it, as
 * `automatically imported` does for Auto-import, so the fix is "auto-imported". Else "".
 */
function endingOf(word: string, canonical: string): string {
  const last = splitWords(word).at(-1)?.toLowerCase() ?? "";
  const key = termKey(canonical);
  for (const ending of ["ing", "ed"]) {
    if (!last.endsWith(ending)) continue;
    const stem = last.slice(0, -ending.length);
    if (!(stem.length >= 3 && (key.endsWith(stem) || key.endsWith(`${stem}e`)))) continue;
    // `canceling` avoided for Cancel wants another form than glosslint writes, so its fix is the term.
    return termKey(inflect(canonical, ending)) === termKey(word) ? "" : ending;
  }
  return "";
}

/** Adds `ed` or `ing` to `word`, dropping a final `e` before `ing` and writing `d` after one. */
function inflect(word: string, ending: string): string {
  if (ending === "") return word;
  const upper = isAllCaps(word);
  const out = /[^e]e$/i.test(word)
    ? ending === "ed"
      ? `${word}d`
      : `${word.slice(0, -1)}ing`
    : word + ending;
  return upper ? out.toUpperCase() : out;
}

function withSuffix(replace: string, suffix: string, abbr: boolean): string {
  if (suffix === "") return replace;
  if (hasLower(replace) || abbr) return replace + suffix.toLowerCase();
  return replace + suffix;
}

/** Words whose period ends the word, not the sentence, beside those the corpus writes with one, such as `hrs.`. */
const DOTTED_WORDS = ["e.g.", "i.e.", "vs.", "approx.", "incl.", "excl.", "avg.", "no."];

/**
 * Whether a term at `start` begins a sentence. After a colon, either case is right, so the writer's
 * first letter decides. A period after a word in `dotted`, such as `hrs.`, ends no sentence.
 */
function atSentenceStart(text: string, start: number, dotted: ReadonlySet<string>): boolean {
  const before = text.slice(0, start);
  if (/^[\s\p{Ps}\p{Pi}"'*_•-]*$/u.test(before)) return true;
  // Each plural form after `|` ("{count} day | {count} days") starts again.
  if (/\|\s*[\p{Ps}\p{Pi}"'*_]*$/u.test(before)) return true;
  const end = /(\S*)([.!?:])["'\p{Pf}\p{Pe}]*\s+[\p{Ps}\p{Pi}"'*_]*$/u.exec(before);
  if (!end) return false;
  if (end[2] === ":") return isUpper(text.charAt(start));
  return !(end[2] === "." && dotted.has(`${end[1]!.toLowerCase()}.`));
}

function endSentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return /[.!?:]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function makeFinding(
  code: FindingCode,
  start: number,
  end: number,
  text: string,
  term: Term,
  headline: string,
  fix: { kind: FixKind; replace: string } | undefined,
  reason?: string,
): Finding {
  const see = term.links?.[0]?.url;
  const why = reason ?? term.nuance;
  const parts = [
    headline,
    reason && endSentence(capitalise(reason)),
    term.description && `${term.term}: ${endSentence(term.description)}`,
    term.nuance && term.nuance !== reason ? endSentence(term.nuance) : undefined,
    see && `See ${see}`,
  ];
  return {
    code,
    start,
    end,
    text,
    message: parts.filter(Boolean).join(" "),
    ...(why ? { why } : {}),
    ...(fix ? { fix } : {}),
    term,
    ...(see ? { see } : {}),
  };
}

/** Finds a key in `map`, as written or as a plural ending in `s` or `es`. */
function lookup<T>(map: ReadonlyMap<string, T>, key: string): Found<T> | undefined {
  const exact = map.get(key);
  if (exact) return { value: exact, suffix: 0 };
  if (key.length > 2 && key.endsWith("s")) {
    const single = map.get(key.slice(0, -1));
    if (single) return { value: single, suffix: 1 };
    const es = key.endsWith("es") ? map.get(key.slice(0, -2)) : undefined;
    if (es) return { value: es, suffix: 2 };
  }
  return undefined;
}

/**
 * Words of a term in another form: `ed` and `ing` endings, with the `e` of `cache` dropped before
 * `ing`, from `verbs`; and the stem forms of a term that ends in `ing`, so `prerendered` and
 * `prerenders` find Prerendering, from `stems`. A doubled consonant, as in `shipped`, is not read.
 */
function inflected<T>(
  verbs: ReadonlyMap<string, T>,
  stems: ReadonlyMap<string, T>,
  key: string,
): Found<T> | undefined {
  const tries: Array<[stem: string, suffix: number, cut: number, map: ReadonlyMap<string, T>]> = [];
  if (key.endsWith("ing"))
    tries.push([key.slice(0, -3), 3, 0, verbs], [`${key.slice(0, -3)}e`, 3, 1, verbs]);
  if (key.endsWith("ed"))
    tries.push([key.slice(0, -2), 2, 0, verbs], [key.slice(0, -1), 1, 0, verbs]);
  // A stem is its term's key without `ing`, so the term's own canonical form loses three letters.
  tries.push([key, 0, 3, stems]);
  if (key.endsWith("s")) tries.push([key.slice(0, -1), 1, 3, stems]);
  if (key.endsWith("ed")) tries.push([key.slice(0, -2), 2, 3, stems]);
  for (const [stem, suffix, cut, map] of tries) {
    if (stem.length < 3) continue;
    const value = map.get(stem);
    if (value) return { value, suffix, cut, verb: true };
  }
  return undefined;
}

/** The longest run of words from `index` whose joined key `find` knows, up to `max` words. */
function longest<T>(
  text: string,
  words: readonly Word[],
  index: number,
  max: number,
  gap: (between: string) => boolean,
  find: (key: string) => Found<T> | ReadonlyArray<Found<T> | undefined> | undefined,
  accept: (hit: Hit<T>) => Hit<T> | undefined = (hit) => hit,
): Hit<T> | undefined {
  let count = 1;
  while (
    count < max &&
    index + count < words.length &&
    gap(text.slice(words[index + count - 1]!.end, words[index + count]!.start))
  )
    count++;
  for (let n = count; n >= 1; n--) {
    const run = words.slice(index, index + n);
    const found = find(run.map((word) => word.key).join(""));
    const start = run[0]!.start;
    const end = run.at(-1)!.end;
    for (const candidate of [found].flat()) {
      if (!candidate) continue;
      const hit = accept({
        value: candidate.value,
        start,
        end,
        next: index + n,
        suffix: text.slice(end - candidate.suffix, end),
        cut: candidate.cut ?? 0,
        verb: candidate.verb ?? false,
      });
      if (hit) return hit;
    }
  }
  return undefined;
}

function identifierWords(text: string): Word[] {
  const words: Word[] = [];
  let cursor = 0;
  for (const word of splitWords(text)) {
    const found = text.indexOf(word, cursor);
    if (found === -1) continue;
    cursor = found + word.length;
    // `splitWords` keeps a `$` inside a word, as in `$dockCount`: the rename leaves it in place.
    const lead = /^[^\p{L}\p{N}]*/u.exec(word)?.[0].length ?? 0;
    const trail = /[^\p{L}\p{N}]*$/u.exec(word)?.[0].length ?? 0;
    const start = found + lead;
    const end = Math.max(start, cursor - trail);
    const key = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    if (key) words.push({ key, start, end });
  }
  return words;
}

/**
 * The separator `part` uses: `_` or `-` between its words, none between camel humps, and for a
 * single word the one joining it to a neighbouring word of `identifier`. A leading `_`, as in
 * `_dockCount`, joins no words, so it is not a separator.
 */
function separatorOf(part: string, identifier: string, start: number, end: number): string {
  const inner = /[\p{L}\p{N}]([_-])[\p{L}\p{N}]/u.exec(part)?.[1];
  if (inner) return inner;
  if (splitWords(part).length > 1) return "";
  const before = identifier[start - 1] ?? "";
  if (/[_-]/.test(before) && ALNUM.test(identifier[start - 2] ?? "")) return before;
  const after = identifier[end] ?? "";
  if (/[_-]/.test(after) && ALNUM.test(identifier[end + 1] ?? "")) return after;
  return "";
}

/** Writes words in the casing style of `part`, the matched words of an identifier: snake, kebab or camel. */
function identifierStyle(words: readonly string[], part: string, separator: string): string {
  const upper = isAllCaps(part);
  if (upper) return words.join(separator || "_").toUpperCase();
  if (separator) return words.join(separator);
  const camel = words.map((word, index) => (index === 0 ? word : upperFirst(word))).join("");
  return isUpper(part.charAt(0)) ? upperFirst(camel) : camel;
}

function allowPattern(phrase: string): RegExp {
  const body = phrase
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\s\\-‐‑_]+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?:e?s)?(?![\\p{L}\\p{N}])`, "giu");
}

/** The reason of the term's avoid entry written like `written`, such as `pre-rendered: One word.` */
function spellingWhy(term: Term, written: string): string | undefined {
  const flat = (text: string) => spaced(text).toLowerCase();
  for (const avoid of term.avoid ?? [])
    if (typeof avoid !== "string" && avoid.why && flat(avoid.word) === flat(written))
      return avoid.why;
  return undefined;
}

/** A lowercase word against a slash, as in `nuxt/nuxt` or `nuxt/modules`, names a repository or path. */
function againstSlash(text: string, hit: { start: number; end: number }): boolean {
  return (
    !/\p{Lu}/u.test(text.slice(hit.start, hit.end)) &&
    (text[hit.start - 1] === "/" || text[hit.end] === "/")
  );
}

/** Compiles a corpus for matching. Build it once and reuse it. */
export function createMatcher(corpus: Corpus, options: MatcherOptions = {}): Matcher {
  const terms = new Map<string, Entry>();
  const abbrs = new Map<string, Entry>();
  const keep = new Set<string>();
  let maxWords = 1;
  // `defineCorpus` lists terms from lowest to highest precedence, so a later abbreviation or avoid word wins.
  for (const term of corpus.terms) {
    const key = termKey(term.term);
    const { lead, core, trail } = symbols(term.term);
    const entry: Entry = {
      term,
      canonical: term.term,
      mode: caseModeOf(term),
      skip: new Set(term.skip),
      words: splitWords(core || term.term).map((word) => word.toLowerCase()),
      lead,
      trail,
    };
    terms.set(key, entry);
    if (entry.mode === "exact") keep.add(key);
    maxWords = Math.max(maxWords, entry.words.length);
    for (const abbr of term.abbr ?? []) {
      const abbrKey = termKey(abbr);
      const parts = symbols(abbr);
      const words = splitWords(parts.core || abbr).map((w) => w.toLowerCase());
      abbrs.set(abbrKey, {
        ...entry,
        canonical: abbr,
        mode: "abbr",
        words,
        lead: parts.lead,
        trail: parts.trail,
      });
      keep.add(abbrKey);
      maxWords = Math.max(maxWords, words.length);
    }
  }
  // Only words take `ed` and `ing`: an exact term is a name, and a term with symbols, such as `C#`, takes no ending.
  const verbs = new Map<string, Entry>();
  const stems = new Map<string, Entry>();
  for (const [key, entry] of terms) {
    if (entry.mode === "exact" || entry.lead || entry.trail) continue;
    verbs.set(key, entry);
    if (key.length > 5 && key.endsWith("ing") && /ing$/i.test(entry.canonical))
      stems.set(key.slice(0, -3), entry);
  }
  const findForm = (key: string) => lookup(terms, key) ?? inflected(verbs, stems, key);
  const avoids = new Map<string, AvoidEntry>();
  let maxAvoidWords = 1;
  for (const entry of terms.values()) {
    for (const avoid of entry.term.avoid ?? []) {
      const { word, why } = typeof avoid === "string" ? { word: avoid, why: undefined } : avoid;
      const key = termKey(word);
      // An avoid word with a term's key is a spelling of that term, which the TERM pass reports, and
      // so is one split by a space or hyphen with the key of a term's form, such as `pre-rendered`.
      // `canceling`, written as one word, is a form the writer wants avoided.
      if (terms.has(key) || (/[\s\-‐‑_]/.test(word.trim()) && findForm(key))) continue;
      avoids.delete(key);
      avoids.set(key, {
        term: entry.term,
        entry,
        word,
        ...(why ? { why } : {}),
        caseSensitive: /\p{Lu}{2}/u.test(word),
        ending: endingOf(word, entry.canonical),
      });
      maxAvoidWords = Math.max(maxAvoidWords, splitWords(word).length);
    }
  }
  const allow = corpus.allow.map(allowPattern);
  const dotted = new Set(DOTTED_WORDS);
  for (const written of [
    ...[...terms.values(), ...abbrs.values()].map((entry) => entry.canonical),
    ...[...avoids.values()].map((avoid) => avoid.word),
  ]) {
    const last = written.split(/\s+/).at(-1)!;
    if (last.endsWith(".")) dotted.add(last.toLowerCase());
  }
  const startsSentence = (text: string, start: number) => atSentenceStart(text, start, dotted);
  const casing = corpus.casing ?? {};
  /** The case style of `term` in `kind` of text, or undefined where casing isn't checked. */
  const styleOf = (term: Term, kind: TextKind): CaseStyle | undefined => {
    const own = term.casing ?? {};
    if (kind === "header")
      return own.header ?? casing.header ?? own.label ?? casing.label ?? "title";
    if (kind === "label") return own.label ?? casing.label ?? "title";
    if (kind === "sentence") return own.sentence ?? casing.sentence ?? "sentence";
    return undefined;
  };
  const termLimit = maxWords + 1;
  const avoidLimit = maxAvoidWords + 1;
  const textGap = (between: string): boolean => WORD_GAP.test(between);
  const avoidGap = (between: string): boolean => WORD_GAP.test(between.replace(/^\./, ""));
  // `C++` and the abbreviation `C#` share the key `c`, so both are tried until one's symbols fit.
  const findTerm = (key: string) => [findForm(key), lookup(abbrs, key)];
  // A term with symbols, such as `C#` or `.NET`, matches only where the text holds them too, and its hit covers them.
  const withSymbols =
    (text: string) =>
    (hit: Hit<Entry>): Hit<Entry> | undefined => {
      const { lead, trail } = hit.value;
      if (lead === "" && trail === "") return hit;
      if (trail !== "" && hit.suffix !== "") return undefined;
      if (text.slice(hit.start - lead.length, hit.start) !== lead) return undefined;
      if (text.slice(hit.end, hit.end + trail.length) !== trail) return undefined;
      return { ...hit, start: hit.start - lead.length, end: hit.end + trail.length };
    };

  function termFinding(text: string, hit: Hit<Entry>, kind: TextKind): Finding | undefined {
    const entry = hit.value;
    const written = text.slice(hit.start, hit.end);
    const surface = written.slice(0, written.length - hit.suffix.length);
    const exact = entry.mode === "exact" || entry.mode === "abbr";
    const canonical = hit.cut ? entry.canonical.slice(0, -hit.cut) : entry.canonical;
    // An abbreviation in lowercase prose is usually another word or a unit: leave it.
    if (entry.mode === "abbr" && !/\p{Lu}/u.test(surface)) return undefined;
    // case-police's rule: a preset term written all lowercase or all caps passes, whatever its spelling.
    if (entry.skip.has("lower") && !/\p{Lu}/u.test(surface)) return undefined;
    if (entry.skip.has("upper") && !hasLower(surface)) return undefined;
    // A fix never spans a line break, since it would join the lines.
    const fixable = !/[\r\n]/.test(written);
    // Context casing applies to labels, headers and sentences only, so comments and unknown text get exact casing alone.
    const style = styleOf(entry.term, kind);
    const contextWant =
      entry.mode === "context" && style
        ? applyStyle(style, canonical, startsSentence(text, hit.start))
        : undefined;
    // Where the style is ALL CAPS, any term written in capitals fits, abbreviations and exact terms too.
    const shouted = style === "upper" && !hasLower(surface);
    if (squash(surface) !== squash(canonical)) {
      const base = shouted
        ? canonical.toUpperCase()
        : exact
          ? canonical
          : (contextWant ?? keepCapitals(canonical, surface));
      // `cache-ed` and `cache-ing` keep the `e` of `cache` in the text, so the fix inflects it: "cached", "caching".
      const ending = hit.verb ? hit.suffix.toLowerCase() : "";
      const replace =
        ending === "ed" || ending === "ing"
          ? inflect(base, ending)
          : withSuffix(base, hit.suffix, entry.mode === "abbr");
      return makeFinding(
        "GLOSSLINT_TERM",
        hit.start,
        hit.end,
        written,
        entry.term,
        `"${written}" is spelled "${replace}".`,
        fixable ? { kind: "autofix", replace } : undefined,
        spellingWhy(entry.term, written),
      );
    }
    // "Day Passed" in a label is a day that passed, not the term: an `ed` or `ing` form reports only its spelling.
    if (shouted || hit.verb) return undefined;
    if (againstSlash(text, hit)) return undefined;
    const want = exact ? entry.canonical : contextWant;
    const where = exact || contextWant === undefined ? "" : ` in ${kind}s`;
    if (want === undefined || surface.replace(/\s+/g, " ") === want) return undefined;
    const replace = withSuffix(want, hit.suffix, entry.mode === "abbr");
    return makeFinding(
      "GLOSSLINT_CASE",
      hit.start,
      hit.end,
      written,
      entry.term,
      `"${written}" is written "${replace}"${where}.`,
      fixable ? { kind: "autofix", replace } : undefined,
    );
  }

  function avoidFinding(text: string, hit: Hit<AvoidEntry>, kind: TextKind): Finding | undefined {
    const avoid = hit.value;
    // An abbreviation such as "Approx." keeps its period inside the finding.
    const end =
      hit.suffix === "" && avoid.word.endsWith(".") && text[hit.end] === "."
        ? hit.end + 1
        : hit.end;
    const written = text.slice(hit.start, end);
    const surface = hit.suffix ? written.slice(0, -hit.suffix.length) : written;
    if (!periodsFit(surface, avoid.word)) return undefined;
    if (avoid.caseSensitive && spaced(surface) !== spaced(avoid.word)) return undefined;
    const { entry } = avoid;
    let base: string;
    // An acronym written in capitals, such as "SM", says nothing about the casing around it.
    const style = styleOf(entry.term, kind);
    if (style === "upper" && (entry.mode === "context" || !hasLower(surface)))
      base = entry.canonical.toUpperCase();
    else if (entry.mode === "exact" || avoid.caseSensitive) base = entry.canonical;
    else if (entry.mode === "context" && style && kind !== "sentence")
      base = applyStyle(style, entry.canonical, startsSentence(text, hit.start));
    else if (entry.mode === "context" && style && style !== "sentence")
      base = applyStyle(style, entry.canonical, false);
    // An avoid word that is itself an acronym, such as `SM`, is always in capitals, so they ask for none.
    else if (isAllCaps(surface) && hasLower(avoid.word)) base = entry.canonical.toUpperCase();
    else if (isUpper(surface.charAt(0))) base = upperFirst(entry.canonical);
    else base = lowerCase(entry.canonical);
    const replace = hit.suffix ? plural(base) : inflect(base, avoid.ending);
    // "a box crate" holds the avoid word "crate", but "a box box" is no fix.
    const words = splitWords(replace).map((word) => word.toLowerCase());
    const before = /([\p{L}\p{N}]+)\s+$/u.exec(text.slice(0, hit.start))?.[1]?.toLowerCase();
    const after = /^\s+([\p{L}\p{N}]+)/u.exec(text.slice(end))?.[1]?.toLowerCase();
    if (before === words[0] || after === words.at(-1)) return undefined;
    // A replacement ending in a period, such as `hrs.`, takes the place of a sentence's own period.
    const stop = replace.endsWith(".") && text[end] === "." ? end + 1 : end;
    return makeFinding(
      "GLOSSLINT_AVOID",
      hit.start,
      stop,
      text.slice(hit.start, stop),
      avoid.term,
      `Use "${replace}" instead of "${written}".`,
      { kind: "suggestion", replace },
      avoid.why ?? avoid.term.why,
    );
  }

  function checkText(text: string, kind: TextKind): Finding[] {
    const tokens = tokenize(text, keep);
    const accept = withSymbols(text);
    const findings: Finding[] = [];
    for (let index = 0; index < tokens.length;) {
      const hit = longest(text, tokens, index, termLimit, textGap, findTerm, accept);
      if (!hit) {
        index++;
        continue;
      }
      const finding = termFinding(text, hit, kind);
      if (finding) findings.push(finding);
      index = hit.next;
    }
    const findAvoid = (key: string) => lookup(avoids, key);
    // A longer avoid entry that doesn't apply here must not hide a shorter one that does.
    const acceptAvoid = (hit: Hit<AvoidEntry>) => (avoidFinding(text, hit, kind) ? hit : undefined);
    for (let index = 0; index < tokens.length;) {
      // An avoid word may hold a period between words ("Approx. time").
      const hit = longest(text, tokens, index, avoidLimit, avoidGap, findAvoid, acceptAvoid);
      const finding = hit && avoidFinding(text, hit, kind);
      if (!hit || !finding) {
        index++;
        continue;
      }
      findings.push(finding);
      index = hit.next;
    }
    const label = labelFinding(text, kind, tokens, findings, accept);
    if (!label?.fix) return label ? [...findings, label] : findings;
    // The label's fix holds the autofixes inside it, so they report without one of their own.
    const inner = findings.map((finding) => {
      if (finding.fix?.kind !== "autofix") return finding;
      const { fix: _fix, ...rest } = finding;
      return rest;
    });
    return [...inner, label];
  }

  /**
   * With `wholeLabel`, a label or header in Title Case or ALL CAPS holding a context term is written in
   * that style as a whole, so fixing the term alone doesn't leave "Day Pass prices".
   */
  function labelFinding(
    text: string,
    kind: TextKind,
    tokens: Word[],
    findings: readonly Finding[],
    accept: (hit: Hit<Entry>) => Hit<Entry> | undefined,
  ): Finding | undefined {
    if (!corpus.wholeLabel || (kind !== "label" && kind !== "header")) return undefined;
    let styled: { term: Term; style: CaseStyle } | undefined;
    for (let index = 0; index < tokens.length && !styled;) {
      const hit = longest(text, tokens, index, termLimit, textGap, findTerm, accept);
      if (!hit) {
        index++;
        continue;
      }
      const style = styleOf(hit.value.term, kind);
      if (
        hit.value.mode === "context" &&
        !againstSlash(text, hit) &&
        (style === "title" || style === "upper")
      )
        styled = { term: hit.value.term, style };
      index = hit.next;
    }
    if (!styled) return undefined;
    // Read the label as it is once the autofixes are in; an avoid word waits for its suggestion.
    let fixed = text;
    let floor = Infinity;
    for (const finding of [...findings].sort((a, b) => b.start - a.start)) {
      if (finding.fix?.kind !== "autofix" || finding.end > floor) continue;
      fixed = fixed.slice(0, finding.start) + finding.fix.replace + fixed.slice(finding.end);
      floor = finding.start;
    }
    const lead = /^\s*/.exec(fixed)![0].length;
    const body = fixed.trim();
    const want = applyStyle(styled.style, body, true);
    // Text across lines, or with `{count}` placeholders or `|` plural forms, is a template, not one label.
    if (want === body || /[\r\n{}|]/.test(body)) return undefined;
    const start = /^\s*/.exec(text)![0].length;
    const end = text.trimEnd().length;
    const where = styled.style === "upper" ? "ALL CAPS" : "Title Case";
    return makeFinding(
      "GLOSSLINT_CASE",
      start,
      end,
      text.slice(start, end),
      styled.term,
      `"${body}" is written "${want}": ${kind}s are in ${where}.`,
      lead === start ? { kind: "autofix", replace: want } : undefined,
    );
  }

  function checkIdentifier(text: string): Finding[] {
    const words = identifierWords(text);
    const findings: Finding[] = [];
    const anyGap = () => true;
    // An identifier holds no symbols, so a term such as `C++` never matches one.
    const spelled = (key: string) => {
      const found = lookup(terms, key);
      return found && found.value.mode !== "exact" && !found.value.lead && !found.value.trail
        ? found
        : undefined;
    };
    for (let index = 0; index < words.length;) {
      const hit = longest(text, words, index, termLimit, anyGap, spelled);
      if (!hit) {
        index++;
        continue;
      }
      index = hit.next;
      const written = text.slice(hit.start, hit.end);
      const keys = splitWords(written.slice(0, written.length - hit.suffix.length)).map((word) =>
        word.toLowerCase(),
      );
      if (
        keys.join(" ") === hit.value.words.join(" ") ||
        (isAllCaps(written) && !/[_-]/.test(written))
      )
        continue;
      const separator = separatorOf(written, text, hit.start, hit.end);
      const replace = identifierStyle(hit.value.words, written, separator) + hit.suffix;
      findings.push(
        makeFinding(
          "GLOSSLINT_TERM",
          hit.start,
          hit.end,
          written,
          hit.value.term,
          `Rename "${written}" to "${replace}": the term is "${hit.value.term.term}".`,
          {
            kind: "rename",
            replace,
          },
        ),
      );
    }
    if (!options.identifierAvoid) return findings;
    for (let index = 0; index < words.length;) {
      const hit = longest(text, words, index, avoidLimit, anyGap, (key) => lookup(avoids, key));
      if (!hit) {
        index++;
        continue;
      }
      index = hit.next;
      const written = text.slice(hit.start, hit.end);
      const separator = separatorOf(written, text, hit.start, hit.end);
      const base = identifierStyle(hit.value.entry.words, written, separator);
      const replace = hit.suffix ? plural(base) : base;
      findings.push(
        makeFinding(
          "GLOSSLINT_AVOID",
          hit.start,
          hit.end,
          written,
          hit.value.term,
          `Rename "${written}" to "${replace}".`,
          { kind: "rename", replace },
          hit.value.why ?? hit.value.term.why,
        ),
      );
    }
    return findings;
  }

  function allowed(text: string): Array<[number, number]> {
    const ranges: Array<[number, number]> = [];
    for (const pattern of allow)
      for (const match of text.matchAll(pattern))
        ranges.push([match.index, match.index + match[0].length]);
    return ranges;
  }

  return {
    corpus,
    check(text: string, kind: TextKind = "unknown"): Finding[] {
      const findings = kind === "identifier" ? checkIdentifier(text) : checkText(text, kind);
      const ranges = findings.length > 0 ? allowed(text) : [];
      return findings
        .filter(
          (finding) => !ranges.some(([start, end]) => finding.start >= start && finding.end <= end),
        )
        .sort((a, b) => a.start - b.start || a.code.localeCompare(b.code));
    },
  };
}

/** Finds every problem in `text`, read as `kind` (default `unknown`). */
export function check(matcher: Matcher, text: string, kind?: TextKind): Finding[] {
  return matcher.check(text, kind);
}
