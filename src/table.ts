import { readFileSync } from "node:fs";
import { GlosslintConfigError } from "./errors.ts";
import type { Avoid, Corpus, Link, Term } from "./types.ts";

/** Header names to read instead of the defaults, matched in any case. */
export interface GlossaryTableColumns {
  /** The terms to use. Default `Use`, else `Term`. */
  term?: string;
  /** The words to avoid. Default `Avoid`. */
  avoid?: string;
  /** How the term differs from near ones, read as `nuance`. Default `Notes`. */
  notes?: string;
  /** What the term means. Default `Description`, else `Meaning`. */
  description?: string;
  /** Links to pages about the term. Default `Links`. */
  links?: string;
}

type Role = keyof GlossaryTableColumns;

const defaults: Record<Role, string[]> = {
  term: ["use", "term"],
  avoid: ["avoid"],
  notes: ["notes"],
  description: ["description", "meaning"],
  links: ["links"],
};

const delimiterRow = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const fence = /^\s*(`{3,}|~{3,})/;
const markdownLink = /\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)|<(https?:\/\/[^>\s]+)>/g;
const empty = /^[-–—]?$/;

/**
 * Reads the first Markdown table with a `Use` or `Term` column as a corpus.
 *
 * - `Avoid` becomes the first term's avoid list; `word (reason)` gives the reason.
 * - `Notes` becomes `nuance`, and `Description` or `Meaning` becomes `description`.
 * - Top-level commas split a cell, and `Term (ABBR, ABBR2)` gives the term and its `abbr`.
 * - A term with an inner capital or all capitals, or whose notes say lowercase, is `exact`.
 * - Markdown links in any cell, and URLs in a `Links` column, become `links`.
 */
export function fromGlossaryTable(path: string | URL, columns: GlossaryTableColumns = {}): Corpus {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const table = findTable(lines, columns);
  if (!table) {
    throw new GlosslintConfigError({
      code: "GLOSSLINT_NO_GLOSSARY_TABLE",
      why: `No Markdown table in ${String(path)} has a ${columns.term ?? "Use or Term"} column.`,
      fix: "Add a table whose header names the term column, or pass its name in `columns.term`.",
    });
  }

  const terms = new Map<string, Term>();
  for (const cells of table.rows) {
    const cell = (role: Role) => {
      const index = table.index[role];
      return index === undefined ? "" : (cells[index] ?? "").trim();
    };
    const links: Link[] = [];
    const take = (role: Role) => extractLinks(cell(role), links);
    for (const url of take("links").match(/https?:\/\/[^\s,<>)]+/g) ?? []) {
      if (!links.some((link) => link.url === url)) links.push({ title: url, url });
    }
    const termCell = take("term");
    const description = clean(take("description"));
    const nuance = clean(take("notes"));

    const avoid = splitTopLevel(take("avoid")).map(toAvoid);
    const exactByNotes = /\blower[\s-]?case\b/i.test(nuance);
    splitTopLevel(termCell).forEach((part, i) => {
      const { name, abbr, extra } = parseName(part);
      if (!name) return;
      const term: Term = { term: name };
      if (description) term.description = description;
      const termNuance = [extra, nuance].filter(Boolean).join(" ");
      if (termNuance) term.nuance = termNuance;
      if (abbr.length) term.abbr = abbr;
      if (i === 0 && avoid.length) term.avoid = avoid;
      if (links.length) term.links = dedupeLinks(links);
      if (exactByNotes || isExactName(name)) term.case = "exact";
      const key = termKey(name);
      if (terms.has(key)) {
        throw new GlosslintConfigError({
          code: "GLOSSLINT_DUPLICATE_TERM",
          why: `The glossary table in ${String(path)} lists the term twice.`,
          fix: "Merge the two rows into one.",
          term: name,
        });
      }
      terms.set(key, term);
    });
  }

  return { kind: "glosslint.corpus", terms: [...terms.values()], allow: [] };
}

interface Table {
  index: Partial<Record<Role, number>>;
  rows: string[][];
}

function findTable(lines: string[], columns: GlossaryTableColumns): Table | undefined {
  let inFence: string | undefined;
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i] ?? "";
    const open = fence.exec(line)?.[1];
    if (open) {
      if (!inFence) inFence = open;
      else if (open[0] === inFence[0] && open.length >= inFence.length) inFence = undefined;
      continue;
    }
    if (inFence || !line.includes("|") || !delimiterRow.test(lines[i + 1] ?? "")) continue;

    const header = splitRow(line).map((cell) => clean(cell).toLowerCase());
    const index: Table["index"] = {};
    for (const role of Object.keys(defaults) as Role[]) {
      const names = columns[role] ? [columns[role].toLowerCase()] : defaults[role];
      const found = names.map((name) => header.indexOf(name)).find((at) => at >= 0);
      if (found !== undefined) index[role] = found;
    }
    if (index.term === undefined) continue;

    const rows: string[][] = [];
    for (let j = i + 2; j < lines.length; j++) {
      const row = lines[j] ?? "";
      if (!row.trim() || !row.includes("|")) break;
      rows.push(splitRow(row));
    }
    return { index, rows };
  }
  return undefined;
}

/** Splits a table row on pipes that are not escaped, and unescapes `\|`. */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "\\" && line[i + 1] === "|") {
      current += "|";
      i++;
    } else if (char === "|") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  if (line.trimStart().startsWith("|")) cells.shift();
  if (line.trimEnd().endsWith("|") && !line.trimEnd().endsWith("\\|")) cells.pop();
  return cells.map((cell) => cell.trim());
}

/** Splits on commas outside parentheses and inline code. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inCode = false;
  let current = "";
  for (const char of text) {
    if (char === "`") inCode = !inCode;
    else if (!inCode && char === "(") depth++;
    else if (!inCode && char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0 && !inCode) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.map(clean).filter((part) => !empty.test(part));
}

/** Replaces Markdown links with their text, collecting them into `links`. */
function extractLinks(text: string, links: Link[]): string {
  return text.replace(markdownLink, (_, title: string | undefined, url: string, bare: string) => {
    const href = url ?? bare;
    const label = clean(title ?? href);
    links.push({ title: label || href, url: href });
    return title ?? href;
  });
}

/** Drops inline-code backticks and bold or italic markers around the whole cell. */
function clean(text: string): string {
  let out = text.trim().replace(/`([^`]*)`/g, "$1");
  for (const mark of ["**", "__", "*", "_"]) {
    if (out.length > 2 * mark.length && out.startsWith(mark) && out.endsWith(mark)) {
      out = out.slice(mark.length, -mark.length).trim();
    }
  }
  return empty.test(out) ? "" : out;
}

/**
 * `Day Pass (DP, D)` gives the name and its abbreviations: single words that are one capital or hold a
 * capital after their first letter. Other parentheses, such as `(kiosk)` or `(Kiosk)`, are a note that goes to `extra` and from there to `nuance`.
 */
function parseName(part: string): { name: string; abbr: string[]; extra: string } {
  const match = /^(.*?)\s*\(([^()]*)\)$/.exec(part);
  if (!match) return { name: part, abbr: [], extra: "" };
  const name = clean(match[1] ?? "");
  const inner = splitTopLevel(match[2] ?? "");
  if (
    inner.length &&
    inner.every((item) => /^\S+$/.test(item) && /^.+\p{Lu}|^\p{Lu}[^\p{L}\p{N}]*$/u.test(item))
  ) {
    return { name, abbr: inner, extra: "" };
  }
  return { name, abbr: [], extra: sentence(clean(match[2] ?? "")) };
}

function toAvoid(part: string): string | Avoid {
  const match = /^(.*?)\s*\(([^()]+)\)$/.exec(part);
  if (!match?.[1]) return part;
  return { word: clean(match[1]), why: sentence(clean(match[2] ?? "")) };
}

function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** A capital right after a letter: an inner capital, like `eBike`, or all capitals, like `SOS`. */
function isExactName(name: string): boolean {
  return (
    /\p{L}\p{Lu}/u.test(name) || (name.length > 1 && /\p{Lu}/u.test(name) && !/\p{Ll}/u.test(name))
  );
}

function termKey(name: string): string {
  return name.toLowerCase().replace(/[\s._-]+/g, "");
}

function dedupeLinks(links: Link[]): Link[] {
  return links.filter((link, i) => links.findIndex((other) => other.url === link.url) === i);
}
