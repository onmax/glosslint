import { fileURLToPath } from "node:url";
import { main } from "../../src/cli.ts";

/** The bike-share fixture: `corpus.ts`, docs in Markdown, MDX and text, and a corpus with failing examples. */
export const bikeDir = fileURLToPath(new URL("../fixtures/cli/bike/", import.meta.url));
export const brokenDir = fileURLToPath(new URL("../fixtures/cli/broken/", import.meta.url));
/** A folder with `.agents/glossary.md` and no config, other glossaries and a doc to check. */
export const glossaryDir = fileURLToPath(new URL("../fixtures/cli/glossary/", import.meta.url));
/** A folder with `.agents/glossary.md` next to a `glosslint.config.mjs` the CLI no longer reads. */
export const legacyConfigDir = fileURLToPath(
  new URL("../fixtures/cli/legacy-config/", import.meta.url),
);
/** Glossaries for `doctor`, copied before `--fix` writes them. */
export const doctorDir = fileURLToPath(new URL("../fixtures/cli/doctor/", import.meta.url));

/**
 * Runs the CLI in-process in `cwd` and collects what it writes. In the bike-share fixture it passes
 * `--corpus corpus.ts` unless the arguments name a corpus or a glossary, or run `doctor`.
 */
export async function run(
  args: string[],
  cwd = bikeDir,
): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  const named = args.some((arg) => arg === "--corpus" || arg === "--glossary" || arg === "doctor");
  const code = await main(cwd === bikeDir && !named ? [...args, "--corpus", "corpus.ts"] : args, {
    cwd,
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    color: false,
  });
  return { code, stdout, stderr };
}
