import { readdirSync, readFileSync } from "node:fs";
import { buildRegex, replaceCore } from "case-police";
import { describe, expect, it } from "vite-plus/test";
import { createMatcher } from "../src/matcher.ts";
import tech from "../src/presets/tech.ts";
import { termKey } from "../src/words.ts";

// Every case-police 2.2.1 entry, written four ways inside a sentence, fixed by glosslint and by case-police itself.
const dictDir = new URL("../node_modules/case-police/dict/", import.meta.url);
const dicts = Object.fromEntries(
  readdirSync(dictDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => [
      file.replace(/\.json$/, ""),
      JSON.parse(readFileSync(new URL(file, dictDir), "utf8")) as Record<string, string>,
    ]),
);
const entries = Object.entries(dicts).flatMap(([dict, words]) =>
  Object.entries(words).map(([key, canonical]) => ({ dict, key, canonical })),
);
const dictionary = Object.fromEntries(entries.map(({ key, canonical }) => [key, canonical]));
const regex = buildRegex(dictionary);
const matcher = createMatcher(tech);

/**
 * The only expected differences: spellings case-police lists beside a spaced form with the same key. The preset keeps
 * the spaced form as the term and puts the joined one in `allow`, which matches in any case, so glosslint leaves
 * `Antdesign` as written where case-police rewrites it to `AntDesign`.
 */
const ALLOWED_SPELLINGS: Record<string, string> = {
  AntDesign: "allowed beside the term Ant Design",
  AntDesignVue: "allowed beside the term Ant Design Vue",
  CompositionAPI: "allowed beside the term Composition API",
  GraphRAG: "allowed beside the term Graph RAG",
  NaiveUI: "allowed beside the term Naive UI",
  TailwindCSS: "allowed beside the term Tailwind CSS",
  WindiCSS: "allowed beside the term Windi CSS",
};

const sentence = (word: string) => `We use ${word} for the bike share app.`;

function casePolice(text: string): string {
  return replaceCore(text, dictionary, [], undefined, regex) ?? text;
}

function glosslint(text: string): string {
  const fixes = matcher
    .check(text)
    .filter((finding) => finding.fix?.kind === "autofix")
    .sort((a, b) => b.start - a.start);
  return fixes.reduce(
    (out, finding) => out.slice(0, finding.start) + finding.fix!.replace + out.slice(finding.end),
    text,
  );
}

const forms = (key: string, canonical: string) => ({
  capitalised: key.charAt(0).toUpperCase() + key.slice(1),
  lower: key,
  upper: key.toUpperCase(),
  canonical,
});

describe("tech preset parity with case-police 2.2.1", () => {
  it("reads 488 entries in five dictionaries", () => {
    expect(
      Object.fromEntries(
        Object.entries(dicts).map(([name, words]) => [name, Object.keys(words).length]),
      ),
    ).toEqual({ softwares: 309, abbreviates: 118, brands: 30, general: 18, products: 13 });
    expect(entries).toHaveLength(488);
  });

  it("covers every entry with a term of the same key, or an allowed spelling", () => {
    const terms = new Map(tech.terms.map((term) => [termKey(term.term), term.term]));
    const spellings = new Set([...tech.terms.map((term) => term.term), ...tech.allow]);
    expect(entries.filter(({ key }) => !terms.has(termKey(key)))).toEqual([]);
    expect(entries.filter(({ canonical }) => !spellings.has(canonical))).toEqual([]);
    expect([...tech.allow].sort()).toEqual(Object.keys(ALLOWED_SPELLINGS).sort());
  });

  it("fixes each entry written Capitalised, lower, UPPER and canonical as case-police does, but for the allowed spellings", () => {
    const differences: Array<{
      entry: string;
      form: string;
      reason: string;
      casePolice: string;
      glosslint: string;
    }> = [];
    let cases = 0;
    for (const { dict, key, canonical } of entries) {
      for (const [form, word] of Object.entries(forms(key, canonical))) {
        cases++;
        const text = sentence(word);
        const expected = casePolice(text);
        const actual = glosslint(text);
        if (actual !== expected)
          differences.push({
            entry: `${dict}/${key}`,
            form,
            reason: ALLOWED_SPELLINGS[canonical] ?? "unexplained",
            casePolice: expected,
            glosslint: actual,
          });
      }
    }
    expect(cases).toBe(1952);
    expect(differences).toEqual(
      Object.entries(ALLOWED_SPELLINGS).map(([spelling, reason]) => {
        const key = spelling.toLowerCase();
        return {
          entry: `softwares/${key}`,
          form: "capitalised",
          reason,
          casePolice: sentence(spelling),
          glosslint: sentence(key.charAt(0).toUpperCase() + key.slice(1)),
        };
      }),
    );
  });
});
