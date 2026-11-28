import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { parse } from "yaml";
import { run } from "./run.ts";

const glossary = `# Glossary

## Server route
What: A handler that answers HTTP requests at a path.
How: An API route is a server route under \`/api\`.
Translations: fr: route serveur

## Prerender
What: Render a route to HTML at build time.
Forms:
- en: prerendering, prerendered

## NuxtApp
What: The per-request runtime app.
`;

const shared = `# Shared terms, in x18n's glossary shape.
- term: Nuxt
  doNotTranslate: true
- term: prerendering
  translations:
    fr: prérendu
    de: Prerendering
`;

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "glosslint-export-"));
  writeFileSync(join(dir, "GLOSSARY.md"), glossary);
  writeFileSync(join(dir, "glossary.yml"), shared);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("glosslint export", () => {
  it("prints the corpus as x18n glossary YAML, with the What alone as the note under --note short", async () => {
    const full = await run(["export", "--glossary", "GLOSSARY.md"], dir);
    expect(full).toMatchObject({ code: 0, stderr: "" });
    expect(full.stdout).toContain(
      "  note: A handler that answers HTTP requests at a path. An API route is a server route under `/api`.\n",
    );
    const short = await run(["export", "--glossary", "GLOSSARY.md", "--note", "short"], dir);
    expect(short.stdout).toBe(`- term: Server route
  note: A handler that answers HTTP requests at a path.
  translations:
    fr: route serveur
- term: Prerender
  note: Render a route to HTML at build time.
  forms:
    en:
      - prerendering
      - prerendered
- term: NuxtApp
  note: The per-request runtime app.
  doNotTranslate: true
`);
  });

  it("exports the glossary's own terms, without the ones its Presets add", async () => {
    writeFileSync(
      join(dir, "PRESETS.md"),
      "# Glossary\n\nPresets: tech\n\n## Dock\nWhat: A powered stand.\n\n## eBike\nWhat: An electric bike.\n",
    );
    const result = await run(["export", "--glossary", "PRESETS.md"], dir);
    expect(result.code).toBe(0);
    expect(parse(result.stdout)).toEqual([
      { term: "Dock", note: "A powered stand." },
      { term: "eBike", note: "An electric bike.", doNotTranslate: true },
    ]);
  });

  it("merges into the file with --merge, keeping its translations and comments, and prints what changed", async () => {
    const result = await run(
      ["export", "--glossary", "GLOSSARY.md", "--note", "short", "--merge", "glossary.yml"],
      dir,
    );
    expect(result).toEqual({
      code: 0,
      stdout: `glossary.yml: 3 terms merged, 2 added, 1 updated, 0 unchanged.
+ Server route
+ NuxtApp
~ prerendering (Prerender): note, forms
`,
      stderr: "",
    });
    expect(readFileSync(join(dir, "glossary.yml"), "utf8"))
      .toBe(`# Shared terms, in x18n's glossary shape.
- term: Nuxt
  doNotTranslate: true
- term: prerendering
  note: Render a route to HTML at build time.
  translations:
    fr: prérendu
    de: Prerendering
  forms:
    en:
      - prerendering
      - prerendered
- term: Server route
  note: A handler that answers HTTP requests at a path.
  translations:
    fr: route serveur
- term: NuxtApp
  note: The per-request runtime app.
  doNotTranslate: true
`);
  });

  it("exits 2 and writes nothing when a term matches more than one entry", async () => {
    const file = "- term: Nuxt app\n- term: nuxt-app\n";
    writeFileSync(join(dir, "glossary.yml"), file);
    const result = await run(
      ["export", "--glossary", "GLOSSARY.md", "--merge", "glossary.yml"],
      dir,
    );
    expect(result.code).toBe(2);
    expect(result.stderr).toContain(
      'glossary.yml: "NuxtApp" matches 2 entries: "Nuxt app" and "nuxt-app".',
    );
    expect(result.stderr).toContain("Merge those entries into one");
    expect(readFileSync(join(dir, "glossary.yml"), "utf8")).toBe(file);
  });

  it("changes nothing on a second merge when a term is a form of another, and exits 2 when two terms match one entry", async () => {
    writeFileSync(
      join(dir, "RENDER.md"),
      "# Glossary\n\n## Render\nWhat: Turn components into HTML.\nForms: en: Rendering\n\n## Rendering\nWhat: The act of rendering.\n",
    );
    writeFileSync(join(dir, "glossary.yml"), "");
    const args = ["export", "--glossary", "RENDER.md", "--merge", "glossary.yml"];
    expect((await run(args, dir)).stdout).toBe(
      "glossary.yml: 2 terms merged, 2 added, 0 updated, 0 unchanged.\n+ Render\n+ Rendering\n",
    );
    const first = readFileSync(join(dir, "glossary.yml"), "utf8");
    const second = await run(args, dir);
    expect(second.code).toBe(0);
    expect(second.stdout).toContain("2 terms merged, 0 added, 0 updated, 2 unchanged.");
    expect(readFileSync(join(dir, "glossary.yml"), "utf8")).toBe(first);

    writeFileSync(join(dir, "glossary.yml"), "- term: rendering\n");
    const claimed = await run(args, dir);
    expect(claimed.code).toBe(2);
    expect(claimed.stderr).toContain(
      'glossary.yml: "Render" and "Rendering" both match the entry "rendering".',
    );
    expect(readFileSync(join(dir, "glossary.yml"), "utf8")).toBe("- term: rendering\n");
  });

  it("does not mark a translated exact term doNotTranslate, and fails when a merge would translate an entry marked so", async () => {
    const exact = "# Glossary\n\n## eBike\nWhat: An electric bike.\n";
    writeFileSync(join(dir, "EBIKE.md"), exact);
    writeFileSync(join(dir, "glossary.yml"), "");
    const args = ["export", "--glossary", "EBIKE.md", "--merge", "glossary.yml"];
    expect((await run(args, dir)).code).toBe(0);
    const first = readFileSync(join(dir, "glossary.yml"), "utf8");
    expect(parse(first)).toEqual([
      { term: "eBike", note: "An electric bike.", doNotTranslate: true },
    ]);

    writeFileSync(join(dir, "EBIKE.md"), `${exact}Translations: fr: vélo électrique\n`);
    expect(parse((await run(["export", "--glossary", "EBIKE.md"], dir)).stdout)).toEqual([
      { term: "eBike", note: "An electric bike.", translations: { fr: "vélo électrique" } },
    ]);
    const second = await run(args, dir);
    expect(second.code).toBe(2);
    expect(second.stderr).toContain(
      'glossary.yml: "eBike" has doNotTranslate: true, and the glossary\'s "eBike" gives it translations (fr).',
    );
    expect(second.stderr).toContain("Remove doNotTranslate: true from");
    expect(readFileSync(join(dir, "glossary.yml"), "utf8")).toBe(first);
  });

  it("merges a locale that keeps the term into an entry marked doNotTranslate without writing it", async () => {
    writeFileSync(
      join(dir, "NUXT.md"),
      "# Glossary\n\n## Nuxt\nCase: exact\nTranslations: fr: keep\n",
    );
    const args = ["export", "--glossary", "NUXT.md", "--merge", "glossary.yml"];
    expect(parse((await run(["export", "--glossary", "NUXT.md"], dir)).stdout)).toEqual([
      { term: "Nuxt", translations: { fr: "Nuxt" } },
    ]);
    const result = await run(args, dir);
    expect(result).toMatchObject({ code: 0, stderr: "" });
    expect(result.stdout).toBe("glossary.yml: 1 term merged, 0 added, 0 updated, 1 unchanged.\n");
    expect(readFileSync(join(dir, "glossary.yml"), "utf8")).toBe(shared);
  });

  it("exits 2 on a missing file, a file that is not a list, or another --note", async () => {
    const missing = await run(["export", "--glossary", "GLOSSARY.md", "--merge", "no.yml"], dir);
    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain('The x18n glossary "no.yml" does not exist.');
    writeFileSync(join(dir, "glossary.yml"), "term: Nuxt\n");
    const notList = await run(
      ["export", "--glossary", "GLOSSARY.md", "--merge", "glossary.yml"],
      dir,
    );
    expect(notList.code).toBe(2);
    expect(notList.stderr).toContain("glossary.yml: The file is not a list of glossary entries");
    expect(readFileSync(join(dir, "glossary.yml"), "utf8")).toBe("term: Nuxt\n");
    const note = await run(["export", "--glossary", "GLOSSARY.md", "--note", "long"], dir);
    expect(note.code).toBe(2);
    expect(note.stderr).toContain('--note is "long".');
  });
});

const diglotGlossary = `# Glossary

## Layer
What: A Nuxt project that another one extends.
Translations:
- fr: keep (couche)

## Server route
What: A handler that answers HTTP requests at a path.
Translations:
- fr: route serveur
Forms:
- fr: routes serveur
Hints:
- fr: Feminine: la route serveur.

## Nuxt
Case: exact
Translations:
- fr: keep

## NuxtApp
Case: exact
`;

const french = `# French decisions that need diglot-only fields.
style:
  - Use "vous".
terms:
  - term: layer
    match: \\blayers?\\b
    note: the Nuxt layers feature (extends)
    decision: keep-gloss
    gloss: couche
  - term: server-route # reviewed in June
    decision: keep
  - term: payload
    decision: keep-gloss
    gloss: charge utile
`;

describe("glosslint export --diglot", () => {
  const args = ["export", "--glossary", "DIGLOT.md", "--diglot", "fr"];
  const file = () => readFileSync(join(dir, "fr", "glossary.yml"), "utf8");
  beforeEach(() => {
    writeFileSync(join(dir, "DIGLOT.md"), diglotGlossary);
    mkdirSync(join(dir, "fr"));
    writeFileSync(join(dir, "fr", "glossary.yml"), french);
  });

  it("prints the locale's diglot glossary, with only the terms that have an item for it", async () => {
    const result = await run(args, dir);
    expect(result).toMatchObject({ code: 0, stderr: "" });
    expect(result.stdout).toBe(`terms:
  - term: Layer
    match: \\b(?:Layering|Layered|Layers|Layer)\\b
    decision: keep-gloss
    gloss: couche
  - term: Server route
    match: \\b(?:Server[- ]?routing|Server[- ]?routed|Server[- ]?routes|Server[- ]?route)\\b
    note: "Feminine: la route serveur."
    decision: translate
    target: route serveur
    accept:
      - routes serveur
  - term: Nuxt
    match: \\b(?:Nuxts|Nuxt)\\b
    caseSensitive: true
    decision: keep
`);
  });

  it("merges into the file, keeping its match, note, comments and other entries, and changes nothing a second time", async () => {
    const merge = [...args, "--merge", "fr/glossary.yml"];
    const first = await run(merge, dir);
    expect(first).toEqual({
      code: 0,
      stdout: `fr/glossary.yml: 3 terms merged, 1 added, 1 updated, 1 unchanged, 1 kept \`match\`.
+ Nuxt
~ server-route: note, decision (was keep), target, accept
`,
      stderr: "",
    });
    expect(file()).toBe(`# French decisions that need diglot-only fields.
style:
  - Use "vous".
terms:
  - term: layer
    match: \\blayers?\\b
    note: the Nuxt layers feature (extends)
    decision: keep-gloss
    gloss: couche
  - term: server-route # reviewed in June
    note: "Feminine: la route serveur."
    decision: translate
    target: route serveur
    accept:
      - routes serveur
  - term: payload
    decision: keep-gloss
    gloss: charge utile
  - term: Nuxt
    match: \\b(?:Nuxts|Nuxt)\\b
    caseSensitive: true
    decision: keep
`);
    const merged = file();
    const second = await run(merge, dir);
    expect(second.stdout).toBe(
      "fr/glossary.yml: 3 terms merged, 0 added, 0 updated, 3 unchanged, 1 kept `match`.\n",
    );
    expect(file()).toBe(merged);
  });

  it("exits 2 without a BCP 47 locale or a term that has one", async () => {
    const missing = await run(["export", "--glossary", "DIGLOT.md", "--diglot"], dir);
    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain("option `--diglot <locale>` value is missing.");
    const invalid = await run(["export", "--glossary", "DIGLOT.md", "--diglot", "fr_FR"], dir);
    expect(invalid.code).toBe(2);
    expect(invalid.stderr).toContain('--diglot is "fr_FR", which is not a BCP 47 locale.');
    const none = await run(["export", "--glossary", "DIGLOT.md", "--diglot", "de"], dir);
    expect(none.code).toBe(2);
    expect(none.stderr).toContain("No term in the glossary has de in Translations.");
  });

  it("exits 2 and writes nothing on a missing file, invalid YAML, an x18n list or an ambiguous match", async () => {
    const merge = [...args, "--merge", "fr/glossary.yml"];
    const missing = await run([...args, "--merge", "de/glossary.yml"], dir);
    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain('The diglot glossary "de/glossary.yml" does not exist.');
    const fails = async (text: string, why: string) => {
      writeFileSync(join(dir, "fr", "glossary.yml"), text);
      const result = await run(merge, dir);
      expect(result.code).toBe(2);
      expect(result.stderr).toContain(`fr/glossary.yml: ${why}`);
      expect(file()).toBe(text);
    };
    await fails("terms: [\n", "Not valid YAML:");
    await fails("- term: Nuxt\n  doNotTranslate: true\n", "The file is an x18n glossary");
    await fails(
      "terms:\n  - term: layer\n    decision: keep\n  - term: Layer\n    decision: keep\n",
      '"Layer" matches 2 entries: "layer" and "Layer".',
    );
    writeFileSync(
      join(dir, "DIGLOT.md"),
      `${diglotGlossary}\n## Route\nForms: en: server route\nTranslations: fr: route\n`,
    );
    await fails(
      "terms:\n  - term: server route\n    decision: keep\n",
      '"Server route" and "Route" both match the entry "server route".',
    );
  });
});
