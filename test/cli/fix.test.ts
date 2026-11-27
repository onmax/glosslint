import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { CliReport } from "../../src/types.ts";
import { run } from "./run.ts";

const tech = fileURLToPath(new URL("../../src/presets/tech.ts", import.meta.url));

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "glosslint-fix-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const write = (name: string, text: string) => writeFileSync(join(dir, name), text);
const read = (name: string) => readFileSync(join(dir, name), "utf8");
const fix = (...args: string[]) => run([...args, "--fix", "--corpus", tech], dir);

describe("glosslint check --fix", () => {
  it("writes every autofix into the file and exits 0 when nothing is left", async () => {
    write("a.md", "We use Github and Typescript here.\n");
    expect(await fix("a.md")).toEqual({
      code: 0,
      stdout: "Fixed 2 findings in 1 of 1 file.\n",
      stderr: "",
    });
    expect(read("a.md")).toBe("We use GitHub and TypeScript here.\n");
  });

  it("changes nothing on a second run", async () => {
    write("a.md", "Github, Typescript and Javascript.\n\n# Using Github\n");
    await fix("a.md");
    const once = read("a.md");
    expect(once).toBe("GitHub, TypeScript and JavaScript.\n\n# Using GitHub\n");
    expect(await fix("a.md")).toEqual({ code: 0, stdout: "No findings in 1 file.\n", stderr: "" });
    expect(read("a.md")).toBe(once);
  });

  it("leaves code, front matter and glosslint-ignore lines alone", async () => {
    const text = [
      "---",
      "title: Github",
      "---",
      "",
      "Run `Github` in Github.",
      "",
      "```sh",
      "Github",
      "```",
      "",
      "<!-- glosslint-ignore -->",
      "Github stays.",
      "",
    ].join("\n");
    write("a.md", text);
    expect((await fix("a.md")).code).toBe(0);
    expect(read("a.md")).toBe(text.replace("in Github.", "in GitHub."));
  });

  it("prints the findings it cannot fix and exits 1", async () => {
    const corpus = join(dir, "corpus.mjs");
    writeFileSync(
      corpus,
      `export default { kind: "glosslint.corpus", allow: [], terms: [
        { term: "GitHub", case: "exact" },
        { term: "dock", avoid: [{ word: "rack" }] },
      ] };\n`,
    );
    write("a.md", "Leave the Github bike at the rack.\n");
    const result = await run(["a.md", "--fix", "--corpus", corpus], dir);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe(`[GLOSSLINT_AVOID] "rack" in a.md:1:30
├▶ fix: Use "dock": "Leave the GitHub bike at the dock."
╰▶ term: dock

Fixed 1 finding in 1 of 1 file. 1 finding left.
`);
    expect(read("a.md")).toBe("Leave the GitHub bike at the rack.\n");
  });

  it("reports how many it fixed in JSON", async () => {
    write("a.md", "We use Github and Typescript here.\n");
    write("b.md", "Nothing to fix.\n");
    const result = await fix(".", "--format", "json");
    expect(result.code).toBe(0);
    const report = JSON.parse(result.stdout) as CliReport;
    expect(report).toEqual({
      findings: [],
      summary: {
        files: 2,
        findings: 0,
        fixed: 2,
        GLOSSLINT_TERM: 0,
        GLOSSLINT_AVOID: 0,
        GLOSSLINT_CASE: 0,
      },
    });
  });

  it("leaves files without findings untouched", async () => {
    write("a.md", "Nothing to fix.\r\n");
    expect(await fix("a.md")).toEqual({ code: 0, stdout: "No findings in 1 file.\n", stderr: "" });
    expect(read("a.md")).toBe("Nothing to fix.\r\n");
  });
});
