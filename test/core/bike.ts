import { defineCorpus } from "../../src/corpus.ts";
import type { Term } from "../../src/types.ts";

/** An invented bike-share corpus, the one every core test reads. */
export const bikeTerms: Term[] = [
  {
    term: "Dock",
    description: "A powered stand where one bike is locked.",
    nuance: "A station is a group of docks.",
    avoid: [{ word: "rack", why: "Racks are unpowered." }, "bay"],
    examples: { good: ["Return the bike to any dock"], bad: ["Return the bike to any rack"] },
    links: [
      { title: "Docks", url: "https://example.com/docs/docks" },
      { title: "Stations", url: "https://example.com/docs/stations" },
    ],
  },
  { term: "Station", description: "A group of docks at one address.", avoid: ["hub"] },
  {
    term: "Checkout",
    description: "Unlocking a bike to start a ride.",
    avoid: ["check-out", "rental start"],
  },
  { term: "eBike", case: "exact", description: "A bike with an electric motor." },
  {
    term: "Day Pass",
    abbr: ["DP"],
    case: "context",
    description: "Unlimited rides for one calendar day.",
  },
  { term: "Recharge point", description: "The battery level at which a bike is sent to charge." },
  { term: "BikeShare", case: "exact", skip: ["lower", "upper"] },
  { term: "Box", avoid: ["crate"] },
  { term: "Station Manager", avoid: [{ word: "SM", why: "Nobody outside ops knows it." }] },
];

export const bike = defineCorpus({ terms: bikeTerms, allow: ["check out our", "roof rack"] });
