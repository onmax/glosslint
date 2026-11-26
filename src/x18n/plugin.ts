import type {
  Check,
  CheckContext,
  DiagnosticInput,
  Fix,
  LocaleCode,
  Message,
  Plugin,
  TextRange,
} from "@x18n/core";
import { caseModeOf, classify } from "../kind.ts";
import { createMatcher } from "../matcher.ts";
import type { Corpus, Finding, FindingCode, KindOf } from "../types.ts";

const CHECKS: ReadonlyArray<
  Pick<Check, "id" | "defaultSeverity" | "description"> & { code: FindingCode }
> = [
  {
    id: "glosslint-term",
    code: "GLOSSLINT_TERM",
    defaultSeverity: "error",
    description: "A corpus term written with other words, splits or hyphens.",
  },
  {
    id: "glosslint-avoid",
    code: "GLOSSLINT_AVOID",
    defaultSeverity: "warning",
    description: "A word the corpus says to avoid, with the term to use instead.",
  },
  {
    id: "glosslint-case",
    code: "GLOSSLINT_CASE",
    defaultSeverity: "error",
    description: "A corpus term written with the wrong capitals.",
  },
];

interface Item {
  code: FindingCode;
  diagnostic: DiagnosticInput;
}

/**
 * Where `value` starts inside `range` of the file: at the range's start when the file holds it as is, one past it when
 * the range only adds quotes. Undefined when escapes or template arguments make offsets differ.
 */
function valueStart(text: string | undefined, range: TextRange, value: string): number | undefined {
  const raw = text?.slice(range.start, range.end);
  if (raw === value) return range.start;
  if (raw?.length === value.length + 2 && raw.slice(1, -1) === value) return range.start + 1;
  return undefined;
}

function locate(
  path: string | undefined,
  range: TextRange | undefined,
  start: number | undefined,
  finding: Finding,
) {
  if (path === undefined || range === undefined) return undefined;
  return {
    path,
    range: start === undefined ? range : { start: start + finding.start, end: start + finding.end },
  };
}

/** Applies the autofixes right to left, skipping one that overlaps a fix already applied. */
function applyFixes(value: string, findings: readonly Finding[]): string {
  let out = value;
  let limit = value.length;
  for (const finding of [...findings].sort((a, b) => b.start - a.start)) {
    if (!finding.fix || finding.end > limit) continue;
    out = out.slice(0, finding.start) + finding.fix.replace + out.slice(finding.end);
    limit = finding.start;
  }
  return out;
}

/**
 * The fixes of a message finding. x18n's `--fix` keeps the first `set` of a key, so when a message has several
 * autofixes, each finding's safe fix applies all of them, and a quick fix without a level applies only its own.
 * A fix left out of `autofixes`, because only the message's shape placed it, gets only the quick fix.
 */
function messageFixes(
  message: Message,
  value: string,
  finding: Finding,
  autofixes: Finding[],
): Fix[] {
  if (finding.fix?.kind !== "autofix") return [];
  const set = (findings: Finding[]) => [
    {
      type: "set" as const,
      key: message.key,
      locale: message.locale,
      value: applyFixes(value, findings),
    },
  ];
  const own = `Change "${finding.text}" to "${finding.fix.replace}"`;
  if (!autofixes.includes(finding)) return [{ title: own, ops: set([finding]) }];
  if (autofixes.length === 1) return [{ title: own, level: "safe", ops: set(autofixes) }];
  return [
    {
      title: `Fix ${autofixes.length} terms in "${message.key}"`,
      level: "safe",
      ops: set(autofixes),
    },
    { title: own, ops: set([finding]) },
  ];
}

/** What the plugin needs besides the corpus. */
export interface PluginSettings {
  /** The locale whose messages are checked. Default: the project's source locale. */
  sourceLocale?: string;
  /** Decides a message's or hard string's kind before glosslint's own `kindOf`. */
  kindOf?: KindOf;
}

/** The x18n plugin for a corpus. `x18n.ts` reads the corpus from a glossary file when it is given none. */
export function createPlugin(corpus: Corpus, options: PluginSettings = {}): Plugin {
  const matcher = createMatcher(corpus);

  function* collect(ctx: CheckContext): Generator<Item> {
    const locale: LocaleCode = options.sourceLocale ?? ctx.sourceLocale;
    const paths = new Map(ctx.resources.map((resource) => [resource.id, resource.path]));
    for (const message of ctx.messages(locale)) {
      const value = message.value;
      if (typeof value !== "string") continue;
      const path = paths.get(message.resource);
      const { kind, guessed } = classify(
        { name: message.key, text: value, shown: true, ...(path ? { file: path } : {}) },
        options.kindOf,
      );
      const findings = matcher.check(value, kind);
      if (findings.length === 0) continue;
      const range = message.range?.value;
      const start =
        path !== undefined && range ? valueStart(ctx.text(path), range, value) : undefined;
      // Where only the message's shape decided its kind, a `context` term's fix needs a person.
      const safe = (finding: Finding) =>
        finding.fix?.kind === "autofix" && !(guessed && caseModeOf(finding.term) === "context");
      const autofixes = findings.filter(safe);
      for (const finding of findings) {
        yield {
          code: finding.code,
          diagnostic: {
            key: message.key,
            locale: message.locale,
            message: finding.message,
            location: locate(path, range, start, finding),
            fixes: messageFixes(message, value, finding, autofixes),
          },
        };
      }
    }
    // x18n has no edit op for source files outside extraction, so hard strings get no fix.
    for (const hard of ctx.hardStrings()) {
      const { kind } = classify(
        {
          text: hard.text,
          file: hard.path,
          shown: hard.attribute === undefined,
          ...(hard.attribute !== undefined ? { name: hard.attribute } : {}),
        },
        options.kindOf,
      );
      const findings = matcher.check(hard.text, kind);
      if (findings.length === 0) continue;
      const start = valueStart(ctx.text(hard.path), hard.range, hard.text);
      for (const finding of findings) {
        yield {
          code: finding.code,
          diagnostic: {
            message: finding.message,
            location: locate(hard.path, hard.range, start, finding),
          },
        };
      }
    }
  }

  // The three checks share one pass per analysis: x18n gives each check a copy of the same context.
  let cache: { source: CheckContext["messages"]; items: Item[] } | undefined;
  const items = (ctx: CheckContext): Item[] => {
    if (cache?.source !== ctx.messages) cache = { source: ctx.messages, items: [...collect(ctx)] };
    return cache.items;
  };

  return {
    name: "glosslint",
    checks: CHECKS.map(({ code, ...check }) => ({
      ...check,
      docs: "https://github.com/onmax/glosslint#readme",
      *run(ctx: CheckContext) {
        for (const item of items(ctx)) if (item.code === code) yield item.diagnostic;
      },
    })),
  };
}
