import { describe, expect, it } from "vite-plus/test";
import { defineCorpus } from "../../src/corpus.ts";
import glosslint from "../../src/eslint.ts";
import { tester } from "./setup.ts";
import { createRuleTester } from "eslint-vitest-rule-tester";
import type { Rule } from "eslint";

describe("identifier", () => {
  const { valid, invalid } = tester("identifier", "ts");

  it("passes names that split as the terms do", async () => {
    await valid(`const rechargePoint = 1;`);
    await valid(`const RECHARGE_POINT = 1;`);
    await valid(`function getDayPass() {}`);
  });

  it("suggests a rename in the message and never fixes", async () => {
    const { result } = await invalid(`const reChargePoint = 1;`, {
      output: null,
      errors: ["GLOSSLINT_TERM"],
    });
    const [message] = result.messages;
    expect(message?.message).toMatch(
      /^Rename "reChargePoint" to "rechargePoint": the term is "Recharge point"\./,
    );
    expect(message?.suggestions).toBeUndefined();
    expect(message?.fix).toBeUndefined();
  });

  it("skips a name written with escapes instead of crashing", async () => {
    await valid(`const re\\u0043hargePoint = 1; use(reChargePoint);`);
  });

  it("checks variables, functions, params, classes and properties", async () => {
    await invalid(`function reChargePoint() {}`, { errors: 1 });
    await invalid(`const f = function (re_charge_point) {};`, { errors: 1 });
    await invalid(`const f = (a, reChargePoint = 1, ...reChargePoints) => a;`, { errors: 2 });
    await invalid(`class ReChargePoint {}`, { errors: 1 });
    await invalid(`const o = { reChargePoint: 1 };`, { errors: 1 });
    await invalid(`class A { reChargePoint = 1; #reChargePoint = 2; getReChargePoint() {} }`, {
      errors: 3,
    });
    await invalid(`const [reChargePoint] = list;`, { errors: 1 });
    await invalid(`const { level: reChargePoint } = bike;`, { errors: 1 });
  });

  it("checks declarations only, never uses", async () => {
    await valid(`use(reChargePoint); bike.reChargePoint = 1; const { reChargePoint } = bike;`);
    await valid(`const o = { reChargePoint };`);
  });

  it("skips one-word terms and never checks exact terms", async () => {
    await valid(`const checkOut = 1;`);
    await valid(`const ebikeCount = 1; const EBikeCount = 2;`);
  });

  it("reports avoid words only with identifierAvoid", async () => {
    await valid(`const rackCount = 1;`);
    const strict = tester("identifier", "ts", { identifierAvoid: true });
    await strict.invalid(`const rackCount = 1;`, { errors: ["GLOSSLINT_AVOID"] });
  });

  it("does not report a camel spelling of a one-word preset term", async () => {
    const corpus = defineCorpus({ terms: [{ term: "allowlist", avoid: ["whitelist"] }] });
    const [config] = glosslint({ corpus, identifierAvoid: true });
    const rule = config!.plugins!.glosslint!.rules!.identifier as Rule.RuleModule;
    const { valid: ok, invalid: bad } = createRuleTester({ name: "identifier", rule });
    await ok(`const allowList = [];`);
    await bad({ code: `const whitelist = [];`, errors: 1 });
  });
});
