import { defineCorpus, fromGlossaryTable } from "glosslint";
import inclusive from "glosslint/presets/inclusive";
import tech from "glosslint/presets/tech";

export default defineCorpus({
  extends: [tech, inclusive, fromGlossaryTable(new URL("./docs/glossary.md", import.meta.url))],
  terms: [
    {
      term: "Dock",
      description: "A powered stand where one bike is locked.",
      nuance: "A station is a group of docks.",
      avoid: [{ word: "rack", why: "Racks are unpowered." }, "bay"],
      examples: { good: ["Return the bike to any dock"], bad: ["Return the bike to any rack"] },
      links: [{ title: "Docks", url: "https://example.com/docs/docks" }],
    },
    { term: "Checkout" },
    { term: "eBike", case: "exact" },
    { term: "Day Pass", abbr: ["DP"], case: "context" },
  ],
  allow: ["check out our", "roof rack"],
});
