import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { loadCorpus } from "../../src/cli.ts";
import { bikeDir, glossaryDir, legacyConfigDir, run } from "./run.ts";

const terms = async (cwd: string, options?: { corpus?: string; glossary?: string }) =>
  (await loadCorpus(cwd, options)).corpus.terms.map((term) => term.term);

describe("loading the corpus", () => {
  it("reads .agents/glossary.md by default", async () => {
    expect(await terms(glossaryDir)).toEqual(["Dock", "Station"]);
    const { code, stdout } = await run(["docs"], glossaryDir);
    expect(code).toBe(1);
    expect(stdout).toContain('[GLOSSLINT_AVOID] "rack" in docs/riding.md:3:22');
  });

  it("never reads a glosslint.config.* file", async () => {
    expect(await terms(legacyConfigDir)).toEqual(["Dock", "Station"]);
    expect((await run([], join(bikeDir, "docs"))).stderr).toMatch(
      /^\[GLOSSLINT_C009\] No glossary at \.agents\/glossary\.md\./,
    );
  });

  it("reads --glossary instead of the default, and --corpus instead of any glossary", async () => {
    expect(await terms(glossaryDir, { glossary: "glossaries/kiosk.md" })).toEqual(["Kiosk"]);
    const corpus = join(bikeDir, "corpus.ts");
    expect(await terms(glossaryDir, { corpus })).toContain("eBike");
    expect(await terms(legacyConfigDir, { corpus: "glosslint.config.mjs" })).toEqual(["Kiosk"]);
  });

  it("resolves a package specifier given to --corpus from the folder's node_modules", async () => {
    const dir = mkdtempSync(join(tmpdir(), "glosslint-specifier-"));
    try {
      const pkg = join(dir, "node_modules", "acme-glossary");
      mkdirSync(pkg, { recursive: true });
      writeFileSync(
        join(pkg, "package.json"),
        JSON.stringify({
          name: "acme-glossary",
          type: "module",
          exports: { "./corpus": "./corpus.mjs" },
        }),
      );
      writeFileSync(
        join(pkg, "corpus.mjs"),
        'export default { kind: "glosslint.corpus", terms: [{ term: "Kiosk" }], allow: [] };\n',
      );
      const loaded = await loadCorpus(dir, { corpus: "acme-glossary/corpus" });
      expect(loaded.corpus.terms.map((term) => term.term)).toEqual(["Kiosk"]);
      expect(loaded.file).toBe(join(pkg, "corpus.mjs"));
      expect(await run(["--corpus", "acme-glossary/missing"], dir)).toEqual({
        code: 2,
        stdout: "",
        stderr: `[GLOSSLINT_C009] The corpus module "acme-glossary/missing" does not exist.
╰▶ fix: Check the path given to --corpus, or install the package that exports it.
`,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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

  it("exits 2 with GLOSSLINT_USAGE when given both --corpus and --glossary", async () => {
    expect(await run(["--corpus", "a.ts", "--glossary", "b.md"], glossaryDir)).toEqual({
      code: 2,
      stdout: "",
      stderr: `[GLOSSLINT_USAGE] --corpus and --glossary both name the corpus.
╰▶ fix: Pass one of them: --glossary for a glossary file, --corpus for a module that exports a corpus.
`,
    });
  });

  it("exits 2 with GLOSSLINT_C009 when there is no glossary", async () => {
    for (const args of [[], ["test"], ["print"], ["explain", "dock"]]) {
      expect(await run(args, join(glossaryDir, "docs"))).toEqual({
        code: 2,
        stdout: "",
        stderr: `[GLOSSLINT_C009] No glossary at .agents/glossary.md.
╰▶ fix: Create .agents/glossary.md with \`# Glossary\` and a \`## Term\` section per term, or pass --glossary <path> or --corpus <module>.
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
╰▶ fix: Use "What", "How", "Why", "Avoid", "Good", "Bad", "Links", "Case", "Casing", "Translations" or "Forms", or reword the line so it does not start with "Note:". 1 more problem: run \`glosslint doctor --glossary glossaries/broken.md\` to list them.
`,
    });
  });
});
