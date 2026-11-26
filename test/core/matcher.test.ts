import { describe, expect, it } from "vite-plus/test";
import { defineCorpus } from "../../src/corpus.ts";
import { classify, kindOf } from "../../src/kind.ts";
import { check, createMatcher } from "../../src/matcher.ts";
import type { Casing, Finding, Term, TextKind } from "../../src/types.ts";
import { bike, bikeTerms } from "./bike.ts";

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
    expect(hits("Re-charge point")).toEqual(["TERM Re-charge point -> Recharge point"]);
    expect(hits("the re charge point")).toEqual(["TERM re charge point -> recharge point"]);
    expect(hits("Re-Charge Point")).toEqual(["TERM Re-Charge Point -> Recharge Point"]);
    expect(hits("RE-CHARGE POINT")).toEqual(["TERM RE-CHARGE POINT -> RECHARGE POINT"]);
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
    expect(hits("Re-charge points")).toEqual(["TERM Re-charge points -> Recharge points"]);
    expect(hits("two check-outs")).toEqual(["TERM check-outs -> checkouts"]);
    expect(hits("RE-CHARGE POINTS")).toEqual(["TERM RE-CHARGE POINTS -> RECHARGE POINTS"]);
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
    const [finding] = matcher.check("A re-charge point.");
    expect(finding).toEqual({
      code: "GLOSSLINT_TERM",
      start: 2,
      end: 17,
      text: "re-charge point",
      message:
        '"re-charge point" is spelled "recharge point". Recharge point: The battery level at which a bike is sent to charge.',
      fix: { kind: "autofix", replace: "recharge point" },
      term: bike.terms.find((term) => term.term === "Recharge point")!,
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
      expect(hits("RECHARGE POINT and Recharge Point and recharge point", kind)).toEqual([]);
      expect(hits("DOCK and dock and Dock", kind)).toEqual([]);
    }
  });

  it("context: Title Case in labels", () => {
    expect(hits("Day pass", "label")).toEqual(["CASE Day pass -> Day Pass"]);
    expect(hits("Buy a day pass", "label")).toEqual(["CASE day pass -> Day Pass"]);
    expect(hits("Buy a Day Pass", "label")).toEqual([]);
    expect(hits("Day passes", "label")).toEqual(["CASE Day passes -> Day Passes"]);
  });

  it("context: a spelling fix takes the label or sentence casing", () => {
    expect(hits("Buy a daypass", "label")).toEqual(["TERM daypass -> Day Pass"]);
    expect(hits("Buy a Daypass today.", "sentence")).toEqual(["TERM Daypass -> day pass"]);
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

  it("falls back to a shorter avoid word when a longer one doesn't apply", () => {
    const m = createMatcher(
      defineCorpus({ terms: [{ term: "Dock", avoid: ["rack", "Rack API"] }] }),
    );
    expect(hits("Use the rack api now", undefined, m)).toEqual(["AVOID rack -> dock"]);
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

  it("takes why from the avoid word's reason, else the term's why, else its nuance", () => {
    const corpus = defineCorpus({
      terms: [
        {
          term: "Dock",
          nuance: "A station is a group of docks.",
          why: 'Riders read "dock" on the stand.',
          avoid: [{ word: "rack", why: "Racks are unpowered." }, "bay"],
        },
        { term: "Station", nuance: "A group of docks.", avoid: ["hub"] },
      ],
    });
    const why = (text: string) => createMatcher(corpus).check(text)[0]?.why;
    expect(why("a rack")).toBe("Racks are unpowered.");
    expect(why("a bay")).toBe('Riders read "dock" on the stand.');
    expect(why("a hub")).toBe("A group of docks.");
    expect(createMatcher(corpus).check("a bay")[0]?.message).toBe(
      'Use "dock" instead of "bay". Riders read "dock" on the stand. A station is a group of docks.',
    );
    const identifier = createMatcher(corpus, { identifierAvoid: true }).check(
      "bayCount",
      "identifier",
    );
    expect(identifier[0]?.why).toBe('Riders read "dock" on the stand.');
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
    expect(hits("The re-charge point's value")).toEqual(["TERM re-charge point -> recharge point"]);
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
    expect(hits("rackId, rack_id, RACK_ID, /racks/rack-list and re-charge-point-x")).toEqual([]);
  });

  it("keeps a camel token whose key is an exact term", () => {
    expect(hits("an eBike and two eBikes")).toEqual([]);
    expect(hits("an EBike")).toEqual(["CASE EBike -> eBike"]);
  });

  it("skips scoped packages, repository refs and lowercase repository slugs", () => {
    const nuxt = createMatcher(defineCorpus({ terms: [{ term: "Nuxt", case: "exact" }] }));
    for (const text of [
      "Install @nuxt/kit first.",
      "This may be removed in \\@nuxt/kit v5.",
      "The builder is [@nuxt/vite-builder](https://example.com).",
      "See nuxt/nuxt#18395 for details.",
      "Pin nuxt/nuxt@v3 for now.",
      "Open a pull request to [nuxt/nuxt](https://github.com/nuxt/nuxt) or nuxt/modules.",
    ])
      expect(hits(text, "sentence", nuxt)).toEqual([]);
    expect(hits("Merged into nuxt/nuxt, then shipped in nuxt 4.", "sentence", nuxt)).toEqual([
      "CASE nuxt -> Nuxt",
    ]);
  });

  it("still reports an avoid word against a slash", () => {
    expect(hits("Find a rack/dock nearby")).toEqual(["AVOID rack -> dock"]);
    expect(hits("See https://registry.npmjs.org/@nuxt/kit?tag=rack")).toEqual([]);
  });

  it("gives a lowercase repository slug no whole-label finding", () => {
    const nuxt = createMatcher(
      defineCorpus({ terms: [{ term: "Nuxt", case: "context" }], wholeLabel: true }),
    );
    expect(hits("nuxt/modules", "label", nuxt)).toEqual([]);
  });

  it("checks the words of ICU branches", () => {
    expect(hits("{n, plural, one {# rack} other {# racks}}")).toEqual([
      "AVOID rack -> dock",
      "AVOID racks -> docks",
    ]);
  });

  it("skips an argument nested in an ICU branch", () => {
    expect(hits("{n, plural, other {Pick {daypass} or a rack}}")).toEqual(["AVOID rack -> dock"]);
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
    expect(hits("Open notepad++ now", undefined, symbols)).toEqual(["CASE notepad++ -> Notepad++"]);
  });
});

describe("terms and abbreviations with leading or trailing symbols", () => {
  const plans = createMatcher(
    defineCorpus({
      terms: [
        { term: "Dock Plus", abbr: ["D+"] },
        { term: "Pass+", case: "exact" },
        { term: "#RideFree", case: "exact" },
      ],
    }),
  );

  /** Applies every autofix, as ESLint's fixer does on each pass. */
  function fixed(text: string): string {
    return plans
      .check(text)
      .filter((finding) => finding.fix?.kind === "autofix")
      .sort((a, b) => b.start - a.start)
      .reduce((out, f) => out.slice(0, f.start) + f.fix!.replace + out.slice(f.end), text);
  }

  it("reports an abbreviation with symbols only where the text holds them", () => {
    expect(hits("Upgrade to D+ today.", undefined, plans)).toEqual([]);
    expect(hits("Use Plan D instead.", undefined, plans)).toEqual([]);
    expect(fixed("Use Plan D instead.")).toBe("Use Plan D instead.");
  });

  it("leaves the bare word of an exact term with symbols alone", () => {
    expect(hits("Buy a pass today.", undefined, plans)).toEqual([]);
    expect(hits("Riders ride free on Sundays.", undefined, plans)).toEqual([]);
  });

  it("reports the casing of a term with symbols over the whole term, and the fix converges", () => {
    expect(hits("Buy a pass+ today.", undefined, plans)).toEqual(["CASE pass+ -> Pass+"]);
    expect(hits("Tag it #ridefree", undefined, plans)).toEqual(["CASE #ridefree -> #RideFree"]);
    const once = fixed("Buy a pass+ and tag it #ridefree.");
    expect(once).toBe("Buy a Pass+ and tag it #RideFree.");
    expect(fixed(once)).toBe(once);
  });
});

describe("terms split across a line break", () => {
  const exact = createMatcher(defineCorpus({ terms: [{ term: "Day Pass", case: "exact" }] }));

  it("passes a correctly cased exact term split across lines", () => {
    expect(hits("Buy a Day\nPass now", undefined, exact)).toEqual([]);
    expect(hits("Buy a Day\r\n  Pass now", undefined, exact)).toEqual([]);
    expect(hits("Ride an\neBike now")).toEqual([]);
  });

  it("reports a wrong casing across lines without a fix that would join them", () => {
    const [finding] = exact.check("Buy a day\r\npass now");
    expect(finding).toMatchObject({ code: "GLOSSLINT_CASE", text: "day\r\npass" });
    expect(finding?.fix).toBeUndefined();
    const [split] = matcher.check("An E\nBike");
    expect(split).toMatchObject({ code: "GLOSSLINT_TERM", text: "E\nBike" });
    expect(split?.fix).toBeUndefined();
  });
});

describe("kind comment", () => {
  it("reports TERM, AVOID and exact casing, but no context casing", () => {
    expect(hits("// Move the ebike to a rack, then re-charge point, Day pass", "comment")).toEqual([
      "CASE ebike -> eBike",
      "AVOID rack -> dock",
      "TERM re-charge point -> recharge point",
    ]);
  });
});

describe("kind identifier", () => {
  it("passes an identifier whose words split as the term's do", () => {
    expect(hits("dayPassId", "identifier")).toEqual([]);
    expect(hits("rechargePoint", "identifier")).toEqual([]);
    expect(hits("RECHARGE_POINT", "identifier")).toEqual([]);
    expect(hits("checkout", "identifier")).toEqual([]);
  });

  it("suggests a rename in the identifier's casing style", () => {
    expect(hits("reChargePoint", "identifier")).toEqual(["TERM reChargePoint -> rechargePoint"]);
    expect(hits("getReChargePoint", "identifier")).toEqual(["TERM ReChargePoint -> RechargePoint"]);
    expect(hits("re_charge_point", "identifier")).toEqual([
      "TERM re_charge_point -> recharge_point",
    ]);
    expect(hits("RE_CHARGE_POINTS", "identifier")).toEqual([
      "TERM RE_CHARGE_POINTS -> RECHARGE_POINTS",
    ]);
    expect(hits("re-charge-point", "identifier")).toEqual([
      "TERM re-charge-point -> recharge-point",
    ]);
    expect(hits("daypassId", "identifier")).toEqual(["TERM daypass -> dayPass"]);
    expect(hits("isCheckOut", "identifier")).toEqual(["TERM CheckOut -> Checkout"]);
  });

  it("takes the casing and separator from the matched words, not the whole name", () => {
    expect(hits("_reChargePoint", "identifier")).toEqual(["TERM reChargePoint -> rechargePoint"]);
    expect(hits("max_reChargePoint", "identifier")).toEqual([
      "TERM reChargePoint -> rechargePoint",
    ]);
    expect(hits("MAX_RE_CHARGE_POINT", "identifier")).toEqual([
      "TERM RE_CHARGE_POINT -> RECHARGE_POINT",
    ]);
    expect(hits("bike-re-charge-point", "identifier")).toEqual([
      "TERM re-charge-point -> recharge-point",
    ]);
    expect(hits("max_daypass", "identifier")).toEqual(["TERM daypass -> day_pass"]);
    expect(hits("_daypass", "identifier")).toEqual(["TERM daypass -> dayPass"]);
    expect(hits("$reChargePoint", "identifier")).toEqual(["TERM reChargePoint -> rechargePoint"]);
    expect(hits("re_charge_point$", "identifier")).toEqual([
      "TERM re_charge_point -> recharge_point",
    ]);
  });

  it("gives the rename fix kind and a rename headline", () => {
    expect(matcher.check("reChargePoint", "identifier")[0]).toMatchObject({
      code: "GLOSSLINT_TERM",
      start: 0,
      end: 13,
      fix: { kind: "rename", replace: "rechargePoint" },
    });
    expect(matcher.check("reChargePoint", "identifier")[0]?.message).toMatch(
      /^Rename "reChargePoint" to "rechargePoint": the term is "Recharge point"\./,
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
    expect(hits("_RACK", "identifier", strict)).toEqual(["AVOID RACK -> DOCK"]);
    expect(hits("rack$Count", "identifier", strict)).toEqual(["AVOID rack -> dock"]);
    expect(strict.check("rackCount", "identifier")[0]?.fix?.kind).toBe("rename");
  });
});

describe("kindOf", () => {
  it("reads labels from the key and short text", () => {
    expect(kindOf({ name: "buttonLabel", text: "Buy a day pass" })).toBe("label");
    expect(kindOf({ name: "pageTitle", text: "Docks near you" })).toBe("label");
  });

  it("reads table headers from the key and short text", () => {
    expect(kindOf({ name: "columnHeader", text: "Day pass" })).toBe("header");
    expect(kindOf({ name: "headerName", text: "Day pass" })).toBe("header");
    expect(kindOf({ name: "columns.dock", text: "Day pass" })).toBe("header");
    expect(kindOf({ name: "th", text: "Day pass" })).toBe("header");
    expect(kindOf({ name: "headerName", text: "Return the bike to any dock." })).toBe("sentence");
  });

  it("reads sentences from the key or a final stop", () => {
    expect(kindOf({ name: "description", text: "Docks near you" })).toBe("sentence");
    expect(kindOf({ name: "tooltip", text: "Docks near you" })).toBe("sentence");
    expect(kindOf({ text: "Return the bike to any dock." })).toBe("sentence");
    expect(kindOf({ name: "buttonLabel", text: "Return the bike to any dock." })).toBe("sentence");
  });

  it("does not call a long text a label", () => {
    expect(
      kindOf({ name: "label", text: "Return the bike to any dock within the next ten minutes" }),
    ).toBe("unknown");
  });

  it("matches whole words of the key only", () => {
    expect(kindOf({ name: "tabLabel", text: "Buy a day pass" })).toBe("label");
    expect(kindOf({ name: "settings.tabs.rides", text: "Ride history" })).toBe("label");
    expect(kindOf({ name: "displayName", text: "Day pass" })).toBe("label");
    expect(kindOf({ name: "tableDescription", text: "Buy a day pass today" })).toBe("sentence");
    expect(kindOf({ name: "stableHint", text: "Docks near you" })).toBe("sentence");
    expect(kindOf({ name: "databaseHelp", text: "Docks near you" })).toBe("sentence");
    expect(kindOf({ name: "rename", text: "Docks near you" })).toBe("unknown");
    expect(kindOf({ name: "stable", text: "Docks near you" })).toBe("unknown");
  });

  it("reads numbered keys and subheadings as labels", () => {
    expect(kindOf({ name: "title1", text: "Docks near you" })).toBe("label");
    expect(kindOf({ name: "label2", text: "Day pass" })).toBe("label");
    expect(kindOf({ name: "subheading", text: "Docks near you" })).toBe("label");
  });

  it("returns unknown without a hint", () => {
    expect(kindOf({ text: "Docks near you" })).toBe("unknown");
    expect(kindOf({ name: "value", text: "Docks near you" })).toBe("unknown");
  });

  it("reads a heading tag as a label", () => {
    expect(kindOf({ name: "h2", text: "Docks near you" })).toBe("label");
  });

  it("places shown text with no telling name by its length and capitals", () => {
    expect(kindOf({ text: "Docks near you", shown: true })).toBe("label");
    expect(kindOf({ text: "There are no docks", shown: true })).toBe("sentence");
    expect(kindOf({ text: "Return the bike to any dock today", shown: true })).toBe("sentence");
    expect(kindOf({ text: "Return the Bike to Any Dock Today", shown: true })).toBe("label");
  });
});

describe("classify", () => {
  it("marks a kind only the shape decided as guessed, and lets a custom kindOf decide first", () => {
    expect(classify({ text: "Docks near you", shown: true })).toEqual({
      kind: "label",
      guessed: true,
    });
    expect(classify({ name: "title", text: "Docks near you", shown: true })).toEqual({
      kind: "label",
      guessed: false,
    });
    const caption = (site: { name?: string }) => (site.name === "caption" ? "label" : undefined);
    expect(classify({ name: "caption", text: "Docks near you" }, caption)).toEqual({
      kind: "label",
      guessed: false,
    });
    expect(classify({ name: "value", text: "Docks near you" }, caption).kind).toBe("unknown");
  });
});

describe("casing", () => {
  const terms = bikeTerms.filter((term) => term.term !== "Day Pass");
  const withCasing = (casing: Casing, dayPass: Partial<Term> = {}, wholeLabel = false) =>
    createMatcher(
      defineCorpus({
        terms: [
          ...terms,
          { term: "Day Pass", abbr: ["DP"], case: "context", avoid: ["ticket"], ...dayPass },
        ],
        casing,
        wholeLabel,
      }),
    );
  const whole = (casing: Casing) => withCasing(casing, {}, true);

  it("headers take the label style by default", () => {
    expect(hits("Day pass", "header")).toEqual(["CASE Day pass -> Day Pass"]);
    expect(hits("Day passes", "header", withCasing({ label: "sentence" }))).toEqual([]);
  });

  it("upper: headers in ALL CAPS, with the headline naming headers", () => {
    const m = withCasing({ header: "upper" });
    expect(hits("Day Pass", "header", m)).toEqual(["CASE Day Pass -> DAY PASS"]);
    expect(hits("DAY PASSES", "header", m)).toEqual([]);
    expect(hits("Day Pass", "label", m)).toEqual([]);
    expect(m.check("Day Pass", "header")[0]?.message).toMatch(
      /^"Day Pass" is written "DAY PASS" in headers\./,
    );
  });

  it("upper: abbreviations, exact terms and spelling fixes fit the capitals", () => {
    const m = withCasing({ header: "upper" });
    expect(hits("DP PRICE", "header", m)).toEqual([]);
    expect(hits("EBIKE", "header", m)).toEqual([]);
    expect(hits("Ebike", "header", m)).toEqual(["CASE Ebike -> eBike"]);
    expect(hits("DAYPASS", "header", m)).toEqual(["TERM DAYPASS -> DAY PASS"]);
    expect(hits("TICKET", "header", m)).toEqual(["AVOID TICKET -> DAY PASS"]);
    expect(hits("Ticket", "header", m)).toEqual(["AVOID Ticket -> DAY PASS"]);
    expect(hits("RACK", "header", m)).toEqual(["AVOID RACK -> DOCK"]);
  });

  it("sentence: labels with one capital at the start", () => {
    const m = withCasing({ label: "sentence" });
    expect(hits("Buy a Day Pass", "label", m)).toEqual(["CASE Day Pass -> day pass"]);
    expect(hits("Day Pass", "label", m)).toEqual(["CASE Day Pass -> Day pass"]);
    expect(hits("Buy a ticket", "label", m)).toEqual(["AVOID ticket -> day pass"]);
  });

  it("lower and as-written in sentences", () => {
    expect(
      hits("Day pass holders ride free.", "sentence", withCasing({ sentence: "lower" })),
    ).toEqual(["CASE Day pass -> day pass"]);
    const asWritten = withCasing({ sentence: "as-written" });
    expect(hits("Buy a day pass today.", "sentence", asWritten)).toEqual([
      "CASE day pass -> Day Pass",
    ]);
    expect(hits("Buy a ticket today.", "sentence", asWritten)).toEqual([
      "AVOID ticket -> Day Pass",
    ]);
  });

  it("a term's casing wins over the corpus's, and its label style reaches headers", () => {
    const m = withCasing(
      { header: "upper" },
      { term: "Day pass", casing: { label: "as-written" } },
    );
    expect(hits("Day Pass", "label", m)).toEqual(["CASE Day Pass -> Day pass"]);
    expect(hits("Day pass", "header", m)).toEqual(["CASE Day pass -> DAY PASS"]);
    const own = withCasing({}, { term: "Day pass", casing: { label: "as-written" } });
    expect(hits("Day Pass", "header", own)).toEqual(["CASE Day Pass -> Day pass"]);
  });

  it("a term with casing and no case is a context term", () => {
    const m = createMatcher(
      defineCorpus({ terms: [{ term: "Return Window", casing: { header: "upper" } }] }),
    );
    expect(hits("Return window", "header", m)).toEqual(["CASE Return window -> RETURN WINDOW"]);
    expect(hits("Return window", "label", m)).toEqual(["CASE Return window -> Return Window"]);
    expect(hits("Mind the Return Window.", "sentence", m)).toEqual([
      "CASE Return Window -> return window",
    ]);
  });

  it("checks only the term in a label unless wholeLabel is set, whatever casing says", () => {
    expect(hits("Day pass price", "label")).toEqual(["CASE Day pass -> Day Pass"]);
    expect(hits("Day pass price", "label", withCasing({ label: "title" }))).toEqual([
      "CASE Day pass -> Day Pass",
    ]);
    expect(hits("Day pass price", "label", whole({ label: "sentence" }))).toEqual([]);
  });

  it("with wholeLabel, a label or header follows its style as a whole, holding the term fixes", () => {
    const title = whole({});
    expect(hits("Buy a day pass", "label", title)).toEqual(["CASE day pass -> Day Pass"]);
    expect(hits("Day pass price", "label", title)).toEqual([
      "CASE Day pass -> undefined",
      "CASE Day pass price -> Day Pass Price",
    ]);
    expect(title.check("Day pass price", "label")[1]?.message).toBe(
      '"Day Pass price" is written "Day Pass Price": labels are in Title Case.',
    );
    expect(hits("Day Pass price", "header", whole({ header: "upper" }))).toEqual([
      "CASE Day Pass -> undefined",
      "CASE Day Pass price -> DAY PASS PRICE",
    ]);
    expect(hits("Buy a Day Pass", "label", title)).toEqual([]);
    expect(hits("{count} day pass | {count} day passes", "label", title)).toEqual([
      "CASE day pass -> Day Pass",
      "CASE day passes -> Day Passes",
    ]);
    expect(hits("Return the bike to a dock", "label", title)).toEqual([]);
    expect(hits("Rentals - at another dock day pass (from app)", "label", title)).toEqual([
      "CASE Rentals - at another dock day pass (from app) -> Rentals - At Another Dock Day Pass (from app)",
      "CASE day pass -> undefined",
    ]);
  });

  it("leaves comments and unknown text alone", () => {
    const m = withCasing({ label: "upper", header: "upper", sentence: "upper" });
    expect(hits("Buy a day pass", undefined, m)).toEqual([]);
    expect(hits("Buy a day pass", "comment", m)).toEqual([]);
  });
});

describe("sentence starts and replacements", () => {
  it("a word after e.g., a term's own period or a lowercase colon starts no sentence", () => {
    expect(hits("Ride often, e.g. day pass holders.", "sentence")).toEqual([]);
    expect(hits("Ride often, e.g. Day Pass holders.", "sentence")).toEqual([
      "CASE Day Pass -> day pass",
    ]);
    expect(hits("Included: day pass", "sentence")).toEqual([]);
    expect(hits("Included: Day Pass", "sentence")).toEqual(["CASE Day Pass -> Day pass"]);
    const hrs = createMatcher(
      defineCorpus({ terms: [...bikeTerms, { term: "hrs.", case: "exact", avoid: ["hours"] }] }),
    );
    expect(hits("Valid for 24 hrs. day pass holders ride free.", "sentence", hrs)).toEqual([]);
  });

  it("each plural form after | starts a sentence", () => {
    expect(hits("Day pass for {count} day | Day pass for {count} days", "sentence")).toEqual([]);
    expect(hits("{count} day | day pass for {count} days", "sentence")).toEqual([
      "CASE day pass -> Day pass",
    ]);
  });

  it("a replacement ending in a period takes the sentence's own period", () => {
    const hrs = createMatcher(
      defineCorpus({ terms: [{ term: "hrs.", case: "exact", avoid: ["hours"] }] }),
    );
    expect(hits("Rides last 2 hours.", "sentence", hrs)).toEqual(["AVOID hours. -> hrs."]);
    expect(hits("Rides last 2 hours here.", "sentence", hrs)).toEqual(["AVOID hours -> hrs."]);
  });

  it("an avoid word in capitals asks for capitals unless the avoid word is an acronym", () => {
    expect(hits("RETURN TO THE RACK")).toEqual(["AVOID RACK -> DOCK"]);
    expect(hits("Ask the SM")).toEqual(["AVOID SM -> Station Manager"]);
  });

  it("offers no replacement that would repeat the word beside it", () => {
    expect(hits("a box crate")).toEqual([]);
    expect(hits("a wooden crate")).toEqual(["AVOID crate -> box"]);
  });
});
