// Product and technology names from case-police, each an `exact` term.
import type { Corpus } from "../types.ts";
import { allow, terms } from "./tech-data.ts";

const corpus: Corpus = { kind: "glosslint.corpus", terms, allow };

export default corpus;
