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
    const spelled = readGlossary("# Glossary\n\n## eBike\nCase: spelling\n").corpus!.terms;
    expect(spelled).toEqual([{ term: "eBike", case: "spelling" }]);
    const how = readGlossary("# Glossary\n\n## kiosk\nHow: Always lowercase.\n").corpus!.terms;
    expect(how[0]?.case).toBeUndefined();
  });

  it("joins a text field's lines and paragraphs with one space", () => {
    const text =
      "# Glossary\n\n## Dock\nWhat: A powered stand\nwhere one bike is locked.\n\nIt charges the bike.\n";
    expect(readGlossary(text).corpus!.terms[0]?.description).toBe(
      "A powered stand where one bike is locked. It charges the bike.",
    );
  });

  it("reports a mistyped field on the next line instead of joining it to the field above", () => {
    const typo = readGlossary("# Glossary\n\n## Dock\nWhat: A stand.\nAvod: rack\n");
    expect(typo.problems.map((problem) => [problem.code, problem.line])).toEqual([
      ["GLOSSLINT_G002", 5],
    ]);
    expect(typo.corpus!.terms[0]).toMatchObject({ description: "A stand.", avoid: ["rack"] });
    const prose = readGlossary("# Glossary\n\n## Dock\nWhat: A stand\nsee below: it charges.\n");
    expect(prose.problems).toEqual([]);
    expect(prose.corpus!.terms[0]?.description).toBe("A stand see below: it charges.");
  });

  it("reads comma lists, backticked avoid words and reasons split at the first colon and space", () => {
    const text =
      "# Glossary\n\n## Dock\nAvoid: rack, `bay, berth`: Old words., `pod:x`, slot: Ops: only\n";
    expect(readGlossary(text).corpus!.terms[0]?.avoid).toEqual([
      "rack",
      { word: "bay, berth", why: "Old words." },
      "pod:x",
      { word: "slot", why: "Ops: only" },
    ]);
  });

  it("reports one code per problem the format names", () => {
    expect(codes("# Glossary\n\n## Dock\nWhat: A stand.\n")).toEqual([]);
    expect(codes("## Dock\n")).toEqual(["GLOSSLINT_G001"]);
    expect(codes("# Glossary\n\n## Dock\nmeaning: A stand.\n")).toEqual(["GLOSSLINT_G002"]);
    expect(codes("# Glossary\n\n## Dock\nLinks:\n- https://a.example\n")).toEqual([
      "GLOSSLINT_G003",
    ]);
    expect(codes(read("g004.md"))).toEqual(["GLOSSLINT_G004"]);
    expect(codes(read("g005.md"))).toEqual(["GLOSSLINT_G005"]);
    expect(codes(read("g006.md"))).toEqual(["GLOSSLINT_G006"]);
    expect(codes(read("g007.md"))).toEqual(["GLOSSLINT_G007"]);
    expect(codes(read("g008.md"))).toEqual(["GLOSSLINT_G008"]);
  });

  it("reads a paragraph with several fields clean, and starts a field at a name in any case", () => {
    const text =
      "# Glossary\n\n## Station\nWhat: A group of docks.\nHow: Say station for the whole group.\nWhy: Riders see it on the map.\n";
    const result = readGlossary(text);
    expect(result.problems).toEqual([]);
    expect(result.corpus!.terms[0]).toMatchObject({
      description: "A group of docks.",
      nuance: "Say station for the whole group.",
      why: "Riders see it on the map.",
    });
    const lower = readGlossary(text.replace("How:", "how:"));
    expect(lower.problems.map((problem) => `${problem.code} ${problem.line}`)).toEqual([
      "GLOSSLINT_G002 5",
    ]);
    expect(lower.fixed).toBe(text);
  });

  it("ends a list at the next line that is not indented, or that a formatter indented as a field", () => {
    const text = "# Glossary\n\n## Dock\nAvoid:\n- rack\nGood:\n- Park at the dock\n";
    const result = readGlossary(text);
    expect(result.problems).toEqual([]);
    expect(result.corpus!.terms[0]).toMatchObject({
      avoid: ["rack"],
      examples: { good: ["Park at the dock"] },
    });
    const indented = readGlossary(text.replace("\nGood:", "\n  Good:"));
    expect(indented.corpus).toEqual(result.corpus);
    expect(indented.fixed).toBe(text);
  });

  it("reports the old layout's blank lines inside a term and the corpus fields as G003", () => {
    const result = readGlossary(read("old-layout.md"));
    expect(new Set(result.problems.map((problem) => problem.why))).toEqual(
      new Set(["A blank line before this line."]),
    );
    expect(result.problems[0]).toMatchObject({
      code: "GLOSSLINT_G003",
      line: 7,
      fix: "Remove it: a term's heading and its fields go on consecutive lines.",
      fixable: true,
    });
    expect(result.fixed).toBe(read("spec.md"));
  });

  it("reports text, tables, code fences and H3s a term has no place for", () => {
    const where = (body: string) =>
      readGlossary(`# Glossary\n\n## Dock\n${body}\n`).problems.map(
        (problem) => `${problem.code} ${problem.line} ${problem.term}`,
      );
    expect(where("A stand.")).toEqual(["GLOSSLINT_G004 4 Dock"]);
    expect(where("Avoid:\n- rack\n\nMore text.")).toEqual(["GLOSSLINT_G004 7 Dock"]);
    expect(where("| a | b |\n| - | - |")).toEqual(["GLOSSLINT_G004 4 Dock"]);
    expect(where("```\ncode\n```")).toEqual(["GLOSSLINT_G004 4 Dock"]);
    expect(where("### Notes")).toEqual(["GLOSSLINT_G004 4 Dock"]);
  });

  it("reports bad values: Case, Casing, presets, links and empty fields", () => {
    const head = "# Glossary\n\n";
    expect(codes(`${head}Presets: tech, prose\n`)).toEqual(["GLOSSLINT_G006"]);
    expect(codes(`${head}Presets: constructor\n`)).toEqual(["GLOSSLINT_G006"]);
    expect(codes(`${head}Casing: label loud\n`)).toEqual(["GLOSSLINT_G006"]);
    expect(codes(`${head}## Dock\nLinks:\n- [Docks](ftp://a)\n`)).toEqual(["GLOSSLINT_G006"]);
    expect(codes(`${head}## Dock\nWhat:\n`)).toEqual(["GLOSSLINT_G006"]);
  });

  it("reads Extends as Presets and rewrites it as G002", () => {
    const text = "# Glossary\n\nExtends: tech\n\n## Dock\nAvoid: rack\n";
    const result = readGlossary(text);
    expect(result.problems).toEqual([
      {
        code: "GLOSSLINT_G002",
        line: 3,
        why: '"Extends" is another name for "Presets".',
        fix: 'Rename it to "Presets".',
        fixable: true,
      },
    ]);
    expect(result.fixed).toBe(text.replace("Extends:", "Presets:"));
    expect(result.corpus).toEqual(readGlossary(result.fixed!).corpus);
    expect(result.corpus!.terms.some((term) => term.term === "GitHub")).toBe(true);
  });

  it("reads a term's Casing as defineCorpus's casing, which makes the term context without Case", () => {
    const text =
      "# Glossary\n\n## Ride history\nCasing: label as-written, sentence lower\n\n## eBike\nCasing: label as-written\n\n## GitHub\nCase: exact\nCasing: label upper\n";
    const result = readGlossary(text);
    expect(result.problems).toEqual([]);
    expect(result.corpus).toEqual(
      defineCorpus({
        terms: [
          { term: "Ride history", casing: { label: "as-written", sentence: "lower" } },
          { term: "eBike", casing: { label: "as-written" } },
          { term: "GitHub", case: "exact", casing: { label: "upper" } },
        ],
      }),
    );
    expect(codes("# Glossary\n\n## Dock\nCasing: label loud\n")).toEqual(["GLOSSLINT_G006"]);
    expect(codes("# Glossary\n\n## Dock\nCasing: label title\nCase: context\n")).toEqual([
      "GLOSSLINT_G003",
    ]);
  });

  it("gives each problem its line, term, fix and whether --fix rewrites it", () => {
    const [problem] = readGlossary(read("g004.md")).problems;
    expect(problem).toEqual({
      code: "GLOSSLINT_G004",
      line: 5,
      why: '"Note" is not a field.',
      fix: 'Use "What", "How", "Why", "Avoid", "Good", "Bad", "Links", "Case" or "Casing", or reword the line so it does not start with "Note:".',
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
      "# Glossary\n\n## Dock\nAvoid: rack\nGood:\n- Park at the rack\nBad:\n- Park at the stand\n";
    const result = readGlossary(text);
    expect(result.problems.map((problem) => `${problem.code} ${problem.line}`)).toEqual([
      "GLOSSLINT_G009 6",
      "GLOSSLINT_G009 8",
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
      ["g004.md", 5],
      ["g005.md", 5],
      ["g006.md", 4],
      ["g007.md", 3],
      ["g008.md", 4],
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
