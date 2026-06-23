import { describe, expect, test } from "bun:test";
import { EB_TOKENS, type EbTheme } from "./tokens";

describe("EB_TOKENS catalogue", () => {
  test("every token name is an --eb-* custom property with a default", () => {
    for (const [name, value] of Object.entries(EB_TOKENS)) {
      expect(name.startsWith("--eb-")).toBe(true);
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });

  test("includes the core chrome tokens", () => {
    expect(EB_TOKENS["--eb-color-accent"]).toBeDefined();
    expect(EB_TOKENS["--eb-color-border"]).toBeDefined();
    expect(EB_TOKENS["--eb-font-ui"]).toBeDefined();
  });

  test("EbTheme accepts a subset of catalogue keys", () => {
    const theme: EbTheme = { "--eb-color-accent": "#000" };
    expect(theme["--eb-color-accent"]).toBe("#000");
  });
});
