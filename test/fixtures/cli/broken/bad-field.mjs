import { defineCorpus } from "../../../../src/index.ts";

export default defineCorpus({ terms: [{ term: "Dock", avoids: ["rack"] }] });
