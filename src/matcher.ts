import type { Corpus, Finding, Matcher, TextKind } from "./types.ts";

/** Compiles a corpus for matching. Build it once and reuse it. */
export function createMatcher(_corpus: Corpus): Matcher {
  throw new Error("not implemented");
}

/** Finds every problem in `text`, read as `kind` (default `unknown`). */
export function check(_matcher: Matcher, _text: string, _kind?: TextKind): Finding[] {
  throw new Error("not implemented");
}

/** Whether a string is a label or a sentence, from its key or attribute name and its text. */
export function kindOf(_name: string | undefined, _text: string): TextKind {
  throw new Error("not implemented");
}
