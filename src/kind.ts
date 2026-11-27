import type { CaseMode, KindOf, KindSite, Term, TextKind } from "./types.ts";
import { isTitled, splitWords } from "./words.ts";

const LABEL_WORD = /^(?:label|(?:sub)?title|button|tab|(?:sub)?heading)s?$/;
const HEADER_WORD = /^(?:header|column|col|th)s?$/;
const SENTENCE_WORD =
  /^(?:description|tooltip|text|message|intro|outro|hint|explanation|body|help)s?$/;
const HEADING_TAG = /^h[1-6]$/i;

/** First words that open a sentence rather than a label, as in "There are no rides". English only. */
const SENTENCE_OPENER =
  /^(?:there|this|that|these|those|it|you|we|they|i|is|are|was|were|do|does|did|can|could|will|would|should|has|have)$/i;

/** The kind a site's name gives it, with a closing stop always making a sentence. */
function byName(name: string | undefined, text: string): TextKind {
  const trimmed = text.trim();
  const endsSentence = /[.!?]$/.test(trimmed);
  // Whole words of the key, so `tableHint` is no tab and `rename` no name; `title1` is a title and `h2` a heading.
  const words = splitWords(name ?? "").map((word) =>
    HEADING_TAG.test(word) ? "heading" : word.toLowerCase().replace(/\d+$/, ""),
  );
  const last = words.at(-1) ?? "";
  const header = words.some((word) => HEADER_WORD.test(word));
  // The last word names the text, so `headerTooltip` is the header's tooltip, not a header.
  if (SENTENCE_WORD.test(last)) return "sentence";
  if (
    (header || words.some((word) => LABEL_WORD.test(word)) || last === "name") &&
    !endsSentence &&
    splitWords(trimmed).length <= 7
  )
    return header ? "header" : "label";
  if (words.some((word) => SENTENCE_WORD.test(word)) || endsSentence) return "sentence";
  return "unknown";
}

/**
 * Whether a key or prop holds text people read, from its words alone: `title`, `cardLabel` and `name`
 * do, `to`, `icon` and `className` don't.
 */
export function isTextName(name: string): boolean {
  const words = splitWords(name).map((word) => word.toLowerCase().replace(/\d+$/, ""));
  return (
    name === "name" ||
    words.some(
      (word) => LABEL_WORD.test(word) || HEADER_WORD.test(word) || SENTENCE_WORD.test(word),
    )
  );
}

/**
 * The kind of shown text from its shape alone: a label when it is a few words that don't open like a
 * sentence, or when it is written in Title Case, else a sentence.
 */
function byShape(text: string): TextKind {
  const trimmed = text.trim().replace(/:$/, "");
  const words = trimmed.split(/\s+/);
  const short = words.length <= 4 && !SENTENCE_OPENER.test(words[0]!);
  return short || isTitled(trimmed.replace(/\([^)]*\)/g, "")) ? "label" : "sentence";
}

/** A site's kind, and whether its shape alone decided it, so a fix there needs a person. */
export interface Classified {
  kind: TextKind;
  guessed: boolean;
}

/** Decides a site's kind: `custom` first, then the site's name, then, for shown text, its shape. */
export function classify(site: KindSite, custom?: KindOf): Classified {
  const own = custom?.(site);
  if (own !== undefined) return { kind: own, guessed: false };
  const named = byName(site.name, site.text);
  if (named !== "unknown" || !site.shown) return { kind: named, guessed: false };
  return { kind: byShape(site.text), guessed: true };
}

/**
 * glosslint's default kind for a string: from its key, attribute or element name, else from a closing
 * stop, else, when `shown` is set, from its length and capitals. Every adapter uses it unless its
 * `kindOf` option decides first.
 */
export function kindOf(site: KindSite): TextKind {
  return classify(site).kind;
}

/** How a term's capitals are checked: its `case`, else `context` when it sets `casing`, else `spelling`. */
export function caseModeOf(term: Term): CaseMode {
  return term.case ?? (term.casing ? "context" : "spelling");
}
