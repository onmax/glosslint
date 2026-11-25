import type { ESLint, Linter } from "eslint";
import { createRules } from "./eslint/rules.ts";
import { DEFAULT_IGNORE_CALLEES } from "./eslint/sites.ts";
import type { Corpus } from "./types.ts";

/** Options of the ESLint config. */
export interface GlosslintEslintOptions {
  /** The corpus, usually `import corpus from './glosslint.config.ts'`. */
  corpus: Corpus;
  /** Files the rules run on. */
  files?: string[];
  /**
   * Callees whose first argument is never checked, added to `t`, `$t`, `te` and `tm`. Defaults to
   * `endsWith`, `startsWith`, `includes` and `querySelector*`; a name ending in `*` matches as a prefix.
   */
  ignoreCallees?: string[];
  /** Report avoid words in declared names too. Off by default, since a rename touches every caller. */
  identifierAvoid?: boolean;
}

/**
 * ESLint flat configs that run glosslint's rules: `...glosslint({ corpus, files })`. They set no
 * parser: your config supplies typescript-eslint, vue-eslint-parser or yaml-eslint-parser.
 */
export default function glosslint(options: GlosslintEslintOptions): Linter.Config[] {
  const rules = createRules(options.corpus, {
    ignoreCallees: options.ignoreCallees ?? DEFAULT_IGNORE_CALLEES,
    identifierAvoid: options.identifierAvoid ?? false,
  });
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
