import { describe, expect, test } from "bun:test";
import { type TokenItem, filterAndGroup, flatten, matchesQuery } from "./token-filter";

const TOKENS: TokenItem[] = [
  { key: "first_name", label: "First name", source: "Contact" },
  { key: "last_name", label: "Last name", source: "Contact" },
  { key: "order_total", label: "Order total", source: "Order" },
  { key: "unsubscribe_url", label: "Unsubscribe URL" }, // no source
];

describe("matchesQuery", () => {
  test("empty query matches everything", () => {
    expect(matchesQuery(TOKENS[0]!, "")).toBe(true);
    expect(matchesQuery(TOKENS[0]!, "   ")).toBe(true);
  });

  test("matches label, key, or source case-insensitively", () => {
    expect(matchesQuery(TOKENS[0]!, "FIRST")).toBe(true); // label
    expect(matchesQuery(TOKENS[0]!, "_name")).toBe(true); // key
    expect(matchesQuery(TOKENS[0]!, "contact")).toBe(true); // source
    expect(matchesQuery(TOKENS[0]!, "zzz")).toBe(false);
  });
});

describe("filterAndGroup", () => {
  test("groups by source in first-seen order, ungrouped last", () => {
    const groups = filterAndGroup(TOKENS, "");
    expect(groups.map((g) => g.source)).toEqual(["Contact", "Order", ""]);
    expect(groups[0]!.items.map((i) => i.key)).toEqual(["first_name", "last_name"]);
    expect(groups[2]!.items.map((i) => i.key)).toEqual(["unsubscribe_url"]);
  });

  test("filters out non-matching items and drops empty groups", () => {
    const groups = filterAndGroup(TOKENS, "order");
    expect(groups).toHaveLength(1);
    expect(groups[0]!.source).toBe("Order");
    expect(groups[0]!.items.map((i) => i.key)).toEqual(["order_total"]);
  });

  test("empty token list yields no groups", () => {
    expect(filterAndGroup([], "")).toEqual([]);
  });
});

describe("flatten", () => {
  test("returns items in display order across groups", () => {
    const flat = flatten(filterAndGroup(TOKENS, ""));
    expect(flat.map((i) => i.key)).toEqual([
      "first_name",
      "last_name",
      "order_total",
      "unsubscribe_url",
    ]);
  });
});
