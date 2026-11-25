import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import * as yamlParser from "yaml-eslint-parser";
import { describe, expect, it } from "vite-plus/test";
import glosslint from "../../src/eslint.ts";
import { corpus } from "./setup.ts";

describe("glosslint()", () => {
  it("returns one config with the plugin and all four rules on", () => {
    const configs = glosslint({ corpus, files: ["src/**/*.ts"] });
    expect(configs).toHaveLength(1);
    const [config] = configs;
    expect(config?.files).toEqual(["src/**/*.ts"]);
    expect(Object.keys(config?.plugins?.glosslint?.rules ?? {})).toEqual([
      "term",
      "avoid",
      "comment",
      "identifier",
    ]);
    expect(config?.rules).toEqual({
      "glosslint/term": "error",
      "glosslint/avoid": "error",
      "glosslint/comment": "error",
      "glosslint/identifier": "warn",
    });
    expect(config?.languageOptions).toBeUndefined();
  });

  it("applies to every file when no files are given", () => {
    expect(glosslint({ corpus })[0]?.files).toBeUndefined();
  });

  it("lints with the finding code as messageId, autofixes TERM and leaves AVOID", () => {
    const linter = new Linter({ configType: "flat" });
    const config = [
      { files: ["**/*.ts"], languageOptions: { parser: tseslint.parser as Linter.Parser } },
      { files: ["**/*.yml"], languageOptions: { parser: yamlParser } },
      ...glosslint({ corpus, files: ["**/*.ts", "**/*.yml"] }),
    ];
    const code = `// the rack\nconst reChargePoint = "Re-charge point at the rack";\n`;
    const messages = linter.verify(code, config, "a.ts");
    expect(messages.map((m) => `${m.ruleId} ${m.messageId} ${m.severity}`)).toEqual([
      "glosslint/comment GLOSSLINT_AVOID 2",
      "glosslint/identifier GLOSSLINT_TERM 1",
      "glosslint/term GLOSSLINT_TERM 2",
      "glosslint/avoid GLOSSLINT_AVOID 2",
    ]);
    const fixed = linter.verifyAndFix(code, config, "a.ts");
    expect(fixed.output).toBe(`// the rack\nconst reChargePoint = "Recharge point at the rack";\n`);
    const yaml = linter.verifyAndFix("a: The check-out\n", config, "a.yml");
    expect(yaml.output).toBe("a: The checkout\n");
  });
});
