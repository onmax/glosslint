// Writes diglot's per-locale glossary YAML, a `terms:` map of entries. Like the x18n merge it edits the
// parsed file with the `yaml` Document API, and then writes back only the entries it changed, spliced into
// the source by their ranges, so every other entry, the comments, `style` and the line wrapping of a
// hand-kept file stay byte for byte.
import { Document, isMap, isScalar, isSeq, parseDocument, Scalar, stringify, YAMLSeq } from "yaml";
import type { Node, Pair, YAMLMap } from "yaml";
import { matchKey, X18nMergeError } from "./x18n-merge.ts";

/** A diglot decision: keep the term as written, keep it with a gloss, or translate it. */
export type DiglotDecision = "keep" | "keep-gloss" | "translate";

/** One entry of a diglot glossary, `GlossaryEntry` in `@diglot/core`. */
export type DiglotGlossaryEntry = {
  term: string;
  /** A regular expression for the term in the source, used instead of the term itself. */
  match?: string;
  caseSensitive?: boolean;
  note?: string;
} & (
  | { decision: "keep" }
  | { decision: "translate"; target?: string; accept?: string[] }
  | { decision: "keep-gloss"; gloss: string }
);

/** A diglot glossary file, `Glossary` in `@diglot/core`. */
export interface DiglotGlossary {
  terms: DiglotGlossaryEntry[];
  style?: string[];
}

/** One glossary term to merge into a diglot glossary. */
export interface DiglotEntryInput {
  /** The glossary's term, matched against the file's `term`. */
  term: string;
  /** Other source-locale spellings of the term, matched against the file's `term` after the term itself. */
  forms: string[];
  /** The entry to write. */
  entry: DiglotGlossaryEntry;
  /** Whether the glossary sets the entry's `note`. When it doesn't, the file's note stays. */
  ownsNote: boolean;
}

/** What `mergeDiglotGlossary` changed. */
export interface DiglotMergeResult {
  /** The merged file. */
  text: string;
  /** The terms added as new entries, in input order. */
  added: string[];
  /** The entries that changed, by the file's term, with what changed, such as `target` or `decision (was keep)`. */
  updated: { term: string; changes: string[] }[];
  /** The input terms whose entry already said everything. */
  unchanged: string[];
  /** The file's terms whose own `match` was kept over a different one from the input. */
  keptMatch: string[];
}

const YAML_OPTIONS = { lineWidth: 0 } as const;

/** The order a diglot glossary writes an entry's keys in. A new key goes after the ones before it here. */
const KEY_ORDER = [
  "term",
  "match",
  "caseSensitive",
  "note",
  "decision",
  "target",
  "gloss",
  "accept",
] as const;

const text = (node: unknown): string | undefined =>
  isScalar(node) && typeof node.value === "string" ? node.value : undefined;

/** The entry with its keys in diglot's order and without the fields its decision doesn't use. */
function ordered(entry: DiglotGlossaryEntry): Record<string, unknown> {
  const { term, match, caseSensitive, note, decision } = entry;
  return {
    term,
    ...(match === undefined ? {} : { match }),
    ...(caseSensitive === undefined ? {} : { caseSensitive }),
    ...(note === undefined ? {} : { note }),
    decision,
    ...(entry.decision === "translate" && entry.target !== undefined
      ? { target: entry.target }
      : {}),
    ...(entry.decision === "keep-gloss" ? { gloss: entry.gloss } : {}),
    ...(entry.decision === "translate" && entry.accept?.length ? { accept: entry.accept } : {}),
  };
}

/**
 * Merges glossary terms into the text of a diglot glossary YAML file, a `terms:` map of entries, or writes a
 * new file when `text` is undefined. A term matches an entry whose `term` is the same in any case and with
 * hyphens and spaces ignored, trying the term first and then its forms; the entry keeps the file's spelling
 * of `term`. The merge sets the fields the glossary owns: `decision`, `target`, `gloss`, and `note` when
 * `ownsNote`. It removes `target` and `gloss` when the decision no longer uses them, adds `accept` patterns
 * the entry lacks and removes none, and keeps `match` (or its absence, so diglot keeps matching the entry
 * as before), `caseSensitive`, every other key and the file's note otherwise. Only new entries get the
 * generated `match`. Entries the input doesn't match stay as they are, and new terms are added at the end of
 * `terms`. A second merge of the same input changes nothing. Throws an `X18nMergeError`, and merges
 * nothing, when the file is not valid YAML, is not a `terms:` map, or when one term matches two entries or
 * two terms match one entry.
 */
export function mergeDiglotGlossary(
  source: string | undefined,
  entries: readonly DiglotEntryInput[],
): DiglotMergeResult {
  if (source === undefined)
    return {
      text: stringify({ terms: entries.map((input) => ordered(input.entry)) }, YAML_OPTIONS),
      added: entries.map((input) => input.term),
      updated: [],
      unchanged: [],
      keptMatch: [],
    };

  const parsed = parseDocument(source);
  const error = parsed.errors[0];
  if (error) throw new X18nMergeError(`Not valid YAML: ${error.message.split("\n")[0]}`);
  const doc: Document = parsed;
  const root = (doc.contents ??= doc.createNode({}));
  if (isSeq(root))
    throw new X18nMergeError(
      "The file is an x18n glossary, a list of entries, and not a diglot glossary with a `terms:` map.",
      "Merge into the locale's diglot glossary, such as `fr/glossary.yml`, or export without --diglot for the shared x18n file.",
    );
  if (!isMap(root))
    throw new X18nMergeError("The file is not a diglot glossary, a map with `terms:`.");
  const found = root.get("terms", true);
  if (found !== undefined && !isSeq(found))
    throw new X18nMergeError(
      "The file's `terms` is not a list of entries, such as `- term: layer`.",
    );
  const list: YAMLSeq = found ?? (doc.createNode([]) as YAMLSeq);
  if (!found) root.set("terms", list);

  const byTerm = new Map<string, YAMLMap[]>();
  for (const item of list.items) {
    if (!isMap(item)) continue;
    const term = text(item.get("term", true));
    if (term === undefined) continue;
    const key = matchKey(term);
    byTerm.set(key, [...(byTerm.get(key) ?? []), item]);
  }
  const find = (input: DiglotEntryInput): YAMLMap | undefined => {
    for (const keys of [[input.term], input.forms]) {
      const hits = [...new Set(keys.flatMap((key) => byTerm.get(matchKey(key)) ?? []))];
      if (hits.length > 1) {
        const names = hits.map((item) => `"${text(item.get("term", true))}"`);
        throw new X18nMergeError(
          `"${input.term}" matches ${hits.length} entries: ${names.slice(0, -1).join(", ")} and ${names.at(-1)}.`,
          "Merge those entries into one in the file, or rename the term or the form in the glossary that matches the wrong one.",
        );
      }
      if (hits.length === 1) return hits[0];
    }
    return undefined;
  };

  // Every match is found before anything is written, so a bad match fails the whole merge.
  const matches = entries.map((input) => [input, find(input)] as const);
  const claims = new Map<YAMLMap, DiglotEntryInput>();
  for (const [input, map] of matches) {
    if (!map) continue;
    const other = claims.get(map);
    if (other)
      throw new X18nMergeError(
        `"${other.term}" and "${input.term}" both match the entry "${text(map.get("term", true))}".`,
        "Merge those terms into one in the glossary, or remove the form that matches the wrong entry.",
      );
    claims.set(map, input);
  }

  const result: Omit<DiglotMergeResult, "text"> = {
    added: [],
    updated: [],
    unchanged: [],
    keptMatch: [],
  };
  const changed: YAMLMap[] = [];
  const created: Node[] = [];
  for (const [input, map] of matches) {
    if (!map) {
      created.push(doc.createNode(ordered(input.entry)));
      result.added.push(input.term);
      continue;
    }
    const term = text(map.get("term", true))!;
    const match = text(map.get("match", true));
    if (match !== undefined && input.entry.match !== undefined && match !== input.entry.match)
      result.keptMatch.push(term);
    const changes = mergeEntry(doc, map, input);
    if (changes.length > 0) {
      result.updated.push({ term, changes });
      changed.push(map);
    } else result.unchanged.push(input.term);
  }

  return {
    text: splice(source, doc, list, changed, created) ?? whole(doc, list, created),
    ...result,
  };
}

/** Sets the fields the glossary owns on one entry and returns what changed. */
function mergeEntry(doc: Document, map: YAMLMap, input: DiglotEntryInput): string[] {
  const { entry } = input;
  const changes: string[] = [];
  const set = (key: (typeof KEY_ORDER)[number], value: string | boolean | undefined) => {
    const node = map.get(key, true);
    const now = isScalar(node) ? node.value : node;
    if (value === undefined) {
      if (node === undefined) return false;
      map.delete(key);
      return true;
    }
    if (now === value) return false;
    // The scalar keeps its comment and quoting when only its value changes.
    if (isScalar(node)) node.value = value;
    else if (node !== undefined) map.set(key, value);
    else insert(doc, map, key, value);
    return true;
  };

  if (!map.has("caseSensitive") && set("caseSensitive", entry.caseSensitive))
    changes.push("caseSensitive");
  if (input.ownsNote && set("note", entry.note)) changes.push("note");
  const was = text(map.get("decision", true));
  if (set("decision", entry.decision)) changes.push(was ? `decision (was ${was})` : "decision");
  if (set("target", entry.decision === "translate" ? entry.target : undefined))
    changes.push("target");
  if (set("gloss", entry.decision === "keep-gloss" ? entry.gloss : undefined))
    changes.push("gloss");

  const patterns = entry.decision === "translate" ? (entry.accept ?? []) : [];
  if (patterns.length > 0) {
    const node = map.get("accept", true);
    if (node !== undefined && !isSeq(node))
      throw new X18nMergeError(
        `"accept" of "${text(map.get("term", true))}" is not a list of patterns.`,
      );
    const have = new Set(node ? node.items.map(text) : []);
    const missing = [...new Set(patterns)].filter((pattern) => !have.has(pattern));
    if (missing.length > 0) {
      if (node) node.items.push(...missing.map((pattern) => new Scalar(pattern)));
      else insert(doc, map, "accept", missing);
      changes.push("accept");
    }
  }
  return changes;
}

/** Adds a key the entry lacks after the last key that comes before it in `KEY_ORDER`. */
function insert(
  doc: Document,
  map: YAMLMap,
  key: (typeof KEY_ORDER)[number],
  value: unknown,
): void {
  const rank = KEY_ORDER.indexOf(key);
  let at = 0;
  map.items.forEach((pair, index) => {
    const other = KEY_ORDER.indexOf(text(pair.key) as (typeof KEY_ORDER)[number]);
    if (other !== -1 && other < rank) at = index + 1;
  });
  map.items.splice(at, 0, doc.createPair(key, value) as Pair<unknown, unknown>);
}

/**
 * The node as YAML at column 0, without the blank line and comments before and after it, which are outside
 * its range and stay in the source.
 */
function render(node: Node, indentSeq: boolean): string {
  const { commentBefore, spaceBefore, comment } = node;
  node.commentBefore = undefined;
  node.spaceBefore = undefined;
  node.comment = undefined;
  const out = new Document();
  out.contents = node;
  const rendered = out.toString({ ...YAML_OPTIONS, indentSeq });
  node.commentBefore = commentBefore;
  node.spaceBefore = spaceBefore;
  node.comment = comment;
  return rendered;
}

const columnAt = (source: string, offset: number): number =>
  offset - source.lastIndexOf("\n", offset - 1) - 1;

/**
 * The source with each changed entry replaced by its new text and the new entries added after the last one,
 * so nothing else moves. Undefined when `terms` is not a block list of block entries that can be spliced.
 */
function splice(
  source: string,
  doc: Document,
  list: YAMLSeq,
  changed: YAMLMap[],
  created: Node[],
): string | undefined {
  if (list.flow || !list.range || list.items.length === 0) return undefined;
  const first = list.items[0] as Node;
  if (!first.range || !/-[ \t]+$/.test(source.slice(0, first.range[0]))) return undefined;
  const dash = source.lastIndexOf("-", first.range[0]);
  const pairs = isMap(doc.contents) ? doc.contents.items : [];
  const keyNode = pairs.find((pair) => text(pair.key) === "terms")?.key as Node | undefined;
  const indentSeq = !keyNode?.range || columnAt(source, dash) > columnAt(source, keyNode.range[0]);

  const edits: { start: number; end: number; text: string }[] = [];
  for (const map of changed) {
    if (map.flow || !map.range) return undefined;
    const [start, end] = map.range;
    const indent = " ".repeat(columnAt(source, start));
    const trailing = /\n\s*$/.exec(source.slice(start, end))?.[0] ?? "";
    const lines = render(map, indentSeq).replace(/\n$/, "").split("\n");
    const body = lines.map((line, index) => (index === 0 || !line ? line : indent + line));
    edits.push({ start, end, text: body.join("\n") + trailing });
  }
  if (created.length > 0) {
    const last = list.items.at(-1) as Node;
    if (!last.range) return undefined;
    const at = last.range[1];
    const indent = " ".repeat(columnAt(source, dash));
    const seq = new YAMLSeq();
    seq.items.push(...created);
    const lines = render(seq, indentSeq).replace(/\n$/, "").split("\n");
    const body = lines.map((line) => (line ? indent + line : line)).join("\n") + "\n";
    edits.push({ start: at, end: at, text: (source[at - 1] === "\n" ? "" : "\n") + body });
  }
  let out = source;
  for (const edit of edits.toSorted((a, b) => b.start - a.start))
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return out;
}

/** The whole document written again, for a file whose `terms` can't be spliced, such as an empty one. */
function whole(doc: Document, list: YAMLSeq, created: Node[]): string {
  list.items.push(...created);
  return doc.toString(YAML_OPTIONS);
}
