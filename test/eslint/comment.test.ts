import { describe, expect, it } from "vite-plus/test";
import { suggested, tester } from "./setup.ts";

describe("comment in TS", () => {
  const { valid, invalid } = tester("comment", "ts");

  it("passes comments that follow the corpus", async () => {
    await valid(`// Return the eBike to any dock.`);
  });

  it("fixes spellings in line and block comments", async () => {
    await invalid(`// Set the re-charge point`, {
      output: `// Set the recharge point`,
      errors: ["GLOSSLINT_TERM"],
    });
    await invalid(`/* Start the check-out */`, { output: `/* Start the checkout */`, errors: 1 });
  });

  it("checks casing for exact terms only", async () => {
    await invalid(`// Rent an Ebike`, { output: `// Rent an eBike`, errors: ["GLOSSLINT_CASE"] });
    await valid(`// Buy a DAY PASS or a day pass`);
  });

  it("suggests the term for an avoid word", async () => {
    const code = `// Find a rack`;
    const { result } = await invalid(code, { output: null, errors: ["GLOSSLINT_AVOID"] });
    expect(suggested(code, result.messages[0]!)).toBe(`// Find a dock`);
  });

  it("skips tool directives", async () => {
    await valid(`/* global rack */\nconst a = 1;`);
    await valid(`// @ts-expect-error rack`);
  });
});

describe("comment in Vue and YAML", () => {
  it("checks template comments and script comments", async () => {
    const { invalid } = tester("comment", "vue");
    await invalid(`<template><!-- the re-charge point --><p /></template>`, {
      output: `<template><!-- the recharge point --><p /></template>`,
      errors: 1,
    });
    await invalid(`<script setup>\n// the check-out\n</script>`, {
      output: `<script setup>\n// the checkout\n</script>`,
      errors: 1,
    });
  });

  it("checks YAML comments", async () => {
    const { invalid } = tester("comment", "yaml");
    await invalid(`# the check-out\na: 1`, { output: `# the checkout\na: 1`, errors: 1 });
  });
});
