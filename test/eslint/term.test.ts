import { describe, expect, it } from "vite-plus/test";
import { covered, tester } from "./setup.ts";

describe("term in TS", () => {
  const { valid, invalid } = tester("term", "ts");

  it("passes strings spelled as the corpus does", async () => {
    await valid(`const intro = "Return the eBike to any dock.";`);
    await valid(`const label = "Recharge point";`);
  });

  it("fixes a spelling and keeps the writer's capitals", async () => {
    const { result } = await invalid(`const hint = "Set the Re-charge point here.";`, {
      output: `const hint = "Set the Recharge point here.";`,
      errors: ["GLOSSLINT_TERM"],
    });
    expect(result.messages[0]?.message).toBe(
      '"Re-charge point" is spelled "Recharge point". Recharge point: The battery level at which a bike is sent to charge.',
    );
  });

  it("reports CASE for exact terms and context terms in labels", async () => {
    await invalid(`const title = "Rent an Ebike";`, {
      output: `const title = "Rent an eBike";`,
      errors: ["GLOSSLINT_CASE"],
    });
    await invalid(`const buttonLabel = "Buy a day pass";`, {
      output: `const buttonLabel = "Buy a Day Pass";`,
      errors: ["GLOSSLINT_CASE"],
    });
    await valid(`const value = "Buy a day pass";`);
  });

  it("reads the kind from a property, assignment or default value", async () => {
    await invalid(`const ui = { pageTitle: "Your day pass" };`, {
      output: `const ui = { pageTitle: "Your Day Pass" };`,
      errors: 1,
    });
    await invalid(`ui.tabLabel = ok ? "Day pass" : "";`, {
      output: `ui.tabLabel = ok ? "Day Pass" : "";`,
      errors: 1,
    });
    await invalid(`function f(columnHeader = "day pass") {}`, {
      output: `function f(columnHeader = "Day Pass") {}`,
      errors: 1,
    });
  });

  it("checks each quasi of a template literal", async () => {
    await invalid("const intro = `Your re-charge point is ${level} and your check-out ${time}`;", {
      output: "const intro = `Your recharge point is ${level} and your checkout ${time}`;",
      errors: ["GLOSSLINT_TERM", "GLOSSLINT_TERM"],
    });
  });

  it("maps offsets back through escapes", async () => {
    await invalid(`const a = 'Don\\'t pass the re-charge point';`, {
      output: `const a = 'Don\\'t pass the recharge point';`,
      errors: 1,
    });
    await invalid(`const a = "Line one\\nThe re-charge point";`, {
      output: `const a = "Line one\\nThe recharge point";`,
      errors: 1,
    });
    await invalid(`const a = "\\u0041 re-charge point";`, {
      output: `const a = "\\u0041 recharge point";`,
      errors: 1,
    });
    await invalid("const a = `Tab\\there: re-charge point`;", {
      output: "const a = `Tab\\there: recharge point`;",
      errors: 1,
    });
  });

  it("skips import sources, keys, comparisons, switch cases and literal types", async () => {
    await valid(`import x from "Re-charge point";`);
    await valid(`export * from "Re-charge point";`);
    await valid(`const x = { "Check-out": 1 };`);
    await valid(`class A { "Check-out" = 1 }`);
    await valid(`if (state === "Check-out") {}`);
    await valid(`if ("Check-out" in states) {}`);
    await valid(`switch (state) { case "Check-out": break }`);
    await valid(`type State = "Check-out" | "Re-charge point";`);
    await valid(`const s = states["Check-out"];`);
    await valid(`"use strict";`);
  });

  it("checks a quoted key with a space, as a column header", async () => {
    await invalid(`const row = { "Re-charge point": level };`, {
      output: `const row = { "Recharge point": level };`,
      errors: 1,
    });
  });

  it("skips the first argument of t, $t, te, tm and the ignored callees", async () => {
    await valid(`t("Re-charge point")`);
    await valid(`i18n.$t("Re-charge point", { n: 1 })`);
    await valid(`te("Check-out"); tm("Check-out")`);
    await valid(`name.endsWith("Check-out")`);
    await valid(`name.startsWith("Check-out") || name.includes("Check-out")`);
    await valid(`document.querySelectorAll("Check-out")`);
    await invalid(`t("key", "Re-charge point")`, {
      output: `t("key", "Recharge point")`,
      errors: 1,
    });
    await invalid(`format("Re-charge point")`, { output: `format("Recharge point")`, errors: 1 });
  });

  it("takes ignoreCallees in place of the default ones", async () => {
    const custom = tester("term", "ts", { ignoreCallees: ["track*"] });
    await custom.valid(`trackEvent("Check-out")`);
    await custom.valid(`t("Check-out")`);
    await custom.invalid(`name.endsWith("Check-out")`, {
      output: `name.endsWith("Checkout")`,
      errors: 1,
    });
  });

  it("skips all-lowercase and camelCase code shapes but checks capitalised words", async () => {
    await valid(`const a = "check-out";`);
    await valid(`const a = "check_out";`);
    await valid(`const a = "/docks/check-out";`);
    await valid(`const a = "app.re-charge.point";`);
    await valid(`const a = "checkOutButton";`);
    await valid("const a = `check-out-${id}`;");
    await invalid(`const a = "Check-out";`, { output: `const a = "Checkout";`, errors: 1 });
    await invalid(`const a = "Re-Charge-Point";`, {
      output: `const a = "Recharge Point";`,
      errors: 1,
    });
  });

  it("skips tagged templates", async () => {
    await valid("const q = sql`Check-out`;");
  });

  it("reports the range of the reported text", async () => {
    const code = `const a = 'It\\'s the re-charge point';`;
    const { result } = await invalid(code, { errors: 1 });
    expect(covered(code, result.messages[0]!)).toBe("re-charge point");
  });
});

describe("term in Vue", () => {
  const { valid, invalid } = tester("term", "vue");

  it("checks template text, static attributes and strings in expressions", async () => {
    await invalid(`<template><p>Find the re-charge point</p></template>`, {
      output: `<template><p>Find the recharge point</p></template>`,
      errors: 1,
    });
    await invalid(`<template><UButton label="Check-out" /></template>`, {
      output: `<template><UButton label="Checkout" /></template>`,
      errors: 1,
    });
    await invalid(`<template><UButton :label="'Check-out'" /></template>`, {
      output: `<template><UButton :label="'Checkout'" /></template>`,
      errors: 1,
    });
    await invalid("<template><p>{{ ok ? `Re-charge point` : 'Check-out' }}</p></template>", {
      output: "<template><p>{{ ok ? `Recharge point` : 'Checkout' }}</p></template>",
      errors: 2,
    });
  });

  it("reads the attribute or directive argument as the kind", async () => {
    await invalid(`<template><UButton title="Buy a day pass" /></template>`, {
      output: `<template><UButton title="Buy a Day Pass" /></template>`,
      errors: ["GLOSSLINT_CASE"],
    });
    await invalid(`<template><UButton :title="'Buy a day pass'" /></template>`, {
      output: `<template><UButton :title="'Buy a Day Pass'" /></template>`,
      errors: ["GLOSSLINT_CASE"],
    });
  });

  it("skips class, for, aria id references, data-* and the other code attributes", async () => {
    await valid(`<template><div class="Check-out" /></template>`);
    await valid(`<template><label for="Check-out" /></template>`);
    await valid(
      `<template><div aria-labelledby="Check-out" aria-controls="Check-out" /></template>`,
    );
    await valid(`<template><div data-test="Check-out" /></template>`);
    await valid(
      `<template><UIcon :name="'Check-out'" :class="ok ? 'Check-out' : ''" /></template>`,
    );
    await valid(`<template><RouterLink to="Check-out" /></template>`);
  });

  it("skips the key of $t and comparisons in templates", async () => {
    await valid(`<template><p>{{ $t('Check-out') }}</p></template>`);
    await valid(`<template><p v-if="state === 'Check-out'">x</p></template>`);
  });

  it("checks code shapes in template text but not in attributes", async () => {
    await invalid(`<template><p>check-out</p></template>`, {
      output: `<template><p>checkout</p></template>`,
      errors: 1,
    });
    await valid(`<template><UButton label="check-out" /></template>`);
  });

  it("checks strings in the script block", async () => {
    await invalid(`<script setup lang="ts">\nconst label = 'Check-out'\n</script>`, {
      output: `<script setup lang="ts">\nconst label = 'Checkout'\n</script>`,
      errors: 1,
    });
  });

  it("places template text with entities but offers no fix there", async () => {
    const code = `<template><p>Tom &amp; the re-charge point</p></template>`;
    const { result } = await invalid(code, { output: null, errors: 1 });
    expect(covered(code, result.messages[0]!)).toBe("re-charge point");
  });
});

describe("term in YAML", () => {
  const { valid, invalid } = tester("term", "yaml");

  it("checks values and never keys", async () => {
    await valid(`Check-out: Checkout`);
    await invalid(`checkout:\n  title: Check-out`, {
      output: `checkout:\n  title: Checkout`,
      errors: 1,
    });
    await invalid(`list:\n  - The re-charge point`, {
      output: `list:\n  - The recharge point`,
      errors: 1,
    });
  });

  it("never skips a code-shaped value", async () => {
    await invalid(`a: check-out`, { output: `a: checkout`, errors: 1 });
  });

  it("maps quoted scalars back to the source", async () => {
    await invalid(`a: 'It''s the re-charge point'`, {
      output: `a: 'It''s the recharge point'`,
      errors: 1,
    });
    await invalid(`a: "Say \\"hi\\" at the re-charge point"`, {
      output: `a: "Say \\"hi\\" at the recharge point"`,
      errors: 1,
    });
  });

  it("reads the last key as the kind", async () => {
    await invalid(`pass:\n  buttonLabel: Buy a day pass`, {
      output: `pass:\n  buttonLabel: Buy a Day Pass`,
      errors: ["GLOSSLINT_CASE"],
    });
  });

  it("places block scalars without a fix", async () => {
    const code = `a: >\n  Set the re-charge\n  point here.\n`;
    const { result } = await invalid(code, { output: null, errors: 1 });
    expect(covered(code, result.messages[0]!)).toBe("re-charge\n  point");
  });
});
