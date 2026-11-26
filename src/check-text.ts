// Checks one file's text the way `glosslint check` does, without a file system, so a browser can run it too.
import { type ComarkProp, LINK_TARGET, maskComark } from "./comark.ts";
import { kindOf } from "./kind.ts";
import type { CliFinding, Finding, Matcher, Term, TermSummary, TextKind } from "./types.ts";

/** Blanks a span with spaces, keeping line breaks, so every offset and line stays where it was. */
function blank(text: string): string {
  return text.replace(/[^\n\r]/g, " ");
}

const FRONTMATTER = /^(?:---|\+\+\+)\r?\n[\s\S]*?\r?\n(?:---|\+\+\+|\.\.\.)[ \t]*(?:\r?\n|$)/;
// A fence may sit in a list item or a blockquote: `- ```ts`, `> ~~~`.
const FENCE = /^[ \t]*((?:>[ \t]?)*)[ \t]*((?:[-*+]|\d{1,9}[.)])[ \t]+)?(`{3,}|~{3,})([^\n]*)$/;
const HTML_COMMENT = /<!--[\s\S]*?(?:-->|$)/g;
// A code span never crosses a blank line, written with LF or CRLF.
const INLINE_CODE = /(?<!`)(`+)(?!`)(?:(?!\r?\n[ \t]*\r?\n)[\s\S])*?[^`]\1(?!`)/g;
const LINK_REFERENCE = /(?<=\])\[[^\]\n]*\]/g;
const REFERENCE_DEFINITION = /^ {0,3}\[[^\]\n]+\]:[ \t]*\S.*$/gm;
const AUTOLINK = /<(?:[a-z][a-z\d+.-]*:[^\s<>]*|[^\s<>@]+@[^\s<>]+)>/gi;
const TAG = /<\/?[A-Za-z][^<>]*>/g;
const LINE_PREFIX =
  /^( {0,3}(?:>[ \t]?)*)(#{1,6}(?=[ \t]|\r?$)|[-*+](?=[ \t])|\d{1,9}[.)](?=[ \t]))?([ \t]+\[[ xX]\](?=[ \t]))?/;
const HEADING = /^ {0,3}#{1,6}(?:[ \t]|\r?$)/;
const LIST_ITEM = /^ {0,3}(?:>[ \t]?)*(?:[-*+]|\d{1,9}[.)])[ \t]/;

/**
 * Blanks what is not prose in Markdown, keeping every offset: frontmatter, fenced code, HTML
 * comments and tags, inline code, link targets and references, and the markers of headings, lists
 * and quotes. In MDX, `import` and `export` lines too; in other Markdown, Comark component markup.
 */
export function maskMarkdown(text: string, options: { mdx?: boolean } = {}): string {
  return maskMarkdownParts(text, options).masked;
}

/** {@link maskMarkdown}, plus the Comark text props it blanked, which are checked on their own. */
function maskMarkdownParts(
  text: string,
  options: { mdx?: boolean },
): { masked: string; props: ComarkProp[] } {
  let out = text.replace(FRONTMATTER, blank);
  const lines = out.split("\n");
  // The open fence's marker and blockquote depth; it closes only at the same depth, never on a list item.
  let fence: { marker: string; depth: number } | undefined;
  for (const [index, line] of lines.entries()) {
    const match = FENCE.exec(line);
    const marker = match?.[3];
    const depth = match?.[1]?.split(">").length ?? 0;
    if (fence !== undefined) {
      if (
        marker &&
        !match![2] &&
        depth === fence.depth &&
        marker[0] === fence.marker[0] &&
        marker.length >= fence.marker.length &&
        match![4]!.trim() === ""
      )
        fence = undefined;
      lines[index] = blank(line);
    } else if (marker) {
      fence = { marker, depth };
      lines[index] = blank(line);
    } else if (options.mdx && /^(?:import|export)\s/.test(line)) {
      lines[index] = blank(line);
    }
  }
  out = lines.join("\n").replace(HTML_COMMENT, blank).replace(INLINE_CODE, blank);
  // MDX reads `{...}` as code and has no Comark syntax.
  let props: ComarkProp[] = [];
  if (!options.mdx) {
    const comark = maskComark(out.split("\n"), blank);
    out = comark.lines.join("\n");
    props = comark.props;
  }
  out = out.replace(REFERENCE_DEFINITION, blank);
  out = out.replace(LINK_TARGET, blank);
  out = out.replace(LINK_REFERENCE, blank);
  out = out.replace(AUTOLINK, blank);
  out = out.replace(TAG, blank);
  const masked = out
    .split("\n")
    .map((line) => {
      let masked = line.replace(LINE_PREFIX, blank);
      if (HEADING.test(line)) masked = masked.replace(/[ \t]#+[ \t]*(?=\r?$)/, blank);
      return masked;
    })
    .join("\n");
  return { masked, props };
}

const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*\r?$/;

interface Block {
  start: number;
  end: number;
  kind: TextKind;
  /** The text to check, when it isn't the masked text at these offsets, as for a Comark prop. */
  text?: string;
}

/** Splits text into the pieces checked one at a time: headings, table cells, list items and paragraphs. */
function blocks(original: string, masked: string, markdown: boolean): Block[] {
  const found: Block[] = [];
  let current: Block | undefined;
  const flush = () => {
    if (current) found.push(current);
    current = undefined;
  };
  let start = 0;
  const lines = masked.split("\n");
  for (const [index, line] of lines.entries()) {
    const end = start + line.length;
    const source = original.slice(start, end);
    if (line.trim() === "") flush();
    else if (markdown && HEADING.test(source)) {
      flush();
      found.push({ start, end, kind: "label" });
    } else if (markdown && source.trimStart().startsWith("|")) {
      flush();
      // A row right above the `| --- |` delimiter row is the table's header.
      const header = TABLE_DELIMITER.test(lines[index + 1] ?? "");
      let cellStart = start;
      for (const cell of line.split("|")) {
        if (cell.trim() !== "")
          found.push({
            start: cellStart,
            end: cellStart + cell.length,
            kind: header ? "header" : kindOf({ text: cell }),
          });
        cellStart += cell.length + 1;
      }
    } else if (markdown && LIST_ITEM.test(source)) {
      flush();
      current = { start, end, kind: "sentence" };
    } else if (current) current.end = end;
    else current = { start, end, kind: "sentence" };
    start = end + 1;
  }
  flush();
  return found;
}

function summarize(term: Term): TermSummary {
  return {
    term: term.term,
    ...(term.description ? { description: term.description } : {}),
    ...(term.nuance ? { nuance: term.nuance } : {}),
  };
}

/** Checks one file's text. Markdown is masked first, so code and link targets are never reported. */
export function checkFileText(
  matcher: Matcher,
  text: string,
  file: string,
  options: { markdown?: boolean; mdx?: boolean } = {},
): CliFinding[] {
  const markdown = options.markdown ?? false;
  const { masked, props } = markdown
    ? maskMarkdownParts(text, { mdx: options.mdx ?? false })
    : { masked: text, props: [] };
  const lineStarts = [0];
  for (let index = text.indexOf("\n"); index !== -1; index = text.indexOf("\n", index + 1))
    lineStarts.push(index + 1);
  const lineOf = (offset: number): number => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (lineStarts[mid]! <= offset) low = mid;
      else high = mid - 1;
    }
    return low;
  };
  const lineEnd = (line: number): number => (lineStarts[line + 1] ?? text.length + 1) - 1;
  const findings: CliFinding[] = [];
  const all: Block[] = [
    ...blocks(text, masked, markdown),
    ...props.map((prop) => ({
      start: prop.start,
      end: prop.end,
      kind: kindOf({ text: prop.text, name: prop.name, shown: true }),
      text: prop.text,
    })),
  ].sort((a, b) => a.start - b.start);
  for (const block of all) {
    const read = block.text ?? masked.slice(block.start, block.end);
    for (const finding of matcher.check(read, block.kind)) {
      const start = block.start + finding.start;
      const end = block.start + finding.end;
      const line = lineOf(start);
      const lineStart = lineStarts[line]!;
      findings.push(
        toCliFinding(finding, {
          file,
          text,
          start,
          end,
          line,
          lineStart,
          lineEnd: lineEnd(lineOf(end)),
        }),
      );
    }
  }
  // A prop's findings can fall between two findings of the prose around it.
  return findings.sort((a, b) => a.start - b.start);
}

function toCliFinding(
  finding: Finding,
  at: {
    file: string;
    text: string;
    start: number;
    end: number;
    line: number;
    lineStart: number;
    lineEnd: number;
  },
): CliFinding {
  const { fix, term, start: _start, end: _end, ...rest } = finding;
  const result = fix
    ? (at.text.slice(at.lineStart, at.start) + fix.replace + at.text.slice(at.end, at.lineEnd))
        .replace(/\s+/g, " ")
        .trim()
    : undefined;
  return {
    code: rest.code,
    file: at.file,
    line: at.line + 1,
    column: at.start - at.lineStart + 1,
    start: at.start,
    end: at.end,
    text: at.text.slice(at.start, at.end),
    message: rest.message,
    ...(rest.why ? { why: rest.why } : {}),
    ...(fix && result !== undefined ? { fix: { ...fix, result } } : {}),
    term: summarize(term),
    ...(rest.see ? { see: rest.see } : {}),
  };
}
