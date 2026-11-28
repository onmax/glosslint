import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { defineCorpus } from "../src/corpus.ts";
import { readGlossary } from "../src/glossary.ts";
import tech from "../src/presets/tech.ts";
import {
  diglotMatch,
  explain,
  explainMatches,
  printCorpus,
  testCorpus,
  toDiglotGlossary,
  toX18nGlossary,
} from "../src/tools.ts";
import type { Corpus } from "../src/types.ts";
import { bike, bikeTerms } from "./core/bike.ts";

/** The corpus of a glossary file's text, which must have no problems. */
function glossaryCorpus(text: string): Corpus {
  const { corpus, problems } = readGlossary(text);
  expect(problems).toEqual([]);
  return corpus!;
}

/** Day Pass, with a decision per locale in each of the forms the Translations field takes. */
const decisions = `# Glossary

## Day Pass (DP)
What: Unlimited rides for one day.
Avoid: day ticket
Translations:
- fr: forfait journée
- de: keep
- es: translate
- it: keep (abbonamento giornaliero)
- pt: \`keep\`
Forms:
- en: day-pass, daypass
- fr: forfait jour, \`/forfaits? journ[ée]es?/\`, forfait (1 jour)
Hints:
- fr: Masculine: le forfait.

## Nuxt
Case: exact
Translations:
- fr: keep

## eBike
Case: exact
`;

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

  it("writes the term for a locale that keeps it, puts a gloss in the note, and skips translate, patterns and hints", () => {
    expect(toX18nGlossary(glossaryCorpus(decisions))).toEqual([
      {
        term: "Day Pass",
        translations: {
          fr: "forfait journée",
          pt: "keep",
          de: "Day Pass",
          it: "Day Pass",
        },
        forms: { en: ["day-pass", "daypass"], fr: ["forfait jour", "forfait (1 jour)"] },
        note: 'Unlimited rides for one day. it: keep, gloss as "abbonamento giornaliero"',
      },
      { term: "Nuxt", translations: { fr: "Nuxt" } },
      { term: "eBike", doNotTranslate: true },
    ]);
  });

  it("leaves out the terms a preset adds, through any corpus that extends it, and keeps a term that replaces one", () => {
    const corpus = defineCorpus({
      extends: [tech],
      terms: [{ term: "Dock" }, { term: "GitHub", description: "Where the code lives" }],
    });
    expect(toX18nGlossary(corpus)).toEqual([
      { term: "Dock" },
      { term: "GitHub", note: "Where the code lives." },
    ]);
    const outer = defineCorpus({ extends: [corpus], terms: [{ term: "Station" }] });
    expect(toX18nGlossary(outer).map((entry) => entry.term)).toEqual(["Dock", "GitHub", "Station"]);
  });
});

describe("toDiglotGlossary", () => {
  it("exports the locale's decision, hint and accepted forms for each term with an item for it", () => {
    const corpus = glossaryCorpus(decisions);
    const match =
      "\\b(?:Day[- ]?Passing|day[- ]?tickets|Day[- ]?Passed|Day[- ]?Passes|day[- ]?ticket|daypassing|daypassed|daypasses|Day[- ]?Pass|daypass|DPs|DP)\\b";
    expect(toDiglotGlossary(corpus, "fr")).toEqual([
      {
        term: "Day Pass",
        forms: ["day-pass", "daypass"],
        ownsNote: true,
        entry: {
          term: "Day Pass",
          match,
          note: "Masculine: le forfait.",
          decision: "translate",
          target: "forfait journée",
          accept: ["forfait jour", "forfait \\(1 jour\\)", "forfaits? journ[ée]es?"],
        },
      },
      {
        term: "Nuxt",
        forms: [],
        ownsNote: false,
        entry: {
          term: "Nuxt",
          match: "\\b(?:Nuxts|Nuxt)\\b",
          caseSensitive: true,
          decision: "keep",
        },
      },
    ]);
    const entries = (locale: string) =>
      toDiglotGlossary(corpus, locale).map(({ entry }) => ({ ...entry, match: undefined }));
    expect(entries("de")).toEqual([{ term: "Day Pass", decision: "keep" }]);
    expect(entries("es")).toEqual([{ term: "Day Pass", decision: "translate" }]);
    expect(entries("it")).toEqual([
      { term: "Day Pass", decision: "keep-gloss", gloss: "abbonamento giornaliero" },
    ]);
    expect(entries("pt")).toEqual([{ term: "Day Pass", decision: "translate", target: "keep" }]);
    expect(entries("nl")).toEqual([]);
  });

  it("borders a spelling that \\b can't border with letters and digits, and adds source patterns as they are", () => {
    const corpus = glossaryCorpus(
      "# Glossary\n\n## C#\nCase: exact\n\n## Café\nForms:\n- en: `/caf[eé]s?/`\n",
    );
    const [csharp, cafe] = corpus.terms.slice(-2);
    expect(diglotMatch(csharp!)).toBe("(?<![\\p{L}\\p{N}_])(?:C#)(?![\\p{L}\\p{N}_])");
    const pattern = new RegExp(diglotMatch(cafe!), "iu");
    expect(["Café", "cafés", "cafe", "cafes"].every((text) => pattern.test(text))).toBe(true);
    expect(pattern.test("cafébar")).toBe(false);
  });

  it("matches every term, form, abbreviation and good example of the docs example and the presets", () => {
    const example = readFileSync(
      new URL("../examples/basic/.agents/glossary.md", import.meta.url),
      "utf8",
    );
    const corpora = [glossaryCorpus(example), bike];
    let checked = 0;
    for (const corpus of corpora)
      for (const term of corpus.terms) {
        const pattern = new RegExp(diglotMatch(term), term.case === "exact" ? "u" : "iu");
        const texts = [
          term.term,
          ...(term.abbr ?? []),
          ...(term.forms?.en ?? []),
          ...(term.examples?.good ?? []),
        ];
        for (const text of texts) {
          checked++;
          expect(pattern.test(text), `${term.term}: ${text}`).toBe(true);
        }
      }
    expect(checked).toBeGreaterThan(500);
  });
});
