// Runs test/dist.test.ts against the built dist/, what npm ships:
// `pnpm test:dist`, which builds first when src/ is newer than dist/.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vite-plus";
import base from "../vite.config.ts";

const root = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

function stale(): boolean {
  if (!existsSync(root("dist/cli.mjs"))) return true;
  const built = statSync(root("dist/cli.mjs")).mtimeMs;
  const sources = ["package.json", "tsconfig.json", "vite.config.ts"].map(root);
  for (const file of readdirSync(root("src"), { recursive: true, encoding: "utf8" }))
    sources.push(root(`src/${file}`));
  return sources.some((file) => statSync(file).mtimeMs > built);
}

if (stale())
  execFileSync(root("node_modules/.bin/vp"), ["pack"], {
    cwd: root(""),
    stdio: ["ignore", process.stderr, "inherit"],
  });

// mergeConfig would concatenate the base's include and exclude, which skip this file.
const config = mergeConfig(base, defineConfig({}));
config.test = { ...config.test, include: ["test/dist.test.ts"], exclude: [] };

export default config;
