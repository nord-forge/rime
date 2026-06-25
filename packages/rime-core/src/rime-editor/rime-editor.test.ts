import { describe, expect, test } from "bun:test";
import type { RimeConfig, TokenSource } from "./rime-editor";

// The element's DOM behaviour (registration, parts, theme application) is verified
// in the browser by e2e/editor-shell.spec.ts — bun test has no DOM. Here we assert
// the public config CONTRACT type-checks, which is the part that must stay stable.

describe("RimeConfig contract", () => {
  test("accepts theme tokens, enabledBlocks, onImageUpload, tokenSources", () => {
    const config: RimeConfig = {
      theme: { "--rime-color-accent": "#5b5bd6", "--rime-radius": "10px" },
      enabledBlocks: ["text", "image"],
      onImageUpload: async (file: File) => `https://cdn.test/${file.name}`,
      tokenSources: [
        { id: "user", label: "User", tokens: [{ key: "first_name", label: "First name" }] },
      ],
    };
    expect(config.theme?.["--rime-color-accent"]).toBe("#5b5bd6");
    expect(config.enabledBlocks).toEqual(["text", "image"]);
    expect(typeof config.onImageUpload).toBe("function");
  });

  test("an empty config is valid", () => {
    const config: RimeConfig = {};
    expect(config).toEqual({});
  });

  test("TokenSource shape", () => {
    const source: TokenSource = {
      id: "order",
      label: "Order",
      tokens: [{ key: "order_id", label: "Order ID" }],
    };
    expect(source.tokens).toHaveLength(1);
  });
});
