import { describe, expect, it } from "vite-plus/test";
import { parse } from "yaml";
import { mergeX18nGlossary, stringifyX18nGlossary } from "../src/x18n-merge.ts";

// The shape of nuxt/translations' glossary.yml: a header comment, then entries with translations.
const shared = `# Terminology shared by every locale, in x18n's \`glossary\` shape.
# Locale-specific decisions live in \`<locale>/glossary.yml\`.
- term: Nuxt
  doNotTranslate: true
- term: SSR
  note: server-side rendering
  doNotTranslate: true
# Concepts
- term: prerendering
  translations:
    fr: prérendu
    de: Prerendering
- term: route middleware
  translations:
    fr: middleware de route
    de: Routen-Middleware
  reviewed: 2026-11-01
`;

describe("mergeX18nGlossary", () => {
  it("matches by term in any case and with hyphens ignored, keeps translations and other fields, and adds new terms at the end", () => {
    const result = mergeX18nGlossary(shared, [
      { term: "Route-Middleware", note: "Runs before navigation." },
      { term: "Prerendering", note: "Rendering a route at build time." },
      { term: "Server route", note: "Answers HTTP requests at a path." },
    ]);
    expect(result.text).toBe(`# Terminology shared by every locale, in x18n's \`glossary\` shape.
# Locale-specific decisions live in \`<locale>/glossary.yml\`.
- term: Nuxt
  doNotTranslate: true
- term: SSR
  note: server-side rendering
  doNotTranslate: true
# Concepts
- term: prerendering
  note: Rendering a route at build time.
  translations:
    fr: prérendu
    de: Prerendering
- term: route middleware
  note: Runs before navigation.
  translations:
    fr: middleware de route
    de: Routen-Middleware
  reviewed: 2026-11-01
- term: Server route
  note: Answers HTTP requests at a path.
`);
    expect(result).toMatchObject({
      added: ["Server route"],
      updated: [
        { term: "route middleware", from: "Route-Middleware", fields: ["note"] },
        { term: "prerendering", from: "Prerendering", fields: ["note"] },
      ],
      unchanged: [],
      conflicts: [],
    });
  });

  it("matches by a source-locale form of the glossary's term or of the file's entry", () => {
    const ours = mergeX18nGlossary(shared, [
      { term: "Prerender", forms: { en: ["prerendering", "prerendered"] } },
    ]);
    expect(ours.added).toEqual([]);
    expect(parse(ours.text)[2]).toEqual({
      term: "prerendering",
      translations: { fr: "prérendu", de: "Prerendering" },
      forms: { en: ["prerendering", "prerendered"] },
    });
    const theirs = mergeX18nGlossary("- term: prerendering\n  forms:\n    en: [Prerender]\n", [
      { term: "prerender", note: "Render at build time." },
    ]);
    expect(theirs.added).toEqual([]);
    expect(theirs.updated).toEqual([{ term: "prerendering", from: "prerender", fields: ["note"] }]);
    // A form in another locale is not the term.
    const fr = mergeX18nGlossary(shared, [{ term: "prérendu", forms: { fr: ["prerendering"] } }]);
    expect(fr.added).toEqual(["prérendu"]);
    expect(
      mergeX18nGlossary(shared, [{ term: "Prerender", forms: { de: ["prerendering"] } }], {
        sourceLocale: "de",
      }).added,
    ).toEqual([]);
  });

  it("adds missing locales and forms, and keeps a translation the file has over the glossary's", () => {
    const result = mergeX18nGlossary(shared, [
      {
        term: "Prerendering",
        translations: { fr: "pré-rendu", es: "prerenderizado" },
        forms: { de: ["Prerenderings"] },
      },
    ]);
    expect(parse(result.text)[2]).toEqual({
      term: "prerendering",
      translations: { fr: "prérendu", de: "Prerendering", es: "prerenderizado" },
      forms: { de: ["Prerenderings"] },
    });
    expect(result.updated).toEqual([
      { term: "prerendering", from: "Prerendering", fields: ["translations", "forms"] },
    ]);
    expect(result.conflicts).toEqual([
      { term: "prerendering", locale: "fr", kept: "prérendu", dropped: "pré-rendu" },
    ]);
  });

  it("does not mark an entry the file translates as doNotTranslate, and changes nothing a second time", () => {
    const entries = [
      { term: "Nuxt", doNotTranslate: true },
      { term: "route middleware", doNotTranslate: true },
      { term: "NuxtApp", note: "The runtime app.", doNotTranslate: true },
    ];
    const first = mergeX18nGlossary(shared, entries);
    expect(first.unchanged).toEqual(["Nuxt", "route middleware"]);
    expect(first.added).toEqual(["NuxtApp"]);
    const second = mergeX18nGlossary(first.text, entries);
    expect(second.text).toBe(first.text);
    expect(second.unchanged).toEqual(["Nuxt", "route middleware", "NuxtApp"]);
  });

  it("starts an empty file and throws on YAML that is not a list of entries", () => {
    expect(mergeX18nGlossary("", [{ term: "Dock" }]).text).toBe("- term: Dock\n");
    expect(() => mergeX18nGlossary("term: Dock\n", [])).toThrow("not a list of glossary entries");
    expect(() => mergeX18nGlossary("- term: [\n", [])).toThrow("Not valid YAML");
    expect(() =>
      mergeX18nGlossary("- term: Dock\n  translations: Dock\n", [
        { term: "Dock", translations: { de: "Dock" } },
      ]),
    ).toThrow('"translations" of "Dock" is not a map of locales.');
  });
});

describe("stringifyX18nGlossary", () => {
  it("writes term, note, translations, forms and doNotTranslate in that order", () => {
    expect(
      stringifyX18nGlossary([
        { doNotTranslate: true, term: "NuxtApp", note: "The runtime app." },
        { forms: { fr: ["routes serveur"] }, translations: { fr: "route serveur" }, term: "Route" },
      ]),
    ).toBe(`- term: NuxtApp
  note: The runtime app.
  doNotTranslate: true
- term: Route
  translations:
    fr: route serveur
  forms:
    fr:
      - routes serveur
`);
  });
});
