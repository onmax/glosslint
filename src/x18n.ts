import type { Plugin } from "@x18n/core";
import type { Corpus } from "./types.ts";

/** Options of the x18n plugin. */
export interface GlosslintX18nOptions {
  /** The corpus, usually `import corpus from './glosslint.config.ts'`. */
  corpus: Corpus;
}

/** An x18n plugin that checks source-locale messages and hard strings against the corpus. */
export default function glosslint(_options: GlosslintX18nOptions): Plugin {
  throw new Error("not implemented");
}
