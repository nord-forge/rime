import { describe, expect, test } from "bun:test";
import { TokenRegistry } from "./registry";

describe("TokenRegistry", () => {
  test("registerSource adds grouped tokens, flattened by all()", () => {
    const reg = new TokenRegistry();
    reg.registerSource({
      id: "contact",
      label: "Contact",
      tokens: [
        { key: "first_name", label: "First name" },
        { key: "last_name", label: "Last name" },
      ],
    });
    expect(reg.all()).toEqual([
      { key: "first_name", label: "First name", source: "Contact" },
      { key: "last_name", label: "Last name", source: "Contact" },
    ]);
  });

  test("register adds an ad-hoc token (no source)", () => {
    const reg = new TokenRegistry();
    reg.register({ key: "unsubscribe_url", label: "Unsubscribe URL" });
    expect(reg.all()).toEqual([{ key: "unsubscribe_url", label: "Unsubscribe URL" }]);
  });

  test("bySource groups by source label, ungrouped under empty string", () => {
    const reg = new TokenRegistry();
    reg.registerSource({
      id: "order",
      label: "Order",
      tokens: [{ key: "order_total", label: "Order total" }],
    });
    reg.register({ key: "now", label: "Now" });
    const grouped = reg.bySource();
    expect([...grouped.keys()]).toEqual(["Order", ""]);
    expect(grouped.get("Order")!.map((t) => t.key)).toEqual(["order_total"]);
    expect(grouped.get("")!.map((t) => t.key)).toEqual(["now"]);
  });

  test("rejects a duplicate source id", () => {
    const reg = new TokenRegistry();
    reg.registerSource({ id: "x", label: "X", tokens: [] });
    expect(() => reg.registerSource({ id: "x", label: "X2", tokens: [] })).toThrow(
      /already registered/,
    );
  });

  test("rejects a duplicate token key (across register and source)", () => {
    const reg = new TokenRegistry();
    reg.register({ key: "dup", label: "Dup" });
    expect(() => reg.register({ key: "dup", label: "Dup2" })).toThrow(/already registered/);
    expect(() =>
      reg.registerSource({ id: "s", label: "S", tokens: [{ key: "dup", label: "D" }] }),
    ).toThrow(/already registered/);
  });

  test("rejects empty/whitespace token keys", () => {
    const reg = new TokenRegistry();
    expect(() => reg.register({ key: "", label: "Empty" })).toThrow(/non-empty/);
    expect(() => reg.register({ key: "   ", label: "Spaces" })).toThrow(/non-empty/);
    expect(() =>
      reg.registerSource({ id: "s", label: "S", tokens: [{ key: " ", label: "X" }] }),
    ).toThrow(/non-empty/);
  });

  test("clear empties the registry", () => {
    const reg = new TokenRegistry();
    reg.register({ key: "a", label: "A" });
    reg.clear();
    expect(reg.all()).toEqual([]);
    expect([...reg.bySource().keys()]).toEqual([]);
  });
});
