import { fileURLToPath } from "node:url";
import { main } from "../../src/cli.ts";

/** The bike-share fixture: a config, docs in Markdown, MDX and text, and a config with failing examples. */
export const bikeDir = fileURLToPath(new URL("../fixtures/cli/bike/", import.meta.url));
export const brokenDir = fileURLToPath(new URL("../fixtures/cli/broken/", import.meta.url));
/** A folder with `.agents/glossary.md` and no config, other glossaries and a doc to check. */
export const glossaryDir = fileURLToPath(new URL("../fixtures/cli/glossary/", import.meta.url));
/** A folder with both a config and `.agents/glossary.md`. */
export const bothDir = fileURLToPath(new URL("../fixtures/cli/both/", import.meta.url));
/** Glossaries for `doctor`, copied before `--fix` writes them. */
export const doctorDir = fileURLToPath(new URL("../fixtures/cli/doctor/", import.meta.url));

/** Runs the CLI in-process in `cwd` and collects what it writes. */
export async function run(
  args: string[],
  cwd = bikeDir,
): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  const code = await main(args, {
    cwd,
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    color: false,
  });
  return { code, stdout, stderr };
}
