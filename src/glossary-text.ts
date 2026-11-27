// The glossary format without a file system, so a browser can read a glossary too. `glossary.ts` adds the file.
import { defineCorpus, distance, nearest } from "./corpus.ts";
import inclusive from "./presets/inclusive.ts";
import tech from "./presets/tech.ts";
import { testCorpus } from "./tools.ts";
import type {
  Avoid,
  CaseMode,
  Casing,
  CasingKind,
  CaseStyle,
  Corpus,
  Link,
  Term,
} from "./types.ts";
import { termKey } from "./words.ts";

/** One problem `readGlossary` found in a glossary file. */
export interface GlossaryProblem {
  /** A stable code, `GLOSSLINT_G001` to `GLOSSLINT_G009`. */
  code: string;
  /** The 1-based line the problem is on. */
  line: number;
  /** What is wrong. */
  why: string;
  /** What to change, or what `glosslint doctor --fix` changes. */
  fix: string;
  /** Whether `glosslint doctor --fix` rewrites it (`G001` to `G003`). */
  fixable: boolean;
  /** The term the problem is in, when it is in one. */
  term?: string;
}

/** The codes of `GlossaryProblem`. */
export const GLOSSARY_PROBLEMS = {
  title: "GLOSSLINT_G001",
  fieldName: "GLOSSLINT_G002",
  layout: "GLOSSLINT_G003",
  noPlace: "GLOSSLINT_G004",
  twice: "GLOSSLINT_G005",
  badValue: "GLOSSLINT_G006",
  badHeading: "GLOSSLINT_G007",
  avoidIsTerm: "GLOSSLINT_G008",
  failingExample: "GLOSSLINT_G009",
} as const;

const P = GLOSSARY_PROBLEMS;
const FIXABLE: ReadonlySet<string> = new Set([P.title, P.fieldName, P.layout]);
/** The problems that leave no corpus: `G004` to `G008`. */
export const BLOCKING: ReadonlySet<string> = new Set([
  P.noPlace,
  P.twice,
  P.badValue,
  P.badHeading,
  P.avoidIsTerm,
]);

/** Where `fromGlossary` looks when it is given no path. */
export const DEFAULT_GLOSSARY = ".agents/glossary.md";

type FieldKind = "text" | "list" | "value";
interface FieldSpec {
  name: string;
  kind: FieldKind;
  /** Whether the field also takes a comma list on its own line. */
  comma?: boolean;
}

const CORPUS_FIELDS: readonly FieldSpec[] = [
  { name: "Presets", kind: "list", comma: true },
  { name: "Allow", kind: "list", comma: true },
  { name: "Casing", kind: "list", comma: true },
];
const TERM_FIELDS: readonly FieldSpec[] = [
  { name: "What", kind: "text" },
  { name: "How", kind: "text" },
  { name: "Why", kind: "text" },
  { name: "Avoid", kind: "list", comma: true },
  { name: "Good", kind: "list" },
  { name: "Bad", kind: "list" },
  { name: "Links", kind: "list" },
  { name: "Case", kind: "value" },
  { name: "Casing", kind: "list", comma: true },
  { name: "Translations", kind: "list", comma: true },
  { name: "Forms", kind: "list" },
];
const ALIASES: Record<string, string> = {
  extends: "Presets",
  description: "What",
  meaning: "What",
  notes: "How",
  nuance: "How",
  see: "Links",
  related: "Links",
  "related links": "Links",
};
const PRESETS: Record<string, Corpus> = { tech, inclusive };
const FIELD_NAMES = new Set([
  ...[...CORPUS_FIELDS, ...TERM_FIELDS].map((spec) => spec.name.toLowerCase()),
  ...Object.keys(ALIASES),
]);
const CASE_MODES: readonly CaseMode[] = ["exact", "spelling", "context"];
const CASING = /^(label|header|sentence)\s+(title|sentence|lower|upper|as-written)$/;
/** A BCP 47 tag such as `fr`, `de` or `pt-BR`. */
const LOCALE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
/** The fields whose items are `locale: value`. */
const LOCALE_FIELDS: ReadonlySet<string> = new Set(["Translations", "Forms"]);

const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ITEM = /^ {0,3}([-*+])(?:[ \t]+(.*))?$/;
const TABLE = /^ {0,3}\|/;
const COMMENT = /^ {0,3}<!--/;
const FIELD = /^ {0,3}([A-Za-z]+(?: [A-Za-z]+){0,2}):(?:[ \t]+(.*))?$/;
const LINK = /^\[([^\]]*\S[^\]]*)\]\((https?:\/\/[^\s()]+)\)$/;
const BARE_URL = /^<?(https?:\/\/[^\s<>()]+)>?$/;

/**
 * Whether a line starts a field: a field name or alias of the corpus or a term, in any case, then `:`.
 * A word of four or more letters one edit from a name, such as `Avod:`, starts one too, so a typo is
 * reported instead of joining the field above it.
 */
function isFieldLine(line: string): boolean {
  const name = FIELD.exec(line)?.[1]?.toLowerCase();
  if (name === undefined) return false;
  if (FIELD_NAMES.has(name)) return true;
  return /^[a-z]{4,}$/.test(name) && [...FIELD_NAMES].some((field) => distance(name, field) <= 1);
}

interface Item {
  line: number;
  bullet: string;
  /** The text after the bullet, then each continuation line, trimmed. */
  lines: string[];
}

interface Block {
  kind: "h1" | "h2" | "heading" | "paragraph" | "list" | "table" | "fence" | "comment";
  /** 1-based first and last line. */
  start: number;
  end: number;
  lines: string[];
  /** A heading's text. */
  text?: string;
  items?: Item[];
  /** Whether an HTML comment runs to the end of the file with no `-->`. */
  unclosed?: boolean;
}

/** Splits the file into Markdown blocks. Blank lines end every block but a fence. */
function scan(lines: readonly string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  const isBlank = (line: string | undefined) => line === undefined || line.trim() === "";
  const startsBlock = (line: string) =>
    HEADING.test(line) ||
    FENCE.test(line) ||
    ITEM.test(line) ||
    TABLE.test(line) ||
    COMMENT.test(line);
  while (i < lines.length) {
    const line = lines[i]!;
    if (isBlank(line)) {
      i++;
      continue;
    }
    const first = i;
    const fence = FENCE.exec(line)?.[1];
    if (fence) {
      i++;
      const close = new RegExp(`^ {0,3}${fence[0] === "`" ? "`" : "~"}{${fence.length},}[ \\t]*$`);
      while (i < lines.length && !close.test(lines[i]!)) i++;
      i = Math.min(i + 1, lines.length);
      blocks.push({ kind: "fence", start: first + 1, end: i, lines: lines.slice(first, i) });
      continue;
    }
    // An HTML comment is a block of its own, so one right above `Allow:` doesn't pull the field into
    // the introduction, and one right below doesn't join its last entry.
    if (COMMENT.test(line)) {
      while (
        i < lines.length &&
        !lines[i]!.slice(i === first ? line.indexOf("<!--") + 4 : 0).includes("-->")
      )
        i++;
      const unclosed = i === lines.length;
      i = Math.min(i + 1, lines.length);
      blocks.push({
        kind: "comment",
        start: first + 1,
        end: i,
        lines: lines.slice(first, i),
        ...(unclosed ? { unclosed } : {}),
      });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      i++;
      blocks.push({
        kind: level === 1 ? "h1" : level === 2 ? "h2" : "heading",
        start: first + 1,
        end: first + 1,
        lines: [line],
        text: (heading[2] ?? "").trim(),
      });
      continue;
    }
    if (TABLE.test(line)) {
      while (i < lines.length && !isBlank(lines[i]) && TABLE.test(lines[i]!)) i++;
      blocks.push({ kind: "table", start: first + 1, end: i, lines: lines.slice(first, i) });
      continue;
    }
    if (ITEM.test(line)) {
      const items: Item[] = [];
      while (i < lines.length && !isBlank(lines[i])) {
        const current = lines[i]!;
        const item = ITEM.exec(current);
        if (item) items.push({ line: i + 1, bullet: item[1]!, lines: [(item[2] ?? "").trim()] });
        // A Markdown formatter indents a field line that follows a list as the last item's continuation.
        else if (/^[ \t]+\S/.test(current) && !startsBlock(current) && !isFieldLine(current))
          items.at(-1)!.lines.push(current.trim());
        else break;
        i++;
      }
      blocks.push({ kind: "list", start: first + 1, end: i, lines: lines.slice(first, i), items });
      continue;
    }
    while (i < lines.length && !isBlank(lines[i]) && (i === first || !startsBlock(lines[i]!))) i++;
    blocks.push({ kind: "paragraph", start: first + 1, end: i, lines: lines.slice(first, i) });
  }
  return blocks;
}

interface FieldNode {
  spec: FieldSpec;
  line: number;
  /** A text field's paragraphs; the first starts with the text on the field's line, which may be empty. */
  text: string[][];
  /** A list or value field's items; a comma list on the field's line gives one item per entry. */
  items: Item[];
  /** Whether a list field is written as a comma list on its line or as `-` items. */
  form: "inline" | "list";
  /** A value field's text. */
  value: string;
  /** How many `-` lists follow the field. */
  lists: number;
}

interface TermNode {
  line: number;
  name: string;
  abbr: string[];
  fields: Map<string, FieldNode>;
}

interface Doc {
  intro: Block[];
  corpus: Map<string, FieldNode>;
  terms: TermNode[];
}

/** Splits a comma list, keeping commas inside backticks. */
function splitCommas(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inCode = false;
  for (const char of text) {
    if (char === "`") inCode = !inCode;
    if (char === "," && !inCode) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** `word` or `word: reason`, split at the first colon followed by a space; backticks around the word are dropped. */
function parseAvoid(raw: string): { word: string; why?: string } {
  const ticked = /^`([^`]*)`(?::(?:\s+([\s\S]*))?)?$/.exec(raw);
  if (ticked) {
    const why = ticked[2]?.trim();
    return why ? { word: ticked[1]!.trim(), why } : { word: ticked[1]!.trim() };
  }
  const at = raw.search(/:(?:\s|$)/);
  if (at < 0) return { word: raw.trim() };
  const why = raw.slice(at + 1).trim();
  return why ? { word: raw.slice(0, at).trim(), why } : { word: raw.slice(0, at).trim() };
}

/** `fr: route serveur` as its locale and value, split at the first colon. */
function parseLocaleItem(raw: string): { locale: string; value: string } | undefined {
  const at = raw.indexOf(":");
  if (at < 0) return undefined;
  return { locale: raw.slice(0, at).trim(), value: raw.slice(at + 1).trim() };
}

/** A single word that is one capital or has a capital after its first letter, such as `DP`, `D` or `eB`. */
function isAbbr(word: string): boolean {
  return /^(?:\p{Lu}|\S+\p{Lu}\S*)$/u.test(word);
}

/** A capital right after a letter, as in `eBike` or `SOS`, makes a term `exact`. */
function isExactName(name: string): boolean {
  return /\p{L}\p{Lu}/u.test(name);
}

const itemText = (item: Item): string => item.lines.join(" ").trim();
const textOf = (node: FieldNode): string =>
  node.text
    .flat()
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

function quoteList(values: readonly string[]): string {
  const quoted = values.map((value) => `"${value}"`);
  return quoted.length > 1
    ? `${quoted.slice(0, -1).join(", ")} or ${quoted.at(-1)}`
    : (quoted[0] ?? "");
}

class Reader {
  readonly problems: GlossaryProblem[] = [];
  private readonly blocks: Block[];

  constructor(lines: readonly string[]) {
    this.blocks = scan(lines);
    // Everything after an unclosed comment is inside it, so the glossary would read as empty.
    for (const block of this.blocks)
      if (block.unclosed)
        this.add(
          P.noPlace,
          block.start,
          "An HTML comment has no closing `-->`, so it hides the rest of the file.",
          "Close the comment with `-->`, or remove it.",
        );
  }

  add(code: string, line: number, why: string, fix: string, term?: string): void {
    this.problems.push({
      code,
      line,
      why,
      fix,
      fixable: FIXABLE.has(code),
      ...(term === undefined ? {} : { term }),
    });
  }

  read(): Doc {
    const { blocks } = this;
    let index = 0;
    const title = blocks[0];
    if (title?.kind === "h1") {
      index = 1;
      if (title.text !== "Glossary")
        this.add(
          P.title,
          title.start,
          `The title is "${title.text}", not "Glossary".`,
          `Retitle it "# Glossary".`,
        );
    } else
      this.add(
        P.title,
        title?.start ?? 1,
        "The file does not start with `# Glossary`.",
        "Add `# Glossary` as the first line.",
      );

    const intro: Block[] = [];
    while (index < blocks.length) {
      const block = blocks[index]!;
      if (block.kind === "h2" || (block.kind === "paragraph" && FIELD.test(block.lines[0]!))) break;
      if (block.kind === "h1") this.secondTitle(block);
      else intro.push(block);
      index++;
    }

    // One blank line sets off the title, the introduction, each term and each further paragraph of a
    // field. A term's heading and its fields sit on consecutive lines, as do the corpus fields.
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i]!;
      const gap = block.start - blocks[i - 1]!.end - 1;
      const want =
        i <= index ||
        block.kind === "h1" ||
        block.kind === "h2" ||
        (block.kind === "paragraph" &&
          !isFieldLine(block.lines[0]!) &&
          blocks[i - 1]!.kind !== "h2")
          ? 1
          : 0;
      if (gap === want) continue;
      this.add(
        P.layout,
        block.start,
        want === 1
          ? gap === 0
            ? "No blank line before this line."
            : `${gap} blank lines before this line.`
          : gap === 1
            ? "A blank line before this line."
            : `${gap} blank lines before this line.`,
        want === 1
          ? "Leave one blank line before a heading, after the introduction and between the paragraphs of one field."
          : "Remove it: a term's heading and its fields go on consecutive lines.",
      );
    }

    let end = index;
    while (end < blocks.length && blocks[end]!.kind !== "h2") end++;
    const corpus = this.section(blocks.slice(index, end), CORPUS_FIELDS, undefined);

    const terms: TermNode[] = [];
    const seen = new Map<string, string>();
    for (index = end; index < blocks.length; index = end) {
      const heading = blocks[index]!;
      end = index + 1;
      while (end < blocks.length && blocks[end]!.kind !== "h2") end++;
      const parsed = this.heading(heading);
      const fields = this.section(blocks.slice(index + 1, end), TERM_FIELDS, parsed.name);
      const key = termKey(parsed.name);
      if (key !== "") {
        const previous = seen.get(key);
        if (previous !== undefined)
          this.add(
            P.twice,
            heading.start,
            `"${parsed.name}" is written twice: "${previous}" is the same term.`,
            "Merge the two sections into one.",
            parsed.name,
          );
        else seen.set(key, parsed.name);
      }
      terms.push({ line: heading.start, name: parsed.name, abbr: parsed.abbr, fields });
    }
    return { intro, corpus, terms };
  }

  private secondTitle(block: Block): void {
    this.add(
      P.noPlace,
      block.start,
      `A second H1, "${block.text}", has no place in a glossary.`,
      "Remove it, or make it a term with `##`.",
    );
  }

  private heading(block: Block): { name: string; abbr: string[] } {
    const text = block.text ?? "";
    const match = /^(.*?)\s*\(([^()]*)\)$/.exec(text);
    const name = (match ? match[1]! : text).trim();
    const abbr = match ? match[2]!.split(",").map((part) => part.trim()) : [];
    const fail = (why: string, fix: string) => this.add(P.badHeading, block.start, why, fix, name);
    if (termKey(name) === "")
      fail(`The term heading "## ${text}" has no words.`, "Write the term after `## `.");
    else if (/[()]/.test(name) || (match && !abbr.every(isAbbr)))
      fail(
        `The parentheses in "## ${text}" hold more than abbreviations.`,
        "Keep only abbreviations in parentheses, such as `## Day Pass (DP)`, and move the rest to `How`.",
      );
    return { name, abbr: abbr.filter(Boolean) };
  }

  /** Reads the fields of the corpus (`term` undefined) or of one term. */
  private section(
    blocks: readonly Block[],
    specs: readonly FieldSpec[],
    term: string | undefined,
  ): Map<string, FieldNode> {
    const fields = new Map<string, FieldNode>();
    const sink: FieldNode = {
      spec: { name: "", kind: "text" },
      line: 0,
      text: [],
      items: [],
      form: "inline",
      value: "",
      lists: 0,
    };
    let current: FieldNode | undefined;
    const noPlace = (line: number, what: string, fix?: string) =>
      this.add(
        P.noPlace,
        line,
        `${what} has no place in a glossary${term === undefined ? "" : " term"}.`,
        term === undefined
          ? "Move it to the introduction above the first field, or remove it."
          : (fix ?? "Write it as a field, such as `How:`, or remove it."),
        term,
      );

    for (const block of blocks) {
      if (block.kind === "list") {
        if (current === sink) continue;
        if (current?.spec.kind !== "list") {
          noPlace(
            block.start,
            current
              ? `A list after the ${current.spec.name} field`
              : "A list before the first field",
          );
          current = sink;
          continue;
        }
        if (current.lists > 0) {
          this.add(
            P.layout,
            block.start,
            `Blank lines split the list of ${current.spec.name}.`,
            "Write the list's items on consecutive lines.",
            term,
          );
        } else if (current.items.length > 0) {
          this.add(
            P.layout,
            current.line,
            `${current.spec.name} has entries on its line and a list below it.`,
            "Move every entry into the `-` list.",
            term,
          );
        }
        const bullet = block.items!.find((item) => item.bullet !== "-");
        if (bullet)
          this.add(
            P.layout,
            bullet.line,
            `A list item starts with "${bullet.bullet}".`,
            "Start each list item with `-`.",
            term,
          );
        current.form = "list";
        current.lists++;
        current.items.push(...block.items!);
        continue;
      }
      if (block.kind !== "paragraph") {
        if (block.kind === "h1") this.secondTitle(block);
        else if (block.kind === "comment") {
          if (!block.unclosed)
            noPlace(
              block.start,
              "An HTML comment among the fields",
              "Move it to the introduction, or remove it.",
            );
        } else
          noPlace(
            block.start,
            block.kind === "heading"
              ? `The heading "${block.lines[0]!.trim()}"`
              : block.kind === "table"
                ? "A table"
                : "A code block",
          );
        current = sink;
        continue;
      }

      for (const segment of this.segments(block)) {
        const head = FIELD.exec(segment.lines[0]!);
        if (!head) {
          if (current === sink) continue;
          if (current?.spec.kind === "text") current.text.push(segment.lines.map(trimEnd));
          else {
            noPlace(
              segment.line,
              current
                ? `Text after the ${current.spec.name} field`
                : term === undefined
                  ? "Text after the corpus fields"
                  : `Text before the first field of "${term}"`,
            );
            current = sink;
          }
          continue;
        }
        const written = head[1]!;
        const spec = this.resolve(written, specs, segment.line, term);
        if (!spec) {
          current = sink;
          continue;
        }
        if (fields.has(spec.name)) {
          this.add(
            P.twice,
            segment.line,
            `${spec.name} is written twice${term === undefined ? "" : ` in "${term}"`}.`,
            "Merge the two into one field.",
            term,
          );
          current = sink;
          continue;
        }
        const order = specs.indexOf(spec);
        const later = [...fields.values()].find((field) => specs.indexOf(field.spec) > order);
        if (later)
          this.add(
            P.layout,
            segment.line,
            `${spec.name} comes after ${later.spec.name}.`,
            `Write the fields in this order: ${specs.map((field) => field.name).join(", ")}.`,
            term,
          );
        current = this.field(spec, segment.line, head[2] ?? "", segment.lines.slice(1), term);
        fields.set(spec.name, current);
      }
    }
    for (const field of fields.values()) this.check(field, term);
    return fields;
  }

  /** A paragraph's fields: a new one starts at each line that names a field. */
  private segments(block: Block): { line: number; lines: string[] }[] {
    const segments = [{ line: block.start, lines: [block.lines[0]!] }];
    for (let i = 1; i < block.lines.length; i++) {
      const line = block.lines[i]!;
      if (isFieldLine(line)) segments.push({ line: block.start + i, lines: [line] });
      else segments.at(-1)!.lines.push(line);
    }
    return segments;
  }

  private resolve(
    written: string,
    specs: readonly FieldSpec[],
    line: number,
    term: string | undefined,
  ): FieldSpec | undefined {
    const lower = written.toLowerCase();
    const exact = specs.find((spec) => spec.name === written);
    if (exact) return exact;
    const byCase = specs.find((spec) => spec.name.toLowerCase() === lower);
    const alias = specs.find((spec) => ALIASES[lower] === spec.name);
    const other = term === undefined ? TERM_FIELDS : CORPUS_FIELDS;
    const elsewhere = other.find(
      (spec) => spec.name.toLowerCase() === lower || ALIASES[lower] === spec.name,
    );
    const near = elsewhere
      ? undefined
      : nearest(
          written,
          specs.map((spec) => spec.name.toLowerCase()),
        );
    const spec =
      byCase ??
      alias ??
      (near ? specs.find((field) => field.name.toLowerCase() === near) : undefined);
    if (spec) {
      this.add(
        P.fieldName,
        line,
        byCase
          ? `"${written}" is written "${spec.name}".`
          : alias
            ? `"${written}" is another name for "${spec.name}".`
            : `"${written}" is not a field; "${spec.name}" is.`,
        `Rename it to "${spec.name}".`,
        term,
      );
      return spec;
    }
    this.add(
      P.noPlace,
      line,
      elsewhere
        ? term === undefined
          ? `${elsewhere.name} is a term field, written before the first term.`
          : `${elsewhere.name} is a glossary field, written inside the term "${term}".`
        : `"${written}" is not a field.`,
      elsewhere
        ? term === undefined
          ? `Move it under the \`##\` heading of its term.`
          : "Move it above the first `##` term."
        : `Use ${quoteList(specs.map((spec) => spec.name))}, or reword the line so it does not start with "${written}:".`,
      term,
    );
    return undefined;
  }

  private field(
    spec: FieldSpec,
    line: number,
    rest: string,
    more: string[],
    term: string | undefined,
  ): FieldNode {
    const node: FieldNode = {
      spec,
      line,
      text: [],
      items: [],
      form: "inline",
      value: "",
      lists: 0,
    };
    if (spec.kind === "text") {
      node.text.push([rest.trim(), ...more.map(trimEnd)]);
      return node;
    }
    const inline = [rest, ...more]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ");
    if (spec.kind === "value") {
      node.value = inline;
      return node;
    }
    if (!inline) return node;
    if (spec.comma) {
      node.items = splitCommas(inline).map((part) => ({ line, bullet: "", lines: [part] }));
      return node;
    }
    this.add(
      P.layout,
      line,
      `${spec.name} has its entry on the field's line.`,
      `Write ${spec.name} as a \`-\` list.`,
      term,
    );
    node.form = "list";
    node.items = [{ line, bullet: "-", lines: [inline] }];
    return node;
  }

  /** Reports bad values and rewrites bare URLs under `Links` as Markdown links. */
  private check(node: FieldNode, term: string | undefined): void {
    const bad = (line: number, why: string, fix: string) =>
      this.add(P.badValue, line, why, fix, term);
    const { name } = node.spec;
    const empty =
      node.spec.kind === "text"
        ? textOf(node) === ""
        : node.spec.kind === "value"
          ? node.value === ""
          : node.items.every((item) => itemText(item) === "");
    if (empty) {
      bad(node.line, `${name} is empty.`, `Write a value after "${name}:", or remove the field.`);
      return;
    }
    if (name === "Case" && !CASE_MODES.includes(node.value as CaseMode))
      bad(node.line, `Case is "${node.value}".`, `Use ${quoteList(CASE_MODES)}.`);
    const locales = new Map<string, string>();
    for (const item of node.items) {
      const text = itemText(item);
      if (text !== "" && LOCALE_FIELDS.has(name)) {
        this.checkLocaleItem(node, item, locales, term);
        continue;
      }
      if (text === "")
        bad(item.line, `An item of ${name} is empty.`, "Write the item, or remove its line.");
      else if (name === "Presets" && !Object.hasOwn(PRESETS, text))
        bad(item.line, `"${text}" is not a preset.`, `Use ${quoteList(Object.keys(PRESETS))}.`);
      else if (name === "Casing" && !CASING.test(text))
        bad(
          item.line,
          `"${text}" is not a casing.`,
          "Write a kind (label, header or sentence) and a style (title, sentence, lower, upper or as-written), such as `label sentence`.",
        );
      else if (name === "Avoid" && termKey(parseAvoid(text).word) === "")
        bad(item.line, `"${text}" has no word to avoid.`, "Write it as `word` or `word: reason`.");
      else if (name === "Links" && !LINK.test(text)) {
        const url = BARE_URL.exec(text)?.[1];
        if (url) {
          this.add(
            P.layout,
            item.line,
            `The link ${url} has no title.`,
            `Write it as [${url}](${url}), or give it a title.`,
            term,
          );
          item.lines = [`[${url}](${url})`];
        } else
          bad(
            item.line,
            `"${text}" is not a link.`,
            "Write it as `[title](https://…)` with an http or https URL.",
          );
      }
    }
  }

  /** Reports a `Translations` or `Forms` item that is not `locale: value`, or whose locale is listed twice. */
  private checkLocaleItem(
    node: FieldNode,
    item: Item,
    seen: Map<string, string>,
    term: string | undefined,
  ): void {
    const { name } = node.spec;
    const text = itemText(item);
    const example = name === "Forms" ? "`fr: routes serveur`" : "`fr: route serveur`";
    const parsed = parseLocaleItem(text);
    if (!parsed || parsed.locale === "") {
      this.add(
        P.badValue,
        item.line,
        `"${text}" in ${name} has no locale.`,
        `Write it as ${example}: a locale, a colon, then the ${name === "Forms" ? "forms" : "translation"}.`,
        term,
      );
      return;
    }
    if (!LOCALE.test(parsed.locale)) {
      this.add(
        P.badValue,
        item.line,
        `"${parsed.locale}" in ${name} is not a locale.`,
        "Use a BCP 47 tag such as `fr`, `de` or `pt-BR`.",
        term,
      );
      return;
    }
    if (parsed.value === "" || (name === "Forms" && splitCommas(parsed.value).length === 0)) {
      this.add(
        P.badValue,
        item.line,
        `${parsed.locale} in ${name} has no ${name === "Forms" ? "forms" : "translation"}.`,
        `Write it after "${parsed.locale}:", or remove the line.`,
        term,
      );
      return;
    }
    const key = parsed.locale.toLowerCase();
    const previous = seen.get(key);
    if (previous !== undefined) {
      this.add(
        P.twice,
        item.line,
        `${name} lists ${parsed.locale} twice${term === undefined ? "" : ` in "${term}"`}.`,
        name === "Forms"
          ? `Merge the two into one \`${previous}:\` line, with the forms separated by commas.`
          : `Keep one \`${previous}:\` line.`,
        term,
      );
      return;
    }
    seen.set(key, parsed.locale);
  }
}

const squash = (text: string): string => text.trim().replace(/\s+/g, " ").toLowerCase();

function trimEnd(line: string): string {
  return line.replace(/\s+$/, "");
}

/**
 * The canonical text of a glossary that has only fixable problems: one blank line between the title,
 * each introduction block, the corpus fields and each term, and none inside a term or the corpus fields.
 */
function serialize(doc: Doc): string {
  const sections: string[] = ["# Glossary"];
  for (const block of doc.intro) sections.push(block.lines.map(trimEnd).join("\n"));
  const fields = (map: Map<string, FieldNode>, specs: readonly FieldSpec[]) =>
    specs.flatMap((spec) => {
      const node = map.get(spec.name);
      return node ? [renderField(node)] : [];
    });
  const corpus = fields(doc.corpus, CORPUS_FIELDS);
  if (corpus.length) sections.push(corpus.join("\n"));
  for (const term of doc.terms)
    sections.push(
      [
        `## ${term.name}${term.abbr.length ? ` (${term.abbr.join(", ")})` : ""}`,
        ...fields(term.fields, TERM_FIELDS),
      ].join("\n"),
    );
  return `${sections.join("\n\n")}\n`;
}

/** A field's lines; the paragraphs of a text field after its first are set off by blank lines. */
function renderField(node: FieldNode): string {
  const { name, kind } = node.spec;
  if (kind === "text") {
    const [first = [""], ...rest] = node.text;
    return [[`${name}:${first[0] ? ` ${first[0]}` : ""}`, ...first.slice(1)], ...rest]
      .map((paragraph) => paragraph.join("\n"))
      .join("\n\n");
  }
  if (kind === "value") return `${name}: ${node.value}`;
  const items = node.items.filter((item) => itemText(item) !== "");
  if (node.form === "inline") return `${name}: ${items.map(itemText).join(", ")}`;
  return [
    `${name}:`,
    ...items.flatMap((item) => [
      `- ${item.lines[0]}`,
      ...item.lines.slice(1).map((line) => `  ${line}`),
    ]),
  ].join("\n");
}

function buildTerm(node: TermNode): Term {
  const term: Term = { term: node.name };
  const field = (name: string) => node.fields.get(name);
  const items = (name: string) => field(name)?.items.map(itemText).filter(Boolean) ?? [];
  const text = (name: string) => {
    const found = field(name);
    return found ? textOf(found) : "";
  };
  if (text("What")) term.description = text("What");
  if (text("How")) term.nuance = text("How");
  if (text("Why")) term.why = text("Why");
  if (node.abbr.length) term.abbr = node.abbr;
  const avoid: (string | Avoid)[] = items("Avoid").map((raw) => {
    const parsed = parseAvoid(raw);
    return parsed.why ? { word: parsed.word, why: parsed.why } : parsed.word;
  });
  if (avoid.length) term.avoid = avoid;
  const good = items("Good");
  const bad = items("Bad");
  if (good.length || bad.length)
    term.examples = { ...(good.length ? { good } : {}), ...(bad.length ? { bad } : {}) };
  const links: Link[] = items("Links").flatMap((raw) => {
    const match = LINK.exec(raw);
    return match ? [{ title: match[1]!.trim(), url: match[2]! }] : [];
  });
  if (links.length) term.links = links;
  const casing = parseCasing(items("Casing"));
  if (Object.keys(casing).length) term.casing = casing;
  const translations = localeItems(items("Translations"));
  if (translations.length) term.translations = Object.fromEntries(translations);
  const forms = localeItems(items("Forms"));
  if (forms.length)
    term.forms = Object.fromEntries(forms.map(([locale, value]) => [locale, splitCommas(value)]));
  const mode = field("Case")?.value as CaseMode | undefined;
  if (mode) term.case = mode;
  // Casing without Case makes the term `context`, as in defineCorpus, whatever its name.
  else if (!term.casing && isExactName(node.name)) term.case = "exact";
  return term;
}

/** `fr: route serveur` items as `[locale, value]` pairs, in file order. */
function localeItems(raw: readonly string[]): [string, string][] {
  return raw.map((text) => {
    const { locale, value } = parseLocaleItem(text)!;
    return [locale, value];
  });
}

/** `label sentence, sentence as-written` as a `Casing`. */
function parseCasing(pairs: readonly string[]): Casing {
  const casing: Casing = {};
  for (const pair of pairs) {
    const [, kind, style] = CASING.exec(pair)!;
    casing[kind as CasingKind] = style as CaseStyle;
  }
  return casing;
}

function buildCorpus(doc: Doc, terms: Term[]): Corpus {
  const items = (name: string) => doc.corpus.get(name)?.items.map(itemText).filter(Boolean) ?? [];
  const casing = parseCasing(items("Casing"));
  const allow = items("Allow");
  return defineCorpus({
    extends: items("Presets").map((name) => PRESETS[name]!),
    terms,
    ...(allow.length ? { allow } : {}),
    ...(Object.keys(casing).length ? { casing } : {}),
  });
}

/** Reports every avoid word that is a term of the file. */
function avoidTerms(reader: Reader, doc: Doc): void {
  const names = new Map(doc.terms.map((term) => [termKey(term.name), term.name]));
  for (const term of doc.terms) {
    for (const item of term.fields.get("Avoid")?.items ?? []) {
      const { word } = parseAvoid(itemText(item));
      // An avoid word with the term's own key, such as `check-out` for Checkout, is a spelling to report.
      const own = squash(word) === squash(term.name);
      const other = own ? term.name : names.get(termKey(word));
      if (other === undefined || (other === term.name && !own)) continue;
      reader.add(
        P.avoidIsTerm,
        item.line,
        other === term.name
          ? `"${word}" is both the term and one of its avoid words.`
          : `"${word}" is an avoid word of "${term.name}" and a term of its own.`,
        other === term.name
          ? "Remove it from Avoid. To require one casing, write `Case: exact`."
          : `Remove it from the Avoid list of "${term.name}", or remove the term "${other}".`,
        term.name,
      );
    }
  }
}

/** Reports every `Good` example that is reported and every `Bad` one that is not. */
function failingExamples(reader: Reader, doc: Doc, corpus: Corpus, own: Map<Term, TermNode>): void {
  for (const failure of testCorpus(corpus)) {
    const node = own.get(failure.term);
    if (!node) continue;
    const field = node.fields.get(failure.expected === "none" ? "Good" : "Bad");
    const line =
      field?.items.find((item) => itemText(item) === failure.example)?.line ??
      field?.line ??
      node.line;
    const about = failure.findings.find(
      (finding) => termKey(finding.term.term) === termKey(node.name),
    );
    reader.add(
      P.failingExample,
      line,
      failure.expected === "none"
        ? `The good example "${failure.example}" is reported: ${about?.message ?? "a finding"}`
        : `The bad example "${failure.example}" is not reported.`,
      failure.expected === "none"
        ? "Narrow the avoid word, or fix the example."
        : "Add the wording to Avoid, or fix the example.",
      node.name,
    );
  }
}

/** Reads a glossary's text, and with `examples` runs each term's examples too (`G009`). */
export function parseGlossary(
  text: string,
  examples: boolean,
): { problems: GlossaryProblem[]; corpus?: Corpus; fixed?: string } {
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  const reader = new Reader(lines);
  const doc = reader.read();
  avoidTerms(reader, doc);
  const blocked = reader.problems.some((problem) => BLOCKING.has(problem.code));
  let corpus: Corpus | undefined;
  let fixed: string | undefined;
  if (!blocked) {
    const own = new Map<Term, TermNode>();
    const terms = doc.terms.map((node) => {
      const term = buildTerm(node);
      own.set(term, node);
      return term;
    });
    corpus = buildCorpus(doc, terms);
    const canonical = serialize(doc);
    if (canonical !== text) {
      fixed = canonical;
      if (!reader.problems.some((problem) => problem.fixable)) {
        const want = canonical.split("\n");
        const have = text.split("\n");
        let at = 0;
        while (at < want.length && want[at] === have[at]) at++;
        reader.add(
          P.layout,
          Math.min(at + 1, have.length),
          "The spacing, indentation or line endings differ from the canonical form.",
          "Use LF line endings, a blank line only before a heading, after the introduction and between the paragraphs of one field, no trailing spaces and one final newline.",
        );
      }
    }
    if (examples) failingExamples(reader, doc, corpus, own);
  }
  const problems = [...reader.problems].sort((a, b) => a.line - b.line);
  return {
    problems,
    ...(corpus ? { corpus } : {}),
    ...(fixed === undefined ? {} : { fixed }),
  };
}

/**
 * Reads the text of a glossary file. `corpus` is set when no problem from `G004` to `G008` exists, and
 * `fixed`, the canonical text, when the file can be rewritten and differs from it.
 */
export function readGlossary(text: string): {
  problems: GlossaryProblem[];
  corpus?: Corpus;
  fixed?: string;
} {
  return parseGlossary(text, true);
}
