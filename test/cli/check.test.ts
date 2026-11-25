import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { checkFileText, maskMarkdown } from "../../src/cli.ts";
import { createMatcher } from "../../src/matcher.ts";
import type { CliReport } from "../../src/types.ts";
import { bike } from "../core/bike.ts";
import { bikeDir, run } from "./run.ts";

describe("glosslint check", () => {
  it("prints the findings as a tree with a summary, and exits 1", async () => {
    const { code, stdout, stderr } = await run([]);
    expect(stderr).toBe("");
    expect(code).toBe(1);
    expect(stdout).toBe(`[GLOSSLINT_TERM] "re-charge point" in docs/notes.txt:2:24
├▶ fix: Change to "recharge point": "Old receipts still say recharge point."
╰▶ term: Recharge point

[GLOSSLINT_AVOID] "rack" in docs/riding.md:7:51
├▶ why: Racks are unpowered.
├▶ fix: Use "dock": "Unlock a bike at any station. Return it to a free dock when you"
├▶ term: Dock, a powered stand where one bike is locked.
╰▶ see: https://example.com/docs/docks

[GLOSSLINT_TERM] "e-bike" in docs/riding.md:8:27
├▶ fix: Change to "eBike": "finish, and check out our eBike fleet."
╰▶ term: eBike, a bike with an electric motor.

[GLOSSLINT_CASE] "Day Pass" in docs/riding.md:19:9
├▶ fix: Change to "day pass": "- Buy a day pass at the kiosk."
╰▶ term: Day Pass, unlimited rides for one calendar day.

[GLOSSLINT_AVOID] "hub" in docs/stations.mdx:3:14
├▶ why: Riders confuse it with the depot.
├▶ fix: Use "station": "## Finding a station"
╰▶ term: Station, a group of docks at one address.

5 findings in 3 of 4 files.
`);
  });

  it("takes the check command name, folders and files", async () => {
    const all = await run([]);
    expect(await run(["check"])).toEqual(all);
    expect(await run(["check", "docs"])).toEqual(all);
    const clean = await run(["check", "docs/clean.md"]);
    expect(clean).toEqual({ code: 0, stdout: "No findings in 1 file.\n", stderr: "" });
  });

  it("reads only the extensions given with --ext", async () => {
    const { code, stdout } = await run(["docs", "--ext", ".txt"]);
    expect(code).toBe(1);
    expect(stdout).toContain("docs/notes.txt:2:24");
    expect(stdout).toContain("1 finding in 1 of 1 file.");
  });

  it("reads glob patterns as they are", async () => {
    const { stdout } = await run(["docs/*.mdx"]);
    expect(stdout).toContain("1 finding in 1 of 1 file.");
  });

  it("prints the report as JSON, with the fixed line", async () => {
    const { code, stdout } = await run(["--format", "json"]);
    expect(code).toBe(1);
    const report = JSON.parse(stdout) as CliReport;
    expect(report.summary).toEqual({
      files: 4,
      findings: 5,
      GLOSSLINT_TERM: 2,
      GLOSSLINT_AVOID: 2,
      GLOSSLINT_CASE: 1,
    });
    expect(report.findings[1]).toEqual({
      code: "GLOSSLINT_AVOID",
      file: "docs/riding.md",
      line: 7,
      column: 51,
      start: 101,
      end: 105,
      text: "rack",
      message:
        'Use "dock" instead of "rack". Racks are unpowered. Dock: A powered stand where one bike is locked. A station is a group of docks. See https://example.com/docs/docks',
      why: "Racks are unpowered.",
      fix: {
        kind: "suggestion",
        replace: "dock",
        result: "Unlock a bike at any station. Return it to a free dock when you",
      },
      term: {
        term: "Dock",
        description: "A powered stand where one bike is locked.",
        nuance: "A station is a group of docks.",
      },
      see: "https://example.com/docs/docks",
    });
    expect(report.findings.map((finding) => [finding.file, finding.line, finding.text])).toEqual([
      ["docs/notes.txt", 2, "re-charge point"],
      ["docs/riding.md", 7, "rack"],
      ["docs/riding.md", 8, "e-bike"],
      ["docs/riding.md", 19, "Day Pass"],
      ["docs/stations.mdx", 3, "hub"],
    ]);
  });

  it("colors the tree with --color", async () => {
    const { stdout } = await run(["docs/notes.txt", "--color"]);
    expect(stdout).toContain("\u001B[1;31m[GLOSSLINT_TERM]\u001B[0m");
    const plain = await run(["docs/notes.txt", "--no-color"]);
    expect(plain.stdout).not.toContain("\u001B[");
  });

  it("exits 0 with nothing to read", async () => {
    expect(await run(["docs", "--ext", "rst"])).toEqual({
      code: 0,
      stdout: "No findings in 0 files.\n",
      stderr: "",
    });
  });

  it("exits 2 on a bad format, a missing path or an unknown option", async () => {
    expect(await run(["--format", "xml"])).toEqual({
      code: 2,
      stdout: "",
      stderr: '[GLOSSLINT_USAGE] --format is "xml".\n╰▶ fix: Use --format text or --format json.\n',
    });
    const missing = await run(["nowhere"]);
    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain('"nowhere" does not exist.');
    const unknown = await run(["--bogus"]);
    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain("Unknown option `--bogus`.");
  });

  it.skipIf(process.getuid?.() === 0)(
    "prints a file it may not read as one line and exits 2",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "glosslint-eacces-"));
      try {
        const file = join(dir, "locked.md");
        writeFileSync(file, "Find a charger.\n");
        chmodSync(file, 0);
        const result = await run([file, "--config", join(bikeDir, "glosslint.config.ts")], dir);
        expect(result).toMatchObject({ code: 2, stdout: "" });
        expect(result.stderr).toMatch(
          /^\[GLOSSLINT_ERROR\] EACCES: permission denied, open .*locked\.md'\n$/,
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});

describe("Markdown masking", () => {
  const matcher = createMatcher(bike);
  const check = (text: string, file = "doc.md") =>
    checkFileText(matcher, text, file, { markdown: true, mdx: file.endsWith(".mdx") });

  it("keeps every offset and line break", () => {
    const text =
      "---\ntitle: rack\n---\n\n```\nrack\n```\n\nA `rack` and [docs](https://x.y/rack).\n";
    const masked = maskMarkdown(text);
    expect(masked).toHaveLength(text.length);
    expect(masked.split("\n")).toHaveLength(text.split("\n").length);
    expect(masked).not.toContain("rack");
    expect(masked).toContain("A");
    expect(masked).toContain("docs");
  });

  it("never reports a term inside a code fence, inline code, a link target, a comment or frontmatter", () => {
    const text = [
      "---",
      "title: Racks",
      "---",
      "",
      "~~~~",
      "Put it in the rack.",
      "```",
      "still code: rack",
      "~~~~",
      "",
      "Use ``a ` rack`` here, see [docks](./rack.md 'rack') or [docks][rack].",
      "",
      "[rack]: https://example.com/rack",
      "",
      "<!--",
      "The rack screen.",
      "-->",
      '<img alt="x" src="rack.png">',
      "<https://example.com/rack>",
    ].join("\n");
    expect(check(text)).toEqual([]);
  });

  it("masks fences in list items and blockquotes", () => {
    expect(check("- ```\n  rack\n  ```\n\n> ~~~\n> rack\n> ~~~\n")).toEqual([]);
  });

  it("does not close a fence on a list item inside it", () => {
    const findings = check("```md\n- ```\nrack\n```\n\nA rack.\n");
    expect(findings.map((finding) => [finding.line, finding.text])).toEqual([[6, "rack"]]);
  });

  it("still reports the prose around masked parts, at the right line and column", () => {
    const findings = check("```\nrack\n```\n\nNo `rack` here, but a rack there.\n");
    expect(findings.map((finding) => [finding.line, finding.column, finding.text])).toEqual([
      [5, 23, "rack"],
    ]);
  });

  it("reads headings as labels and paragraphs as sentences", () => {
    const findings = check("# Buy a day pass\n\nYou can buy a Day Pass.\n");
    expect(findings.map((finding) => [finding.line, finding.fix?.replace])).toEqual([
      [1, "Day Pass"],
      [3, "day pass"],
    ]);
  });

  it("checks a paragraph across its lines, so a sentence start is only a real one", () => {
    const findings = check("Rides are cheaper with a\nDay Pass.\n");
    expect(findings.map((finding) => [finding.line, finding.column, finding.fix?.replace])).toEqual(
      [[2, 1, "day pass"]],
    );
  });

  it("checks table cells one at a time", () => {
    const findings = check("| Plan | Notes |\n| --- | --- |\n| `rack` | Find a hub. |\n");
    expect(findings.map((finding) => [finding.line, finding.column, finding.text])).toEqual([
      [3, 19, "hub"],
    ]);
  });

  it("skips import and export lines in MDX only", () => {
    expect(check('import { Rack } from "./rack"\n', "doc.mdx")).toEqual([]);
    expect(check("export const hub = 1\n", "doc.mdx")).toEqual([]);
    expect(check("export the hub list\n", "doc.md")).toHaveLength(1);
  });

  it("masks CRLF files as it masks LF ones", () => {
    const lf = [
      "---",
      "title: rack",
      "---",
      "## A rack ##",
      "",
      "Use the `code",
      "",
      "New para with a rack and an ebike.",
      "More `x` text.",
      "- [ ] check the hub",
      "#",
      "",
    ].join("\n");
    const crlf = lf.replace(/\n/g, "\r\n");
    expect(maskMarkdown(crlf)).toBe(maskMarkdown(lf).replace(/\n/g, "\r\n"));
    const where = (text: string) =>
      check(text).map((finding) => [finding.line, finding.column, finding.text]);
    expect(where(crlf)).toEqual(where(lf));
    expect(where(crlf)).toEqual([
      [4, 6, "rack"],
      [8, 17, "rack"],
      [8, 29, "ebike"],
      [10, 17, "hub"],
    ]);
  });

  it("reads plain text without masking Markdown", () => {
    const findings = checkFileText(matcher, "# the rack\n", "notes.txt");
    expect(findings.map((finding) => finding.text)).toEqual(["rack"]);
  });
});
