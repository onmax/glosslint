import { defineConfig } from "vite-plus";

export default defineConfig({
  // ESM only, with types, and publint fails the build on a broken package.json.
  pack: {
    entry: {
      index: "src/index.ts",
      eslint: "src/eslint.ts",
      oxlint: "src/oxlint.ts",
      x18n: "src/x18n.ts",
      "presets/tech": "src/presets/tech.ts",
      "presets/inclusive": "src/presets/inclusive.ts",
      cli: "src/cli.ts",
    },
    format: ["esm"],
    platform: "node",
    // The peers come from the user's project, as do Node's built-ins.
    deps: { neverBundle: [/^node:/, /^eslint(\/|$)/, /^oxlint(\/|$)/, /^@x18n\/core(\/|$)/] },
    fixedExtension: true,
    dts: true,
    clean: true,
    publint: true,
  },
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/dist.test.ts"],
  },
  staged: {
    "*": "vp check --fix",
  },
  // docs/ is a Nuxt app with its own style, checked by its build.
  // Glossary files put a field right after a list, which a Markdown formatter indents into the list.
  fmt: {
    ignorePatterns: [
      "**/dist/**",
      ".cache/**",
      "docs/**",
      "**/.agents/glossary.md",
      "test/fixtures/glossary/**",
      "test/fixtures/cli/doctor/**",
      "test/fixtures/cli/glossary/glossaries/**",
      "test/fixtures/oxlint/glossary/**",
    ],
  },
  lint: {
    ignorePatterns: ["**/dist/**", ".cache/**", "docs/**"],
    options: { typeAware: true, typeCheck: false },
  },
});
