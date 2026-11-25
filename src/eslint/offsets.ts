/**
 * Maps from a string's cooked value back to its source text. Each map has one entry per UTF-16 unit of
 * the cooked value plus one for its end, each an offset into the raw text (the source between the
 * quotes). A map is `undefined` when the raw text can't be read back exactly, and then no fix is offered.
 */

const JS_SIMPLE: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
  v: "\v",
  "0": "\0",
};

const YAML_SIMPLE: Record<string, string> = {
  "0": "\0",
  a: "\x07",
  b: "\b",
  t: "\t",
  "\t": "\t",
  n: "\n",
  v: "\v",
  f: "\f",
  r: "\r",
  e: "\x1b",
  " ": " ",
  '"': '"',
  "/": "/",
  "\\": "\\",
  N: "\u0085",
  _: " ",
  L: " ",
  P: " ",
};

const HEX: Record<string, number> = { x: 2, u: 4, U: 8 };

/** Reads the escapes of a JS string literal or template quasi. */
export function jsMap(raw: string, cooked: string): number[] | undefined {
  const map: number[] = [];
  let out = "";
  const emit = (text: string, at: number) => {
    for (let unit = 0; unit < text.length; unit++) map.push(at);
    out += text;
  };
  for (let index = 0; index < raw.length;) {
    const char = raw[index]!;
    if (char !== "\\") {
      emit(char, index);
      index++;
      continue;
    }
    const next = raw[index + 1];
    if (next === undefined) return undefined;
    if (next === "\r" && raw[index + 2] === "\n") {
      index += 3;
      continue;
    }
    if ("\n\r  ".includes(next)) {
      index += 2;
      continue;
    }
    if (next === "x" || (next === "u" && raw[index + 2] !== "{")) {
      const size = next === "x" ? 2 : 4;
      const hex = raw.slice(index + 2, index + 2 + size);
      if (!/^[\da-f]+$/i.test(hex) || hex.length !== size) return undefined;
      emit(String.fromCharCode(Number.parseInt(hex, 16)), index);
      index += 2 + size;
      continue;
    }
    if (next === "u") {
      const close = raw.indexOf("}", index);
      const hex = raw.slice(index + 3, close);
      if (close === -1 || !/^[\da-f]+$/i.test(hex)) return undefined;
      emit(String.fromCodePoint(Number.parseInt(hex, 16)), index);
      index = close + 1;
      continue;
    }
    // Legacy octal escapes are rare enough to give up on.
    if (/\d/.test(next) && (next !== "0" || /\d/.test(raw[index + 2] ?? ""))) return undefined;
    emit(JS_SIMPLE[next] ?? next, index);
    index += 2;
  }
  map.push(raw.length);
  return out === cooked ? map : undefined;
}

/** Reads a single-quoted YAML scalar on one line, where `''` is a quote. */
export function yamlSingleMap(raw: string, cooked: string): number[] | undefined {
  if (/[\r\n]/.test(raw)) return undefined;
  const map: number[] = [];
  let out = "";
  for (let index = 0; index < raw.length; index++) {
    map.push(index);
    out += raw[index];
    if (raw[index] === "'" && raw[index + 1] === "'") index++;
  }
  map.push(raw.length);
  return out === cooked ? map : undefined;
}

/** Reads a double-quoted YAML scalar on one line, with its backslash escapes. */
export function yamlDoubleMap(raw: string, cooked: string): number[] | undefined {
  if (/[\r\n]/.test(raw)) return undefined;
  const map: number[] = [];
  let out = "";
  const emit = (text: string, at: number) => {
    for (let unit = 0; unit < text.length; unit++) map.push(at);
    out += text;
  };
  for (let index = 0; index < raw.length;) {
    const char = raw[index]!;
    if (char !== "\\") {
      emit(char, index);
      index++;
      continue;
    }
    const next = raw[index + 1] ?? "";
    const size = HEX[next];
    if (size) {
      const hex = raw.slice(index + 2, index + 2 + size);
      if (!/^[\da-f]+$/i.test(hex) || hex.length !== size) return undefined;
      emit(String.fromCodePoint(Number.parseInt(hex, 16)), index);
      index += 2 + size;
      continue;
    }
    const simple = YAML_SIMPLE[next];
    if (simple === undefined) return undefined;
    emit(simple, index);
    index += 2;
  }
  map.push(raw.length);
  return out === cooked ? map : undefined;
}

/** The identity map, for text whose source is the value itself. */
export function identityMap(raw: string, cooked: string): number[] | undefined {
  if (raw !== cooked) return undefined;
  return Array.from({ length: raw.length + 1 }, (_, index) => index);
}
