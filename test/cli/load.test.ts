import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { loadCorpus } from "../../src/cli.ts";
import { bikeDir, bothDir, glossaryDir, run } from "./run.ts";

const terms = async (cwd: string, options?: { config?: string; glossary?: string }) =>
  (await loadCorpus(cwd, options)).corpus.terms.map((term) => term.term);

describe("loading the corpus", () => {
  it("reads .agents/glossary.md when there is no config", async () => {
    expect(await terms(glossaryDir)).toEqual(["Dock", "Station"]);
    const { code, stdout } = await run(["docs"], glossaryDir);
    expect(code).toBe(1);
    expect(stdout).toContain('[GLOSSLINT_AVOID] "rack" in docs/riding.md:3:22');
  });

  it("prefers glosslint.config.* to .agents/glossary.md", async () => {
    expect(await terms(bothDir)).toEqual(["Kiosk"]);
  });

  it("prefers --glossary to a config, and --config to everything", async () => {
    expect(await terms(bothDir, { glossary: ".agents/glossary.md" })).toEqual(["Dock", "Station"]);
    expect(await terms(glossaryDir, { glossary: "glossaries/kiosk.md" })).toEqual(["Kiosk"]);
    const config = join(bikeDir, "glosslint.config.ts");
    expect(await terms(glossaryDir, { config })).toContain("eBike");
  });

  it("takes --glossary in test, print and explain", async () => {
    const args = ["--glossary", "glossaries/kiosk.md"];
    expect(await run(["test", ...args], glossaryDir)).toMatchObject({
      code: 0,
      stdout: "No term has examples.\n",
    });
    expect((await run(["print", ...args], glossaryDir)).stdout).toContain("## Kiosk");
    expect((await run(["explain", "terminal", ...args], glossaryDir)).code).toBe(0);
  });

  it("exits 2 with GLOSSLINT_USAGE when given both --config and --glossary", async () => {
    expect(await run(["--config", "a.ts", "--glossary", "b.md"], glossaryDir)).toEqual({
      code: 2,
      stdout: "",
      stderr: `[GLOSSLINT_USAGE] --config and --glossary both name the corpus.
╰▶ fix: Pass one of them: --glossary for a glossary file, --config for a config.
`,
    });
  });

  it("exits 2 with GLOSSLINT_C009 naming both files when it finds neither", async () => {
    for (const args of [[], ["test"], ["print"], ["explain", "dock"]]) {
      expect(await run(args, join(glossaryDir, "docs"))).toEqual({
        code: 2,
        stdout: "",
        stderr: `[GLOSSLINT_C009] No .agents/glossary.md and no glosslint.config.ts, .mts, .js or .mjs in the current folder.
╰▶ fix: Create .agents/glossary.md with \`# Glossary\` and a \`## Term\` section per term, or pass --glossary <path> or --config <path>.
`,
      });
    }
    const missing = await run(["--glossary", "nowhere.md"], glossaryDir);
    expect(missing.code).toBe(2);
    expect(missing.stderr).toMatch(
      /^\[GLOSSLINT_C009\] The glossary "nowhere\.md" does not exist\./,
    );
  });

  it("prints a glossary problem that blocks loading as a tree with path:line, and exits 2", async () => {
    expect(await run(["--glossary", "glossaries/broken.md", "docs"], glossaryDir)).toEqual({
      code: 2,
      stdout: "",
      stderr: `[GLOSSLINT_G004] glossaries/broken.md:4: "Note" is not a field.
├▶ term: Dock
╰▶ fix: Use "What", "How", "Why", "Avoid", "Good", "Bad", "Links" or "Case", or reword the line so it does not start with "Note:". 1 more problem: run \`glosslint doctor --glossary glossaries/broken.md\` to list them.
`,
    });
  });
});
