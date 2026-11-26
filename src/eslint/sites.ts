import type { Rule } from "eslint";
import { type Classified, classify } from "../kind.ts";
import type { Finding, KindOf, KindSite, TextKind } from "../types.ts";
import { isCodeShape } from "../words.ts";
import { identityMap, jsMap, yamlDoubleMap, yamlSingleMap } from "./offsets.ts";

/** An AST node from any of the parsers: ESTree, vue-eslint-parser's template, yaml-eslint-parser or jsonc-eslint-parser. */
// oxlint-disable-next-line typescript/no-explicit-any
export type Node = { type: string; range: [number, number]; parent?: Node | null } & Record<
  string,
  any
>;

/** A piece of text to check, and how to find its findings in the source. */
export interface Site {
  /** The text as the matcher reads it: the cooked string value. */
  text: string;
  kind: TextKind;
  /** Whether only the text's shape decided `kind`, so a fix that depends on it needs a person. */
  guessed: boolean;
  /** Source offset of the raw text that `map` indexes. */
  base: number;
  /** Cooked offset to raw offset, or `undefined` when the source can't be read back exactly. */
  map?: number[];
  /** The source range the text came from, searched when there is no map. */
  within: [number, number];
  /** Whether `replace` can be written into the source as it is. */
  safe: (replace: string) => boolean;
}

/** Where a finding is in the source, and whether a fix may be offered there. */
export interface Placed {
  range: [number, number];
  fixable: boolean;
}

const ALWAYS_IGNORED = ["t", "$t", "te", "tm"];

/** The callees whose first argument `ignoreCallees` replaces by default. */
export const DEFAULT_IGNORE_CALLEES = ["endsWith", "startsWith", "includes", "querySelector*"];

const SKIPPED_ATTRIBUTES = new Set([
  "class",
  "style",
  "id",
  "key",
  "ref",
  "name",
  "to",
  "href",
  "src",
  "icon",
  "type",
  "variant",
  "color",
  "size",
  "slot",
  "is",
  "for",
  // vue-i18n's <i18n-t keypath="..."> names a message, it doesn't show one.
  "keypath",
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-owns",
]);

const COMPARISONS = new Set(["==", "===", "!=", "!==", "<", ">", "<=", ">=", "in", "instanceof"]);

/** Nodes a string passes through without changing what it is. */
const WRAPPERS = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "ParenthesizedExpression",
  "ChainExpression",
]);

/** Nodes a string passes through on its way to the name it is assigned to. */
const NAME_WRAPPERS = new Set([
  ...WRAPPERS,
  "ConditionalExpression",
  "LogicalExpression",
  "ArrayExpression",
  "TemplateLiteral",
  "BinaryExpression",
]);

export function isSkippedAttribute(name: string | undefined): boolean {
  if (name === undefined) return false;
  const lower = name.toLowerCase();
  return SKIPPED_ATTRIBUTES.has(lower) || lower.startsWith("data-");
}

function nameOf(node: Node | null | undefined): string | undefined {
  if (!node) return undefined;
  if (node.type === "Identifier" || node.type === "PrivateIdentifier") return node.name as string;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "MemberExpression" && !node.computed) return nameOf(node.property);
  return undefined;
}

function calleeName(node: Node): string | undefined {
  const callee = node.callee as Node;
  if (callee.type === "Identifier") return callee.name as string;
  if (callee.type === "MemberExpression") return nameOf(callee.property);
  return undefined;
}

function matchesCallee(name: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) =>
    pattern.endsWith("*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern,
  );
}

/** The attribute or directive argument name of a Vue attribute. */
export function attributeName(attribute: Node): string | undefined {
  const key = attribute.key as Node;
  if (!attribute.directive) return (key.rawName ?? key.name) as string;
  const argument = key.argument as Node | null;
  return argument?.type === "VIdentifier"
    ? ((argument.rawName ?? argument.name) as string)
    : undefined;
}

/** Whether a string literal or template literal sits where decision 7 says it is code. */
export function isSkippedString(node: Node, ignoreCallees: readonly string[]): boolean {
  let child = node;
  let parent = node.parent;
  while (
    parent &&
    (WRAPPERS.has(parent.type) || (parent.type === "BinaryExpression" && parent.operator === "+"))
  ) {
    child = parent;
    parent = parent.parent;
  }
  if (!parent) return false;
  switch (parent.type) {
    case "ImportDeclaration":
    case "ExportAllDeclaration":
    case "ExportNamedDeclaration":
    case "ImportExpression":
    case "TSExternalModuleReference":
    case "TSImportType":
    case "ImportAttribute":
    case "ImportSpecifier":
    case "ExportSpecifier":
    case "TSLiteralType":
    case "TaggedTemplateExpression":
      return true;
    case "ExpressionStatement":
      return parent.directive !== undefined;
    case "Property":
    case "PropertyDefinition":
    case "MethodDefinition":
    case "AccessorProperty":
    case "TSPropertySignature":
    case "TSAbstractPropertyDefinition":
      // A quoted key with a space is text, such as an export's column header.
      return parent.key === child && !(parent.type === "Property" && isTextKey(child));
    case "TSEnumMember":
      return parent.id === child;
    case "MemberExpression":
      return parent.property === child;
    case "BinaryExpression":
      return COMPARISONS.has(parent.operator as string);
    case "SwitchCase":
      return parent.test === child;
    case "CallExpression":
    case "NewExpression": {
      if ((parent.arguments as Node[])[0] !== child) return false;
      const name = calleeName(parent);
      return (
        name !== undefined && (ALWAYS_IGNORED.includes(name) || matchesCallee(name, ignoreCallees))
      );
    }
  }
  return false;
}

function isTextKey(node: Node): boolean {
  return node.type === "Literal" && typeof node.value === "string" && /\s/.test(node.value);
}

/** Decides the kind of a string from what the site builder knows about it. */
export type Decide = (site: KindSite) => Classified;

/** The name `kindOf` reads for a string: the key, variable, attribute or YAML key it belongs to. */
export function stringName(node: Node): string | undefined {
  let child = node;
  let parent = node.parent;
  while (parent && NAME_WRAPPERS.has(parent.type)) {
    if (parent.type === "BinaryExpression" && parent.operator !== "+") break;
    child = parent;
    parent = parent.parent;
  }
  if (!parent) return undefined;
  switch (parent.type) {
    case "Property":
    case "PropertyDefinition":
      return parent.value === child ? nameOf(parent.key) : undefined;
    case "VariableDeclarator":
      return nameOf(parent.id);
    case "AssignmentExpression":
    case "AssignmentPattern":
      return nameOf(parent.left);
    case "VExpressionContainer": {
      const holder = parent.parent;
      if (holder?.type === "VAttribute") return attributeName(holder);
      return "text";
    }
  }
  return undefined;
}

/** The Vue attribute a template expression belongs to, if any. */
function enclosingAttribute(node: Node): Node | undefined {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === "VAttribute") return current;
    if (current.type === "VElement") return undefined;
  }
  return undefined;
}

function noneOf(...forbidden: string[]): (replace: string) => boolean {
  return (replace) => !forbidden.some((text) => replace.includes(text));
}

const NEWLINES = ["\n", "\r"];
/** U+0000 to U+001F, which JSON allows in a string only escaped. */
const JSON_CONTROL = Array.from({ length: 0x20 }, (_, code) => String.fromCharCode(code));

/** Builds the sites of a JS string literal or template literal, or none when it is skipped. */
export function esSites(
  node: Node,
  source: string,
  ignoreCallees: readonly string[],
  inTemplate: boolean,
  decide: Decide,
): Site[] {
  if (isSkippedString(node, ignoreCallees)) return [];
  if (inTemplate && isSkippedAttribute(attributeNameOf(node))) return [];
  const name = stringName(node);
  if (node.type === "Literal") {
    const text = node.value as string;
    if (isCodeShape(text)) return [];
    const raw = (node.raw as string).slice(1, -1);
    const quote = (node.raw as string)[0]!;
    // A quoted text key is reported, but renaming it would break every reader of that key.
    const isKey = node.parent?.type === "Property" && node.parent.key === node;
    return [
      {
        text,
        ...decide({ name, text }),
        base: node.range[0] + 1,
        map: jsMap(raw, text),
        within: node.range,
        safe: isKey ? () => false : noneOf(quote, "\\", ...NEWLINES),
      },
    ];
  }
  const quasis = node.quasis as Node[];
  const cookedOf = (quasi: Node) => (quasi.value as { cooked: string | null }).cooked;
  // A template is code when its text, read without the expressions, is: `item-${id}`.
  if (isCodeShape(quasis.map((quasi) => cookedOf(quasi) ?? "").join(""))) return [];
  // Every part of a template is the same kind of text: the kind of the whole, with each expression as a word.
  const { kind, guessed } = decide({
    name,
    text: quasis.map((quasi) => cookedOf(quasi) ?? "").join("x"),
  });
  const sites: Site[] = [];
  for (const quasi of quasis) {
    const cooked = cookedOf(quasi);
    const raw = (quasi.value as { raw: string }).raw;
    if (cooked === null || cooked.trim() === "") continue;
    const base = quasi.range[0] + 1;
    const exact = source.slice(base, base + raw.length) === raw;
    sites.push({
      text: cooked,
      kind,
      guessed,
      base,
      map: exact ? jsMap(raw, cooked) : undefined,
      within: quasi.range,
      safe: noneOf("`", "${", "\\"),
    });
  }
  return sites;
}

function attributeNameOf(node: Node): string | undefined {
  const attribute = enclosingAttribute(node);
  return attribute ? attributeName(attribute) : undefined;
}

/** The name a Vue text node's element gives it: the slot of a `<template #header>`, else the tag. */
function elementName(node: Node): string | undefined {
  const element = node.parent;
  if (element?.type !== "VElement") return undefined;
  const tag = String(element.rawName ?? element.name ?? "");
  if (tag !== "template") return tag;
  const attributes = ((element.startTag as Node | undefined)?.attributes ?? []) as Node[];
  for (const attribute of attributes) {
    const key = attribute.key as Node | undefined;
    if (!attribute.directive || (key?.name as Node | undefined)?.name !== "slot") continue;
    const argument = key?.argument as Node | null | undefined;
    if (argument?.type === "VIdentifier") return String(argument.rawName ?? argument.name);
  }
  return undefined;
}

/** Builds the site of a Vue template text node. */
export function textSite(node: Node, source: string, decide: Decide): Site | undefined {
  const text = node.value as string;
  if (text.trim() === "") return undefined;
  const raw = source.slice(node.range[0], node.range[1]);
  return {
    text,
    ...decide({ name: elementName(node), text, shown: true }),
    base: node.range[0],
    map: identityMap(raw, text),
    within: node.range,
    safe: noneOf("<", "&", "{{", "}}"),
  };
}

/** Builds the site of a static Vue attribute value. */
export function attributeSite(attribute: Node, source: string, decide: Decide): Site | undefined {
  const value = attribute.value as Node | null;
  if (attribute.directive || !value || value.type !== "VLiteral") return undefined;
  const name = attributeName(attribute);
  const text = value.value as string;
  if (isSkippedAttribute(name) || text.trim() === "" || isCodeShape(text)) return undefined;
  let raw = source.slice(value.range[0], value.range[1]);
  let base = value.range[0];
  const quote = /^["']/.test(raw) ? raw[0]! : "";
  if (quote) {
    raw = raw.slice(1, -1);
    base++;
  }
  return {
    text,
    ...decide({ name, text }),
    base,
    map: identityMap(raw, text),
    within: value.range,
    safe: quote
      ? noneOf("&", '"', "'", "<", ...NEWLINES)
      : noneOf("&", '"', "'", "<", ">", "=", "`", " ", "\t", ...NEWLINES),
  };
}

function yamlKeyName(node: Node): string | undefined {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type !== "YAMLPair") continue;
    const key = current.key as Node | null;
    if (key?.type === "YAMLScalar" && key.value !== null) return String(key.value);
    return undefined;
  }
  return undefined;
}

/** Builds the site of a YAML string value; keys are never checked. */
export function yamlSite(node: Node, decide: Decide): Site | undefined {
  if (typeof node.value !== "string" || node.value.trim() === "") return undefined;
  const parent = node.parent;
  if (parent?.type === "YAMLPair" && parent.key === node) return undefined;
  const text = node.value;
  const name = yamlKeyName(node);
  const raw = typeof node.raw === "string" ? node.raw : "";
  const site = { text, ...decide({ name, text, shown: true }), within: node.range };
  switch (node.style) {
    case "plain":
      return {
        ...site,
        base: node.range[0],
        map: /[\r\n]/.test(raw) ? undefined : identityMap(raw, text),
        safe: noneOf("#", ":", ",", "[", "]", "{", "}", ...NEWLINES),
      };
    case "single-quoted":
      return {
        ...site,
        base: node.range[0] + 1,
        map: yamlSingleMap(raw.slice(1, -1), text),
        safe: noneOf("'", ...NEWLINES),
      };
    case "double-quoted":
      return {
        ...site,
        base: node.range[0] + 1,
        map: yamlDoubleMap(raw.slice(1, -1), text),
        safe: noneOf('"', "\\", ...NEWLINES),
      };
    default:
      // Block scalars fold and indent their lines, so a finding is placed but never fixed.
      return { ...site, base: node.range[0], safe: () => false };
  }
}

function jsonKeyName(node: Node): string | undefined {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type !== "JSONProperty") continue;
    const key = current.key as Node;
    if (key.type === "JSONIdentifier") return key.name as string;
    return typeof key.value === "string" ? key.value : undefined;
  }
  return undefined;
}

/** Builds the site of a JSON string value; keys are never checked. */
export function jsonSite(node: Node, decide: Decide): Site | undefined {
  if (typeof node.value !== "string" || node.value.trim() === "") return undefined;
  const parent = node.parent;
  if (parent?.type === "JSONProperty" && parent.key === node) return undefined;
  const text = node.value;
  const raw = node.raw as string;
  return {
    text,
    ...decide({ name: jsonKeyName(node), text, shown: true }),
    base: node.range[0] + 1,
    map: jsMap(raw.slice(1, -1), text),
    within: node.range,
    safe: noneOf(raw[0]!, "\\", ...JSON_CONTROL),
  };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Places a site's findings in the source. With a map each offset is exact; without one each finding's
 * text is searched for in the site's source, in order, and no fix is offered.
 */
export function place(site: Site, source: string, findings: readonly Finding[]): Placed[] {
  let cursor = site.within[0];
  return findings.map((finding) => {
    const map = site.map;
    if (map) {
      const start = site.base + map[finding.start]!;
      const end = site.base + map[finding.end]!;
      return { range: [start, end], fixable: !finding.fix || site.safe(finding.fix.replace) };
    }
    const pattern = new RegExp(escapeRegExp(finding.text.trim()).replace(/\s+/g, "\\s+"), "gu");
    pattern.lastIndex = cursor;
    const area = source.slice(0, site.within[1]);
    const match = pattern.exec(area);
    if (!match) return { range: site.within, fixable: false };
    cursor = match.index + match[0].length;
    return { range: [match.index, cursor], fixable: false };
  });
}

/** Builds the listener that hands every checkable string of a file to `onSite`. */
export function stringListener(
  context: Rule.RuleContext,
  ignoreCallees: readonly string[],
  kindOf: KindOf | undefined,
  onSite: (site: Site) => void,
): Rule.RuleListener {
  const source = context.sourceCode.text;
  const file = context.filename;
  const decide: Decide = (site) => classify({ ...site, file }, kindOf);
  const emit = (site: Site | undefined) => site && onSite(site);
  const es = (inTemplate: boolean) => (node: unknown) => {
    const n = node as Node;
    if (n.type === "Literal" && typeof n.value !== "string") return;
    for (const site of esSites(n, source, ignoreCallees, inTemplate, decide)) onSite(site);
  };
  const script: Rule.RuleListener = {
    Literal: es(false),
    TemplateLiteral: es(false),
    // yaml-eslint-parser's and jsonc-eslint-parser's node types are not ESTree's, so the listener type does not know them.
    ...({
      YAMLScalar: (node: unknown) => emit(yamlSite(node as Node, decide)),
      JSONLiteral: (node: unknown) => emit(jsonSite(node as Node, decide)),
    } as Rule.RuleListener),
  };
  const services = context.sourceCode.parserServices as
    | { defineTemplateBodyVisitor?: (template: object, script: object) => Rule.RuleListener }
    | undefined;
  if (!services?.defineTemplateBodyVisitor) return script;
  return services.defineTemplateBodyVisitor(
    {
      VText: (node: Node) => emit(textSite(node, source, decide)),
      VAttribute: (node: Node) => emit(attributeSite(node, source, decide)),
      Literal: es(true),
      TemplateLiteral: es(true),
    },
    script,
  );
}
