import { describe, expect, it } from "vite-plus/test";
import { defineCorpus } from "../src/corpus.ts";
import { explain, explainMatches, printCorpus, testCorpus, toX18nGlossary } from "../src/tools.ts";
import { bike, bikeTerms } from "./core/bike.ts";

describe("testCorpus", () => {
  it("passes when bad examples are reported and good ones are not", () => {
    expect(testCorpus(bike)).toEqual([]);
  });

  it("fails a bad example that is not reported, or is reported only for another term", () => {
    const corpus = defineCorpus({
      terms: [
        ...bikeTerms,
        { term: "Ride", avoid: ["trip"], examples: { bad: ["Start a journey", "Find a hub"] } },
      ],
    });
    const failures = testCorpus(corpus);
    expect(
      failures.map((failure) => [failure.term.term, failure.example, failure.expected]),
    ).toEqual([
      ["Ride", "Start a journey", "finding"],
      ["Ride", "Find a hub", "finding"],
    ]);
    expect(failures[1]!.findings.map((finding) => finding.term.term)).toEqual(["Station"]);
  });

  it("fails a good example that is reported for its own term, but not for another term", () => {
    const corpus = defineCorpus({
      terms: [
        ...bikeTerms,
        { term: "Ride", avoid: ["trip"], examples: { good: ["Your trip ended", "Find a hub"] } },
      ],
    });
    const failures = testCorpus(corpus);
    expect(failures.map((failure) => [failure.example, failure.expected])).toEqual([
      ["Your trip ended", "none"],
    ]);
    expect(failures[0]!.findings[0]).toMatchObject({ code: "GLOSSLINT_AVOID", text: "trip" });
  });

  it("reads each example as a label or a sentence, as kindOf does", () => {
    const corpus = defineCorpus({
      terms: [
        {
          term: "Day Pass",
          case: "context",
          examples: { good: ["Buy Day Pass", "Buy a day pass."], bad: ["Buy a Day Pass."] },
        },
      ],
    });
    expect(testCorpus(corpus)).toEqual([]);
  });
});

describe("printCorpus", () => {
  it("gives each described term a section and lists bare spellings on one line", () => {
    const md = printCorpus(bike, "md");
    expect(md).toContain(`## Dock
A powered stand where one bike is locked.
- A station is a group of docks.
- Don't write: rack (racks are unpowered), bay.
- Good: "Return the bike to any dock". Bad: "Return the bike to any rack".
- See: [Docks](https://example.com/docs/docks), [Stations](https://example.com/docs/stations).
`);
    expect(md).toContain("## Station Manager\n- Don't write: SM (nobody outside ops knows it).\n");
    expect(md).toContain(
      "## Day Pass\nUnlimited rides for one calendar day.\n- Abbreviation: DP.\n",
    );
    expect(md.trimEnd().split("\n").at(-1)).toBe("Write these as shown: BikeShare.");
    expect(md).not.toContain("## BikeShare");
  });

  it("prints the flattened corpus as JSON", () => {
    expect(JSON.parse(printCorpus(bike, "json"))).toEqual({
      terms: JSON.parse(JSON.stringify(bike.terms)),
      allow: ["check out our", "roof rack"],
    });
  });
});

describe("explain", () => {
  it("finds a term by its name, a plural or another spelling", () => {
    expect(explainMatches(bike, "dock")).toEqual([{ term: bike.terms[0] }]);
    expect(explainMatches(bike, "Docks").map((match) => match.term.term)).toEqual(["Dock"]);
    expect(explainMatches(bike, "re-charge point")).toEqual([
      { term: bike.terms[5], note: '"re-charge point" is spelled "Recharge point".' },
    ]);
  });

  it("finds a term by an abbreviation, a form or an avoid word", () => {
    expect(explainMatches(bike, "DP")[0]!.note).toBe('"DP" abbreviates Day Pass.');
    expect(explainMatches(bike, "racks")[0]!.note).toBe(
      '"rack" is an avoid word for Dock. Racks are unpowered.',
    );
    const corpus = defineCorpus({
      terms: [{ term: "Dock", forms: { de: ["Docks", "Dockingstation"] } }],
    });
    expect(explainMatches(corpus, "Dockingstation")[0]!.note).toBe(
      '"Dockingstation" is a form of Dock.',
    );
  });

  it("falls back to the terms a phrase misspells or mentions", () => {
    expect(explainMatches(bike, "put it in the crate")[0]).toMatchObject({
      term: { term: "Box" },
      note: '"crate" is an avoid word for Box.',
    });
    expect(explainMatches(bike, "every station").map((match) => match.term.term)).toEqual([
      "Station",
    ]);
    expect(explainMatches(bike, "scooter")).toEqual([]);
  });

  it("prints the meaning, nuance, avoid words, examples, links and related terms", () => {
    expect(explain(bike, "station")).toBe(`Station
  A group of docks at one address.
  Avoid: hub.
  Related: Dock, Station Manager`);
    expect(explain(bike, "eBike")).toBe(`eBike
  A bike with an electric motor.
  Always written "eBike".`);
    expect(explain(bike, "scooter")).toBe('No term in the corpus matches "scooter".');
  });

  it("prints the term's why after its nuance", () => {
    const corpus = defineCorpus({
      terms: [
        {
          term: "Dock",
          description: "A powered stand.",
          nuance: "A station is a group of docks.",
          why: 'Riders read "dock" on the stand',
          avoid: ["bay"],
        },
      ],
    });
    expect(explain(corpus, "dock")).toBe(`Dock
  A powered stand.
  A station is a group of docks.
  Riders read "dock" on the stand.
  Avoid: bay.`);
  });

  it("starts a reason written in lowercase with a capital, keeping a first word with capitals", () => {
    const corpus = defineCorpus({
      terms: [
        { term: "Station", avoid: [{ word: "hub", why: "riders confuse it with the depot" }] },
        { term: "Battery", avoid: [{ word: "cell", why: "eBike riders read it as a phone." }] },
      ],
    });
    expect(explain(corpus, "hub").split("\n").slice(0, 2)).toEqual([
      "Station",
      '  "hub" is an avoid word for Station. Riders confuse it with the depot.',
    ]);
    expect(explain(corpus, "cell").split("\n")[1]).toBe(
      '  "cell" is an avoid word for Battery. eBike riders read it as a phone.',
    );
  });

  it("finds an avoid word or abbreviation under the term that wins the merge", () => {
    const a = defineCorpus({ terms: [{ term: "Station", avoid: ["hub"], abbr: ["ST"] }] });
    const corpus = defineCorpus({
      extends: [a],
      terms: [{ term: "Depot", avoid: ["hub"], abbr: ["ST"] }],
    });
    expect(explainMatches(corpus, "hub").map((match) => match.term.term)).toEqual(["Depot"]);
    expect(explainMatches(corpus, "ST").map((match) => match.term.term)).toEqual(["Depot"]);
  });
});

describe("toX18nGlossary", () => {
  it("passes translations and forms, writes a note, and keeps exact terms untranslated", () => {
    const corpus = defineCorpus({
      terms: [
        {
          term: "Dock",
          description: "A powered stand where one bike is locked",
          nuance: "A station is a group of docks.",
          translations: { de: "Dock" },
          forms: { de: ["Docks"] },
          avoid: ["rack"],
        },
        { term: "eBike", case: "exact" },
        { term: "BikeShare", case: "exact", translations: { de: "Radverleih" } },
        { term: "Checkout" },
      ],
    });
    expect(toX18nGlossary(corpus)).toEqual([
      {
        term: "Dock",
        translations: { de: "Dock" },
        forms: { de: ["Docks"] },
        note: "A powered stand where one bike is locked. A station is a group of docks.",
      },
      { term: "eBike", doNotTranslate: true },
      { term: "BikeShare", translations: { de: "Radverleih" } },
      { term: "Checkout" },
    ]);
  });

  it("writes the description alone as the note with note: short", () => {
    const corpus = defineCorpus({
      terms: [
        {
          term: "Dock",
          description: "A powered stand where one bike is locked",
          nuance: "A station is a group of docks.",
        },
        { term: "Station", nuance: "A group of docks." },
      ],
    });
    expect(toX18nGlossary(corpus, { note: "short" })).toEqual([
      { term: "Dock", note: "A powered stand where one bike is locked." },
      { term: "Station" },
    ]);
    expect(toX18nGlossary(corpus, { note: "full" })).toEqual(toX18nGlossary(corpus));
  });
});
