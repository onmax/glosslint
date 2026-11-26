// Runs the real `oxlint` binary with glosslint's source plugin on a copy of test/fixtures/oxlint.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const oxlint = join(root, "node_modules/.bin/oxlint");
const fixture = join(root, "test/fixtures/oxlint");
// Under Vite+ (VP_VERSION set, as in `vp test`), oxlint reads vite.config.ts instead of .oxlintrc.json.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("VP_")),
);

const rules = {
  "glosslint/term": "error",
  "glosslint/avoid": "error",
  "glosslint/comment": "error",
  "glosslint/identifier": "warn",
};

const projects: string[] = [];
afterEach(() => {
  for (const project of projects.splice(0)) rmSync(project, { recursive: true, force: true });
});

/** A copy of the fixture with a `.oxlintrc.json` that loads `plugin` with `settings`. */
function setup(settings?: object, plugin = join(root, "src/oxlint.ts")): string {
  const project = mkdtempSync(join(tmpdir(), "glosslint-oxlint-"));
  projects.push(project);
  cpSync(fixture, project, { recursive: true });
  const config = { jsPlugins: [plugin], rules, ...(settings ? { settings } : {}) };
  writeFileSync(join(project, ".oxlintrc.json"), JSON.stringify(config));
  return project;
}

interface Diagnostic {
  code: string;
  filename: string;
  labels: { span: { line: number; column: number } }[];
}

/** Each finding as `file:line:column rule`, in oxlint's order. */
function lint(cwd: string, ...args: string[]): { code: number | null; findings: string[] } {
  const result = spawnSync(oxlint, ["--format", "json", ...args], { cwd, env, encoding: "utf8" });
  if (result.stderr) throw new Error(result.stderr);
  const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: Diagnostic[] };
  const findings = diagnostics.map(({ code, filename, labels: [label] }) => {
    const { line, column } = label!.span;
    return `${filename}:${line}:${column} ${code}`;
  });
  return { code: result.status, findings: findings.sort() };
}

// Each test spawns oxlint, which starts Node for the plugin.
describe("oxlint", { timeout: 60_000 }, () => {
  it("reports all four rules in .ts files and in a .vue file's <script>", () => {
    const { code, findings } = lint(setup());
    expect(code).toBe(1);
    expect(findings).toEqual([
      "Return.vue:6:27 glosslint(comment)",
      "Return.vue:7:30 glosslint(term)",
      "Return.vue:8:7 glosslint(identifier)",
      "bikes.ts:1:16 glosslint(comment)",
      "bikes.ts:2:23 glosslint(term)",
      "bikes.ts:2:46 glosslint(avoid)",
      "bikes.ts:3:14 glosslint(identifier)",
    ]);
  });

  it("applies the autofixes with --fix and leaves the suggestions", () => {
    const cwd = setup();
    const { findings } = lint(cwd, "--fix");
    expect(findings).toEqual([
      "Return.vue:6:27 glosslint(comment)",
      "Return.vue:8:7 glosslint(identifier)",
      "bikes.ts:2:46 glosslint(avoid)",
      "bikes.ts:3:14 glosslint(identifier)",
    ]);
    const bikes = readFileSync(join(cwd, "bikes.ts"), "utf8");
    expect(bikes).toContain(`// Find a free Recharge point.`);
    expect(bikes).toContain(`"Recharge point at the rack"`);
    expect(bikes).toContain(`reChargePoint = 1`);
    const vue = readFileSync(join(cwd, "Return.vue"), "utf8");
    expect(vue).toContain(`"Return to the Recharge point"`);
    expect(vue).toContain(`<p>Start the check-out at the bay.</p>`);
  });

  it("reads settings.glosslint: glossary, identifierAvoid and ignoreCallees", () => {
    const cwd = setup({
      glosslint: { glossary: "glossary/other.md", identifierAvoid: true },
    });
    expect(lint(cwd).findings).toEqual([
      "hub.ts:1:35 glosslint(avoid)",
      "hub.ts:2:14 glosslint(identifier)",
    ]);
    expect(lint(setup({ glosslint: { ignoreCallees: [] } })).findings).toContain(
      "bikes.ts:4:34 glosslint(term)",
    );
  });
});
