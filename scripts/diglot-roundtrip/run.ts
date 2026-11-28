// Round-trip harness for `glosslint export --diglot`. It runs outside the unit tests:
//
//   node scripts/diglot-roundtrip/run.ts <translations-root> [options]
//
// For each locale it copies the translations repository under the system temp folder, converts
// `<locale>/glossary.yml` into a glosslint glossary (convert.ts), runs
// `glosslint export --diglot <locale> --merge <copy>/<locale>/glossary.yml --glossary <converted.md>`
// twice, and checks that nothing a translator wrote was lost:
// - `loadGlossary` from @diglot/store is deep-equal before and after, per entry and per field;
// - every comment line of the file survives, and the second merge changes no byte;
// - `matchGlossary` from @diglot/core finds the same terms in every source skeleton of the
//   manifests under `.diglot/manifest` and of `<locale>/segments`;
// - `diglot validate` in the copy reports the expected records, errors and warnings.
// It prints a Markdown report and exits 1 when any check fails.
//
// Options:
//   --cli <file>        glosslint CLI to run (default: dist/cli.mjs of this repository; run `pnpm build`)
//   --locales <list>    comma-separated locales (default: fr,de)
//   --compare <dir>     skip the conversion and export and compare <dir> against the root as it is,
//                       to check the harness itself on a copy you broke by hand
//   --expect <r/e/w>    what `diglot validate` must report (default: 20215/0/153)
//   --skip-validate     don't run `diglot validate`
//   --keep              keep the temporary copy and print its path
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { matchGlossary } from "@diglot/core";
import type { Glossary, GlossaryEntry } from "@diglot/core";
import { loadGlossary } from "@diglot/store";
import { convertDiglotGlossary } from "./convert.ts";

const repo = fileURLToPath(new URL("../../", import.meta.url));

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    cli: { type: "string", default: join(repo, "dist/cli.mjs") },
    locales: { type: "string", default: "fr,de" },
    compare: { type: "string" },
    expect: { type: "string", default: "20215/0/153" },
    "skip-validate": { type: "boolean", default: false },
    keep: { type: "boolean", default: false },
  },
});
if (positionals.length !== 1) {
  console.error(
    "usage: node scripts/diglot-roundtrip/run.ts <translations-root> [--cli <file>] [--locales fr,de] [--compare <dir>] [--expect 20215/0/153] [--skip-validate] [--keep]",
  );
  process.exit(2);
}
const root = resolve(positionals[0]!);
const locales = values.locales
  .split(",")
  .map((locale) => locale.trim())
  .filter(Boolean);
const cli = resolve(values.cli);
const [expectRecords, expectErrors, expectWarnings] = values.expect.split("/").map(Number);

/** Problems that make the run red, as Markdown list items, by section. */
const failures: string[] = [];
const out: string[] = [];
const say = (line = "") => out.push(line);

// The copy: everything but `.git` and `node_modules`, which is linked so `npx diglot` resolves.
let work: string | undefined;
let copy: string;
if (values.compare) copy = resolve(values.compare);
else {
  work = mkdtempSync(join(tmpdir(), "diglot-roundtrip-"));
  copy = join(work, "translations");
  cpSync(root, copy, {
    recursive: true,
    filter: (src) => {
      const rel = src.slice(root.length).replace(/^\//, "");
      return rel !== ".git" && rel !== "node_modules";
    },
  });
  if (existsSync(join(root, "node_modules")))
    symlinkSync(join(root, "node_modules"), join(copy, "node_modules"));
}

const SHARED = "glossary.yml";
const load = async (dir: string, locale: string): Promise<Glossary> =>
  (await loadGlossary(dir, locale, { shared: SHARED })) ?? { terms: [] };

const show = (value: unknown) => (value === undefined ? "(none)" : JSON.stringify(value));
const clip = (text: string, max = 90) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Per-entry, per-field differences between two loaded glossaries, keyed by term as diglot does. */
function diffGlossaries(before: Glossary, after: Glossary) {
  const key = (entry: GlossaryEntry) => entry.term.toLowerCase();
  const afterByKey = new Map(after.terms.map((entry) => [key(entry), entry]));
  const beforeKeys = new Set(before.terms.map(key));
  const lines: string[] = [];
  let updated = 0;
  let unchanged = 0;
  let removed = 0;
  for (const old of before.terms) {
    const now = afterByKey.get(key(old));
    if (!now) {
      removed++;
      lines.push(`\`${old.term}\`: entry missing after the merge (was ${show(old)})`);
      continue;
    }
    if (isDeepStrictEqual(old, now)) {
      unchanged++;
      continue;
    }
    updated++;
    const fields = new Set([...Object.keys(old), ...Object.keys(now)]);
    for (const field of fields) {
      const a = (old as Record<string, unknown>)[field];
      const b = (now as Record<string, unknown>)[field];
      if (isDeepStrictEqual(a, b)) continue;
      if (Array.isArray(a) || Array.isArray(b)) {
        const lost = ((a as unknown[]) ?? []).filter(
          (item) => !((b as unknown[]) ?? []).includes(item),
        );
        const gained = ((b as unknown[]) ?? []).filter(
          (item) => !((a as unknown[]) ?? []).includes(item),
        );
        const parts = [
          lost.length ? `lost ${lost.map(show).join(", ")}` : "",
          gained.length ? `gained ${gained.map(show).join(", ")}` : "",
          !lost.length && !gained.length ? `reordered ${show(a)} -> ${show(b)}` : "",
        ].filter(Boolean);
        lines.push(`\`${old.term}\`.${field}: ${parts.join("; ")}`);
      } else lines.push(`\`${old.term}\`.${field}: ${show(a)} -> ${show(b)}`);
    }
  }
  const added = after.terms.filter((entry) => !beforeKeys.has(key(entry)));
  for (const entry of added) lines.push(`\`${entry.term}\`: entry added (${show(entry)})`);
  const order = (glossary: Glossary) =>
    glossary.terms.map(key).filter((k) => afterByKey.has(k) && beforeKeys.has(k));
  if (!isDeepStrictEqual(order(before), order(after))) lines.push("entry order changed");
  if (!isDeepStrictEqual(before.style, after.style))
    lines.push(`style: ${show(before.style)} -> ${show(after.style)}`);
  return { lines, added: added.length, updated, unchanged, removed };
}

/** Every source skeleton diglot matches the glossary against: the manifests' and the locale's segments'. */
function skeletons(dir: string, locale: string): string[] {
  const found = new Set<string>();
  const manifests = join(dir, ".diglot/manifest");
  if (existsSync(manifests))
    for (const name of readdirSync(manifests).filter((file) => file.endsWith(".json"))) {
      const manifest = JSON.parse(readFileSync(join(manifests, name), "utf8")) as {
        files: Record<string, { skeleton: string }[]>;
      };
      for (const segments of Object.values(manifest.files))
        for (const segment of segments) found.add(segment.skeleton);
    }
  const segments = join(dir, locale, "segments");
  if (existsSync(segments))
    for (const name of readdirSync(segments, { recursive: true, encoding: "utf8" })) {
      if (!name.endsWith(".json")) continue;
      const record = JSON.parse(readFileSync(join(segments, name), "utf8")) as { source?: string };
      if (typeof record.source === "string") found.add(record.source);
    }
  return [...found];
}

function diffMatches(before: Glossary, after: Glossary, texts: string[]) {
  const byTerm = new Map<string, { lost: number; gained: number; example: string }>();
  let changed = 0;
  for (const text of texts) {
    const a = new Set(matchGlossary(before, text).map((entry) => entry.term));
    const b = new Set(matchGlossary(after, text).map((entry) => entry.term));
    if (isDeepStrictEqual(a, b)) continue;
    changed++;
    for (const [terms, other, kind] of [
      [a, b, "lost"],
      [b, a, "gained"],
    ] as const)
      for (const term of terms) {
        if (other.has(term)) continue;
        const stat = byTerm.get(term) ?? { lost: 0, gained: 0, example: text };
        stat[kind]++;
        byTerm.set(term, stat);
      }
  }
  const lines = [...byTerm].map(
    ([term, stat]) =>
      `\`${term}\`: ${[stat.lost && `lost in ${stat.lost}`, stat.gained && `gained in ${stat.gained}`].filter(Boolean).join(", ")} skeleton(s), e.g. "${clip(stat.example)}"`,
  );
  return { changed, lines };
}

const commentLines = (text: string) =>
  text
    .split("\n")
    .filter((line) => /^\s*#/.test(line))
    .map((line) => line.trim());

interface Export {
  code: number | null;
  output: string;
}
function runExport(locale: string, glossary: string): Export {
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "export",
      "--diglot",
      locale,
      "--merge",
      join(copy, locale, "glossary.yml"),
      "--glossary",
      glossary,
    ],
    { cwd: work, encoding: "utf8" },
  );
  return { code: result.status, output: `${result.stdout}${result.stderr}`.trim() };
}

/** Reads `N added, N updated, N unchanged` and a kept-`match` count from the CLI's summary, if it printed them. */
function summaryCounts(output: string) {
  const num = (pattern: RegExp) => pattern.exec(output)?.[1];
  return {
    added: num(/(\d+) added/),
    updated: num(/(\d+) updated/),
    unchanged: num(/(\d+) unchanged/),
    keptMatch:
      num(/(\d+) (?:keptMatch|kept `?match`?)/i) ??
      num(/(?:keptMatch|kept `?match`?)\D{0,3}(\d+)/i),
  };
}

say("# diglot round trip");
say();
say(`- Root: \`${root}\``);
say(`- Copy: \`${copy}\`${values.compare ? " (--compare, no export run)" : ""}`);
if (!values.compare) say(`- CLI: \`${cli}\``);
say();

const rows: string[] = [];
const details: string[] = [];
for (const locale of locales) {
  const ownFile = join(root, locale, "glossary.yml");
  const original = readFileSync(ownFile, "utf8");
  const before = await load(root, locale);
  const local: string[] = [];
  let exportCell = "skipped";
  let cliCounts = summaryCounts("");

  if (!values.compare) {
    const conversion = convertDiglotGlossary(original, locale);
    const md = join(work!, `glossary-${locale}.md`);
    writeFileSync(md, conversion.markdown);
    const first = runExport(locale, md);
    const merged = readFileSync(join(copy, locale, "glossary.yml"), "utf8");
    const second = first.code === 0 ? runExport(locale, md) : undefined;
    cliCounts = summaryCounts(first.output);
    exportCell = first.code === 0 ? "ok" : `exit ${first.code}`;
    details.push(
      `### ${locale}: export`,
      "",
      `Converted ${conversion.terms} entries to \`${md}\`. Fields only the file holds: ${
        Object.entries(conversion.fileOnly)
          .map(([field, n]) => `${field} ${n}`)
          .join(", ") || "none"
      }.`,
      "",
      "```",
      first.output || "(no output)",
      "```",
      "",
    );
    if (first.code !== 0)
      local.push(`export exited ${first.code}: ${clip(first.output.split("\n")[0] ?? "", 160)}`);
    else if (second && second.code !== 0) local.push(`second export exited ${second.code}`);
    else if (readFileSync(join(copy, locale, "glossary.yml"), "utf8") !== merged)
      local.push("the second merge changed the file");
  }

  const after = await load(copy, locale);
  const entries = diffGlossaries(before, after);
  local.push(...entries.lines);
  const merged = readFileSync(join(copy, locale, "glossary.yml"), "utf8");
  const kept = new Set(commentLines(merged));
  for (const comment of commentLines(original))
    if (!kept.has(comment)) local.push(`comment lost: ${clip(comment)}`);

  const texts = skeletons(root, locale);
  const matches = diffMatches(before, after, texts);
  local.push(...matches.lines);

  rows.push(
    `| ${locale} | ${before.terms.length} | ${after.terms.length} | ${entries.added} | ${entries.updated} | ${entries.unchanged} | ${entries.removed} | ${cliCounts.added ?? "-"} / ${cliCounts.updated ?? "-"} / ${cliCounts.unchanged ?? "-"} | ${cliCounts.keptMatch ?? "-"} | ${texts.length} | ${matches.changed} | ${exportCell} |`,
  );
  details.push(
    `### ${locale}: loss`,
    "",
    ...(local.length ? local.map((line) => `- ${line}`) : ["None."]),
    "",
  );
  failures.push(...local.map((line) => `${locale}: ${line}`));
}

say("## Counts");
say();
say(
  "Entries are those `loadGlossary` returns (shared `glossary.yml` plus the locale's own file). Added, updated, unchanged and missing come from comparing them; the CLI column is what the merge printed.",
);
say();
say(
  "| Locale | Entries before | After | Added | Updated | Unchanged | Missing | CLI added / updated / unchanged | keptMatch | Skeletons | Skeletons with other terms | Export |",
);
say("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const row of rows) say(row);
say();

say("## diglot validate");
say();
if (values["skip-validate"]) say("Skipped.");
else {
  const result = spawnSync("npx", ["diglot", "validate"], { cwd: copy, encoding: "utf8" });
  const output = `${result.stdout}${result.stderr}`;
  const totals = /(\d+) records checked, (\d+) errors?, (\d+) warnings?/.exec(output);
  if (!totals) {
    say(
      `No totals in the output (exit ${result.status}): ${clip(output.trim().split("\n").at(-1) ?? "")}`,
    );
    failures.push("diglot validate printed no totals");
  } else {
    const [, records, errors, warnings] = totals.map(Number);
    say(`${records} records, ${errors} errors, ${warnings} warnings (expected ${values.expect}).`);
    if (records !== expectRecords || errors !== expectErrors || warnings !== expectWarnings)
      failures.push(`diglot validate: ${records}/${errors}/${warnings}, expected ${values.expect}`);
  }
}
say();

say("## Details");
say();
for (const line of details) say(line);

say(`## Result: ${failures.length ? `FAIL (${failures.length})` : "PASS"}`);
say();
for (const failure of failures) say(`- ${failure}`);

process.stdout.write(`${out.join("\n")}\n`);
if (work && !values.keep) rmSync(work, { recursive: true, force: true });
else if (work) process.stderr.write(`kept ${work}\n`);
process.exitCode = failures.length ? 1 : 0;
