import { resolve } from "node:path";
import { type Binding, createRules } from "./eslint/rules.ts";
import { DEFAULT_IGNORE_CALLEES } from "./eslint/sites.ts";
import { DEFAULT_GLOSSARY, fromGlossary } from "./glossary.ts";
import type { Corpus } from "./types.ts";

/** `settings.glosslint` in `.oxlintrc.json`. */
export interface GlosslintOxlintSettings {
  /** The glossary file to read instead of `.agents/glossary.md`, resolved from Oxlint's working folder. */
  glossary?: string;
  /** Callees whose first argument is never checked, added to `t`, `$t`, `te` and `tm`. */
  ignoreCallees?: string[];
  /** Report avoid words in declared names too. */
  identifierAvoid?: boolean;
}

interface OxlintRule {
  meta?: object;
  create(context: never): object;
}

/** An Oxlint JS plugin, typed without Oxlint or ESLint so neither is needed for the types. */
export interface GlosslintOxlintPlugin {
  meta: { name: "glosslint" };
  rules: Record<"term" | "avoid" | "comment" | "identifier", OxlintRule>;
}

/** What `bind` reads from Oxlint's rule context. */
interface OxlintContext {
  cwd: string;
  settings: { glosslint?: GlosslintOxlintSettings };
}

// Read once per path and kept for the process: Oxlint has no hook that runs before the first file.
const corpora = new Map<string, Corpus>();

function corpusAt(file: string): Corpus {
  let corpus = corpora.get(file);
  if (!corpus) {
    corpus = fromGlossary(file);
    corpora.set(file, corpus);
  }
  return corpus;
}

function bind(context: unknown): Binding {
  const { cwd, settings } = context as OxlintContext;
  const options = settings.glosslint ?? {};
  return {
    corpus: corpusAt(resolve(cwd, options.glossary ?? DEFAULT_GLOSSARY)),
    settings: {
      ignoreCallees: options.ignoreCallees ?? DEFAULT_IGNORE_CALLEES,
      identifierAvoid: options.identifierAvoid ?? false,
    },
  };
}

/**
 * glosslint's rules as an Oxlint JS plugin: `"jsPlugins": ["glosslint/oxlint"]`. The rules read
 * `.agents/glossary.md`, or `settings.glosslint.glossary`, from Oxlint's working folder on the first file.
 */
const plugin: GlosslintOxlintPlugin = { meta: { name: "glosslint" }, rules: createRules(bind) };

export default plugin;
