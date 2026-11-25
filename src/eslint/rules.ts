import type { Rule } from "eslint";
import { createMatcher } from "../matcher.ts";
import type { Corpus, Finding, FindingCode, Matcher } from "../types.ts";
import { splitWords } from "../words.ts";
import { type Node, type Site, place, stringListener } from "./sites.ts";

/** What the rules need besides the corpus. */
export interface RuleSettings {
  /** Callees whose first argument is skipped, besides `t`, `$t`, `te` and `tm`. */
  ignoreCallees: readonly string[];
  /** Whether `identifier` reports avoid words too. */
  identifierAvoid: boolean;
}

export type RuleName = "term" | "avoid" | "comment" | "identifier";

const matchers = new WeakMap<Corpus, Matcher>();
const identifierMatchers = new WeakMap<Corpus, Matcher>();

/** One matcher per corpus, and a second one per corpus for identifiers when avoid words count there. */
function matcherFor(corpus: Corpus, identifierAvoid = false): Matcher {
  const cache = identifierAvoid ? identifierMatchers : matchers;
  let matcher = cache.get(corpus);
  if (!matcher) {
    matcher = createMatcher(corpus, { identifierAvoid });
    cache.set(corpus, matcher);
  }
  return matcher;
}

const messages: Record<FindingCode | "suggest", string> = {
  GLOSSLINT_TERM: "{{message}}",
  GLOSSLINT_AVOID: "{{message}}",
  GLOSSLINT_CASE: "{{message}}",
  suggest: 'Change to "{{replace}}".',
};

const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim();

function docs(description: string): Rule.RuleMetaData["docs"] {
  return { description, url: "https://github.com/onmax/glosslint#eslint" };
}

/** Reports findings of a site, with an autofix for TERM and CASE and a suggestion for AVOID. */
function report(
  context: Rule.RuleContext,
  site: Site,
  findings: readonly Finding[],
  codes: ReadonlySet<FindingCode>,
): void {
  const wanted = findings.filter((finding) => codes.has(finding.code));
  if (wanted.length === 0) return;
  const { sourceCode } = context;
  const placed = place(site, sourceCode.text, wanted);
  for (const [index, finding] of wanted.entries()) {
    const { range, fixable } = placed[index]!;
    const loc = {
      start: sourceCode.getLocFromIndex(range[0]),
      end: sourceCode.getLocFromIndex(range[1]),
    };
    const replace = finding.fix?.replace;
    const fix =
      fixable && replace !== undefined
        ? (fixer: Rule.RuleFixer) => fixer.replaceTextRange(range, replace)
        : undefined;
    const base = { loc, messageId: finding.code, data: { message: oneLine(finding.message) } };
    if (finding.fix?.kind === "autofix") context.report({ ...base, fix: fix ?? null });
    else
      context.report({
        ...base,
        suggest: fix ? [{ messageId: "suggest", data: { replace: replace! }, fix }] : [],
      });
  }
}

const STRING_CODES = new Set<FindingCode>(["GLOSSLINT_TERM", "GLOSSLINT_CASE"]);
const AVOID_CODES = new Set<FindingCode>(["GLOSSLINT_AVOID"]);
const ALL_CODES = new Set<FindingCode>(["GLOSSLINT_TERM", "GLOSSLINT_AVOID", "GLOSSLINT_CASE"]);

function stringRule(
  corpus: Corpus,
  settings: RuleSettings,
  codes: ReadonlySet<FindingCode>,
  meta: Rule.RuleMetaData,
): Rule.RuleModule {
  return {
    meta: { schema: [], messages, ...meta },
    create(context) {
      const matcher = matcherFor(corpus);
      return stringListener(context, settings.ignoreCallees, (site) =>
        report(context, site, matcher.check(site.text, site.kind), codes),
      );
    },
  };
}

/** Comments that configure a tool rather than say something. */
const DIRECTIVE =
  /^\s*(?:eslint|global|globals|exported|jshint|istanbul|c8|v8|prettier-ignore|oxlint|biome|@ts-|ts-|#?(?:end)?region\b|\/\s*<reference)/;

function commentRule(corpus: Corpus): Rule.RuleModule {
  return {
    meta: {
      type: "suggestion",
      docs: docs("Check comments against the corpus: spellings, avoid words and exact casing."),
      fixable: "code",
      hasSuggestions: true,
      schema: [],
      messages,
    },
    create(context) {
      const matcher = matcherFor(corpus);
      const { sourceCode } = context;
      const source = sourceCode.text;
      const check = (comment: { value: string; range?: [number, number]; type: string }) => {
        if (!comment.range || DIRECTIVE.test(comment.value)) return;
        const base = source.indexOf(comment.value, comment.range[0]);
        if (base === -1) return;
        const text = comment.value;
        const site: Site = {
          text,
          kind: "comment",
          base,
          map: Array.from({ length: text.length + 1 }, (_, index) => index),
          within: comment.range,
          safe: (replace) =>
            comment.type === "Line" || comment.type === "YAMLComment"
              ? !/[\r\n]/.test(replace)
              : !replace.includes("*/") && !replace.includes("-->"),
        };
        report(context, site, matcher.check(text, "comment"), ALL_CODES);
      };
      return {
        Program() {
          for (const comment of sourceCode.getAllComments()) check(comment);
          const ast = sourceCode.ast as unknown as {
            templateBody?: {
              comments?: { value: string; range: [number, number]; type: string }[];
            };
          };
          for (const comment of ast.templateBody?.comments ?? []) check(comment);
        },
      };
    },
  };
}

/** The identifiers a declaration introduces: variables, functions, params, classes and properties. */
function declaredNames(node: Node): Node[] {
  const names: Node[] = [];
  const binding = (target: Node | null | undefined) => {
    if (!target) return;
    if (target.type === "Identifier") names.push(target);
    else if (target.type === "AssignmentPattern") binding(target.left);
    else if (target.type === "RestElement") binding(target.argument);
    else if (target.type === "TSParameterProperty") binding(target.parameter);
    else if (target.type === "ArrayPattern")
      for (const element of target.elements) binding(element);
    else if (target.type === "ObjectPattern")
      for (const property of target.properties as Node[]) {
        if (property.type === "RestElement") binding(property);
        // `{ apiField }` keeps a name it was given; only an alias is the writer's own name.
        else if (!property.shorthand) binding(property.value);
      }
  };
  switch (node.type) {
    case "VariableDeclarator":
      binding(node.id);
      break;
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      binding(node.id);
      for (const param of node.params) binding(param);
      break;
    case "ClassDeclaration":
    case "ClassExpression":
      binding(node.id);
      break;
    case "Property":
      if (node.parent?.type === "ObjectExpression" && !node.computed && !node.shorthand)
        if (node.key.type === "Identifier") names.push(node.key);
      break;
    case "PropertyDefinition":
    case "MethodDefinition":
    case "AccessorProperty":
      if (!node.computed && node.kind !== "constructor")
        if (node.key.type === "Identifier" || node.key.type === "PrivateIdentifier")
          names.push(node.key);
      break;
  }
  return names;
}

function identifierRule(corpus: Corpus, settings: RuleSettings): Rule.RuleModule {
  return {
    meta: {
      type: "suggestion",
      docs: docs("Check how declared names split into words. Suggests a rename, never fixes."),
      schema: [],
      messages,
    },
    create(context) {
      const matcher = matcherFor(corpus, settings.identifierAvoid);
      const { sourceCode } = context;
      const seen = new Set<Node>();
      const check = (node: unknown) => {
        for (const id of declaredNames(node as Node)) {
          if (seen.has(id)) continue;
          seen.add(id);
          const name = id.name as string;
          const start = sourceCode.text.indexOf(name, id.range[0]);
          // A one-word term says nothing about how a name splits: `allowList` is fine for "allowlist".
          const findings = matcher
            .check(name, "identifier")
            .filter(
              (finding) =>
                finding.code !== "GLOSSLINT_TERM" || splitWords(finding.term.term).length > 1,
            );
          for (const finding of findings)
            context.report({
              loc: {
                start: sourceCode.getLocFromIndex(start + finding.start),
                end: sourceCode.getLocFromIndex(start + finding.end),
              },
              messageId: finding.code,
              data: { message: oneLine(finding.message) },
            });
        }
      };
      return {
        VariableDeclarator: check,
        FunctionDeclaration: check,
        FunctionExpression: check,
        ArrowFunctionExpression: check,
        ClassDeclaration: check,
        ClassExpression: check,
        Property: check,
        PropertyDefinition: check,
        MethodDefinition: check,
        ...({ AccessorProperty: check } as Rule.RuleListener),
      };
    },
  };
}

/** The four rules, bound to one corpus. */
export function createRules(
  corpus: Corpus,
  settings: RuleSettings,
): Record<RuleName, Rule.RuleModule> {
  return {
    term: stringRule(corpus, settings, STRING_CODES, {
      type: "suggestion",
      docs: docs("Spell terms as the corpus does, with the casing it asks for."),
      fixable: "code",
    }),
    avoid: stringRule(corpus, settings, AVOID_CODES, {
      type: "suggestion",
      docs: docs("Report words the corpus says to avoid, and suggest the term."),
      hasSuggestions: true,
    }),
    comment: commentRule(corpus),
    identifier: identifierRule(corpus, settings),
  };
}
