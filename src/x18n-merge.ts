// Writes x18n glossary YAML. The `yaml` package's Document API edits the parsed file in place, so the
// comments, entry order, key order and quoting of a shared glossary survive a merge.
import { isMap, isScalar, isSeq, parseDocument, Scalar, stringify } from "yaml";
import type { Document, Pair, YAMLMap } from "yaml";
import type { X18nGlossaryEntry } from "./types.ts";
import { termKey } from "./words.ts";

/** Options of `mergeX18nGlossary`. */
export interface X18nMergeOptions {
  /** The locale whose `forms` are other spellings of the term itself, used to match entries. Default: `en`. */
  sourceLocale?: string;
}

/** A translation the file already has, kept over a different one from the glossary. */
export interface X18nMergeConflict {
  /** The entry's `term`, as the file writes it. */
  term: string;
  locale: string;
  /** The file's translation, which stays. */
  kept: string;
  /** The glossary's translation, which is not written. */
  dropped: string;
}

/** What `mergeX18nGlossary` changed. */
export interface X18nMergeResult {
  /** The merged file. */
  text: string;
  /** The glossary's terms added as new entries, in glossary order. */
  added: string[];
  /** The entries that got a field, as `{ term, from, fields }`: the file's term, the glossary's term and the fields set. */
  updated: { term: string; from: string; fields: string[] }[];
  /** The glossary's terms whose entry already said everything. */
  unchanged: string[];
  /** Translations kept over the glossary's. */
  conflicts: X18nMergeConflict[];
}

/** Why `mergeX18nGlossary` could not read the file. */
export class X18nMergeError extends Error {
  override name = "X18nMergeError";
}

const YAML_OPTIONS = { lineWidth: 0 } as const;

/** The entries as x18n glossary YAML, with the keys in the order a shared glossary writes them. */
export function stringifyX18nGlossary(entries: readonly X18nGlossaryEntry[]): string {
  return stringify(entries.map(ordered), YAML_OPTIONS);
}

function ordered(entry: X18nGlossaryEntry): X18nGlossaryEntry {
  const { term, note, translations, forms, doNotTranslate } = entry;
  return {
    term,
    ...(note === undefined ? {} : { note }),
    ...(translations === undefined ? {} : { translations }),
    ...(forms === undefined ? {} : { forms }),
    ...(doNotTranslate === undefined ? {} : { doNotTranslate }),
  };
}

const text = (node: unknown): string | undefined =>
  isScalar(node) && typeof node.value === "string" ? node.value : undefined;

/** The source-locale forms of an entry, as keys. */
function formKeys(map: YAMLMap, locale: string): string[] {
  const forms = map.get("forms");
  if (!isMap(forms)) return [];
  const list = forms.get(locale);
  return isSeq(list) ? list.items.flatMap((item) => text(item) ?? []).map(termKey) : [];
}

/**
 * Merges glossary entries into the text of an x18n glossary YAML file, a list of `{ term, … }` maps.
 * An entry matches one in the file when the two share a term or a source-locale form, in any case and with
 * hyphens and spaces ignored, so "Prerendering" matches "prerendering", and "Prerender" with the form
 * "prerendering" matches it too. A match keeps the file's `term` and every field and translation it has:
 * the glossary sets `note`, adds `doNotTranslate: true`, adds translations for locales the entry lacks, and
 * adds forms the entry lacks. Every other entry is added at the end. Comments and order are kept.
 */
export function mergeX18nGlossary(
  source: string,
  entries: readonly X18nGlossaryEntry[],
  options: X18nMergeOptions = {},
): X18nMergeResult {
  const locale = options.sourceLocale ?? "en";
  const parsed = parseDocument(source);
  const error = parsed.errors[0];
  if (error) throw new X18nMergeError(`Not valid YAML: ${error.message.split("\n")[0]}`);
  // Widened from a parsed document, whose contents can't take the list an empty file needs.
  const doc: Document = parsed;
  const list = (doc.contents ??= doc.createNode([]));
  if (!isSeq(list))
    throw new X18nMergeError("The file is not a list of glossary entries, such as `- term: Nuxt`.");

  // A term wins over a form: "prerendering" the entry beats "prerendering" a form of another entry.
  const byTerm = new Map<string, YAMLMap>();
  const byForm = new Map<string, YAMLMap>();
  for (const item of list.items) {
    if (!isMap(item)) continue;
    const term = text(item.get("term", true));
    if (term === undefined) continue;
    if (!byTerm.has(termKey(term))) byTerm.set(termKey(term), item);
    for (const key of formKeys(item, locale)) if (!byForm.has(key)) byForm.set(key, item);
  }
  const find = (entry: X18nGlossaryEntry): YAMLMap | undefined => {
    const keys = [entry.term, ...(entry.forms?.[locale] ?? [])].map(termKey);
    for (const map of [byTerm, byForm])
      for (const key of keys) if (map.has(key)) return map.get(key);
    return undefined;
  };

  const result: Omit<X18nMergeResult, "text"> = {
    added: [],
    updated: [],
    unchanged: [],
    conflicts: [],
  };
  for (const entry of entries) {
    const map = find(entry);
    if (!map) {
      list.items.push(doc.createNode(ordered(entry)));
      result.added.push(entry.term);
      continue;
    }
    const term = text(map.get("term", true))!;
    const fields = mergeEntry(doc, map, entry, (local, kept, dropped) =>
      result.conflicts.push({ term, locale: local, kept, dropped }),
    );
    if (fields.length > 0) result.updated.push({ term, from: entry.term, fields });
    else result.unchanged.push(entry.term);
  }
  return { text: doc.toString(YAML_OPTIONS), ...result };
}

/** Sets the fields the glossary owns on one entry and returns their names. */
function mergeEntry(
  doc: Document,
  map: YAMLMap,
  entry: X18nGlossaryEntry,
  conflict: (locale: string, kept: string, dropped: string) => void,
): string[] {
  const fields: string[] = [];
  if (entry.note !== undefined && text(map.get("note", true)) !== entry.note) {
    if (map.has("note")) map.set("note", entry.note);
    else {
      // A new note goes right after the term, where a shared glossary writes it.
      const at = map.items.findIndex((pair) => text(pair.key) === "term") + 1;
      map.items.splice(at, 0, doc.createPair("note", entry.note) as Pair<unknown, unknown>);
    }
    fields.push("note");
  }
  // An entry the file translates is not marked untranslatable because the glossary has no translations.
  if (entry.doNotTranslate && map.get("doNotTranslate") !== true && !map.has("translations")) {
    map.set("doNotTranslate", true);
    fields.push("doNotTranslate");
  }
  const translations = Object.entries(entry.translations ?? {}).filter(([locale, value]) => {
    const kept = text(localeMap(map, "translations")?.get(locale, true));
    if (kept !== undefined && kept !== value) conflict(locale, kept, value);
    return kept === undefined;
  });
  if (translations.length > 0) {
    const target = child(doc, map, "translations");
    for (const [locale, value] of translations) target.set(locale, value);
    fields.push("translations");
  }
  const forms = Object.entries(entry.forms ?? {}).flatMap(([locale, values]) => {
    const seq = localeMap(map, "forms")?.get(locale, true);
    const have = new Set(isSeq(seq) ? seq.items.map(text) : []);
    const missing = values.filter((value) => !have.has(value));
    return missing.length > 0 ? [[locale, missing] as const] : [];
  });
  if (forms.length > 0) {
    const target = child(doc, map, "forms");
    for (const [locale, values] of forms) {
      const seq = target.get(locale, true);
      if (isSeq(seq)) seq.items.push(...values.map((value) => new Scalar(value)));
      else target.set(locale, doc.createNode(values));
    }
    fields.push("forms");
  }
  return fields;
}

/** The entry's `translations` or `forms` map, when it has one. */
function localeMap(map: YAMLMap, key: string): YAMLMap | undefined {
  const found = map.get(key, true);
  return isMap(found) ? found : undefined;
}

/** The entry's `translations` or `forms` map, created when it has none. */
function child(doc: Document, map: YAMLMap, key: string): YAMLMap {
  const found = map.get(key, true);
  if (isMap(found)) return found;
  if (found !== undefined)
    throw new X18nMergeError(
      `"${key}" of "${text(map.get("term", true))}" is not a map of locales.`,
    );
  const created = doc.createNode({}) as YAMLMap;
  map.set(key, created);
  return created;
}
