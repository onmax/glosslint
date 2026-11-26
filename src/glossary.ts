import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG_ERRORS } from "./corpus.ts";
import { GlosslintConfigError } from "./errors.ts";
import { BLOCKING, DEFAULT_GLOSSARY, parseGlossary } from "./glossary-text.ts";
import type { Corpus } from "./types.ts";

export { DEFAULT_GLOSSARY, GLOSSARY_PROBLEMS, readGlossary } from "./glossary-text.ts";
export type { GlossaryProblem } from "./glossary-text.ts";

function displayPath(file: string): string {
  const shown = relative(process.cwd(), file);
  return shown && !shown.startsWith("..") && !isAbsolute(shown) ? shown : file;
}

/** The absolute path of a glossary: a string resolves from the current folder. */
export function glossaryPath(path: string | URL = DEFAULT_GLOSSARY): string {
  return typeof path === "string" ? resolve(process.cwd(), path) : fileURLToPath(path);
}

/**
 * Reads a glossary file, `.agents/glossary.md` by default, as a corpus. Throws a `GlosslintConfigError`
 * when the file is missing (`GLOSSLINT_C009`) or has a problem only a person can fix (`G004` to `G008`).
 * A file with only fixable problems loads as its fixed form would.
 */
export function fromGlossary(path: string | URL = DEFAULT_GLOSSARY): Corpus {
  const file = glossaryPath(path);
  const shown = displayPath(file);
  if (!existsSync(file))
    throw new GlosslintConfigError({
      code: CONFIG_ERRORS.noGlossary,
      why: `No glossary at ${shown}.`,
      fix: `Create ${shown} with \`# Glossary\` and a \`## Term\` section per term, or pass the path of your glossary.`,
    });
  const { problems, corpus } = parseGlossary(readFileSync(file, "utf8"), false);
  if (corpus) return corpus;
  const blocking = problems.filter((problem) => BLOCKING.has(problem.code));
  const [first] = blocking;
  const more =
    blocking.length > 1
      ? ` ${blocking.length - 1} more problem${blocking.length > 2 ? "s" : ""}: run \`glosslint doctor\` to list them.`
      : "";
  throw new GlosslintConfigError({
    code: first!.code,
    why: `${shown}:${first!.line}: ${first!.why}`,
    fix: `${first!.fix}${more}`,
    ...(first!.term === undefined ? {} : { term: first!.term }),
  });
}
