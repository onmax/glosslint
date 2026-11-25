import { describe, expect, it } from "vite-plus/test";
import { defineCorpus } from "../../src/corpus.ts";
import { GlosslintConfigError } from "../../src/errors.ts";
import { createMatcher } from "../../src/matcher.ts";
import inclusive from "../../src/presets/inclusive.ts";
import type { CorpusInput } from "../../src/types.ts";
import { bike, bikeTerms } from "./bike.ts";

function configError(input: unknown): GlosslintConfigError {
  try {
    defineCorpus(input as CorpusInput);
  } catch (error) {
    if (error instanceof GlosslintConfigError) return error;
    throw error;
  }
  throw new Error("defineCorpus did not throw");
}

describe("defineCorpus", () => {
  it("returns a marked, frozen corpus with the terms and allowed phrases", () => {
    expect(bike.kind).toBe("glosslint.corpus");
    expect(bike.terms.map((term) => term.term)).toEqual(bikeTerms.map((term) => term.term));
    expect(bike.allow).toEqual(["check out our", "roof rack"]);
    expect(Object.isFrozen(bike)).toBe(true);
    expect(Object.isFrozen(bike.terms)).toBe(true);
  });

  it("accepts an empty input", () => {
    expect(defineCorpus({})).toEqual({ kind: "glosslint.corpus", terms: [], allow: [] });
  });

  describe("merge order", () => {
    const first = defineCorpus({
      terms: [
        { term: "Dock", description: "first" },
        { term: "Station", description: "first" },
      ],
      allow: ["roof rack"],
    });
    const second = defineCorpus({
      terms: [
        { term: "dock", description: "second" },
        { term: "Helmet", description: "second" },
      ],
      allow: ["bike rack"],
    });

    it("lets later extends win per term key, and lists the winner after the terms it beats", () => {
      const corpus = defineCorpus({ extends: [first, second] });
      expect(corpus.terms.map((term) => [term.term, term.description])).toEqual([
        ["Station", "first"],
        ["dock", "second"],
        ["Helmet", "second"],
      ]);
    });

    it("lets the corpus's own terms win over every extends entry, by key", () => {
      const corpus = defineCorpus({
        extends: [first, second],
        terms: [{ term: "DOCK", description: "own" }],
      });
      expect(corpus.terms.find((term) => term.description === "own")?.term).toBe("DOCK");
      expect(corpus.terms.filter((term) => term.term.toLowerCase() === "dock")).toHaveLength(1);
    });

    it("matches keys across spellings", () => {
      const corpus = defineCorpus({
        extends: [first],
        terms: [{ term: "Re-charge point" }, { term: "Day-Pass" }],
      });
      const other = defineCorpus({
        extends: [corpus],
        terms: [{ term: "Recharge Point" }, { term: "day pass" }],
      });
      expect(other.terms.map((term) => term.term)).toEqual([
        "Dock",
        "Station",
        "Recharge Point",
        "day pass",
      ]);
    });

    it("lets the own terms' avoid words beat a preset's", () => {
      const corpus = defineCorpus({
        extends: [inclusive],
        terms: [
          {
            term: "Trusted rider list",
            avoid: [{ word: "whitelist", why: "Ops calls it the trusted rider list." }],
          },
        ],
      });
      const findings = createMatcher(corpus).check("Add the rider to the whitelist.");
      expect(findings.map((f) => [f.code, f.term.term, f.fix?.replace, f.why])).toEqual([
        [
          "GLOSSLINT_AVOID",
          "Trusted rider list",
          "trusted rider list",
          "Ops calls it the trusted rider list.",
        ],
      ]);
    });

    it("lets a later extends entry's avoid words and abbreviations win", () => {
      const a = defineCorpus({
        terms: [
          { term: "Station", avoid: ["hub"] },
          { term: "Day Pass", abbr: ["DP"] },
        ],
      });
      const b = defineCorpus({
        terms: [
          { term: "Depot", avoid: ["hub"] },
          { term: "Dock pass", abbr: ["DP"] },
        ],
      });
      const both = createMatcher(defineCorpus({ extends: [a, b] }));
      expect(both.check("Go to the hub with a Dp.").map((f) => [f.code, f.term.term])).toEqual([
        ["GLOSSLINT_AVOID", "Depot"],
        ["GLOSSLINT_CASE", "Dock pass"],
      ]);
      const own = createMatcher(
        defineCorpus({ extends: [a], terms: [{ term: "Dock pass", abbr: ["DP"] }] }),
      );
      expect(own.check("Buy a Dp.").map((f) => f.term.term)).toEqual(["Dock pass"]);
    });

    it("lets an own term that overrides a key keep its precedence over later extends", () => {
      const a = defineCorpus({ terms: [{ term: "Station", avoid: ["hub"] }] });
      const b = defineCorpus({ terms: [{ term: "Depot", avoid: ["hub"] }] });
      const corpus = defineCorpus({
        extends: [a, b],
        terms: [{ term: "station", avoid: ["hub"] }],
      });
      expect(createMatcher(corpus).check("Go to the hub.")[0]?.term.term).toBe("station");
    });

    it("concatenates allow lists, extends first", () => {
      const corpus = defineCorpus({ extends: [first, second], allow: ["check out our"] });
      expect(corpus.allow).toEqual(["roof rack", "bike rack", "check out our"]);
    });
  });

  describe("errors", () => {
    it("C001: names the nearest field for an unknown term field", () => {
      const error = configError({ terms: [{ term: "Dock", avoids: ["rack"] }] });
      expect(error).toMatchObject({
        code: "GLOSSLINT_C001",
        why: 'Unknown field "avoids" in term "Dock".',
        fix: 'Rename it to "avoid".',
        term: "Dock",
      });
      expect(error.message).toBe('Unknown field "avoids" in term "Dock". (term "Dock")');
    });

    it("C001: lists the fields when none is near", () => {
      const error = configError({ terms: [{ term: "Dock", colour: "blue" }] });
      expect(error.code).toBe("GLOSSLINT_C001");
      expect(error.fix).toMatch(/^Remove it\. The fields are "term", /);
    });

    it("C001: checks the corpus, avoid, link and example fields too", () => {
      expect(configError({ term: [] })).toMatchObject({
        code: "GLOSSLINT_C001",
        fix: 'Rename it to "terms".',
      });
      expect(configError({ allows: [] })).toMatchObject({ fix: 'Rename it to "allow".' });
      expect(
        configError({ terms: [{ term: "Dock", avoid: [{ word: "rack", reason: "x" }] }] }).code,
      ).toBe("GLOSSLINT_C001");
      expect(
        configError({ terms: [{ term: "Dock", links: [{ title: "Docks", href: "x" }] }] }),
      ).toMatchObject({
        code: "GLOSSLINT_C001",
      });
      expect(configError({ terms: [{ term: "Dock", examples: { goood: [] } }] })).toMatchObject({
        fix: 'Rename it to "good".',
      });
    });

    it("C002: a term with no `term` or no letters", () => {
      expect(configError({ terms: [{ description: "A stand." }] })).toMatchObject({
        code: "GLOSSLINT_C002",
        why: 'Entry 1 of "terms" has no "term".',
      });
      expect(configError({ terms: [{ term: "Dock" }, { term: "--" }] })).toMatchObject({
        code: "GLOSSLINT_C002",
        term: "--",
      });
    });

    it("C003: a bad case mode", () => {
      expect(configError({ terms: [{ term: "Dock", case: "title" }] })).toMatchObject({
        code: "GLOSSLINT_C003",
        why: '"case" is "title".',
        fix: 'Use "exact", "spelling" or "context".',
        term: "Dock",
      });
    });

    it("C004: an avoid word equal to its own term", () => {
      expect(configError({ terms: [{ term: "Day Pass", avoid: ["day  pass"] }] })).toMatchObject({
        code: "GLOSSLINT_C004",
        term: "Day Pass",
      });
      expect(configError({ terms: [{ term: "Dock", avoid: [{ word: "DOCK" }] }] }).code).toBe(
        "GLOSSLINT_C004",
      );
    });

    it("C004 is not raised for a spelling variant, which decision 10 reports as TERM", () => {
      expect(() =>
        defineCorpus({ terms: [{ term: "Checkout", avoid: ["check-out"] }] }),
      ).not.toThrow();
    });

    it("C005: two terms with the same key in one corpus", () => {
      expect(configError({ terms: [{ term: "Day Pass" }, { term: "day-pass" }] })).toMatchObject({
        code: "GLOSSLINT_C005",
        why: '"Day Pass" and "day-pass" are the same words, so they are one term.',
        term: "day-pass",
      });
    });

    it("C006: a bad skip value", () => {
      expect(configError({ terms: [{ term: "BikeShare", skip: ["title"] }] })).toMatchObject({
        code: "GLOSSLINT_C006",
        why: '"skip" has "title".',
      });
      expect(configError({ terms: [{ term: "BikeShare", skip: "lower" }] }).code).toBe(
        "GLOSSLINT_C006",
      );
    });

    it("C007: fields of the wrong type", () => {
      const cases: unknown[] = [
        null,
        { terms: {} },
        { extends: {} },
        { allow: "roof rack" },
        { terms: ["Dock"] },
        { terms: [{ term: "Dock", description: 1 }] },
        { terms: [{ term: "Dock", abbr: "DK" }] },
        { terms: [{ term: "Dock", abbr: [""] }] },
        { terms: [{ term: "Dock", avoid: "rack" }] },
        { terms: [{ term: "Dock", avoid: [""] }] },
        { terms: [{ term: "Dock", avoid: [{ word: "rack", why: 2 }] }] },
        { terms: [{ term: "Dock", examples: ["x"] }] },
        { terms: [{ term: "Dock", examples: { good: "x" } }] },
        { terms: [{ term: "Dock", links: {} }] },
        { terms: [{ term: "Dock", links: [{ title: "Docks" }] }] },
        { terms: [{ term: "Dock", forms: { de: "Dock" } }] },
        { terms: [{ term: "Dock", translations: { de: ["Dock"] } }] },
      ];
      for (const input of cases)
        expect(configError(input).code, JSON.stringify(input)).toBe("GLOSSLINT_C007");
    });

    it("C011: a casing with an unknown kind or style", () => {
      expect(configError({ casing: { table: "upper" } })).toMatchObject({
        code: "GLOSSLINT_C011",
        why: '"casing" of the corpus has the kind "table".',
      });
      expect(configError({ terms: [{ term: "Dock", casing: { header: "caps" } }] })).toMatchObject({
        code: "GLOSSLINT_C011",
        why: '"casing.header" of term "Dock" is "caps".',
      });
      expect(configError({ casing: "upper" }).code).toBe("GLOSSLINT_C011");
    });

    it("C008: an extends entry that is not a corpus", () => {
      expect(configError({ extends: [{ terms: [{ term: "Dock" }] }] })).toMatchObject({
        code: "GLOSSLINT_C008",
        why: 'Entry 1 of "extends" is not a corpus.',
      });
    });
  });
});
