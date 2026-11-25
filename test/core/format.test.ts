import { describe, expect, it } from "vite-plus/test";
import { formatFinding, formatFindings, toJson } from "../../src/format.ts";
import { createMatcher } from "../../src/matcher.ts";
import type { CliFinding } from "../../src/types.ts";
import { bike } from "./bike.ts";

const matcher = createMatcher(bike);

const avoid: CliFinding = {
  code: "GLOSSLINT_AVOID",
  start: 21,
  end: 25,
  text: "rack",
  message: 'Use "dock" instead of "rack". Racks are unpowered.',
  why: "Racks are unpowered.",
  fix: { kind: "suggestion", replace: "dock", result: "Return the bike to any dock." },
  term: {
    term: "Dock",
    description: "A powered stand where one bike is locked.",
    nuance: "A station is a group of docks.",
  },
  see: "https://example.com/docs/docks",
  file: "docs/returns.md",
  line: 14,
  column: 22,
};

const term: CliFinding = {
  code: "GLOSSLINT_TERM",
  start: 0,
  end: 9,
  text: "Check-out",
  message: '"Check-out" is spelled "Checkout".',
  fix: { kind: "autofix", replace: "Checkout", result: "Checkout opens at 6." },
  term: { term: "Checkout" },
  file: "docs/hours.md",
  line: 3,
  column: 1,
};

describe("formatFinding", () => {
  it("prints the dx-ax tree for a CLI finding", () => {
    expect(formatFinding(avoid)).toBe(
      [
        '[GLOSSLINT_AVOID] "rack" in docs/returns.md:14:22',
        "├▶ why: Racks are unpowered.",
        '├▶ fix: Use "dock": "Return the bike to any dock."',
        "├▶ term: Dock, a powered stand where one bike is locked.",
        "╰▶ see: https://example.com/docs/docks",
      ].join("\n"),
    );
  });

  it("omits absent lines and ends with ╰▶", () => {
    expect(formatFinding(term)).toBe(
      [
        '[GLOSSLINT_TERM] "Check-out" in docs/hours.md:3:1',
        '├▶ fix: Change to "Checkout": "Checkout opens at 6."',
        "╰▶ term: Checkout",
      ].join("\n"),
    );
  });

  it("prints a matcher finding with its offset, and the rename verb", () => {
    const [finding] = matcher.check("reChargePoint", "identifier");
    expect(formatFinding(finding!)).toMatchInlineSnapshot(`
      "[GLOSSLINT_TERM] "reChargePoint" at offset 0
      ├▶ fix: Rename to "rechargePoint"
      ╰▶ term: Recharge point, the battery level at which a bike is sent to charge."
    `);
  });

  it("keeps the capitals of a description that starts with an acronym", () => {
    const [finding] = matcher.check("Your Dp");
    expect(
      formatFinding({
        ...finding!,
        term: { term: "Day Pass", description: "DP holders ride free." },
      }),
    ).toContain("term: Day Pass, DP holders ride free.");
  });

  it("prints no color by default and ANSI color on request", () => {
    expect(formatFinding(avoid)).not.toContain("\u001B[");
    const colored = formatFinding(avoid, { color: true });
    expect(colored).toContain("\u001B[1;31m[GLOSSLINT_AVOID]\u001B[0m");
    expect(colored.replace(/\[[\d;]*m/g, "").replaceAll("\u001B", "")).toBe(formatFinding(avoid));
  });
});

describe("formatFindings", () => {
  it("joins findings with a blank line and ends with the summary", () => {
    expect(formatFindings([avoid, term], { files: 23 })).toMatchInlineSnapshot(`
      "[GLOSSLINT_AVOID] "rack" in docs/returns.md:14:22
      ├▶ why: Racks are unpowered.
      ├▶ fix: Use "dock": "Return the bike to any dock."
      ├▶ term: Dock, a powered stand where one bike is locked.
      ╰▶ see: https://example.com/docs/docks

      [GLOSSLINT_TERM] "Check-out" in docs/hours.md:3:1
      ├▶ fix: Change to "Checkout": "Checkout opens at 6."
      ╰▶ term: Checkout

      2 findings in 2 of 23 files."
    `);
  });

  it("summarises one finding, none, and findings without files", () => {
    expect(formatFindings([avoid], { files: 1 }).split("\n").at(-1)).toBe(
      "1 finding in 1 of 1 file.",
    );
    expect(formatFindings([], { files: 23 })).toBe("No findings in 23 files.");
    expect(formatFindings([])).toBe("No findings.");
    expect(formatFindings(matcher.check("Racks and bays")).split("\n").at(-1)).toBe("2 findings.");
  });
});

describe("toJson", () => {
  it("builds the CLI report with counts per code", () => {
    expect(toJson([avoid, term], 23)).toEqual({
      findings: [avoid, term],
      summary: { files: 23, findings: 2, GLOSSLINT_TERM: 1, GLOSSLINT_AVOID: 1, GLOSSLINT_CASE: 0 },
    });
    expect(toJson([], 0).summary).toEqual({
      files: 0,
      findings: 0,
      GLOSSLINT_TERM: 0,
      GLOSSLINT_AVOID: 0,
      GLOSSLINT_CASE: 0,
    });
  });
});
