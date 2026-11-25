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

/** Characters allowed between the words of one term: spaces, hyphens and underscores. */
export const WORD_GAP = /^[\s\-‐‑_]+$/;

const TOKEN = /[\p{L}\p{N}](?:[\p{L}\p{N}.]*[\p{L}\p{N}])?/gu;
const APOSTROPHE = /['’]/;
const PLACEHOLDER =
  /\{\{[\s\S]*?\}\}|\{\s*[\p{L}\p{N}_$.-]+\s*(?:,\s*(?:number|date|time)[^{}]*)?\}/gu;
const ICU_HEAD = /\{\s*[\p{L}\p{N}_$.-]+\s*,\s*(?:plural|select|selectordinal)\s*,/gu;
const ICU_BRANCH = /(?:=\d+|[\p{L}\p{N}_]+)\s*\{|[{}#]/gu;
const URL =
  /\b[a-z][a-z\d+.-]*:\/\/[^\s<>"'`)\]]*|\bwww\.[^\s<>"'`)\]]+|\bmailto:[^\s<>"'`)\]]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+/giu;
const BACKTICKS = /(`+)[\s\S]*?\1/gu;
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

/** Whether a token with this key is spared from masking because it names an exact term, singular or plural. */
function isKept(key: string, keep: ReadonlySet<string>): boolean {
  return (
    keep.has(key) ||
    (key.endsWith("s") && keep.has(key.slice(0, -1))) ||
    (key.endsWith("es") && keep.has(key.slice(0, -2)))
  );
}

/**
 * Blanks out what is code rather than words, keeping every offset: placeholders, URLs, paths, backtick
 * code, and camel, snake and slug tokens unless their key is in `keep`.
 */
export function mask(text: string, keep: ReadonlySet<string> = new Set()): string {
  let out = blankAll(text, BACKTICKS);
  out = blankAll(out, URL);
  out = blankAll(out, PATH);
  if (out.search(ICU_HEAD) !== -1) {
    // Keep the words of each ICU branch, such as `# docks` in `{n, plural, other {# docks}}`.
    out = blankAll(out, ICU_HEAD);
    out = blankAll(out, ICU_BRANCH);
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
