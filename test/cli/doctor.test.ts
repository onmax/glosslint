import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { DoctorReport } from "../../src/cli.ts";
import { bikeDir, doctorDir, glossaryDir, run } from "./run.ts";

const glossaryFixtures = fileURLToPath(new URL("../fixtures/glossary/", import.meta.url));

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "glosslint-doctor-"));
  mkdirSync(join(dir, ".agents"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Copies a fixture to `.agents/glossary.md` in a fresh folder and returns its path. */
function use(fixture: string): string {
  const file = join(dir, ".agents/glossary.md");
  copyFileSync(fixture, file);
  return file;
}

describe("glosslint doctor", () => {
  it("prints each problem with its code, path:line, why and fix, and exits 1", async () => {
    use(join(doctorDir, "every.md"));
    const { code, stdout, stderr } = await run(["doctor"], dir);
    expect(stderr).toBe("");
    expect(code).toBe(1);
    expect(stdout)
      .toBe(`[GLOSSLINT_G001] .agents/glossary.md:1: The title is "Words", not "Glossary".
╰▶ fix: Retitle it "# Glossary".

[GLOSSLINT_G002] .agents/glossary.md:4: "description" is another name for "What".
├▶ term: Dock
╰▶ fix: Rename it to "What".

[GLOSSLINT_G008] .agents/glossary.md:5: "station" is an avoid word of "Dock" and a term of its own.
╰▶ fix: Remove it from the Avoid list of "Dock", or remove the term "station".

[GLOSSLINT_G004] .agents/glossary.md:6: "Note" is not a field.
├▶ term: Dock
╰▶ fix: Use "What", "How", "Why", "Avoid", "Good", "Bad", "Links", "Case", "Casing", "Translations", "Forms" or "Hints", or reword the line so it does not start with "Note:".

[GLOSSLINT_G006] .agents/glossary.md:7: Case is "loud".
├▶ term: Dock
╰▶ fix: Use "exact", "spelling" or "context".

[GLOSSLINT_G003] .agents/glossary.md:11: A blank line before this line.
╰▶ fix: Remove it: a term's heading and its fields go on consecutive lines.

[GLOSSLINT_G005] .agents/glossary.md:14: "station" is written twice: "Station" is the same term.
╰▶ fix: Merge the two sections into one.

[GLOSSLINT_G007] .agents/glossary.md:16: The parentheses in "## Day Pass (day ticket)" hold more than abbreviations.
├▶ term: Day Pass
╰▶ fix: Keep only abbreviations in parentheses, such as \`## Day Pass (DP)\`, and move the rest to \`How\`.

8 problems in .agents/glossary.md.
`);
  });

  it("exits 0 on a clean file", async () => {
    use(join(glossaryFixtures, "spec.md"));
    expect(await run(["doctor"], dir)).toEqual({
      code: 0,
      stdout: "No problems in .agents/glossary.md.\n",
      stderr: "",
    });
  });

  it("reads --glossary, and never a config", async () => {
    const result = await run(["doctor", "--glossary", "glossaries/kiosk.md"], glossaryDir);
    expect(result).toEqual({
      code: 0,
      stdout: "No problems in glossaries/kiosk.md.\n",
      stderr: "",
    });
    // bikeDir has a corpus module but no glossary file.
    expect((await run(["doctor"], bikeDir)).code).toBe(2);
  });

  it("exits 2 when the file is missing", async () => {
    expect(await run(["doctor"], join(glossaryDir, "docs"))).toEqual({
      code: 2,
      stdout: "",
      stderr: `[GLOSSLINT_C009] No glossary at .agents/glossary.md.
╰▶ fix: Create .agents/glossary.md with \`# Glossary\` and a \`## Term\` section per term, or pass --glossary <path>.
`,
    });
    const named = await run(["doctor", "--glossary", "nowhere.md"], glossaryDir);
    expect(named.code).toBe(2);
    expect(named.stderr).toContain('[GLOSSLINT_C009] The glossary "nowhere.md" does not exist.');
  });

  it("says how many problems --fix can fix", async () => {
    use(join(glossaryFixtures, "fixable.md"));
    const { code, stdout } = await run(["doctor"], dir);
    expect(code).toBe(1);
    expect(stdout).toMatch(/\n\n17 problems in \.agents\/glossary\.md, 17 fixable with --fix\.\n$/);
  });

  it("--fix rewrites G001 to G003 in canonical form, and a second --fix changes no byte", async () => {
    const file = use(join(glossaryFixtures, "fixable.md"));
    expect(await run(["doctor", "--fix"], dir)).toEqual({
      code: 0,
      stdout: "Fixed 17 problems in .agents/glossary.md.\n",
      stderr: "",
    });
    const fixed = readFileSync(join(glossaryFixtures, "fixable.fixed.md"), "utf8");
    expect(readFileSync(file, "utf8")).toBe(fixed);
    expect((await run(["doctor"], dir)).code).toBe(0);
    expect(await run(["doctor", "--fix"], dir)).toEqual({
      code: 0,
      stdout: "No problems in .agents/glossary.md.\n",
      stderr: "",
    });
    expect(readFileSync(file, "utf8")).toBe(fixed);
  });

  it("--fix rewrites the old blank-line layout to consecutive fields, and a second --fix changes no byte", async () => {
    const file = use(join(glossaryFixtures, "old-layout.md"));
    const { code, stdout } = await run(["doctor"], dir);
    expect(code).toBe(1);
    expect(stdout).toContain(`[GLOSSLINT_G003] .agents/glossary.md:7: A blank line before this line.
╰▶ fix: Remove it: a term's heading and its fields go on consecutive lines.
`);
    expect(stdout).toMatch(/\n\n14 problems in \.agents\/glossary\.md, 14 fixable with --fix\.\n$/);
    expect((await run(["doctor", "--fix"], dir)).stdout).toBe(
      "Fixed 14 problems in .agents/glossary.md.\n",
    );
    const spec = readFileSync(join(glossaryFixtures, "spec.md"), "utf8");
    expect(readFileSync(file, "utf8")).toBe(spec);
    expect((await run(["doctor", "--fix"], dir)).stdout).toBe(
      "No problems in .agents/glossary.md.\n",
    );
    expect(readFileSync(file, "utf8")).toBe(spec);
  });

  it("--fix leaves the file untouched when a G004 or G007 problem would drop text", async () => {
    for (const fixture of [join(doctorDir, "every.md"), join(glossaryFixtures, "g004.md")]) {
      const file = use(fixture);
      const before = readFileSync(file, "utf8");
      const { code, stdout } = await run(["doctor", "--fix"], dir);
      expect(code).toBe(1);
      expect(readFileSync(file, "utf8")).toBe(before);
      expect(stdout).not.toContain("Fixed");
    }
    const { stdout } = await run(["doctor", "--fix"], dir);
    expect(stdout).toMatch(/\n\n1 problem in \.agents\/glossary\.md\.\n$/);
    use(join(doctorDir, "every.md"));
    expect((await run(["doctor", "--fix"], dir)).stdout).toMatch(
      /\n\n8 problems in \.agents\/glossary\.md\. The file is unchanged: --fix would drop text, so fix the other problems first\.\n$/,
    );
  });

  it("--fix moves Hints after Forms, and reports a locale given two hints as G005", async () => {
    const file = join(dir, ".agents/glossary.md");
    writeFileSync(
      file,
      "# Glossary\n\n## Layer\nHints:\n- de: der Layer\nTranslations: de: keep, fr: keep (couche)\nForms:\n- fr: couches, `/calques?/`\n",
    );
    expect(await run(["doctor", "--fix"], dir)).toEqual({
      code: 0,
      stdout: "Fixed 2 problems in .agents/glossary.md.\n",
      stderr: "",
    });
    const fixed =
      "# Glossary\n\n## Layer\nTranslations: de: keep, fr: keep (couche)\nForms:\n- fr: couches, `/calques?/`\nHints:\n- de: der Layer\n";
    expect(readFileSync(file, "utf8")).toBe(fixed);
    expect((await run(["doctor", "--fix"], dir)).stdout).toBe(
      "No problems in .agents/glossary.md.\n",
    );
    expect(readFileSync(file, "utf8")).toBe(fixed);

    writeFileSync(file, `${fixed}- de: die Layer\n`);
    expect(await run(["doctor"], dir)).toEqual({
      code: 1,
      stdout: `[GLOSSLINT_G005] .agents/glossary.md:9: Hints lists de twice in "Layer".
╰▶ fix: Keep one \`de:\` line.

1 problem in .agents/glossary.md.
`,
      stderr: "",
    });
  });

  it("reports failing examples as G009, checked against the file alone", async () => {
    use(join(doctorDir, "examples.md"));
    expect(await run(["doctor"], dir)).toEqual({
      code: 1,
      stdout: `[GLOSSLINT_G009] .agents/glossary.md:6: The good example "Lock it in the rack" is reported: Use "dock" instead of "rack".
├▶ term: Dock
╰▶ fix: Narrow the avoid word, or fix the example.

[GLOSSLINT_G009] .agents/glossary.md:8: The bad example "Lock it at the bay" is not reported.
├▶ term: Dock
╰▶ fix: Add the wording to Avoid, or fix the example.

2 problems in .agents/glossary.md.
`,
      stderr: "",
    });
  });

  it("prints the report as JSON with --format json", async () => {
    use(join(doctorDir, "examples.md"));
    const { code, stdout } = await run(["doctor", "--format", "json"], dir);
    expect(code).toBe(1);
    const report = JSON.parse(stdout) as DoctorReport;
    expect(report.summary).toEqual({
      file: ".agents/glossary.md",
      problems: 2,
      fixable: 0,
      fixed: 0,
    });
    expect(report.problems[1]).toEqual({
      file: ".agents/glossary.md",
      code: "GLOSSLINT_G009",
      line: 8,
      why: 'The bad example "Lock it at the bay" is not reported.',
      fix: "Add the wording to Avoid, or fix the example.",
      fixable: false,
      term: "Dock",
    });
    const bad = await run(["doctor", "--format", "xml"], dir);
    expect(bad.code).toBe(2);
  });
});
