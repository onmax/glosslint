import { splitByCase } from "scule";

const SEPARATORS = [" ", "\t", "\n", "-", "‐", "‑", "_", "/", "."] as const;

/** Splits text or an identifier into words: `dayPass`, `day-pass` and `day pass` all give day, pass. */
export function splitWords(text: string): string[] {
  return splitByCase(text.trim(), SEPARATORS).filter((word) => word.length > 0);
}

/** A term's key: its words joined and lowercased, letters and digits only, so `Re-charge point` and `recharge point` share one. */
export function termKey(text: string): string {
  return splitWords(text)
    .join("")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** A word of checked text, with its offsets in the original string. */
export interface Token {
  /** The word as written, such as `Dock` or `Node.js`. */
  word: string;
  /** The word's letters and digits, lowercased. */
  key: string;
  start: number;
  end: number;
}

/**
 * Starts a reason that opens a sentence with a capital, so "riders confuse it" reads "Riders confuse it". A
 * first word with a capital of its own, such as `eBike`, stays as written.
 */
export function capitalise(text: string): string {
  return text.replace(
    /^(\s*)(\p{Ll})(?=[\p{Ll}\p{N}'’-]*(?![\p{L}\p{N}]))/u,
    (_, space: string, letter: string) => space + letter.toUpperCase(),
  );
}

/** A word of shown text, for case styles: a letter, then letters, digits, periods and apostrophes. */
export const WORD = /\p{L}[\p{L}\p{N}.'’]*/gu;

/** English words that Title Case leaves lowercase past a label's first word. */
export const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "per",
  "the",
  "to",
  "via",
  "vs",
  "with",
]);

export const isUpper = (char: string): boolean =>
  char !== char.toLowerCase() && char === char.toUpperCase();

/** Whether every word but a small one past the first starts with a capital, as "Buy a Day Pass" does. */
export function isTitled(text: string): boolean {
  const words = text.match(WORD) ?? [];
  return (
    words.length > 1 &&
    words.every((word, index) => isUpper(word.charAt(0)) || (index > 0 && SMALL_WORDS.has(word)))
  );
}

/** Characters allowed between the words of one term: spaces, hyphens and underscores. */
export const WORD_GAP = /^[\s\-‐‑_]+$/;

const TOKEN = /[\p{L}\p{N}](?:[\p{L}\p{N}.]*[\p{L}\p{N}])?/gu;
const APOSTROPHE = /['’]/;
const PLACEHOLDER =
  /\{\{[\s\S]*?\}\}|\{\s*[\p{L}\p{N}_$.-]+\s*(?:,\s*(?:number|date|time)[^{}]*)?\}/gu;
const ICU_HEAD = /\{\s*[\p{L}\p{N}_$.-]+\s*,\s*(?:plural|select|selectordinal)\s*,/gu;
const ICU_BRANCH = /(?:=\d+|[\p{L}\p{N}_]+)\s*\{|[{}#]/gu;
const URL =
  /\b[a-z][a-z\d+.-]*:\/\/[^\s<>"'`)\]]*|\bwww\.[^\s<>"'`)\]]+|\bmailto:[^\s<>"'`)\]]+/giu;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu;
const BACKTICKS = /(`+)[\s\S]*?\1/gu;
/** A vue-i18n linked message, such as `@:common.save`, `@.lower:common.save` or `@:{'common.save'}`. */
const LINKED = /@(?:\.\p{L}+)?:(?:\{\s*'(?:[^'\\]|\\.)*'\s*\}|[\p{L}\p{N}_$.-]+)/gu;
/** An npm scoped package, such as `@nuxt/kit`, also after a Markdown escape (`\\@nuxt/kit`). */
const SCOPED_PACKAGE =
  /(?<![\p{L}\p{N}_.@])@[\p{L}\p{N}][\p{L}\p{N}_.~-]*\/[\p{L}\p{N}][\p{L}\p{N}_.~-]*/gu;
/** A repository issue or ref, such as `nuxt/nuxt#18395` or `nuxt/nuxt@v3`. */
const REPO_REF =
  /(?<![\p{L}\p{N}_./@-])[\p{L}\p{N}][\p{L}\p{N}_.-]*\/[\p{L}\p{N}_.-]+(?:#\d+|@[\p{L}\p{N}_.-]*[\p{L}\p{N}])/gu;
/** One pass, so the span that starts first wins: a URL keeps a package inside it, an email its `www.` domain. */
const CODE_SPAN = new RegExp(
  [URL, LINKED, REPO_REF, SCOPED_PACKAGE, EMAIL].map((pattern) => pattern.source).join("|"),
  "giu",
);
const PATH = /(?<![\p{L}\p{N}.~])(?:\.{1,2}|~)?\/[\p{L}\p{N}_.~/-]+/gu;
const CHUNK = /[\p{L}\p{N}_]+(?:[-.][\p{L}\p{N}_]+)*/gu;
const CAMEL = /\p{Ll}\p{Lu}/u;
const SLUG = /^[\p{Ll}\p{N}]+(?:-[\p{Ll}\p{N}]+)+$/u;
const PATH_EDGE = /[/#@=]/;

function blank(text: string, start: number, end: number): string {
  return text.slice(0, start) + " ".repeat(end - start) + text.slice(end);
}

function blankAll(text: string, pattern: RegExp): string {
  return text.replace(pattern, (match) => " ".repeat(match.length));
}

/**
 * Blanks an ICU message's syntax and keeps the words of its branches, such as `docks` in
 * `{n, plural, other {# docks}}`. Odd brace depth is an argument, even depth is branch text.
 * Returns undefined when the braces don't balance.
 */
function maskIcu(text: string): string | undefined {
  let depth = 0;
  let out = "";
  for (const char of text) {
    if (char === "{") depth++;
    else if (char === "}" && --depth < 0) return undefined;
    const keep = char !== "{" && char !== "}" && (depth === 0 || (depth % 2 === 0 && char !== "#"));
    out += keep ? char : " ".repeat(char.length);
  }
  return depth === 0 ? out : undefined;
}

/** Whether a token with this key is spared from masking because it names an exact term, singular or plural. */
function isKept(key: string, keep: ReadonlySet<string>): boolean {
  return (
    keep.has(key) ||
    (key.endsWith("s") && keep.has(key.slice(0, -1))) ||
    (key.endsWith("es") && keep.has(key.slice(0, -2)))
  );
}

/**
 * Blanks out what is code rather than words, keeping every offset: placeholders, linked messages, URLs,
 * paths, backtick code, scoped packages, repository refs, and camel, snake and slug tokens unless their
 * key is in `keep`.
 */
export function mask(text: string, keep: ReadonlySet<string> = new Set()): string {
  let out = blankAll(text, BACKTICKS);
  out = blankAll(out, CODE_SPAN);
  out = blankAll(out, PATH);
  if (out.search(ICU_HEAD) !== -1) {
    const icu = maskIcu(out);
    if (icu !== undefined) out = icu;
    else {
      out = blankAll(out, ICU_HEAD);
      out = blankAll(out, ICU_BRANCH);
    }
  }
  out = blankAll(out, PLACEHOLDER);
  for (const match of out.matchAll(CHUNK)) {
    const chunk = match[0];
    const start = match.index;
    const end = start + chunk.length;
    if (chunk.includes("_")) {
      if (!isKept(termKey(chunk), keep)) out = blank(out, start, end);
      continue;
    }
    const slugLike =
      SLUG.test(chunk) &&
      (chunk.split("-").length >= 3 ||
        PATH_EDGE.test(text[start - 1] ?? "") ||
        PATH_EDGE.test(text[end] ?? ""));
    if (slugLike) {
      if (!isKept(termKey(chunk), keep)) out = blank(out, start, end);
      continue;
    }
    let offset = start;
    for (const part of chunk.split(/([-.])/)) {
      if (CAMEL.test(part) && !isKept(termKey(part), keep))
        out = blank(out, offset, offset + part.length);
      offset += part.length;
    }
  }
  return out;
}

/**
 * The words of `text` with their offsets, after `mask`. A word right after an apostrophe that follows
 * a letter, such as the `s` of a possessive or the `t` of `don't`, never forms a token.
 */
export function tokenize(text: string, keep: ReadonlySet<string> = new Set()): Token[] {
  const masked = mask(text, keep);
  const tokens: Token[] = [];
  for (const match of masked.matchAll(TOKEN)) {
    const start = match.index;
    if (APOSTROPHE.test(text[start - 1] ?? "") && /\p{L}/u.test(text[start - 2] ?? "")) continue;
    const word = match[0];
    tokens.push({
      word,
      key: word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""),
      start,
      end: start + word.length,
    });
  }
  return tokens;
}

/** A string with no spaces, all in lowercase, shaped like a key, slug, path or single code word. */
const LOWER_SHAPE = /^[\p{Ll}\p{N}_\-./:#@~]+$/u;
/** A camelCase name, such as a column id. Capitalised words and hyphenated labels don't match. */
const CAMEL_SHAPE = /^\p{Ll}[\p{Ll}\p{N}]*\p{Lu}[\p{L}\p{N}_\-./:]*$/u;
/** A dotted path of names that each start in lowercase, such as the i18n key `alarm.activeAlarms`. */
const PATH_SHAPE = /^\p{Ll}[\p{L}\p{N}_$-]*(?:\.[\p{Ll}\p{N}_$][\p{L}\p{N}_$-]*)+$/u;

/**
 * A line of JS source: a statement keyword, an object property, a member access called, indexed
 * or assigned, a line of brackets, or a line that opens a block or ends a statement. Sentences don't.
 */
const SOURCE_LINES = [
  /^(?:import\s*[{*'"]|import\s+[\w$]+\s*(?:,|from\s*['"])|export\s+(?:(?:default|const|let|function|class|async)\b|[{*]))/u,
  /^(?:const|let|var)\s+[\w${}[\],\s]+=/u,
  /^(?:if|for|while|switch)\s*\(/u,
  /^[\p{Ll}_$][\w$]*:\s*(?:.*,|'[^']*'|"[^"]*"|[\w$.]+)$/u,
  /^[\p{Ll}_$][\w$]*(?:\.[\w$]+)+(?:[([]|\s*=(?!=))/u,
  /^[\s()[\]{},;]+$/u,
  /(?:[{([;]|=>)$/u,
];

/** Whether every line of a text is a line of JS source, as in a module a template writes to disk. */
function isSource(text: string): boolean {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.length > 0 && lines.every((line) => SOURCE_LINES.some((pattern) => pattern.test(line)))
  );
}

/** Whether a JS string, attribute or prop value is shaped like code, so it is skipped (decision 7). */
export function isCodeShape(text: string): boolean {
  return (
    LOWER_SHAPE.test(text) || CAMEL_SHAPE.test(text) || PATH_SHAPE.test(text) || isSource(text)
  );
}
