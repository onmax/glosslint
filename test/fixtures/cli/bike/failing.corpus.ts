// A corpus whose examples disagree with its terms, for `glosslint test`.
import { defineCorpus } from "../../../../src/index.ts";
import { allow, terms } from "./terms.ts";

export default defineCorpus({
  terms: [
    ...terms,
    {
      term: "Ride",
      description: "One trip from checkout to return.",
      avoid: ["trip"],
      examples: {
        good: ["Your trip ended at 9:40."],
        bad: ["Start a journey"],
      },
    },
  ],
  allow,
});
