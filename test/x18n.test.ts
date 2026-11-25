import { createMemoryHost, createProject, pathId, resolveConfig, walkLeaves } from "@x18n/core";
import type {
  CheckContext,
  DiagnosticInput,
  HardString,
  Message,
  NodeRange,
  Plugin,
  Resource,
  TextRange,
} from "@x18n/core";
import { describe, expect, it } from "vite-plus/test";
import glosslint from "../src/x18n.ts";
import { bike } from "./core/bike.ts";

/** A flat JSON file and the messages x18n would read from it, with value ranges that include the quotes. */
function resource(id: string, locale: string, entries: Record<string, string | number>) {
  const text = `${JSON.stringify(entries, null, 2)}\n`;
  const messages: Message[] = [];
  let from = 0;
  for (const [key, value] of Object.entries(entries)) {
    const keyStart = text.indexOf(JSON.stringify(key), from);
    const valueStart = text.indexOf(JSON.stringify(value), keyStart + key.length + 2);
    const range: NodeRange = {
      key: { start: keyStart, end: keyStart + key.length + 2 },
      value: { start: valueStart, end: valueStart + JSON.stringify(value).length },
    };
    from = range.value.end;
    messages.push({ key, locale, value, resource: id, storedPath: [key], range });
  }
  const res: Resource = {
    id,
    path: id,
    locale,
    namespace: undefined,
    format: "json",
    block: undefined,
    readonly: false,
    finder: "test",
  };
  return { text, messages, resource: res };
}

const en = resource("locales/en.json", "en", {
  "ride.start": "Unlock your ebike at the rack.",
  "pass.buy.label": "Buy a day pass",
  "pass.buy.description": "Buy a day pass today.",
  "ride.charge": "Bikes below the re-charge point go to charge with the ebike team.",
  "ride.quote": 'Say "hi" at the rack',
  "station.count": 3,
});
const da = resource("locales/da.json", "da", { "ride.start": "Lås din ebike op ved rack." });

const vue = `<template>\n  <button title="Dock your ebike here" />\n  <h2 :title="\`\${n} bikes at the rack\`" />\n  <p title="Buy a day pass">Buy a day pass</p>\n</template>\n`;
const at = (needle: string): TextRange => {
  const start = vue.indexOf(needle);
  return { start, end: start + needle.length };
};
const hardStrings: (HardString & { path: string })[] = [
  {
    text: "Dock your ebike here",
    range: at('"Dock your ebike here"'),
    kind: "vue-attribute",
    attribute: "title",
    path: "src/App.vue",
  },
  {
    text: "{n} bikes at the rack",
    range: at("`${n} bikes at the rack`"),
    kind: "vue-attribute",
    attribute: "title",
    args: [{ name: "n", expression: "n" }],
    path: "src/App.vue",
  },
  {
    text: "Buy a day pass",
    range: at('"Buy a day pass"'),
    kind: "vue-attribute",
    attribute: "title",
    path: "src/App.vue",
  },
  // The same text as element text, with no attribute to say it is a label, so the context term passes.
  {
    text: "Buy a day pass",
    range: { start: at(">Buy a day pass<").start + 1, end: at(">Buy a day pass<").end - 1 },
    kind: "vue-text",
    path: "src/App.vue",
  },
];

const files: Record<string, string> = {
  [en.resource.path]: en.text,
  [da.resource.path]: da.text,
  "src/App.vue": vue,
};

/** The parts of x18n's check context the plugin reads, from @x18n/core's own types. */
function stubContext(): CheckContext {
  const messages = [...en.messages, ...da.messages];
  const ctx: Partial<CheckContext> = {
    sourceLocale: "en",
    locales: ["en", "da"],
    resources: [en.resource, da.resource],
    options: {},
    messages: (locale) => messages.filter((m) => locale === undefined || m.locale === locale),
    text: (path) => files[path],
    hardStrings: () => hardStrings,
  };
  return ctx as CheckContext;
}

function run(plugin: Plugin, ctx = stubContext()) {
  return Object.fromEntries(
    (plugin.checks ?? []).map((check) => [
      check.id,
      [...check.run({ ...ctx })] as DiagnosticInput[],
    ]),
  );
}

const slice = (path: string, range: TextRange | undefined) =>
  range && files[path]?.slice(range.start, range.end);

describe("glosslint x18n plugin", () => {
  const plugin = glosslint({ corpus: bike });
  const byCheck = run(plugin);
  const all = Object.values(byCheck).flat();

  it("has one check per finding code, terms and casing as errors and avoid words as warnings", () => {
    expect(plugin.name).toBe("glosslint");
    expect(plugin.checks?.map((c) => [c.id, c.defaultSeverity])).toEqual([
      ["glosslint-term", "error"],
      ["glosslint-avoid", "warning"],
      ["glosslint-case", "error"],
    ]);
  });

  it("checks source-locale messages with their key's kind, and skips other locales and non-strings", () => {
    const keys = (id: string) => byCheck[id]?.map((d) => d.key ?? d.location?.path);
    expect(keys("glosslint-term")).toEqual(["ride.charge"]);
    // `pass.buy.label` is a label, so the context term needs Title Case; the description is a sentence.
    expect(keys("glosslint-case")).toEqual([
      "ride.start",
      "pass.buy.label",
      "ride.charge",
      "src/App.vue",
      "src/App.vue",
    ]);
    expect(keys("glosslint-avoid")).toEqual(["ride.start", "ride.quote", "src/App.vue"]);
    expect(all.every((d) => d.locale === undefined || d.locale === "en")).toBe(true);
  });

  it("points at the reported words inside message values and hard strings", () => {
    const ranges = all.map((d) => slice(d.location!.path, d.location!.range));
    expect(ranges).toEqual([
      "re-charge point",
      "rack",
      // The escaped quotes make offsets differ, so the whole value is reported.
      String.raw`"Say \"hi\" at the rack"`,
      // A template with arguments is reported whole too.
      "`${n} bikes at the rack`",
      "ebike",
      "day pass",
      "ebike",
      "ebike",
      "day pass",
    ]);
  });

  it("carries the finding's message, with the reason, the term's description, nuance and link", () => {
    const rack = byCheck["glosslint-avoid"]?.[0];
    expect(rack?.message).toBe(
      'Use "dock" instead of "rack". Racks are unpowered. Dock: A powered stand where one bike is locked. A station is a group of docks. See https://example.com/docs/docks',
    );
    expect(rack?.severity).toBeUndefined();
  });

  it("offers a safe fix for message autofixes only, setting the whole fixed value", () => {
    const [first] = byCheck["glosslint-case"] ?? [];
    expect(first?.fixes).toEqual([
      {
        title: 'Change "ebike" to "eBike"',
        level: "safe",
        ops: [
          { type: "set", key: "ride.start", locale: "en", value: "Unlock your eBike at the rack." },
        ],
      },
    ]);
    expect(byCheck["glosslint-avoid"]?.every((d) => (d.fixes ?? []).length === 0)).toBe(true);
    const hard = all.filter((d) => d.key === undefined);
    expect(hard.length).toBe(3);
    expect(hard.every((d) => d.fixes === undefined)).toBe(true);
  });

  it("makes every safe fix of a message apply all its autofixes, since x18n keeps the first set of a key", () => {
    const charge = all.filter((d) => d.key === "ride.charge");
    const fixed = "Bikes below the recharge point go to charge with the eBike team.";
    expect(charge.map((d) => d.fixes?.[0])).toEqual([
      {
        title: 'Fix 2 terms in "ride.charge"',
        level: "safe",
        ops: [{ type: "set", key: "ride.charge", locale: "en", value: fixed }],
      },
      {
        title: 'Fix 2 terms in "ride.charge"',
        level: "safe",
        ops: [{ type: "set", key: "ride.charge", locale: "en", value: fixed }],
      },
    ]);
    expect(
      charge.map((d) => [d.fixes?.[1]?.title, d.fixes?.[1]?.level, d.fixes?.[1]?.ops[0]]),
    ).toEqual([
      [
        'Change "re-charge point" to "recharge point"',
        undefined,
        {
          type: "set",
          key: "ride.charge",
          locale: "en",
          value: "Bikes below the recharge point go to charge with the ebike team.",
        },
      ],
      [
        'Change "ebike" to "eBike"',
        undefined,
        {
          type: "set",
          key: "ride.charge",
          locale: "en",
          value: "Bikes below the re-charge point go to charge with the eBike team.",
        },
      ],
    ]);
  });

  it("reads the locale given as sourceLocale", () => {
    const danish = run(glosslint({ corpus: bike, sourceLocale: "da" }));
    expect(
      Object.values(danish)
        .flat()
        .filter((d) => d.key !== undefined)
        .map((d) => [d.key, d.locale, slice(d.location!.path, d.location!.range)]),
    ).toEqual([
      ["ride.start", "da", "rack"],
      ["ride.start", "da", "ebike"],
    ]);
  });
});

describe("glosslint x18n plugin in an x18n project", () => {
  // @x18n/core has no built-in formats, finders or scanners, so the test brings minimal ones.
  const support: Plugin = {
    name: "test-support",
    localeFinders: [
      {
        id: "test-locales",
        find: async () => [
          { path: "locales/en.json", locale: "en", namespace: undefined },
          { path: "locales/da.json", locale: "da", namespace: undefined },
        ],
      },
    ],
    formats: [
      {
        id: "test-json",
        extensions: ["json"],
        parse: (text) => {
          const tree = JSON.parse(text) as Record<string, string>;
          const ranges = new Map<string, NodeRange>();
          for (const { path, value } of walkLeaves(tree)) {
            const key = JSON.stringify(path[0]);
            const keyStart = text.indexOf(key);
            const valueStart = text.indexOf(JSON.stringify(value), keyStart + key.length);
            ranges.set(pathId(path), {
              key: { start: keyStart, end: keyStart + key.length },
              value: { start: valueStart, end: valueStart + JSON.stringify(value).length },
            });
          }
          return { tree, ranges };
        },
        serialize: (tree) => `${JSON.stringify(tree, null, 2)}\n`,
      },
    ],
    scanners: [
      {
        id: "test-titles",
        extensions: ["vue"],
        scan: (file) => ({
          usages: [],
          hardStrings: [...file.text.matchAll(/title="([^"]*)"/g)].map((match) => ({
            text: match[1]!,
            range: { start: match.index + 6, end: match.index + match[0].length },
            kind: "vue-attribute",
            attribute: "title",
          })),
        }),
      },
    ],
  };

  async function project(initial: Record<string, string>) {
    const host = createMemoryHost(initial, "/bikes");
    const setup = await resolveConfig({
      host,
      config: { sourceLocale: "en", plugins: [support, glosslint({ corpus: bike })] },
      builtins: { plugins: [], presets: {} },
    });
    const p = createProject({ host, setup });
    await p.ready;
    return { host, project: p };
  }

  it("reports through x18n's analysis and applies the safe fixes with --fix", async () => {
    const { host, project: p } = await project({
      "locales/en.json": `${JSON.stringify({ "ride.start": "Unlock your ebike at the rack.", "dock.title": "Find a Station" }, null, 2)}\n`,
      "locales/da.json": `${JSON.stringify({ "ride.start": "Lås din ebike op." }, null, 2)}\n`,
      "src/App.vue": '<template><button title="Dock your ebike here" /></template>\n',
    });
    const glossDiagnostics = () =>
      p.analyze().diagnostics.filter((d) => d.code.startsWith("glosslint-"));
    const text = (d: { location?: { path: string; range: TextRange } | undefined }) =>
      d.location && p.text(d.location.path)?.slice(d.location.range.start, d.location.range.end);

    const before = glossDiagnostics();
    expect(before.map((d) => [d.code, d.severity, d.key, text(d)])).toEqual([
      ["glosslint-case", "error", "ride.start", "ebike"],
      ["glosslint-avoid", "warning", "ride.start", "rack"],
      ["glosslint-case", "error", undefined, "ebike"],
    ]);

    const { plan, fixed } = p.planFixes(before);
    expect(fixed).toHaveLength(1);
    await p.apply(plan);
    expect(JSON.parse((await host.readFile("locales/en.json"))!)).toEqual({
      "ride.start": "Unlock your eBike at the rack.",
      "dock.title": "Find a Station",
    });
    expect(await host.readFile("locales/da.json")).toContain("ebike");
    await p.update([{ type: "change", path: "locales/en.json" }]);
    expect(glossDiagnostics().map((d) => [d.code, d.key, text(d)])).toEqual([
      ["glosslint-avoid", "ride.start", "rack"],
      ["glosslint-case", undefined, "ebike"],
    ]);
  });

  it("follows the severity and off settings of the project's config", async () => {
    const host = createMemoryHost(
      {
        "locales/en.json": '{ "a": "Unlock your ebike at the rack." }\n',
        "locales/da.json": "{}\n",
      },
      "/bikes",
    );
    const setup = await resolveConfig({
      host,
      config: {
        sourceLocale: "en",
        plugins: [support, glosslint({ corpus: bike })],
        checks: { "glosslint-case": "off", "glosslint-avoid": "error" },
      },
      builtins: { plugins: [], presets: {} },
    });
    const p = createProject({ host, setup });
    await p.ready;
    expect(
      p
        .analyze()
        .diagnostics.filter((d) => d.code.startsWith("glosslint-"))
        .map((d) => [d.code, d.severity]),
    ).toEqual([["glosslint-avoid", "error"]]);
  });
});
