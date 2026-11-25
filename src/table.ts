import type { Corpus } from "./types.ts";

/** Reads the first table with a `Use` or `Term` column from a Markdown file, as a corpus. */
export function fromGlossaryTable(_path: string | URL): Corpus {
  throw new Error("not implemented");
}
