// The same corpus, imported by the package name as a user's module does. Read by test/dist.test.ts.
import { defineCorpus } from "glosslint";
import { allow, terms } from "./terms.ts";

export default defineCorpus({ terms, allow });
