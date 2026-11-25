// Inclusive wording: words to avoid and what to write instead.
import type { Corpus } from "../types.ts";
import { terms } from "./inclusive-data.ts";

const corpus: Corpus = { kind: "glosslint.corpus", terms, allow: [] };

export default corpus;
