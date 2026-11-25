// The bike-share terms every CLI fixture config reads.
import type { Term } from "../../../../src/types.ts";

export const terms: Term[] = [
  {
    term: "Dock",
    description: "A powered stand where one bike is locked.",
    nuance: "A station is a group of docks.",
    avoid: [{ word: "rack", why: "Racks are unpowered." }, "bay"],
    examples: { good: ["Return the bike to any dock"], bad: ["Return the bike to any rack"] },
    links: [{ title: "Docks", url: "https://example.com/docs/docks" }],
  },
  {
    term: "Station",
    description: "A group of docks at one address.",
    avoid: [{ word: "hub", why: "Riders confuse it with the depot." }],
    examples: { good: ["Find a station near you."], bad: ["Find a hub near you."] },
  },
  { term: "Checkout", description: "Unlocking a bike to start a ride." },
  { term: "eBike", case: "exact", description: "A bike with an electric motor." },
  {
    term: "Day Pass",
    abbr: ["DP"],
    case: "context",
    description: "Unlimited rides for one calendar day.",
  },
  { term: "Reorder point" },
];

export const allow = ["check out our", "roof rack"];
