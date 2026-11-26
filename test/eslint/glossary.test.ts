import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";
import * as yamlParser from "yaml-eslint-parser";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { defineCorpus } from "../../src/corpus.ts";
import { GlosslintConfigError } from "../../src/errors.ts";
import glosslint from "../../src/eslint.ts";

const fixtures = new URL("../fixtures/glossary/", import.meta.url);
const inFolder = (path: string) =>
  vi.spyOn(process, "cwd").mockReturnValue(resolve(fileURLToPath(new URL(path, fixtures))));

afterEach(() => {
  vi.restoreAllMocks();
});

/** An app's flat config: the parsers it brings, then glosslint's. */
function appConfig(configs: Linter.Config[]): Linter.Config[] {
  return [
    { files: ["**/*.ts"], languageOptions: { parser: tseslint.parser as Linter.Parser } },
    {
      files: ["**/*.vue"],
      languageOptions: {
        parser: vueParser,
        parserOptions: { parser: tseslint.parser, sourceType: "module", ecmaVersion: "latest" },
      },
    },
    { files: ["**/*.yml"], languageOptions: { parser: yamlParser } },
    ...configs,
  ];
}

const messages = (linter: Linter, config: Linter.Config[], code: string, file: string) =>
  linter.verify(code, config, file).map((message) => `${message.ruleId} ${message.messageId}`);

describe("glosslint() with a glossary file", () => {
  it("reads .agents/glossary.md from the current folder once, when the config is built", () => {
    inFolder("project/");
    const config = appConfig(glosslint());
    // The folder changes after the config is built; the rules keep the glossary they read.
    inFolder("./");
    const linter = new Linter({ configType: "flat" });

    const ts = `const label = "Re-charge point at the rack";\n`;
    expect(messages(linter, config, ts, "a.ts")).toEqual([
      "glosslint/term GLOSSLINT_TERM",
      "glosslint/avoid GLOSSLINT_AVOID",
    ]);
    expect(linter.verifyAndFix(ts, config, "a.ts").output).toBe(
      `const label = "Recharge point at the rack";\n`,
    );
    const [avoid] = linter.verify(ts, config, "a.ts").filter((m) => m.ruleId === "glosslint/avoid");
    expect(avoid?.message).toContain("Racks are unpowered.");

    const vue = `<template>\n  <p>Start the check-out at the bay.</p>\n</template>\n`;
    expect(messages(linter, config, vue, "a.vue")).toEqual([
      "glosslint/term GLOSSLINT_TERM",
      "glosslint/avoid GLOSSLINT_AVOID",
    ]);
    const [bay] = linter.verify(vue, config, "a.vue").filter((m) => m.ruleId === "glosslint/avoid");
    expect(bay?.message).toContain('Riders read "dock" on the stand itself.');
    expect(linter.verifyAndFix(vue, config, "a.vue").output).toBe(
      `<template>\n  <p>Start the checkout at the bay.</p>\n</template>\n`,
    );

    const yaml = "cta: The check-out\n";
    expect(messages(linter, config, yaml, "a.yml")).toEqual(["glosslint/term GLOSSLINT_TERM"]);
    expect(linter.verifyAndFix(yaml, config, "a.yml").output).toBe("cta: The checkout\n");
  });

  it("throws GLOSSLINT_C009 when the config is built in a folder with no glossary", () => {
    inFolder("./");
    expect(() => glosslint()).toThrow(
      expect.objectContaining({
        code: "GLOSSLINT_C009",
        why: "No glossary at .agents/glossary.md.",
      }),
    );
  });
});

describe("glosslint() options", () => {
  it("reads another glossary from `glossary`, as a path from the current folder or a URL", () => {
    inFolder("./");
    for (const glossary of ["other.md", new URL("other.md", fixtures)]) {
      const config = appConfig(glosslint({ glossary }));
      const linter = new Linter({ configType: "flat" });
      expect(messages(linter, config, `const a = "Find a hub";\n`, "a.ts")).toEqual([
        "glosslint/avoid GLOSSLINT_AVOID",
      ]);
    }
  });

  it("takes a corpus from `corpus` and reads no file", () => {
    inFolder("./");
    const corpus = defineCorpus({ terms: [{ term: "Station", avoid: ["depot"] }] });
    const config = appConfig(glosslint({ corpus }));
    const linter = new Linter({ configType: "flat" });
    expect(messages(linter, config, `const a = "The depot";\n`, "a.ts")).toEqual([
      "glosslint/avoid GLOSSLINT_AVOID",
    ]);
  });

  it("throws GLOSSLINT_C012 when given both `glossary` and `corpus`", () => {
    const corpus = defineCorpus({ terms: [{ term: "Station" }] });
    let error: unknown;
    try {
      glosslint({ glossary: "other.md", corpus });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GlosslintConfigError);
    expect(error).toMatchObject({ code: "GLOSSLINT_C012" });
  });
});
