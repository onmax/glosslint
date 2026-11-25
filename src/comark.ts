// Comark (and MDC) component syntax in Markdown: `::name{props}` blocks, `#slot` lines, YAML props
// and whole-line `:name{props}` components. Markup is blanked; the values of text props are kept.
import { isTextName } from "./kind.ts";
import { isCodeShape } from "./words.ts";

/** A prop value people read, such as a card's `title`, with its offsets in the source. */
export interface ComarkProp {
  name: string;
  start: number;
  end: number;
  /** The text to check, with any markup inside it blanked. */
  text: string;
}

const OPENER = /^[ \t]*(:{2,})[A-Za-z][\w-]*/;
const BARE = /^[ \t]*:[A-Za-z][\w-]*[ \t]*\r?$/;
const CLOSER = /^[ \t]*:{2,}[ \t]*\r?$/;
const SLOT = /^[ \t]*#[A-Za-z][\w-]*[ \t]*\r?$/;
const RULE = /^[ \t]*---[ \t]*\r?$/;
const YAML_ENTRY = /^([ \t]*)([\w.-]+):[ \t]*(.*?)[ \t]*\r?$/;

interface Attribute {
  name: string;
  /** The value's offsets in the line, without quotes; absent for a bare key, `.class` or `#id`. */
  value?: { start: number; end: number };
}

/** Reads `{key="value" key='v' key=v bool .class #id :bind='json'}` from `at`, or `undefined` if it doesn't close. */
function scanAttributes(
  line: string,
  at: number,
): { end: number; attributes: Attribute[] } | undefined {
  const attributes: Attribute[] = [];
  let index = at + 1;
  while (index < line.length) {
    const char = line[index]!;
    if (char === "}") return { end: index + 1, attributes };
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    const key = /^[^\s=}"']+/.exec(line.slice(index));
    if (!key) return undefined;
    const name = key[0];
    index += name.length;
    if (line[index] !== "=") {
      attributes.push({ name });
      continue;
    }
    index++;
    const quote = line[index];
    if (quote === '"' || quote === "'") {
      let end = index + 1;
      while (end < line.length && line[end] !== quote) end += line[end] === "\\" ? 2 : 1;
      if (end >= line.length) return undefined;
      attributes.push({ name, value: { start: index + 1, end } });
      index = end + 1;
    } else {
      const value = /^[^\s}]*/.exec(line.slice(index))![0];
      attributes.push({ name, value: { start: index, end: index + value.length } });
      index += value.length;
    }
  }
  return undefined;
}

/** Reads `[text]` from `at`, allowing nested brackets, or `undefined` if it doesn't close. */
function scanBrackets(line: string, at: number): number | undefined {
  let depth = 0;
  for (let index = at; index < line.length; index++) {
    const char = line[index];
    if (char === "\\") index++;
    else if (char === "[") depth++;
    else if (char === "]" && --depth === 0) return index + 1;
  }
  return undefined;
}

function isText(name: string, value: string): boolean {
  return !name.startsWith(":") && isTextName(name) && value.trim() !== "" && !isCodeShape(value);
}

type Span = { name: string; start: number; end: number };

/**
 * Reads what follows a component's name: optional `[text]`, then optional `{props}`. Returns where it
 * ends, the text props and the kept `[text]`, or `undefined` when a bracket or brace doesn't close.
 */
function readComponent(
  line: string,
  nameEnd: number,
): { end: number; props: Span[]; content?: [number, number] } | undefined {
  let index = nameEnd;
  let content: [number, number] | undefined;
  if (line[index] === "[") {
    const end = scanBrackets(line, index);
    if (end === undefined) return undefined;
    content = [index + 1, end - 1];
    index = end;
  }
  const props: Span[] = [];
  if (line[index] === "{") {
    const scanned = readProps(line, index);
    if (!scanned) return undefined;
    props.push(...scanned.props);
    index = scanned.end;
  }
  return { end: index, props, ...(content ? { content } : {}) };
}

/** Reads `{props}` at `at`, keeping the values of text props. */
function readProps(line: string, at: number): { end: number; props: Span[] } | undefined {
  const scanned = scanAttributes(line, at);
  if (!scanned) return undefined;
  const props: Span[] = [];
  for (const attribute of scanned.attributes)
    if (
      attribute.value &&
      isText(attribute.name, line.slice(attribute.value.start, attribute.value.end))
    )
      props.push({ name: attribute.name, ...attribute.value });
  return { end: scanned.end, props };
}

// An inline component's colon follows no letter, digit, `_`, `:`, `\\` or `/`, and its name is followed
// by `[` or `{`, so "Note: x", "10:30", `std::vector`, `https://` and `:smile:` stay prose.
const INLINE_NAME = /(?<![\p{L}\p{N}_:\\/]):[A-Za-z][\w-]*(?=[[{])/uy;
/** A link or image target after its `]`, with an optional title: `(/map "Map")`. */
export const LINK_TARGET =
  /(?<=\])\((?:[^()\s]|\([^()\s]*\))*(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?\s*\)/g;
const LINK_TARGET_AT = new RegExp(LINK_TARGET.source, "y");

/**
 * Blanks inline markup in `line` between `from` and `to`, left to right: components such as
 * `:badge[v4.4]{color="info"}`, whose `[text]` is kept and scanned in turn, and `{attrs}` right after a
 * `]` or a link target, as in `[map](/map){target="_blank"}`. Link targets are skipped, as the CLI blanks
 * them anyway. Returns the line and the text props it found.
 */
function maskInline(
  line: string,
  blank: (text: string) => string,
  from = 0,
  to = line.length,
): { line: string; props: Span[] } {
  let out = line;
  const props: Span[] = [];
  const scan = (start: number, end: number): void => {
    let attrsAt = -1;
    for (let index = start; index < end;) {
      INLINE_NAME.lastIndex = index;
      const name = INLINE_NAME.exec(line);
      const component = name && readComponent(line, index + name[0].length);
      if (component && component.end <= end) {
        out =
          out.slice(0, index) + blank(out.slice(index, component.end)) + out.slice(component.end);
        props.push(...component.props);
        if (component.content) {
          const [open, close] = component.content;
          out = out.slice(0, open) + line.slice(open, close) + out.slice(close);
          scan(open, close);
        }
        index = component.end;
        continue;
      }
      const char = line[index];
      if (char === "{" && index === attrsAt) {
        const attrs = readProps(line, index);
        if (attrs && attrs.end <= end) {
          out = out.slice(0, index) + blank(out.slice(index, attrs.end)) + out.slice(attrs.end);
          props.push(...attrs.props);
          index = attrs.end;
          continue;
        }
      }
      if (char === "(" && line[index - 1] === "]") {
        LINK_TARGET_AT.lastIndex = index;
        const target = LINK_TARGET_AT.exec(line);
        if (target && index + target[0].length <= end) {
          index += target[0].length;
          attrsAt = index;
          continue;
        }
      }
      if (char === "\\") index++;
      else if (char === "]") attrsAt = index + 1;
      index++;
    }
  };
  scan(from, to);
  return { line: out, props };
}

/** Reads a YAML props block's top-level `key: value` lines, keeping single-line scalars of text props. */
function yamlProps(
  line: string,
  offset: number,
  indent: { value?: number },
): ComarkProp | undefined {
  const entry = YAML_ENTRY.exec(line);
  if (!entry) return undefined;
  const [, space, name, raw] = entry as unknown as [string, string, string, string];
  indent.value ??= space.length;
  if (space.length !== indent.value || raw === "" || /^[|>[{&*!]/.test(raw)) return undefined;
  let start = line.indexOf(raw, space.length + name.length + 1);
  let value = raw;
  if (raw[0] === '"' || raw[0] === "'") {
    const close = raw.indexOf(raw[0], 1);
    if (close === -1 || raw.slice(close + 1).replace(/[ \t]+#.*$/, "") !== "") return undefined;
    start++;
    value = raw.slice(1, close);
  } else value = raw.replace(/[ \t]+#.*$/, "");
  if (!isText(name, value)) return undefined;
  return { name, start: offset + start, end: offset + start + value.length, text: value };
}

/**
 * Blanks Comark component markup in Markdown whose fences and code spans are already blanked, keeping
 * every offset.
 * Returns the lines with markup blanked and the text props to check on their own.
 */
export function maskComark(
  lines: string[],
  blank: (text: string) => string,
): { lines: string[]; props: ComarkProp[] } {
  const out = [...lines];
  const props: ComarkProp[] = [];
  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  let depth = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (CLOSER.test(line)) {
      out[index] = blank(line);
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0 && SLOT.test(line)) {
      out[index] = blank(line);
      continue;
    }
    const at = (spans: Span[]) =>
      props.push(
        ...spans.map((span) => ({
          name: span.name,
          start: offsets[index]! + span.start,
          end: offsets[index]! + span.end,
          text: line.slice(span.start, span.end),
        })),
      );
    const opener = OPENER.exec(line);
    const read = opener ? readComponent(line, opener[0].length) : undefined;
    if (!opener || !read || line.slice(read.end).trim() !== "") {
      const inline = BARE.test(line) ? { line: blank(line), props: [] } : maskInline(line, blank);
      out[index] = inline.line;
      at(inline.props);
      continue;
    }
    out[index] = blank(line);
    at(read.props);
    // An opener's `[text]` is its own paragraph, so it is checked apart from the body below.
    if (read.content) {
      const [start, end] = read.content;
      const inline = maskInline(line, blank, start, end);
      at(inline.props);
      props.push({
        name: "",
        start: offsets[index]! + start,
        end: offsets[index]! + end,
        text: inline.line.slice(start, end),
      });
    }
    depth++;
    // A YAML props block opens on the very next line and closes before the component does.
    if (!RULE.test(lines[index + 1] ?? "")) continue;
    let close = index + 2;
    while (close < lines.length && !RULE.test(lines[close]!) && !CLOSER.test(lines[close]!))
      close++;
    if (close >= lines.length || !RULE.test(lines[close]!)) continue;
    const indent: { value?: number } = {};
    for (let row = index + 1; row <= close; row++) {
      out[row] = blank(lines[row]!);
      const prop = yamlProps(lines[row]!, offsets[row]!, indent);
      if (prop) props.push(prop);
    }
    index = close;
  }
  return { lines: out, props };
}
