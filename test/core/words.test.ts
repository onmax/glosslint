import { describe, expect, it } from "vite-plus/test";
import { mask, splitWords, termKey, tokenize } from "../../src/words.ts";

const words = (text: string, keep?: Set<string>) => tokenize(text, keep).map((token) => token.word);

describe("splitWords", () => {
  it("splits camel, snake, kebab, slash and spaced text into the same words", () => {
    for (const text of [
      "dayPass",
      "DayPass",
      "day_pass",
      "DAY_PASS",
      "day-pass",
      "day/pass",
      "day pass",
      "  day   pass ",
    ])
      expect(splitWords(text).map((word) => word.toLowerCase())).toEqual(["day", "pass"]);
  });

  it("keeps acronyms together", () => {
    expect(splitWords("eBikeURLParser")).toEqual(["e", "Bike", "URL", "Parser"]);
  });
});

describe("termKey", () => {
  it("joins the words and lowercases them, so spellings of one term share a key", () => {
    expect(termKey("Reorder point")).toBe("reorderpoint");
    expect(termKey("Re-order Point")).toBe("reorderpoint");
    expect(termKey("re_order_point")).toBe("reorderpoint");
    expect(termKey("eBike")).toBe("ebike");
    expect(termKey("Node.js")).toBe("nodejs");
  });
});

describe("tokenize", () => {
  it("returns words with offsets into the original text", () => {
    expect(tokenize("Return to a dock.")).toEqual([
      { word: "Return", key: "return", start: 0, end: 6 },
      { word: "to", key: "to", start: 7, end: 9 },
      { word: "a", key: "a", start: 10, end: 11 },
      { word: "dock", key: "dock", start: 12, end: 16 },
    ]);
  });

  it("keeps dots inside a word but not at its end", () => {
    expect(words("Built on Node.js.")).toEqual(["Built", "on", "Node.js"]);
  });

  it("never makes a token of a possessive 's or a contraction", () => {
    expect(words("The dock's lock isn't on")).toEqual(["The", "dock", "lock", "isn", "on"]);
    expect(words("The dock’s lock")).toEqual(["The", "dock", "lock"]);
    expect(words("the docks' locks")).toEqual(["the", "docks", "locks"]);
  });
});

describe("mask", () => {
  it("keeps every offset", () => {
    const text = "Pick {name} at https://example.com/rack or `rack`";
    expect(mask(text)).toHaveLength(text.length);
  });

  it("masks placeholders, URLs, emails and backtick code", () => {
    expect(words("Hi {name}, {{ user.name }} and {count, number}")).toEqual(["Hi", "and"]);
    expect(words("See https://example.com/rack/bay and www.example.com/bay")).toEqual([
      "See",
      "and",
    ]);
    expect(words("Mail rack@example.com now")).toEqual(["Mail", "now"]);
    expect(words("Run `rack add` or ``bay``")).toEqual(["Run", "or"]);
  });

  it("keeps the words of ICU branches and masks their syntax", () => {
    expect(words("{count, plural, =0 {No docks} one {# dock} other {# docks}}")).toEqual([
      "No",
      "docks",
      "dock",
      "docks",
    ]);
    expect(words("{who, select, rider {Your bike} other {A bike}}")).toEqual([
      "Your",
      "bike",
      "A",
      "bike",
    ]);
  });

  it("masks camel, snake and slug tokens", () => {
    expect(words("dockId and dock_id and DOCK_ID and dock-id-field")).toEqual([
      "and",
      "and",
      "and",
    ]);
    expect(words("open /docks/day-pass or #day-pass")).toEqual(["open", "or"]);
    expect(words("stats.dockCount went up")).toEqual(["stats", "went", "up"]);
  });

  it("keeps a two-part hyphenated word in prose, since that is how spelling variants are written", () => {
    expect(words("the re-order point and check-out")).toEqual(
      ["the", "re-order", "point", "and", "check-out"].flatMap((w) => w.split("-")),
    );
  });

  it("keeps a camel, snake or slug token whose key is an exact term, singular or plural", () => {
    const keep = new Set(["ebike", "daypassid", "bikeshareapp"]);
    expect(words("Ride an eBike or two eBikes", keep)).toEqual([
      "Ride",
      "an",
      "eBike",
      "or",
      "two",
      "eBikes",
    ]);
    expect(words("day_pass_id and bike-share-app", keep)).toEqual(
      ["day_pass_id", "and", "bike-share-app"].flatMap((w) => w.split(/[-_]/)),
    );
  });
});
