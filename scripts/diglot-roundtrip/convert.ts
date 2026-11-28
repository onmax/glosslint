// Test-only converter for the round-trip harness: turns a diglot `<locale>/glossary.yml` into a
// glosslint Markdown glossary with the same decisions, in the syntax of the diglot export design:
// - `decision` and `target`/`gloss` become a `Translations` item: `keep`, `keep (gloss)`,
//   `translate`, or the target as plain text, backticked when it would read as a reserved value;
// - each `accept` pattern becomes a `Forms` item of the locale, plain when escaping it changes
//   nothing, otherwise as a backticked `/pattern/`;
// - `note` becomes a `Hints` item;
// - `caseSensitive: true` becomes `Case: exact`, and a heading glosslint would read as exact, such
//   as `API route`, gets `Case: spelling`.
// `match` and any other key have no field, so the merge has to keep them from the file.
//
// Run `node scripts/diglot-roundtrip/convert.ts <glossary.yml> <locale>` to print the Markdown.
import { readFileSync } from "node:fs";
import { parse } from "yaml";

export interface DiglotEntry {
  term: string;
  match?: string;
  caseSensitive?: boolean;
  note?: string;
  decision: "keep" | "translate" | "keep-gloss";
  target?: string;
  accept?: string[];
  gloss?: string;
  [key: string]: unknown;
}

export interface Conversion {
  markdown: string;
  terms: number;
  /** Entries per field the Markdown can't hold, which only the merge keeps: `match` and unknown keys. */
  fileOnly: Record<string, number>;
}

const OWNED = new Set(["term", "caseSensitive", "note", "decision", "target", "accept", "gloss"]);
const SPECIAL = /[.*+?^${}()|[\]\\]/g;

/** Mirrors glosslint's `isExactName`: a capital right after a letter makes a heading `exact`. */
const readsAsExact = (term: string) => /\p{L}\p{Lu}/u.test(term);

function translation(entry: DiglotEntry): string {
  switch (entry.decision) {
    case "keep":
      return "keep";
    case "keep-gloss":
      if (!entry.gloss) throw new Error(`${entry.term}: keep-gloss with no gloss`);
      return `keep (${entry.gloss})`;
    case "translate": {
      const target = entry.target;
      if (target === undefined) return "translate";
      const reserved = target === "keep" || target === "translate" || /^keep \(.*\)$/.test(target);
      return reserved || target.includes(",") ? `\`${target}\`` : target;
    }
    default:
      throw new Error(`${entry.term}: unknown decision ${JSON.stringify(entry.decision)}`);
  }
}

function form(pattern: string): string {
  if (pattern.includes("`")) throw new Error(`accept pattern ${pattern} holds a backtick`);
  const plain =
    pattern.replace(SPECIAL, "\\$&") === pattern &&
    pattern === pattern.trim() &&
    !pattern.includes(",") &&
    !/^\/.*\/$/.test(pattern);
  return plain ? pattern : `\`/${pattern}/\``;
}

export function convertDiglotGlossary(yaml: string, locale: string): Conversion {
  const data = parse(yaml) as { terms?: DiglotEntry[] } | null;
  if (!data || !Array.isArray(data.terms)) throw new Error("expected a `terms:` list");
  const fileOnly: Record<string, number> = {};
  const sections = data.terms.map((entry) => {
    for (const key of Object.keys(entry))
      if (!OWNED.has(key)) fileOnly[key] = (fileOnly[key] ?? 0) + 1;
    if (/[\n#]/.test(entry.term) || /\(.*\)\s*$/.test(entry.term))
      throw new Error(`${entry.term}: can't be a heading`);
    const lines = [`## ${entry.term}`];
    if (entry.caseSensitive) lines.push("Case: exact");
    else if (readsAsExact(entry.term)) lines.push("Case: spelling");
    lines.push("Translations:", `- ${locale}: ${translation(entry)}`);
    if (entry.accept?.length)
      lines.push("Forms:", `- ${locale}: ${entry.accept.map(form).join(", ")}`);
    if (entry.note !== undefined) {
      if (/\n/.test(entry.note)) throw new Error(`${entry.term}: a note on several lines`);
      lines.push("Hints:", `- ${locale}: ${entry.note}`);
    }
    return lines.join("\n");
  });
  const intro = `# Glossary\n\n<!-- Converted from ${locale}/glossary.yml by scripts/diglot-roundtrip/convert.ts. -->\n`;
  return {
    markdown: `${intro}\n${sections.join("\n\n")}\n`,
    terms: data.terms.length,
    fileOnly,
  };
}

if (import.meta.main) {
  const [file, locale] = process.argv.slice(2);
  if (!file || !locale) {
    console.error("usage: node scripts/diglot-roundtrip/convert.ts <glossary.yml> <locale>");
    process.exit(2);
  }
  process.stdout.write(convertDiglotGlossary(readFileSync(file, "utf8"), locale).markdown);
}
