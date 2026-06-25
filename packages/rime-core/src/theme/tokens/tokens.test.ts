import { describe, expect, test } from "bun:test";
import { RIME_TOKENS, type RimeTheme } from "./tokens";

describe("RIME_TOKENS catalogue", () => {
  test("every token name is an --rime-* custom property with a default", () => {
    for (const [name, value] of Object.entries(RIME_TOKENS)) {
      expect(name.startsWith("--rime-")).toBe(true);
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });

  test("includes the core chrome tokens", () => {
    expect(RIME_TOKENS["--rime-color-accent"]).toBeDefined();
    expect(RIME_TOKENS["--rime-color-border"]).toBeDefined();
    expect(RIME_TOKENS["--rime-font-ui"]).toBeDefined();
  });

  test("RimeTheme accepts a subset of catalogue keys", () => {
    const theme: RimeTheme = { "--rime-color-accent": "#000" };
    expect(theme["--rime-color-accent"]).toBe("#000");
  });
});
