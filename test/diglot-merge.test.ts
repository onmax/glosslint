import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { parse, parseDocument } from "yaml";
import { mergeDiglotGlossary } from "../src/diglot-merge.ts";
import type { DiglotEntryInput, DiglotGlossaryEntry } from "../src/diglot-merge.ts";
import { X18nMergeError } from "../src/x18n-merge.ts";

const input = (
  entry: DiglotGlossaryEntry,
  options: { forms?: string[]; ownsNote?: boolean; term?: string } = {},
): DiglotEntryInput => ({
  term: options.term ?? entry.term,
  forms: options.forms ?? [],
  entry,
  ownsNote: options.ownsNote ?? entry.note !== undefined,
});

// The shape of nuxt/translations' fr/glossary.yml, with a `style` list, comments and a key diglot doesn't know.
const file = `# French decisions that need diglot-only fields.
style:
  - Vouvoiement.
terms:
  - term: layer
    match: \\blayers?\\b
    note: the Nuxt layers feature (extends)
    decision: keep-gloss
    gloss: couche
  # Kept by hand.
  - term: Server Route
    match: \\bserver routes?\\b
    caseSensitive: false
    decision: translate
    target: route serveur # the usual phrase
    accept:
      - routes? (?:de |du )?serveur
    reviewed: 2026-11-01
  - term: bundle
    decision: keep
`;

describe("mergeDiglotGlossary", () => {
  it("writes a fresh terms file when there is no file", () => {
    const result = mergeDiglotGlossary(undefined, [
      input({ term: "layer", match: "\\blayers?\\b", decision: "keep-gloss", gloss: "couche" }),
      input({ term: "build", decision: "translate", accept: [] }),
    ]);
    expect(result.text).toBe(`terms:
  - term: layer
    match: \\blayers?\\b
    decision: keep-gloss
    gloss: couche
  - term: build
    decision: translate
`);
    expect(result).toMatchObject({ added: ["layer", "build"], updated: [], unchanged: [] });
  });

  it("matches by term in any case and with hyphens and spaces ignored, and keeps the file's spelling", () => {
    const result = mergeDiglotGlossary(file, [
      input({
        term: "server-route",
        decision: "translate",
        target: "route côté serveur",
      }),
    ]);
    expect(result.text).toContain("  - term: Server Route\n");
    expect(result.text).toContain("    target: route côté serveur # the usual phrase\n");
    expect(result.updated).toEqual([{ term: "Server Route", changes: ["target"] }]);
  });

  it("matches by a form when no term matches, and tries the term first", () => {
    const byForm = mergeDiglotGlossary(file, [
      input({ term: "Layers feature", decision: "keep" }, { forms: ["Layer"] }),
    ]);
    expect(byForm.added).toEqual([]);
    expect(byForm.updated).toEqual([
      { term: "layer", changes: ["decision (was keep-gloss)", "gloss"] },
    ]);
    // "bundle" the term wins over "layer" the form of the same input.
    const byTerm = mergeDiglotGlossary(file, [
      input({ term: "bundle", decision: "keep" }, { forms: ["layer"] }),
    ]);
    expect(byTerm.unchanged).toEqual(["bundle"]);
    expect(byTerm.text).toBe(file);
  });

  it("sets decision, target and gloss, and drops the fields the new decision doesn't use but keeps accept", () => {
    const result = mergeDiglotGlossary(file, [
      input({ term: "server route", decision: "keep" }),
      input({ term: "bundle", decision: "keep-gloss", gloss: "paquet" }),
      input({ term: "layer", decision: "translate", target: "couche" }),
    ]);
    expect(result.text).toBe(`# French decisions that need diglot-only fields.
style:
  - Vouvoiement.
terms:
  - term: layer
    match: \\blayers?\\b
    note: the Nuxt layers feature (extends)
    decision: translate
    target: couche
  # Kept by hand.
  - term: Server Route
    match: \\bserver routes?\\b
    caseSensitive: false
    decision: keep
    accept:
      - routes? (?:de |du )?serveur
    reviewed: 2026-11-01
  - term: bundle
    decision: keep-gloss
    gloss: paquet
`);
    expect(result.updated).toEqual([
      { term: "Server Route", changes: ["decision (was translate)", "target"] },
      { term: "bundle", changes: ["decision (was keep)", "gloss"] },
      { term: "layer", changes: ["decision (was keep-gloss)", "target", "gloss"] },
    ]);
  });

  it("sets the note only when the glossary owns it", () => {
    const owned = mergeDiglotGlossary(file, [
      input(
        { term: "layer", note: "Nuxt layers", decision: "keep-gloss", gloss: "couche" },
        { ownsNote: true },
      ),
      input({ term: "bundle", note: "a build output", decision: "keep" }, { ownsNote: true }),
    ]);
    expect(owned.text).toContain("    note: Nuxt layers\n");
    expect(owned.text).toContain(
      "  - term: bundle\n    note: a build output\n    decision: keep\n",
    );
    const kept = mergeDiglotGlossary(file, [
      input(
        { term: "layer", note: "Nuxt layers", decision: "keep-gloss", gloss: "couche" },
        { ownsNote: false },
      ),
    ]);
    expect(kept.text).toBe(file);
    expect(kept.unchanged).toEqual(["layer"]);
  });

  it("keeps the file's match and caseSensitive, lists a kept match, and adds a match the entry lacks", () => {
    const result = mergeDiglotGlossary(file, [
      input({
        term: "server route",
        match: "\\bserver[- ]?routes?\\b",
        caseSensitive: true,
        decision: "translate",
        target: "route serveur",
      }),
      input({ term: "bundle", match: "\\bbundles?\\b", decision: "keep" }),
    ]);
    expect(result.text).toContain("    match: \\bserver routes?\\b\n    caseSensitive: false\n");
    expect(result.text).toContain(
      "  - term: bundle\n    match: \\bbundles?\\b\n    decision: keep\n",
    );
    expect(result.keptMatch).toEqual(["Server Route"]);
    expect(result.unchanged).toEqual(["server route"]);
    expect(result.updated).toEqual([{ term: "bundle", changes: ["match"] }]);
  });

  it("adds accept patterns the entry lacks and removes none", () => {
    const result = mergeDiglotGlossary(file, [
      input({
        term: "server route",
        decision: "translate",
        target: "route serveur",
        accept: ["routes? (?:de |du )?serveur", "route côté serveur"],
      }),
      input({ term: "layer", decision: "translate", target: "couche", accept: ["couches?"] }),
    ]);
    expect(result.text).toContain(
      "    accept:\n      - routes? (?:de |du )?serveur\n      - route côté serveur\n    reviewed: 2026-11-01\n",
    );
    expect(result.text).toContain(
      "    decision: translate\n    target: couche\n    accept:\n      - couches?\n  # Kept by hand.\n",
    );
    expect(result.updated).toEqual([
      { term: "Server Route", changes: ["accept"] },
      { term: "layer", changes: ["decision (was keep-gloss)", "target", "gloss", "accept"] },
    ]);
  });

  it("leaves entries the input doesn't match as they are and adds new terms at the end", () => {
    const result = mergeDiglotGlossary(file, [
      input({ term: "hydration", decision: "translate", target: "hydratation" }),
      input({ term: "helper", decision: "keep" }),
    ]);
    expect(result.text).toBe(`${file}  - term: hydration
    decision: translate
    target: hydratation
  - term: helper
    decision: keep
`);
    expect(result).toMatchObject({ added: ["hydration", "helper"], updated: [], unchanged: [] });
  });

  it("returns the same bytes when the same input is merged again", () => {
    const entries = [
      input({ term: "server route", decision: "keep" }),
      input(
        { term: "layer", note: "Nuxt layers", decision: "translate", target: "couche" },
        { ownsNote: true },
      ),
      input({
        term: "hydration",
        decision: "translate",
        target: "hydratation",
        accept: ["hydrat"],
      }),
    ];
    const once = mergeDiglotGlossary(file, entries);
    const twice = mergeDiglotGlossary(once.text, entries);
    expect(twice.text).toBe(once.text);
    expect(twice).toMatchObject({
      added: [],
      updated: [],
      unchanged: ["server route", "layer", "hydration"],
    });
  });

  it("keeps the line wrapping and list indentation of a file it only partly changes", () => {
    // de/glossary.yml writes `- term` at the key's column and wraps long notes.
    const de = `terms:
- term: layout
  note: Nuxt-Layouts (layouts/-Verzeichnis, <NuxtLayout>); das Layout, die Layouts (nicht "Gestaltung", "Aufbau" oder
    "Vorlage")
  decision: keep
- term: module
  decision: translate
  target: Modul
  accept:
  - Module
`;
    const result = mergeDiglotGlossary(de, [
      input({ term: "module", decision: "translate", target: "Modul", accept: ["Modulen"] }),
      input({ term: "payload", decision: "keep" }),
    ]);
    expect(result.text).toBe(`${de}  - Modulen
- term: payload
  decision: keep
`);
  });

  it("keeps the comments inside, after and between the entries it changes", () => {
    const source = `terms:
  - term: a # the term
    # inner
    decision: keep
    # after a

  # before b
  - term: b
    decision: keep # last
`;
    const result = mergeDiglotGlossary(source, [
      input({ term: "a", decision: "translate", target: "x" }),
      input({ term: "b", decision: "translate", target: "y" }),
    ]);
    expect(result.text).toBe(`terms:
  - term: a # the term
    # inner
    decision: translate
    target: x
    # after a

  # before b
  - term: b
    decision: translate # last
    target: y
`);
  });

  it("adds a terms list to a file that has none", () => {
    const result = mergeDiglotGlossary("# Nothing yet.\n", [
      input({ term: "build", decision: "translate" }),
    ]);
    expect(result.text).toBe(
      "# Nothing yet.\n\nterms:\n  - term: build\n    decision: translate\n",
    );
  });

  it("throws, and merges nothing, on a file it can't merge into", () => {
    const keep = [input({ term: "layer", decision: "keep" })];
    expect(() => mergeDiglotGlossary("terms: [layer\n", keep)).toThrow(X18nMergeError);
    expect(() => mergeDiglotGlossary("terms: [layer\n", keep)).toThrow(/Not valid YAML/);
    expect(() => mergeDiglotGlossary("- term: layer\n  doNotTranslate: true\n", keep)).toThrow(
      /x18n glossary/,
    );
    expect(() => mergeDiglotGlossary("terms: layer\n", keep)).toThrow(X18nMergeError);
  });

  it("throws when one input matches two entries", () => {
    const twice = `terms:\n  - term: server route\n    decision: keep\n  - term: Server-Route\n    decision: keep\n`;
    expect(() =>
      mergeDiglotGlossary(twice, [input({ term: "server route", decision: "keep" })]),
    ).toThrow(X18nMergeError);
    expect(() =>
      mergeDiglotGlossary(twice, [input({ term: "server route", decision: "keep" })]),
    ).toThrow(`"server route" matches 2 entries: "server route" and "Server-Route".`);
    expect(() =>
      mergeDiglotGlossary(file, [
        input({ term: "layer", decision: "keep" }, { term: "Layers", forms: ["layer", "bundle"] }),
      ]),
    ).toThrow(/matches 2 entries: "layer" and "bundle"/);
  });

  it("throws when two inputs match one entry", () => {
    expect(() =>
      mergeDiglotGlossary(file, [
        input({ term: "layer", decision: "keep" }),
        input({ term: "Layers", decision: "keep" }, { forms: ["layer"] }),
      ]),
    ).toThrow(/"layer" and "Layers" both match the entry "layer"/);
  });

  it("merges into nuxt/translations' fr glossary and leaves every other entry byte-identical", () => {
    const fr = readFileSync(new URL("fixtures/diglot/fr-glossary.yml", import.meta.url), "utf8");
    const entries = [
      input(
        {
          term: "Layer",
          match: "\\blayers?\\b",
          note: "the Nuxt layers feature (extends, nuxt.config)",
          decision: "keep-gloss",
          gloss: "couche",
        },
        { ownsNote: true },
      ),
      input(
        {
          term: "Auto-imports",
          match: "\\bauto[- ]?imports?\\b",
          decision: "translate",
          target: "import automatique",
          accept: ["import\\p{L}* automatique", "auto-import"],
        },
        { forms: ["auto-import"] },
      ),
      input({ term: "build", decision: "translate", target: "build" }),
      input({ term: "prerendering", decision: "translate", target: "prérendu" }),
    ];
    const result = mergeDiglotGlossary(fr, entries);
    expect(result).toMatchObject({
      added: ["prerendering"],
      updated: [
        { term: "layer", changes: ["note"] },
        { term: "auto-import", changes: ["accept"] },
        { term: "build", changes: ["target"] },
      ],
      unchanged: [],
      keptMatch: ["auto-import"],
    });

    const items = (text: string) => {
      const doc = parseDocument(text);
      const terms = doc.get("terms", true) as { items: { range: [number, number, number] }[] };
      return terms.items.map((item) => text.slice(item.range[0], item.range[1]));
    };
    const before = items(fr);
    const after = items(result.text);
    expect(after).toHaveLength(before.length + 1);
    const touched = new Set([0, 2, before.length - 1]);
    for (const [index, item] of before.entries())
      if (!touched.has(index)) expect(after[index]).toBe(item);
    expect(result.text.startsWith(fr.slice(0, fr.indexOf("  - term: layer")))).toBe(true);
    expect(after.at(-1)).toBe(
      "term: prerendering\n    decision: translate\n    target: prérendu\n",
    );
    expect(after[0]).toContain("note: the Nuxt layers feature (extends, nuxt.config)\n");
    expect(after[2]).toMatch(/accept:\n(?: {6}- .*\n){3} {6}- auto-import\n$/);
    expect(after.at(-2)).toMatch(/decision: translate\n {4}target: build\n$/);
    expect(parse(result.text).terms.at(-2)).toMatchObject({ term: "build", target: "build" });

    expect(mergeDiglotGlossary(result.text, entries).text).toBe(result.text);
  });
});
