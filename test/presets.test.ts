import { describe, expect, it } from "vite-plus/test";
import inclusive from "../src/presets/inclusive.ts";
import tech from "../src/presets/tech.ts";
import { testCorpus } from "../src/tools.ts";

describe("presets", () => {
  it("passes every example of the inclusive preset", () => {
    expect(inclusive.terms.some((term) => term.examples)).toBe(true);
    expect(testCorpus(inclusive)).toEqual([]);
  });

  it("passes every example of the tech preset", () => {
    expect(testCorpus(tech)).toEqual([]);
  });
});
