import type { Plugin } from "@x18n/core";
import { CONFIG_ERRORS } from "./corpus.ts";
import { GlosslintConfigError } from "./errors.ts";
import { fromGlossary } from "./glossary.ts";
import type { Corpus, KindOf } from "./types.ts";
import { createPlugin } from "./x18n/plugin.ts";

/** Options of the x18n plugin. */
export interface GlosslintX18nOptions {
  /** The glossary file to read instead of `.agents/glossary.md`. A string resolves from the current folder. */
  glossary?: string | URL;
  /** A corpus to use instead of a glossary file, such as `defineCorpus({ extends: [fromGlossary()], … })`. */
  corpus?: Corpus;
  /** The locale whose messages are checked. Default: the project's source locale. */
  sourceLocale?: string;
  /**
   * Decides whether a message or hard string is a label, header or sentence before glosslint's own
   * `kindOf`. Return `undefined` to leave it to glosslint.
   */
  kindOf?: KindOf;
}

declare module "@x18n/core" {
  interface CheckIds {
    "glosslint-term": true;
    "glosslint-avoid": true;
    "glosslint-case": true;
  }
}

/**
 * An x18n plugin that checks source-locale messages and hard strings against the corpus. The corpus comes from
 * `corpus`, else from the `glossary` file, else from `.agents/glossary.md`, read once when the plugin is built.
 */
export default function glosslint(options: GlosslintX18nOptions = {}): Plugin {
  if (options.corpus && options.glossary !== undefined)
    throw new GlosslintConfigError({
      code: CONFIG_ERRORS.glossaryAndCorpus,
      why: "glosslint() takes `glossary` or `corpus`, not both.",
      fix: "Pass `glossary` to read a file, or `corpus` with `extends: [fromGlossary(…)]` to add to one.",
    });
  const { glossary, corpus, ...settings } = options;
  return createPlugin(corpus ?? fromGlossary(glossary), settings);
}
