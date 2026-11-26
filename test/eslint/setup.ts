import type { Linter, Rule } from "eslint";
import { createRuleTester } from "eslint-vitest-rule-tester";
import * as jsonParser from "jsonc-eslint-parser";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";
import * as yamlParser from "yaml-eslint-parser";
import glosslint, { type GlosslintEslintOptions } from "../../src/eslint.ts";
import { defineCorpus } from "../../src/corpus.ts";
import { bikeTerms } from "../core/bike.ts";

/** The core tests' bike-share corpus, plus abbreviations ending in a period. */
export const corpus = defineCorpus({
  terms: [
    ...bikeTerms,
    { term: "Battery level", avoid: ["Batt. lvl", "Batt."] },
    { term: "Ride history", avoid: [{ word: "trip log", why: "Riders don't log trips." }] },
  ],
  allow: ["check out our", "roof rack"],
});

export type RuleName = "term" | "avoid" | "comment" | "identifier";

/** The rules as `glosslint()` returns them. */
export function rulesOf(
  options: Partial<GlosslintEslintOptions> = {},
): Record<RuleName, Rule.RuleModule> {
  const [config] = glosslint({ corpus, ...options });
  return config!.plugins!.glosslint!.rules as Record<RuleName, Rule.RuleModule>;
}

const ts: Linter.Config = { languageOptions: { parser: tseslint.parser as Linter.Parser } };
const vue: Linter.Config = {
  languageOptions: {
    parser: vueParser,
    parserOptions: { parser: tseslint.parser, sourceType: "module", ecmaVersion: "latest" },
  },
};
const yaml: Linter.Config = { languageOptions: { parser: yamlParser } };
const json: Linter.Config = { languageOptions: { parser: jsonParser } };

export type Parser = "ts" | "vue" | "yaml" | "json";

const configs: Record<Parser, Linter.Config> = { ts, vue, yaml, json };
const filenames: Record<Parser, string> = {
  ts: "file.ts",
  vue: "file.vue",
  yaml: "file.yml",
  json: "file.json",
};

/** A rule tester for one rule and one parser. Cases get that parser's file name. */
export function tester(
  name: RuleName,
  parser: Parser,
  options: Partial<GlosslintEslintOptions> = {},
) {
  const { valid, invalid } = createRuleTester({
    name,
    rule: rulesOf(options)[name],
    configs: configs[parser],
    defaultFilenames: { ts: filenames[parser], js: filenames[parser] },
  });
  const filename = filenames[parser];
  return {
    valid: (code: string) => valid({ code, filename }),
    invalid: (code: string, rest: Omit<Parameters<typeof invalid>[0] & object, "code"> = {}) =>
      invalid({ code, filename, ...rest }),
  };
}

/** Applies a message's first suggestion to `code`. */
export function suggested(code: string, message: Linter.LintMessage): string {
  const fix = message.suggestions?.[0]?.fix;
  if (!fix) throw new Error(`no suggestion on: ${message.message}`);
  return code.slice(0, fix.range[0]) + fix.text + code.slice(fix.range[1]);
}

/** The source text a message covers. */
export function covered(code: string, message: Linter.LintMessage): string {
  const lines = code.split("\n");
  const offset = (line: number, column: number) =>
    lines.slice(0, line - 1).reduce((sum, text) => sum + text.length + 1, 0) + column - 1;
  return code.slice(
    offset(message.line, message.column),
    offset(message.endLine!, message.endColumn!),
  );
}
