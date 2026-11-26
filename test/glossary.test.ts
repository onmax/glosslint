import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vite-plus/test";
import { defineCorpus } from "../src/corpus.ts";
import { GlosslintConfigError } from "../src/errors.ts";
import { fromGlossary, readGlossary } from "../src/glossary.ts";
import inclusive from "../src/presets/inclusive.ts";
import tech from "../src/presets/tech.ts";

const fixture = (name: string) => new URL(`./fixtures/glossary/${name}`, import.meta.url);
const read = (name: string) => readFileSync(fixture(name), "utf8");
const codes = (text: string) => readGlossary(text).problems.map((problem) => problem.code);

/** The error `fromGlossary` throws for `path`. */
function thrown(path: string | URL): GlosslintConfigError {
  try {
    fromGlossary(path);
  } catch (error) {
    expect(error).toBeInstanceOf(GlosslintConfigError);
    return error as GlosslintConfigError;
  }
  throw new Error("fromGlossary did not throw");
}

describe("readGlossary", () => {
  it("reads the file into the corpus defineCorpus gives for the same values, presets included", () => {
    const result = readGlossary(read("spec.md"));
    expect(result.problems).toEqual([]);
    expect(result.fixed).toBeUndefined();
    expect(result.corpus).toEqual(
      defineCorpus({
        extends: [tech, inclusive],
        terms: [
          {
            term: "Dock",
            description: "A powered stand where one bike is locked.",
            nuance: "A station is a group of docks. Say dock for one stand.",
            why: 'Riders read "dock" on the stand itself.',
            avoid: [{ word: "rack", why: "Racks are unpowered." }, "bay"],
            examples: {
              good: ["Return the bike to any dock"],
              bad: ["Return the bike to any rack"],
            },
            links: [{ title: "Docks", url: "https://example.com/docs/docks" }],
          },
          { term: "Day Pass", abbr: ["DP"], case: "context" },
        ],
        allow: ["check out our", "roof rack"],
        casing: { label: "sentence", header: "title" },
      }),
    );
  });

  it("infers exact from a capital after a letter, lets Case win, and reads abbreviations", () => {
    const terms = readGlossary(read("inference.md")).corpus!.terms;
    expect(terms).toEqual([
      { term: "eBike", case: "exact" },
      { term: "SOS", case: "exact" },
      { term: "kiosk" },
      { term: "Day Pass", abbr: ["DP", "D"] },
    ]);
    const spelled = readGlossary("# Glossary\n\n## eBike\n\nCase: spelling\n").corpus!.terms;
    expect(spelled).toEqual([{ term: "eBike", case: "spelling" }]);
    const how = readGlossary("# Glossary\n\n## kiosk\n\nHow: Always lowercase.\n").corpus!.terms;
    expect(how[0]?.case).toBeUndefined();
  });

  it("joins a text field's lines and paragraphs with one space", () => {
    const text =
      "# Glossary\n\n## Dock\n\nWhat: A powered stand\nwhere one bike is locked.\n\nIt charges the bike.\n";
    expect(readGlossary(text).corpus!.terms[0]?.description).toBe(
      "A powered stand where one bike is locked. It charges the bike.",
    );
  });

  it("reads comma lists, backticked avoid words and reasons split at the first colon and space", () => {
    const text =
      "# Glossary\n\n## Dock\n\nAvoid: rack, `bay, berth`: Old words., `pod:x`, slot: Ops: only\n";
    expect(readGlossary(text).corpus!.terms[0]?.avoid).toEqual([
      "rack",
      { word: "bay, berth", why: "Old words." },
      "pod:x",
      { word: "slot", why: "Ops: only" },
    ]);
  });

  it("reports one code per problem the format names", () => {
    expect(codes("# Glossary\n\n## Dock\n\nWhat: A stand.\n")).toEqual([]);
    expect(codes("## Dock\n")).toEqual(["GLOSSLINT_G001"]);
    expect(codes("# Glossary\n\n## Dock\n\nmeaning: A stand.\n")).toEqual(["GLOSSLINT_G002"]);
    expect(codes("# Glossary\n\n## Dock\n\nLinks:\n\n- https://a.example\n")).toEqual([
      "GLOSSLINT_G003",
    ]);
    expect(codes(read("g004.md"))).toEqual(["GLOSSLINT_G004"]);
    expect(codes(read("g005.md"))).toEqual(["GLOSSLINT_G005"]);
    expect(codes(read("g006.md"))).toEqual(["GLOSSLINT_G006"]);
    expect(codes(read("g007.md"))).toEqual(["GLOSSLINT_G007"]);
    expect(codes(read("g008.md"))).toEqual(["GLOSSLINT_G008"]);
  });

  it("reports text, tables, code fences and H3s a term has no place for", () => {
    const where = (body: string) =>
      readGlossary(`# Glossary\n\n## Dock\n\n${body}\n`).problems.map(
        (problem) => `${problem.code} ${problem.line} ${problem.term}`,
      );
    expect(where("A stand.")).toEqual(["GLOSSLINT_G004 5 Dock"]);
    expect(where("Avoid:\n\n- rack\n\nMore text.")).toEqual(["GLOSSLINT_G004 9 Dock"]);
    expect(where("| a | b |\n| - | - |")).toEqual(["GLOSSLINT_G004 5 Dock"]);
    expect(where("```\ncode\n```")).toEqual(["GLOSSLINT_G004 5 Dock"]);
    expect(where("### Notes")).toEqual(["GLOSSLINT_G004 5 Dock"]);
  });

  it("reports bad values: Case, Casing, presets, links and empty fields", () => {
    const head = "# Glossary\n\n";
    expect(codes(`${head}Extends: tech, prose\n`)).toEqual(["GLOSSLINT_G006"]);
    expect(codes(`${head}Casing: label loud\n`)).toEqual(["GLOSSLINT_G006"]);
    expect(codes(`${head}## Dock\n\nLinks:\n\n- [Docks](ftp://a)\n`)).toEqual(["GLOSSLINT_G006"]);
    expect(codes(`${head}## Dock\n\nWhat:\n`)).toEqual(["GLOSSLINT_G006"]);
  });

  it("gives each problem its line, term, fix and whether --fix rewrites it", () => {
    const [problem] = readGlossary(read("g004.md")).problems;
    expect(problem).toEqual({
      code: "GLOSSLINT_G004",
      line: 7,
      why: '"Note" is not a field.',
      fix: 'Use "What", "How", "Why", "Avoid", "Good", "Bad", "Links" or "Case", or reword the line so it does not start with "Note:".',
      fixable: false,
      term: "Dock",
    });
    expect(readGlossary("## Dock\n").problems[0]?.fixable).toBe(true);
  });

  it("rewrites fixable problems into the canonical form, which reads back clean", () => {
    const result = readGlossary(read("fixable.md"));
    expect(new Set(result.problems.map((problem) => problem.code))).toEqual(
      new Set(["GLOSSLINT_G001", "GLOSSLINT_G002", "GLOSSLINT_G003"]),
    );
    expect(result.problems.every((problem) => problem.fixable)).toBe(true);
    expect(result.fixed).toBe(read("fixable.fixed.md"));
    const again = readGlossary(result.fixed!);
    expect(again).toEqual({ problems: [], corpus: result.corpus });
  });

  it("is idempotent: parse, format and parse give the same corpus and text", () => {
    for (const name of ["spec.md", "fixable.md", "inference.md", "project/.agents/glossary.md"]) {
      const first = readGlossary(read(name));
      const text = first.fixed ?? read(name);
      const second = readGlossary(text);
      expect(second.fixed, name).toBeUndefined();
      expect(second.corpus, name).toEqual(first.corpus);
    }
  });

  it("reports CRLF line endings, trailing spaces and a missing final newline as layout", () => {
    const clean = read("spec.md");
    for (const text of [clean.replace(/\n/g, "\r\n"), clean.trimEnd(), `${clean.trimEnd()}  \n`]) {
      const result = readGlossary(text);
      expect(codes(text)).toEqual(["GLOSSLINT_G003"]);
      expect(result.fixed).toBe(clean);
    }
  });

  it("gives no corpus and no fixed text with a problem only a person can fix", () => {
    expect(readGlossary(read("g004.md"))).toEqual({ problems: expect.any(Array) });
  });

  it("reports failing examples as G009 but still gives the corpus", () => {
    const text =
      "# Glossary\n\n## Dock\n\nAvoid: rack\n\nGood:\n\n- Park at the rack\n\nBad:\n\n- Park at the stand\n";
    const result = readGlossary(text);
    expect(result.problems.map((problem) => `${problem.code} ${problem.line}`)).toEqual([
      "GLOSSLINT_G009 9",
      "GLOSSLINT_G009 13",
    ]);
    expect(result.corpus).toBeDefined();
  });
});

describe("fromGlossary", () => {
  it("reads .agents/glossary.md from the current folder by default", () => {
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(fixture("project").pathname);
    try {
      expect(fromGlossary().terms.map((term) => term.term)).toEqual([
        "Dock",
        "Checkout",
        "Recharge point",
      ]);
      expect(fromGlossary("../other.md").terms.map((term) => term.term)).toEqual(["Station"]);
    } finally {
      cwd.mockRestore();
    }
  });

  it("reads a URL", () => {
    expect(fromGlossary(fixture("spec.md"))).toEqual(readGlossary(read("spec.md")).corpus);
  });

  it("throws the code, path:line and fix for G004 to G008", () => {
    for (const [name, line] of [
      ["g004.md", 7],
      ["g005.md", 5],
      ["g006.md", 5],
      ["g007.md", 3],
      ["g008.md", 5],
    ] as const) {
      const error = thrown(fixture(name));
      expect(error.code).toBe(`GLOSSLINT_G00${name[3]}`);
      expect(error.why).toMatch(new RegExp(`glossary/${name}:${line}: `));
      expect(error.fix).not.toBe("");
    }
  });

  it("loads a file with only fixable problems as its fixed form", () => {
    expect(fromGlossary(fixture("fixable.md"))).toEqual(
      readGlossary(read("fixable.fixed.md")).corpus,
    );
  });

  it("throws GLOSSLINT_C009 naming the path when the file is missing", () => {
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(fixture("").pathname);
    try {
      const error = thrown(".agents/glossary.md");
      expect(error.code).toBe("GLOSSLINT_C009");
      expect(error.why).toBe("No glossary at .agents/glossary.md.");
    } finally {
      cwd.mockRestore();
    }
  });
});
