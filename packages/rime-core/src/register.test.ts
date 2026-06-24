import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { BlockRegistry } from "./blocks/registry";
import { registerCoreBlocks } from "./blocks/core/index";

// register.ts defines the <rime-editor> element on import, which pulls the Lit-
// decorated component — exercised end-to-end by the e2e harness (which imports
// /register). Here we cover the block-registration semantics defineRimeEditor
// drives, against a fresh registry, without instantiating the element.
describe("defineRimeEditor block registration", () => {
  const win = new Window();

  test("coreBlocks (default) registers the built-ins", () => {
    const reg = new BlockRegistry();
    registerCoreBlocks(reg);
    expect(reg.all().length).toBeGreaterThan(0);
    expect(reg.get("text")).toBeDefined();
    expect(reg.get("heading")).toBeDefined();
    expect(reg.get("quote")).toBeDefined();
  });

  test("coreBlocks:false leaves only custom blocks", () => {
    const reg = new BlockRegistry();
    const custom = {
      type: "coupon",
      schema: { fields: [] },
      palette: { label: "Coupon", icon: "🎟️", category: "Marketing", defaults: {} },
      renderCanvas: () => win.document.createElement("div") as unknown as HTMLElement,
      renderExport: () => ({ mjml: "<mj-raw></mj-raw>" }),
    };
    reg.register(custom);
    expect(reg.get("coupon")).toBeDefined();
    expect(reg.get("text")).toBeUndefined();
  });
});
