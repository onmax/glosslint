import type { ESLint, Linter } from "eslint";
import { CONFIG_ERRORS } from "./corpus.ts";
import { GlosslintConfigError } from "./errors.ts";
import { createRules } from "./eslint/rules.ts";
import { fromGlossary } from "./glossary.ts";
import { DEFAULT_IGNORE_CALLEES } from "./eslint/sites.ts";
import type { Corpus, KindOf } from "./types.ts";

/** Options of the ESLint config. */
export interface GlosslintEslintOptions {
  /** The glossary file to read instead of `.agents/glossary.md`. A string resolves from the current folder. */
  glossary?: string | URL;
  /** A corpus to use instead of a glossary file, such as `defineCorpus({ extends: [fromGlossary()], … })`. */
  corpus?: Corpus;
  /** Files the rules run on. */
  files?: string[];
  /**
   * Callees whose first argument is never checked, added to `t`, `$t`, `te` and `tm`. Defaults to
   * `endsWith`, `startsWith`, `includes` and `querySelector*`; a name ending in `*` matches as a prefix.
   */
  ignoreCallees?: string[];
  /** Report avoid words in declared names too. Off by default, since a rename touches every caller. */
  identifierAvoid?: boolean;
  /**
   * Decides whether a string is a label, header or sentence before glosslint's own `kindOf`, from its
   * text, name and file. Return `undefined` to leave a string to glosslint.
   */
  kindOf?: KindOf;
}

/**
 * ESLint flat configs that run glosslint's rules: `...glosslint()`. The corpus comes from `corpus`, else
 * from the `glossary` file, else from `.agents/glossary.md`, read once when the config is built. They set
 * no parser: your config supplies typescript-eslint, vue-eslint-parser or yaml-eslint-parser.
 */
export default function glosslint(options: GlosslintEslintOptions = {}): Linter.Config[] {
  if (options.corpus && options.glossary !== undefined)
    throw new GlosslintConfigError({
      code: CONFIG_ERRORS.glossaryAndCorpus,
      why: "glosslint() takes `glossary` or `corpus`, not both.",
      fix: "Pass `glossary` to read a file, or `corpus` with `extends: [fromGlossary(…)]` to add to one.",
    });
  const binding = {
    corpus: options.corpus ?? fromGlossary(options.glossary),
    settings: {
      ignoreCallees: options.ignoreCallees ?? DEFAULT_IGNORE_CALLEES,
      identifierAvoid: options.identifierAvoid ?? false,
      ...(options.kindOf ? { kindOf: options.kindOf } : {}),
    },
  };
  const rules = createRules(() => binding);
  const plugin: ESLint.Plugin = { meta: { name: "glosslint" }, rules };
  return [
    {
      name: "glosslint",
      ...(options.files ? { files: options.files } : {}),
      plugins: { glosslint: plugin },
      rules: {
        "glosslint/term": "error",
        "glosslint/avoid": "error",
        "glosslint/comment": "error",
        "glosslint/identifier": "warn",
      },
    },
  ];
}
