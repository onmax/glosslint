// Comark (and MDC) component syntax in Markdown: `::name{props}` blocks, `#slot` lines, YAML props
// and whole-line `:name{props}` components. Markup is blanked; the values of text props are kept.
import { isTextName } from "./kind.ts";
import { isCodeShape } from "./words.ts";

/** A prop value people read, such as a card's `title`, with its offsets in the source. */
export interface ComarkProp {
  name: string;
  start: number;
  end: number;
}

const OPENER = /^[ \t]*(:{2,})[A-Za-z][\w-]*/;
const INLINE = /^[ \t]*:[A-Za-z][\w-]*(?=[{[]|[ \t]*\r?$)/;
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

/**
 * Reads a whole component line: the name, then optional `[text]` and `{props}`, then nothing else.
 * Returns the text props and the kept `[text]`, or `undefined` when the line is something else.
 */
function readComponentLine(
  line: string,
  nameEnd: number,
):
  | { props: { name: string; start: number; end: number }[]; content?: [number, number] }
  | undefined {
  let index = nameEnd;
  let content: [number, number] | undefined;
  if (line[index] === "[") {
    const end = scanBrackets(line, index);
    if (end === undefined) return undefined;
    content = [index + 1, end - 1];
    index = end;
  }
  const props: { name: string; start: number; end: number }[] = [];
  if (line[index] === "{") {
    const scanned = scanAttributes(line, index);
    if (!scanned) return undefined;
    for (const attribute of scanned.attributes)
      if (
        attribute.value &&
        isText(attribute.name, line.slice(attribute.value.start, attribute.value.end))
      )
        props.push({ name: attribute.name, ...attribute.value });
    index = scanned.end;
  }
  if (line.slice(index).trim() !== "") return undefined;
  return { props, ...(content ? { content } : {}) };
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
  if ((raw[0] === '"' || raw[0] === "'") && raw.at(-1) === raw[0] && raw.length >= 2) {
    start++;
    value = raw.slice(1, -1);
  } else value = raw.replace(/[ \t]+#.*$/, "");
  if (!isText(name, value)) return undefined;
  return { name, start: offset + start, end: offset + start + value.length };
}

/**
 * Blanks Comark component markup in Markdown whose fences are already blanked, keeping every offset.
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
    const opener = OPENER.exec(line);
    const inline = opener ? undefined : INLINE.exec(line);
    const match = opener ?? inline;
    if (!match) continue;
    const read = readComponentLine(line, match[0].length);
    if (!read) continue;
    out[index] = blank(line);
    for (const prop of read.props)
      props.push({
        name: prop.name,
        start: offsets[index]! + prop.start,
        end: offsets[index]! + prop.end,
      });
    if (read.content) {
      const [start, end] = read.content;
      out[index] = blank(line.slice(0, start)) + line.slice(start, end) + blank(line.slice(end));
    }
    if (!opener) continue;
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
