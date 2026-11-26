import { describe, expect, it } from "vite-plus/test";
import { loadCorpus } from "../../src/cli.ts";
import { bikeDir, brokenDir, run } from "./run.ts";

describe("glosslint test", () => {
  it("lists each term with examples and exits 0 when all pass", async () => {
    expect(await run(["test"])).toEqual({
      code: 0,
      stdout: "✓ Dock     1 good, 1 bad\n✓ Station  1 good, 1 bad\n\n2 terms, 0 failing.\n",
      stderr: "",
    });
  });

  it("explains each failing example and exits 1", async () => {
    const { code, stdout } = await run(["test", "--config", "failing.config.ts"]);
    expect(code).toBe(1);
    expect(stdout).toBe(`✓ Dock     1 good, 1 bad
✓ Station  1 good, 1 bad
✗ Ride     good example "Your trip ended at 9:40." was flagged:
           "trip" is an avoid word for Ride.
           └ narrow the avoid word or move the example
           bad example "Start a journey" was not flagged.
           └ add the wording to "avoid" or fix the example

3 terms, 1 failing.
`);
  });
});

describe("glosslint print", () => {
  it("prints the agent glossary in Markdown by default", async () => {
    const { code, stdout } = await run(["print"]);
    expect(code).toBe(0);
    expect(stdout).toBe(`## Dock
A powered stand where one bike is locked.
- A station is a group of docks.
- Don't write: rack (racks are unpowered), bay.
- Good: "Return the bike to any dock". Bad: "Return the bike to any rack".
- See: [Docks](https://example.com/docs/docks).

## Station
A group of docks at one address.
- Don't write: hub (riders confuse it with the depot).
- Good: "Find a station near you." Bad: "Find a hub near you."

## Checkout
Unlocking a bike to start a ride.

## eBike
A bike with an electric motor.
- Always written "eBike".

## Day Pass
Unlimited rides for one calendar day.
- Abbreviation: DP.
- Title Case in labels, lowercase in sentences.

## Spelling
Write these as shown: Recharge point.
`);
  });

  it("prints the flattened corpus as JSON", async () => {
    const { code, stdout } = await run(["print", "--format", "json"]);
    expect(code).toBe(0);
    const { corpus } = await loadCorpus(bikeDir);
    expect(JSON.parse(stdout)).toEqual({
      terms: corpus.terms,
      allow: ["check out our", "roof rack"],
    });
  });

  it("exits 2 on another format", async () => {
    const { code, stderr } = await run(["print", "--format", "html"]);
    expect(code).toBe(2);
    expect(stderr).toBe(
      '[GLOSSLINT_USAGE] --format is "html".\n╰▶ fix: Use --format md or --format json.\n',
    );
  });
});

describe("glosslint explain", () => {
  it("names the entry a word is an avoid word of", async () => {
    expect(await run(["explain", "rack"])).toEqual({
      code: 0,
      stdout: `Dock
  "rack" is an avoid word for Dock. Racks are unpowered.
  A powered stand where one bike is locked.
  A station is a group of docks.
  Avoid: rack (racks are unpowered), bay.
  Good: "Return the bike to any dock". Bad: "Return the bike to any rack".
  See: Docks https://example.com/docs/docks
  Related: Station
`,
      stderr: "",
    });
  });

  it("finds a term by an abbreviation", async () => {
    const { code, stdout } = await run(["explain", "DP"]);
    expect(code).toBe(0);
    expect(stdout.split("\n").slice(0, 2)).toEqual(["Day Pass", '  "DP" abbreviates Day Pass.']);
  });

  it("exits 1 when no term matches", async () => {
    expect(await run(["explain", "scooter"])).toEqual({
      code: 1,
      stdout: 'No term in the corpus matches "scooter".\n',
      stderr: "",
    });
  });

  it("exits 2 without a query", async () => {
    const { code, stderr } = await run(["explain"]);
    expect(code).toBe(2);
    expect(stderr).toContain("missing required args");
  });
});

describe("config errors", () => {
  it("prints a corpus error as a tree with its code, why and fix, and exits 2", async () => {
    expect(await run([], brokenDir)).toEqual({
      code: 2,
      stdout: "",
      stderr: `[GLOSSLINT_C001] Unknown field "avoids" in term "Dock".
├▶ fix: Rename it to "avoid".
╰▶ config: glosslint.config.mjs
`,
    });
  });

  it("exits 2 when the default export is not a corpus", async () => {
    const { code, stderr } = await run(["test", "--config", "not-corpus.mjs"], brokenDir);
    expect(code).toBe(2);
    expect(stderr)
      .toBe(`[GLOSSLINT_C008] not-corpus.mjs does not export a corpus as its default export.
├▶ fix: End the config with \`export default defineCorpus({ … })\`.
╰▶ config: not-corpus.mjs
`);
  });

  it("exits 2 when --config names no file", async () => {
    const { stderr } = await run(["--config", "missing.ts"]);
    expect(stderr).toContain('[GLOSSLINT_C009] The config "missing.ts" does not exist.');
  });
});
