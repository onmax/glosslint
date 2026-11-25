import { describe, expect, it } from "vite-plus/test";
import { covered, suggested, tester } from "./setup.ts";

describe("avoid in TS", () => {
  const { valid, invalid } = tester("avoid", "ts");

  it("passes strings with no avoid word", async () => {
    await valid(`const intro = "Return the bike to any dock.";`);
    await valid(`const intro = "Mount it on the roof rack.";`);
    await valid(`const intro = "Mount it on the Roof-Rack.";`);
  });

  it("suggests the term and never fixes", async () => {
    const code = `const intro = "Return the bike to the rack.";`;
    const { result } = await invalid(code, { output: null, errors: ["GLOSSLINT_AVOID"] });
    const [message] = result.messages;
    expect(message?.message).toBe(
      'Use "dock" instead of "rack". Racks are unpowered. Dock: A powered stand where one bike is locked. A station is a group of docks. See https://example.com/docs/docks',
    );
    expect(message?.suggestions?.[0]?.desc).toBe('Change to "dock".');
    expect(suggested(code, message!)).toBe(`const intro = "Return the bike to the dock.";`);
  });

  it("keeps the period of an abbreviation inside the finding", async () => {
    const code = `const label = "Batt. low";`;
    const { result } = await invalid(code, { errors: 1 });
    expect(covered(code, result.messages[0]!)).toBe("Batt.");
    expect(suggested(code, result.messages[0]!)).toBe(`const label = "Battery level low";`);
  });

  it("matches a multi-word avoid word across its period", async () => {
    const code = `const label = "Batt. lvl";`;
    const { result } = await invalid(code, { errors: 1 });
    expect(covered(code, result.messages[0]!)).toBe("Batt. lvl");
  });

  it("does not join words across a period the avoid word lacks", async () => {
    await valid(`const a = "See the trip. Log in";`);
    await invalid(`const a = "Open the trip log";`, { errors: 1 });
  });

  it("skips the same places as term", async () => {
    await valid(`if (kind === "rack") {}`);
    await valid(`t("Rack")`);
    await valid(`const x = { Rack: 1, "Rack": 2 };`);
    await valid(`const x = "rack";`);
  });
});

describe("avoid in Vue", () => {
  const { valid, invalid } = tester("avoid", "vue");

  it("reports template text and bound attributes with a suggestion", async () => {
    const code = `<template><p>Find a rack</p><UButton :label="'Rack'" /></template>`;
    const { result } = await invalid(code, { output: null, errors: 2 });
    expect(suggested(code, result.messages[1]!)).toBe(
      `<template><p>Find a rack</p><UButton :label="'Dock'" /></template>`,
    );
  });

  it("skips data-* attributes", async () => {
    await valid(`<template><p data-kind="Rack">Dock</p></template>`);
  });
});

describe("avoid in YAML", () => {
  const { valid, invalid } = tester("avoid", "yaml");

  it("reports values with a suggestion", async () => {
    const code = `a: 'Return it to the rack'`;
    const { result } = await invalid(code, { output: null, errors: 1 });
    expect(suggested(code, result.messages[0]!)).toBe(`a: 'Return it to the dock'`);
  });

  it("never reports keys", async () => {
    await valid(`rack: Dock`);
  });
});
