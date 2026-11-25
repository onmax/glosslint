// examples/basic is the config the docs site shows. It imports glosslint by the package name, so the
// mocks point those imports at src/ and the suite runs without a build.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vite-plus/test";
import { loadCorpus } from "../src/cli.ts";
import { testCorpus } from "../src/tools.ts";
import { run } from "./cli/run.ts";

vi.mock("glosslint", () => import("../src/index.ts"));
vi.mock("glosslint/presets/tech", () => import("../src/presets/tech.ts"));
vi.mock("glosslint/presets/inclusive", () => import("../src/presets/inclusive.ts"));

const exampleDir = fileURLToPath(new URL("../examples/basic/", import.meta.url));
const contentDir = new URL("../docs/content/", import.meta.url);

/** Every docs page and the README, so each output below must appear verbatim on at least one of them. */
const docs = [
  readFileSync(new URL("../README.md", import.meta.url), "utf8"),
  ...readdirSync(contentDir, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".md"))
    .map((file) => readFileSync(new URL(file, contentDir), "utf8")),
].join("\n");

/** Runs the CLI in examples/basic, as the docs commands do. */
const cli = (...args: string[]) => run(args, exampleDir);

describe("examples/basic", () => {
  it("loads the presets, the glossary table and its own terms", async () => {
    const { corpus } = await loadCorpus(exampleDir);
    const names = corpus.terms.map((term) => term.term);
    for (const name of ["GitHub", "allowlist", "Station", "kiosk", "Dock", "Day Pass"])
      expect(names).toContain(name);
    expect(corpus.allow).toEqual(expect.arrayContaining(["check out our", "roof rack"]));
  });

  it("passes every term's examples", async () => {
    const { corpus } = await loadCorpus(exampleDir);
    expect(testCorpus(corpus)).toEqual([]);
  });

  it("prints the findings the docs show for check", async () => {
    const result = await cli("check", "docs/guide");
    expect(result).toMatchObject({ code: 1, stderr: "" });
    expect(result.stdout).toMatch(/^6 findings in 2 of 2 files\.$/m);
    expect(docs).toContain(result.stdout.trimEnd());
  });

  it("prints the JSON the docs show", async () => {
    const result = await cli("check", "docs/guide/riding.md", "--format", "json");
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout).summary).toEqual({
      files: 1,
      findings: 2,
      GLOSSLINT_TERM: 1,
      GLOSSLINT_AVOID: 1,
      GLOSSLINT_CASE: 0,
    });
    expect(docs).toContain(result.stdout.trimEnd());
  });

  it("matches the docs' test, print and explain output", async () => {
    const test = await cli("test");
    expect(test.code).toBe(0);
    expect(docs).toContain(test.stdout.trimEnd().split("\n").slice(-3).join("\n"));

    const print = await cli("print");
    const dock = /^## Dock\n[\s\S]*?\n\n/m.exec(print.stdout)?.[0];
    expect(dock).toBeDefined();
    expect(docs).toContain(dock!.trimEnd());

    for (const query of ["rack", "e-bike"]) {
      const explain = await cli("explain", query);
      expect(explain.code).toBe(0);
      expect(docs).toContain(explain.stdout.trimEnd());
    }
    expect((await cli("explain", "scooter")).code).toBe(1);
  });
});
