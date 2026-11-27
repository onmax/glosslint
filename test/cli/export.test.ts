import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
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
