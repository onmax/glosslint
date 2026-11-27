// Checks one file's text the way `glosslint check` does, without a file system, so a browser can run it too.
import { type ComarkProp, LINK_TARGET, maskComark } from "./comark.ts";
import { caseModeOf, classify } from "./kind.ts";
import type { CliFinding, Finding, Matcher, Term, TermSummary, TextKind } from "./types.ts";

/** Blanks a span with spaces, keeping line breaks, so every offset and line stays where it was. */
function blank(text: string): string {
  return text.replace(/[^\n\r]/g, " ");
}

const FRONTMATTER = /^(?:---|\+\+\+)\r?\n[\s\S]*?\r?\n(?:---|\+\+\+|\.\.\.)[ \t]*(?:\r?\n|$)/;
// A fence may sit in a list item or a blockquote: `- ```ts`, `> ~~~`.
const FENCE = /^[ \t]*((?:>[ \t]?)*)[ \t]*((?:[-*+]|\d{1,9}[.)])[ \t]+)?(`{3,}|~{3,})([^\n]*)$/;
const HTML_COMMENT = /<!--[\s\S]*?(?:-->|$)/g;
/** `<!-- glosslint-ignore -->`, with an optional reason after a space or colon. */
const IGNORE = /<!--\s*glosslint-ignore(?:[\s:][\s\S]*?)?-->/;
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

/**
 * The lines `<!-- glosslint-ignore -->` comments skip, 0-based: a comment alone on its line skips the
 * next line with text, such as a heading kept for its anchor, and one beside text skips its own line.
 * `lines` has its fenced code blanked, so a comment inside a code block skips nothing.
 */
function ignoredLines(lines: readonly string[]): Set<number> {
  const ignored = new Set<number>();
  for (const [index, line] of lines.entries()) {
    const comment = IGNORE.exec(line);
    if (!comment) continue;
    if (line.replace(comment[0], "").trim() !== "") {
      ignored.add(index);
      continue;
    }
    let next = index + 1;
    while (next < lines.length && lines[next]!.trim() === "") next++;
    if (next < lines.length) ignored.add(next);
  }
  return ignored;
}

/** {@link maskMarkdown}, plus the Comark text props it blanked, which are checked on their own. */
function maskMarkdownParts(
  text: string,
  options: { mdx?: boolean },
): { masked: string; props: ComarkProp[]; ignored: Set<number> } {
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
  const ignored = ignoredLines(lines);
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
  return { masked, props, ignored };
}

const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*\r?$/;

interface Block {
  start: number;
  end: number;
  kind: TextKind;
  /** Whether only the text's shape decided `kind`, so a `context` term's fix there needs a person. */
  guessed?: boolean;
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
        if (cell.trim() !== "") {
          const { kind, guessed } = header
            ? { kind: "header" as const, guessed: false }
            : classify({ text: cell });
          found.push({ start: cellStart, end: cellStart + cell.length, kind, guessed });
        }
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

/** A finding at its offsets in the file, and whether `--fix` may apply it unasked. */
interface Placed {
  finding: CliFinding;
  autofix: boolean;
}

/** Every finding of one file's text, in file order. Markdown is masked first. */
function scan(
  matcher: Matcher,
  text: string,
  file: string,
  options: { markdown?: boolean; mdx?: boolean },
): Placed[] {
  const markdown = options.markdown ?? false;
  const { masked, props, ignored } = markdown
    ? maskMarkdownParts(text, { mdx: options.mdx ?? false })
    : { masked: text, props: [], ignored: new Set<number>() };
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
  const placed: Placed[] = [];
  const all: Block[] = [
    ...blocks(text, masked, markdown),
    ...props.map((prop) => ({
      start: prop.start,
      end: prop.end,
      ...classify({ text: prop.text, name: prop.name, shown: true }),
      text: prop.text,
    })),
  ].sort((a, b) => a.start - b.start);
  for (const block of all) {
    const read = block.text ?? masked.slice(block.start, block.end);
    for (const finding of matcher.check(read, block.kind)) {
      const start = block.start + finding.start;
      const end = block.start + finding.end;
      const line = lineOf(start);
      if (ignored.has(line)) continue;
      const lineStart = lineStarts[line]!;
      placed.push({
        finding: toCliFinding(finding, {
          file,
          text,
          start,
          end,
          line,
          lineStart,
          lineEnd: lineEnd(lineOf(end)),
        }),
        // As in ESLint: where only the text's shape decided its kind, a `context` term's fix may be wrong.
        autofix:
          finding.fix?.kind === "autofix" &&
          finding.fix.replace !== finding.text &&
          text.slice(start, end) === finding.text &&
          !(block.guessed && caseModeOf(finding.term) === "context"),
      });
    }
  }
  // A prop's findings can fall between two findings of the prose around it.
  return placed.sort((a, b) => a.finding.start - b.finding.start);
}

/** Checks one file's text. Markdown is masked first, so code and link targets are never reported. */
export function checkFileText(
  matcher: Matcher,
  text: string,
  file: string,
  options: { markdown?: boolean; mdx?: boolean } = {},
): CliFinding[] {
  return scan(matcher, text, file, options).map((placed) => placed.finding);
}

/** As ESLint does, a fix can make another, so fixing repeats until nothing changes, at most this often. */
const FIX_PASSES = 10;

/**
 * Applies every autofix `checkFileText` would report, never two that overlap, and repeats on the
 * result so a second run changes nothing. Suggestions, such as an avoid word's, are left for a person.
 */
export function fixFileText(
  matcher: Matcher,
  text: string,
  file: string,
  options: { markdown?: boolean; mdx?: boolean } = {},
): { text: string; fixed: number; findings: CliFinding[] } {
  let fixed = 0;
  for (let pass = 0; pass < FIX_PASSES; pass++) {
    const edits: CliFinding[] = [];
    for (const { finding, autofix } of scan(matcher, text, file, options))
      if (autofix && finding.start >= (edits.at(-1)?.end ?? 0)) edits.push(finding);
    if (edits.length === 0) break;
    let out = "";
    let at = 0;
    for (const edit of edits) {
      out += text.slice(at, edit.start) + edit.fix!.replace;
      at = edit.end;
    }
    text = out + text.slice(at);
    fixed += edits.length;
  }
  return { text, fixed, findings: checkFileText(matcher, text, file, options) };
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
