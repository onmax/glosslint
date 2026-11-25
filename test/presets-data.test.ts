import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import inclusive from "../src/presets/inclusive.ts";
import tech from "../src/presets/tech.ts";
import { counts } from "../src/presets/tech-data.ts";
import type { Term } from "../src/types.ts";

const dictDir = new URL("../node_modules/case-police/dict/", import.meta.url);
const dicts = Object.fromEntries(
  readdirSync(dictDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => [
      file.replace(/\.json$/, ""),
      JSON.parse(readFileSync(new URL(file, dictDir), "utf8")) as Record<string, string>,
    ]),
);

const key = (text: string) => text.toLowerCase().replace(/[\s._-]+/g, "");
const duplicates = (keys: string[]) => keys.filter((k, i) => keys.indexOf(k) !== i);
const avoidWord = (avoid: NonNullable<Term["avoid"]>[number]) =>
  typeof avoid === "string" ? avoid : avoid.word;

describe("tech preset", () => {
  it("counts every case-police entry, 488 in five files", () => {
    expect(counts).toEqual({
      abbreviates: 118,
      brands: 30,
      general: 18,
      products: 13,
      softwares: 309,
    });
    expect(Object.values(counts).reduce((sum, n) => sum + n, 0)).toBe(488);
    expect(
      Object.fromEntries(Object.entries(dicts).map(([name, d]) => [name, Object.keys(d).length])),
    ).toEqual(counts);
  });

  it("keeps every canonical spelling, as a term or an allowed phrase", () => {
    const spellings = new Set([...tech.terms.map((t) => t.term), ...tech.allow]);
    const missing = Object.values(dicts)
      .flatMap((d) => Object.values(d))
      .filter((canonical) => !spellings.has(canonical));
    expect(missing).toEqual([]);
  });

  it("finds each case-police key under its term's key", () => {
    const keys = new Set(tech.terms.map((t) => key(t.term)));
    const missing = Object.values(dicts)
      .flatMap((d) => Object.keys(d))
      .filter((lookup) => !keys.has(key(lookup)));
    expect(missing).toEqual([]);
  });

  it("has one term per key, each exact and passing all-lower and all-caps words", () => {
    expect(tech.kind).toBe("glosslint.corpus");
    expect(tech.terms).toHaveLength(477);
    expect(duplicates(tech.terms.map((t) => key(t.term)))).toEqual([]);
    for (const term of tech.terms) {
      expect(term).toEqual({ term: term.term, case: "exact", skip: ["lower", "upper"] });
    }
    expect(tech.allow).toEqual([
      "AntDesign",
      "AntDesignVue",
      "CompositionAPI",
      "GraphRAG",
      "NaiveUI",
      "TailwindCSS",
      "WindiCSS",
    ]);
  });
});

describe("inclusive preset", () => {
  it("has 30 to 40 terms with no duplicate key, term or avoid word", () => {
    expect(inclusive.kind).toBe("glosslint.corpus");
    expect(inclusive.terms.length).toBeGreaterThanOrEqual(30);
    expect(inclusive.terms.length).toBeLessThanOrEqual(40);
    const terms = inclusive.terms.map((t) => key(t.term));
    const avoids = inclusive.terms.flatMap((t) => (t.avoid ?? []).map((a) => key(avoidWord(a))));
    expect(duplicates([...terms, ...avoids])).toEqual([]);
  });

  it("gives every term a description, avoid words with reasons, and examples", () => {
    for (const term of inclusive.terms) {
      expect(term.description, term.term).toMatch(/\S\.$/);
      expect(term.avoid?.length, term.term).toBeGreaterThan(0);
      for (const avoid of term.avoid ?? []) {
        expect(typeof avoid === "object" && avoid.why, `${term.term}: ${avoidWord(avoid)}`).toMatch(
          /\S\.$/,
        );
      }
      expect(term.examples?.good?.length, term.term).toBeGreaterThan(0);
      expect(term.examples?.bad?.length, term.term).toBeGreaterThan(0);
    }
  });

  it("writes each bad example with one of its avoid words and each good one without", () => {
    const allAvoids = inclusive.terms.flatMap((t) => (t.avoid ?? []).map(avoidWord));
    const has = (text: string, word: string) =>
      new RegExp(`\\b${word.replace(/-/g, "[- ]?")}(e?s)?\\b`, "i").test(text);
    for (const term of inclusive.terms) {
      const own = (term.avoid ?? []).map(avoidWord);
      for (const bad of term.examples?.bad ?? []) {
        expect(
          own.some((word) => has(bad, word)),
          bad,
        ).toBe(true);
      }
      for (const good of term.examples?.good ?? []) {
        expect(
          allAvoids.filter((word) => has(good, word)),
          good,
        ).toEqual([]);
      }
    }
  });

  it("never flags a bare word that has an ordinary technical sense", () => {
    const words = inclusive.terms.flatMap((t) => (t.avoid ?? []).map(avoidWord));
    for (const bare of ["master", "black", "white", "dummy", "blind", "kill", "native"]) {
      expect(words).not.toContain(bare);
    }
  });

  it("shares no key with the tech preset", () => {
    const techKeys = new Set(tech.terms.map((t) => key(t.term)));
    const clashes = inclusive.terms
      .flatMap((t) => [t.term, ...(t.avoid ?? []).map(avoidWord)])
      .filter((word) => techKeys.has(key(word)));
    expect(clashes).toEqual([]);
  });
});
