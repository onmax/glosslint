import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vite-plus/test";
import { GlosslintConfigError } from "../src/errors.ts";
import { fromGlossaryTable } from "../src/table.ts";

const dir = mkdtempSync(join(tmpdir(), "glosslint-table-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function write(name: string, content: string): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

describe("fromGlossaryTable", () => {
  it("reads the bike-share glossary into terms", () => {
    const corpus = fromGlossaryTable(new URL("./fixtures/glossary.md", import.meta.url));
    expect(corpus.kind).toBe("glosslint.corpus");
    expect(corpus.allow).toEqual([]);
    expect(corpus.terms).toEqual([
      {
        term: "Dock",
        description: "A powered stand where one bike is locked.",
        nuance: "A station is a group of docks.",
        avoid: [{ word: "rack", why: "racks are unpowered." }, "bay"],
        links: [{ title: "docks", url: "https://example.com/docks" }],
      },
      {
        term: "Day Pass",
        description: "Unlimited 30-minute rides for a set period.",
        abbr: ["DP"],
        avoid: ["ticket"],
        links: [{ title: "https://example.com/passes", url: "https://example.com/passes" }],
      },
      {
        term: "Week Pass",
        description: "Unlimited 30-minute rides for a set period.",
        abbr: ["WP"],
        links: [{ title: "https://example.com/passes", url: "https://example.com/passes" }],
      },
      {
        term: "eBike",
        description: "A bike with a motor that helps you pedal.",
        nuance: "Shown as eBike | Classic in the bike picker.",
        avoid: ["e-bike", "electric bike"],
        case: "exact",
      },
      {
        term: "SOS",
        description: "The emergency button on the handlebar.",
        case: "exact",
      },
      {
        term: "kiosk",
        description: "The screen at a station where you buy passes.",
        nuance: "Always lowercase, even at the start of a sentence.",
        avoid: ["terminal"],
        case: "exact",
      },
      {
        term: "Station",
        description: "A group of docks on one street corner.",
        avoid: ["hub", { word: "depot", why: "riders confuse it, with the warehouse." }],
        links: [{ title: "Stations", url: "https://example.com/stations" }],
      },
      {
        term: "Rider",
        description: "A person who can unlock bikes.",
        nuance: "anyone with an account.",
        avoid: ["user"],
      },
    ]);
  });

  it("takes a path string, a Term header and renamed columns", () => {
    const path = write(
      "renamed.md",
      [
        "| Term | Word to avoid | Description | Comment | Docs |",
        "| --- | --- | --- | --- | --- |",
        "| Return | drop off | Locking a bike in a dock. | lower-case in buttons | [Returns](https://example.com/returns) |",
      ].join("\n"),
    );
    const corpus = fromGlossaryTable(path, {
      avoid: "Word to avoid",
      notes: "comment",
      links: "DOCS",
    });
    expect(corpus.terms).toEqual([
      {
        term: "Return",
        description: "Locking a bike in a dock.",
        nuance: "lower-case in buttons",
        avoid: ["drop off"],
        links: [{ title: "Returns", url: "https://example.com/returns" }],
        case: "exact",
      },
    ]);
  });

  it("reads a renamed term column instead of Use", () => {
    const path = write(
      "word.md",
      ["| Use | Word |", "|---|---|", "| ignored | Helmet |", "| | |"].join("\n"),
    );
    expect(fromGlossaryTable(path, { term: "word" }).terms).toEqual([{ term: "Helmet" }]);
  });

  it("splits only on commas outside parentheses and inline code", () => {
    const path = write(
      "commas.md",
      ["Use | Avoid", "--- | ---", "Top-up (TU, T-U), `Credit, plus` | `a, b`, c (one, two)"].join(
        "\n",
      ),
    );
    expect(fromGlossaryTable(path).terms).toEqual([
      { term: "Top-up", abbr: ["TU", "T-U"], avoid: ["a, b", { word: "c", why: "one, two." }] },
      { term: "Credit, plus" },
    ]);
  });

  it("reads a one-word parenthetical as an abbreviation only when it has a capital", () => {
    const path = write(
      "notes.md",
      [
        "| Use | Avoid |",
        "| --- | --- |",
        "| Recharge point (kiosk) | charger |",
        "| Day Pass (DP, dP) | |",
        "| Dock | rack (racks are unpowered) |",
      ].join("\n"),
    );
    expect(fromGlossaryTable(path).terms).toEqual([
      { term: "Recharge point", nuance: "kiosk.", avoid: ["charger"] },
      { term: "Day Pass", abbr: ["DP", "dP"] },
      { term: "Dock", avoid: [{ word: "rack", why: "racks are unpowered." }] },
    ]);
  });

  it("throws a config error when no table has a term column", () => {
    const path = write("none.md", "| Name | Notes |\n| --- | --- |\n| Dock | x |\n");
    expect(() => fromGlossaryTable(path)).toThrow(GlosslintConfigError);
    expect(() => fromGlossaryTable(path)).toThrow(/Use or Term/);
  });

  it("throws a config error when the table lists a term twice", () => {
    const path = write("twice.md", "| Use |\n| --- |\n| Day Pass |\n| day-pass |\n");
    expect(() => fromGlossaryTable(path)).toThrow(
      expect.objectContaining({ code: "GLOSSLINT_DUPLICATE_TERM", term: "day-pass" }),
    );
  });
});
