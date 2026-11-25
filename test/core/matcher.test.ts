import { describe, expect, it } from "vite-plus/test";
import { defineCorpus } from "../../src/corpus.ts";
import { check, createMatcher, kindOf } from "../../src/matcher.ts";
import type { Finding, TextKind } from "../../src/types.ts";
import { bike } from "./bike.ts";

const matcher = createMatcher(bike);

/** Each finding as `CODE text -> replacement`, the shape most tests compare. */
function hits(text: string, kind?: TextKind, m = matcher): string[] {
  return m
    .check(text, kind)
    .map((finding) => `${finding.code.slice(10)} ${finding.text} -> ${finding.fix?.replace}`);
}

describe("createMatcher", () => {
  it("exposes the corpus and the same check as the check function", () => {
    expect(matcher.corpus).toBe(bike);
    expect(check(matcher, "Return it to the rack.", "sentence")).toEqual(
      matcher.check("Return it to the rack.", "sentence"),
    );
  });

  it("returns nothing for clean text", () => {
    expect(hits("Return the eBike to any dock at the station.")).toEqual([]);
    expect(hits("")).toEqual([]);
  });
});

describe("TERM: spelling variants", () => {
  it("reports a different word split and keeps the writer's capitals", () => {
    expect(hits("Re-order point")).toEqual(["TERM Re-order point -> Reorder point"]);
    expect(hits("the re order point")).toEqual(["TERM re order point -> reorder point"]);
    expect(hits("Re-Order Point")).toEqual(["TERM Re-Order Point -> Reorder Point"]);
    expect(hits("RE-ORDER POINT")).toEqual(["TERM RE-ORDER POINT -> REORDER POINT"]);
    expect(hits("Check-out")).toEqual(["TERM Check-out -> Checkout"]);
    expect(hits("CHECK-OUT")).toEqual(["TERM CHECK-OUT -> CHECKOUT"]);
    expect(hits("check out")).toEqual(["TERM check out -> checkout"]);
    expect(hits("Check-Out")).toEqual(["TERM Check-Out -> Checkout"]);
  });

  it("reports a split of an exact term with the exact form as the fix", () => {
    expect(hits("an e-bike")).toEqual(["TERM e-bike -> eBike"]);
    expect(hits("an E Bike")).toEqual(["TERM E Bike -> eBike"]);
  });

  it("reports an avoid word with a term's key as TERM, not AVOID (decision 10)", () => {
    const findings = matcher.check("Start your check-out");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      code: "GLOSSLINT_TERM",
      text: "check-out",
      fix: { kind: "autofix", replace: "checkout" },
    });
  });

  it("matches plurals ending in s and es, keeping the ending", () => {
    expect(hits("Re-order points")).toEqual(["TERM Re-order points -> Reorder points"]);
    expect(hits("two check-outs")).toEqual(["TERM check-outs -> checkouts"]);
    expect(hits("RE-ORDER POINTS")).toEqual(["TERM RE-ORDER POINTS -> REORDER POINTS"]);
  });

  it("prefers the longest term", () => {
    expect(hits("Ask the Station-Manager")).toEqual(["TERM Station-Manager -> Station Manager"]);
    expect(hits("Ask the station manager")).toEqual([]);
  });

  it("matches up to the longest term plus one word", () => {
    const corpus = defineCorpus({ terms: [{ term: "Bike-share" }] });
    expect(hits("bi ke share", undefined, createMatcher(corpus))).toEqual([
      "TERM bi ke share -> bike-share",
    ]);
    expect(hits("b i ke share", undefined, createMatcher(corpus))).toEqual([]);
  });

  it("does not join words across punctuation or masked code", () => {
    expect(hits("Check, out")).toEqual([]);
    expect(hits("check {x} out")).toEqual([]);
  });

  it("carries the offsets, message, why, term and first link", () => {
    const [finding] = matcher.check("A re-order point.");
    expect(finding).toEqual({
      code: "GLOSSLINT_TERM",
      start: 2,
      end: 16,
      text: "re-order point",
      message:
        '"re-order point" is spelled "reorder point". Reorder point: The battery level at which a bike is sent to charge.',
      fix: { kind: "autofix", replace: "reorder point" },
      term: bike.terms.find((term) => term.term === "Reorder point")!,
    } satisfies Finding);
  });
});

describe("CASE", () => {
  it("exact: reports any other casing", () => {
    expect(hits("Ride an Ebike")).toEqual(["CASE Ebike -> eBike"]);
    expect(hits("Ride an ebike")).toEqual(["CASE ebike -> eBike"]);
    expect(hits("Ride an EBIKE")).toEqual(["CASE EBIKE -> eBike"]);
    expect(hits("Two EBIKES")).toEqual(["CASE EBIKES -> eBikes"]);
    expect(hits("Two eBikes")).toEqual([]);
  });

  it("exact: skip lets whole-word lower and upper casings pass", () => {
    expect(hits("bikeshare and BIKESHARE")).toEqual([]);
    expect(hits("Bikeshare")).toEqual(["CASE Bikeshare -> BikeShare"]);
  });

  it("abbr: always exact, whatever the term's mode, and plurals keep a lowercase s", () => {
    expect(hits("Your Dp")).toEqual(["CASE Dp -> DP"]);
    expect(hits("Two DPs and two DPS")).toEqual([]);
    expect(hits("Two Dps", "label")).toEqual(["CASE Dps -> DPs"]);
  });

  it("abbr: leaves an all-lowercase abbreviation alone, as it is usually another word", () => {
    expect(hits("dp")).toEqual([]);
  });

  it("spelling (default): never reports casing", () => {
    for (const kind of ["label", "sentence", "unknown", "comment"] as const) {
      expect(hits("REORDER POINT and Reorder Point and reorder point", kind)).toEqual([]);
      expect(hits("DOCK and dock and Dock", kind)).toEqual([]);
    }
  });

  it("context: Title Case in labels", () => {
    expect(hits("Day pass", "label")).toEqual(["CASE Day pass -> Day Pass"]);
    expect(hits("Buy a day pass", "label")).toEqual(["CASE day pass -> Day Pass"]);
    expect(hits("Buy a Day Pass", "label")).toEqual([]);
    expect(hits("Day passes", "label")).toEqual(["CASE Day passes -> Day Passes"]);
  });

  it("context: lowercase in sentences, capitalised at a sentence start", () => {
    expect(hits("Buy a Day Pass today.", "sentence")).toEqual(["CASE Day Pass -> day pass"]);
    expect(hits("Buy a day pass today.", "sentence")).toEqual([]);
    expect(hits("Day Pass holders ride free.", "sentence")).toEqual(["CASE Day Pass -> Day pass"]);
    expect(hits("Day pass holders ride free.", "sentence")).toEqual([]);
    expect(hits("It ends at midnight. Day passes renew.", "sentence")).toEqual([]);
    expect(hits('Note: "Day pass" renews.', "sentence")).toEqual([]);
    expect(hits("Ride free. day pass renews.", "sentence")).toEqual(["CASE day pass -> Day pass"]);
  });

  it("context: no casing in unknown text or comments", () => {
    expect(hits("Buy a DAY PASS")).toEqual([]);
    expect(hits("Buy a day Pass", "comment")).toEqual([]);
  });

  it("names the context in the headline", () => {
    expect(matcher.check("Buy a day pass", "label")[0]?.message).toMatch(
      /^"day pass" is written "Day Pass" in labels\./,
    );
    expect(matcher.check("Ride an Ebike")[0]?.message).toMatch(/^"Ebike" is written "eBike"\./);
  });
});

describe("AVOID", () => {
  it("matches in any case and suggests the term in the writer's casing", () => {
    expect(hits("Return it to the rack.")).toEqual(["AVOID rack -> dock"]);
    expect(hits("Rack 4 is free")).toEqual(["AVOID Rack -> Dock"]);
    expect(hits("NO BAY FREE")).toEqual(["AVOID BAY -> DOCK"]);
  });

  it("matches plurals and pluralises the suggestion", () => {
    expect(hits("Racks and bays")).toEqual(["AVOID Racks -> Docks", "AVOID bays -> docks"]);
    expect(hits("three crates")).toEqual(["AVOID crates -> boxes"]);
  });

  it("matches multi-word avoid words across spaces and hyphens", () => {
    expect(hits("on rental start")).toEqual(["AVOID rental start -> checkout"]);
    expect(hits("on rental-start")).toEqual(["AVOID rental-start -> checkout"]);
  });

  it("matches avoid words with two capitals in a row only as written", () => {
    expect(hits("Ask your SM")).toEqual(["AVOID SM -> Station Manager"]);
    expect(hits("Ask your sm or Sm")).toEqual([]);
  });

  it("uses the label casing of a context term in labels", () => {
    const corpus = defineCorpus({
      terms: [{ term: "Day Pass", case: "context", avoid: ["ticket"] }],
    });
    expect(hits("Buy a ticket", "label", createMatcher(corpus))).toEqual([
      "AVOID ticket -> Day Pass",
    ]);
    expect(hits("Buy a ticket.", "sentence", createMatcher(corpus))).toEqual([
      "AVOID ticket -> day pass",
    ]);
  });

  it("carries the avoid word's reason as why, and the message in decision 6 order", () => {
    const [finding] = matcher.check("Return it to the rack.");
    expect(finding).toMatchObject({
      code: "GLOSSLINT_AVOID",
      start: 17,
      end: 21,
      why: "Racks are unpowered.",
      fix: { kind: "suggestion", replace: "dock" },
      see: "https://example.com/docs/docks",
    });
    expect(finding?.message).toBe(
      'Use "dock" instead of "rack". Racks are unpowered. Dock: A powered stand where one bike is locked. A station is a group of docks. See https://example.com/docs/docks',
    );
  });

  it("falls back to the nuance as why when the avoid word has no reason", () => {
    expect(matcher.check("a bay")[0]).toMatchObject({ why: "A station is a group of docks." });
    expect(matcher.check("a bay")[0]?.message).toBe(
      'Use "dock" instead of "bay". Dock: A powered stand where one bike is locked. A station is a group of docks. See https://example.com/docs/docks',
    );
  });

  it("is a pass of its own: it reports an avoid word inside a TERM hit", () => {
    const corpus = defineCorpus({
      terms: [
        { term: "Day Pass", avoid: ["ticket"] },
        { term: "Pass", avoid: ["day-pass"] },
      ],
    });
    // "day-pass" is a spelling of "Day Pass", so it stays TERM; "Pass" gets no AVOID from it.
    expect(hits("a day-pass", undefined, createMatcher(corpus))).toEqual([
      "TERM day-pass -> day pass",
    ]);
    const overlap = defineCorpus({
      terms: [{ term: "Station Manager" }, { term: "Manager", avoid: ["station"] }],
    });
    expect(hits("the station-manager", undefined, createMatcher(overlap))).toEqual([
      "AVOID station -> manager",
      "TERM station-manager -> station manager",
    ]);
  });
});

describe("possessives", () => {
  it("does not report the 's of a possessive or treat it as a plural", () => {
    expect(hits("The eBike's motor")).toEqual([]);
    expect(hits("The Day Pass's price", "label")).toEqual([]);
    expect(hits("The re-order point's value")).toEqual(["TERM re-order point -> reorder point"]);
  });

  it("still reports an avoid word before a possessive", () => {
    expect(hits("The rack's lock")).toEqual(["AVOID rack -> dock"]);
    expect(hits("The racks' locks")).toEqual(["AVOID racks -> docks"]);
  });
});

describe("masks (decision 8)", () => {
  it("skips placeholders, URLs and backtick code", () => {
    expect(hits("Pick {rack} or {{ bay }}")).toEqual([]);
    expect(hits("See https://example.com/rack and `rack`")).toEqual([]);
  });

  it("skips camel, snake and slug tokens", () => {
    expect(hits("rackId, rack_id, RACK_ID, /racks/rack-list and re-order-point-x")).toEqual([]);
  });

  it("keeps a camel token whose key is an exact term", () => {
    expect(hits("an eBike and two eBikes")).toEqual([]);
    expect(hits("an EBike")).toEqual(["CASE EBike -> eBike"]);
  });

  it("checks the words of ICU branches", () => {
    expect(hits("{n, plural, one {# rack} other {# racks}}")).toEqual([
      "AVOID rack -> dock",
      "AVOID racks -> docks",
    ]);
  });
});

describe("allow", () => {
  it("drops a finding inside an allowed phrase, in any case", () => {
    expect(hits("Check out our new bikes")).toEqual([]);
    expect(hits("CHECK OUT OUR bikes")).toEqual([]);
    expect(hits("Mount it on the roof rack")).toEqual([]);
    expect(hits("Two roof racks")).toEqual([]);
  });

  it("keeps findings outside the allowed phrase", () => {
    expect(hits("Check out our rack")).toEqual(["AVOID rack -> dock"]);
    expect(hits("Please check out now")).toEqual(["TERM check out -> checkout"]);
  });

  it("switches off a term from extends", () => {
    const preset = defineCorpus({ terms: [{ term: "Wi-Fi", case: "exact" }] });
    const corpus = defineCorpus({ extends: [preset], allow: ["wifi"] });
    expect(hits("Free WiFi", undefined, createMatcher(preset))).toEqual(["TERM WiFi -> Wi-Fi"]);
    expect(hits("Free WiFi", undefined, createMatcher(corpus))).toEqual([]);
  });
});

describe("terms with symbols", () => {
  const symbols = createMatcher(
    defineCorpus({
      terms: [
        { term: "Node.js", case: "exact" },
        { term: "Notepad++", case: "exact" },
      ],
    }),
  );

  it("matches a term with inner and trailing symbols", () => {
    expect(hits("Built on Node.js.", undefined, symbols)).toEqual([]);
    expect(hits("Built on node.JS", undefined, symbols)).toEqual(["CASE node.JS -> Node.js"]);
    expect(hits("Built on NodeJS", undefined, symbols)).toEqual(["TERM NodeJS -> Node.js"]);
    expect(hits("Open Notepad++ now", undefined, symbols)).toEqual([]);
    expect(hits("Open notepad++ now", undefined, symbols)).toEqual(["CASE notepad -> Notepad"]);
  });
});

describe("kind comment", () => {
  it("reports TERM, AVOID and exact casing, but no context casing", () => {
    expect(hits("// Move the ebike to a rack, then re-order point, Day pass", "comment")).toEqual([
      "CASE ebike -> eBike",
      "AVOID rack -> dock",
      "TERM re-order point -> reorder point",
    ]);
  });
});

describe("kind identifier", () => {
  it("passes an identifier whose words split as the term's do", () => {
    expect(hits("dayPassId", "identifier")).toEqual([]);
    expect(hits("reorderPoint", "identifier")).toEqual([]);
    expect(hits("REORDER_POINT", "identifier")).toEqual([]);
    expect(hits("checkout", "identifier")).toEqual([]);
  });

  it("suggests a rename in the identifier's casing style", () => {
    expect(hits("reOrderPoint", "identifier")).toEqual(["TERM reOrderPoint -> reorderPoint"]);
    expect(hits("getReOrderPoint", "identifier")).toEqual(["TERM ReOrderPoint -> ReorderPoint"]);
    expect(hits("re_order_point", "identifier")).toEqual(["TERM re_order_point -> reorder_point"]);
    expect(hits("RE_ORDER_POINTS", "identifier")).toEqual([
      "TERM RE_ORDER_POINTS -> REORDER_POINTS",
    ]);
    expect(hits("re-order-point", "identifier")).toEqual(["TERM re-order-point -> reorder-point"]);
    expect(hits("daypassId", "identifier")).toEqual(["TERM daypass -> dayPass"]);
    expect(hits("isCheckOut", "identifier")).toEqual(["TERM CheckOut -> Checkout"]);
  });

  it("gives the rename fix kind and a rename headline", () => {
    expect(matcher.check("reOrderPoint", "identifier")[0]).toMatchObject({
      code: "GLOSSLINT_TERM",
      start: 0,
      end: 12,
      fix: { kind: "rename", replace: "reorderPoint" },
    });
    expect(matcher.check("reOrderPoint", "identifier")[0]?.message).toMatch(
      /^Rename "reOrderPoint" to "reorderPoint": the term is "Reorder point"\./,
    );
  });

  it("never checks exact terms or abbreviations, and leaves an all-caps run alone", () => {
    expect(hits("ebikeCount", "identifier")).toEqual([]);
    expect(hits("EBikeCount", "identifier")).toEqual([]);
    expect(hits("dpCount", "identifier")).toEqual([]);
    expect(hits("DAYPASS", "identifier")).toEqual([]);
  });

  it("leaves avoid words alone unless identifierAvoid is set", () => {
    expect(hits("rackCount", "identifier")).toEqual([]);
    const strict = createMatcher(bike, { identifierAvoid: true });
    expect(hits("rackCount", "identifier", strict)).toEqual(["AVOID rack -> dock"]);
    expect(hits("RACKS_TOTAL", "identifier", strict)).toEqual(["AVOID RACKS -> DOCKS"]);
    expect(strict.check("rackCount", "identifier")[0]?.fix?.kind).toBe("rename");
  });
});

describe("kindOf", () => {
  it("reads labels from the key and short text", () => {
    expect(kindOf("buttonLabel", "Buy a day pass")).toBe("label");
    expect(kindOf("pageTitle", "Docks near you")).toBe("label");
    expect(kindOf("columnHeader", "Day pass")).toBe("label");
  });

  it("reads sentences from the key or a final stop", () => {
    expect(kindOf("description", "Docks near you")).toBe("sentence");
    expect(kindOf("tooltip", "Docks near you")).toBe("sentence");
    expect(kindOf(undefined, "Return the bike to any dock.")).toBe("sentence");
    expect(kindOf("buttonLabel", "Return the bike to any dock.")).toBe("sentence");
  });

  it("does not call a long text a label", () => {
    expect(kindOf("label", "Return the bike to any dock within the next ten minutes")).toBe(
      "unknown",
    );
  });

  it("returns unknown without a hint", () => {
    expect(kindOf(undefined, "Docks near you")).toBe("unknown");
    expect(kindOf("value", "Docks near you")).toBe("unknown");
  });
});
