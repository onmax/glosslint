// What npm users get: every entry imported by the package name, the CLI, and
// the files `npm pack` would publish. Run with `pnpm test:dist`.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"));

// Node resolves `glosslint/...` from inside the package through its own exports.
function exportsOf(specifier: string): string[] {
  const attributes = specifier.endsWith(".json") ? ', { with: { type: "json" } }' : "";
  const script = `const m = await import(${JSON.stringify(specifier)}${attributes}); console.log(JSON.stringify(Object.keys(m).sort()))`;
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: root,
    encoding: "utf8",
  });
  return JSON.parse(out);
}

// Each test spawns Node or npm, which is slow on a busy runner.
describe("dist", { timeout: 60_000 }, () => {
  it("exports every entry by the package name", () => {
    expect(exportsOf("glosslint")).toEqual([
      "CONFIG_ERRORS",
      "GlosslintConfigError",
      "check",
      "createMatcher",
      "defineCorpus",
      "explain",
      "formatFinding",
      "formatFindings",
      "fromGlossary",
      "kindOf",
      "printCorpus",
      "readGlossary",
      "testCorpus",
      "toJson",
      "toX18nGlossary",
    ]);
    for (const entry of ["glosslint/eslint", "glosslint/x18n"])
      expect(exportsOf(entry)).toEqual(["default"]);
    for (const entry of ["glosslint/presets/tech", "glosslint/presets/inclusive"])
      expect(exportsOf(entry)).toEqual(["default"]);
    expect(exportsOf("glosslint/package.json")).toEqual(["default"]);
  });

  it("lists every subpath in exports", () => {
    expect(Object.keys(pkg.exports)).toEqual([
      ".",
      "./eslint",
      "./x18n",
      "./presets/tech",
      "./presets/inclusive",
      "./package.json",
    ]);
  });

  it("runs the CLI from its bin", () => {
    const help = execFileSync(process.execPath, [`${root}${pkg.bin.glosslint}`, "--help"], {
      encoding: "utf8",
    });
    expect(help).toContain("glosslint");
    for (const command of ["test", "print", "explain <query>"]) expect(help).toContain(command);
    expect(readFileSync(`${root}${pkg.bin.glosslint}`, "utf8")).toMatch(
      /^#!\/usr\/bin\/env node\n/,
    );
  });

  it("runs all four commands on a config that imports glosslint by name", () => {
    const cwd = `${root}test/fixtures/cli/bike`;
    const cli = (...args: string[]) => {
      const result = spawnSync(
        process.execPath,
        [`${root}${pkg.bin.glosslint}`, ...args, "--config", "glosslint.dist.config.mjs"],
        { cwd, encoding: "utf8" },
      );
      return { code: result.status, stdout: result.stdout, stderr: result.stderr };
    };
    const check = cli("check", "docs");
    expect(check.stderr).toBe("");
    expect(check.code).toBe(1);
    expect(check.stdout).toContain('[GLOSSLINT_AVOID] "rack" in docs/riding.md:7:51');
    expect(check.stdout).toMatch(/5 findings in 3 of 4 files\.\n$/);
    const json = JSON.parse(cli("docs", "--format", "json").stdout);
    expect(json.summary).toMatchObject({ files: 4, findings: 5 });
    expect(cli("test")).toMatchObject({
      code: 0,
      stdout: expect.stringContaining("2 terms, 0 failing."),
    });
    expect(cli("print")).toMatchObject({ code: 0, stdout: expect.stringMatching(/^## Dock\n/) });
    expect(cli("explain", "rack")).toMatchObject({
      code: 0,
      stdout: expect.stringContaining('"rack" is an avoid word for Dock.'),
    });
    expect(cli("explain", "scooter").code).toBe(1);
  });

  it("packs only dist, the README, the licence and the notice", () => {
    const [packed] = JSON.parse(
      execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
        cwd: root,
        encoding: "utf8",
      }),
    );
    const files: string[] = packed.files.map((file: { path: string }) => file.path);
    const outside = files.filter(
      (file) =>
        !file.startsWith("dist/") &&
        !["README.md", "LICENSE", "NOTICE", "package.json"].includes(file),
    );
    expect(outside).toEqual([]);
    expect(files).toContain("NOTICE");
    expect(files).toContain("dist/cli.mjs");
    expect(files).toContain("dist/presets/tech.d.mts");
  });
});
