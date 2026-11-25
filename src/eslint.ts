import type { Linter } from "eslint";
import type { Corpus } from "./types.ts";

/** Options of the ESLint config. */
export interface GlosslintEslintOptions {
  /** The corpus, usually `import corpus from './glosslint.config.ts'`. */
  corpus: Corpus;
  /** Files the rules run on. */
  files?: string[];
  /** Callees whose first argument is never checked, added to `t`, `$t`, `te` and `tm`. */
  ignoreCallees?: string[];
}

/** ESLint flat configs that run glosslint's rules: `...glosslint({ corpus, files })`. */
export default function glosslint(_options: GlosslintEslintOptions): Linter.Config[] {
  throw new Error("not implemented");
}
