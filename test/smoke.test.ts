import { describe, expect, it } from "vite-plus/test";
import { GlosslintConfigError } from "../src/index.ts";
import tech from "../src/presets/tech.ts";

describe("package", () => {
  it("exports the config error with its fields", () => {
    const error = new GlosslintConfigError({
      code: "X",
      why: "Bad.",
      fix: "Fix it.",
      term: "Dock",
    });
    expect(error).toMatchObject({ code: "X", why: "Bad.", fix: "Fix it.", term: "Dock" });
    expect(error.message).toBe('Bad. (term "Dock")');
  });

  it("ships the presets as corpora", () => {
    expect(tech.kind).toBe("glosslint.corpus");
  });
});
