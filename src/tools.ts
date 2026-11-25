import type { Corpus, CorpusTestFailure, X18nGlossaryEntry } from "./types.ts";

/** Checks every term's examples: each `bad` one must be reported and each `good` one must not. */
export function testCorpus(_corpus: Corpus): CorpusTestFailure[] {
  throw new Error("not implemented");
}

/** The corpus as a Markdown glossary, for agents to read, or as JSON. */
export function printCorpus(_corpus: Corpus, _format: "md" | "json"): string {
  throw new Error("not implemented");
}

/** What the corpus says about a word or phrase: the term it belongs to, its meaning and nuance. */
export function explain(_corpus: Corpus, _query: string): string {
  throw new Error("not implemented");
}

/** The corpus as x18n `glossary` entries, with only the fields x18n accepts. */
export function toX18nGlossary(_corpus: Corpus): X18nGlossaryEntry[] {
  throw new Error("not implemented");
}
