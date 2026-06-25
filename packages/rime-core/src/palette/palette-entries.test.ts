import { describe, expect, test } from "bun:test";
import { BlockRegistry } from "../blocks/registry";
import { registerCoreBlocks } from "../blocks/core/index";
import { PresetRegistry, registerCorePresets } from "../blocks/column-presets";
import { paletteEntries } from "./palette-entries";

function source() {
  const blocks = new BlockRegistry();
  registerCoreBlocks(blocks);
  const presets = new PresetRegistry();
  registerCorePresets(presets);
  return { blocks, presets };
}

describe("paletteEntries", () => {
  test("groups blocks by category and includes presets", () => {
    const groups = paletteEntries(source());
    const categories = groups.map((g) => g.category);
    expect(categories).toContain("Content");
    expect(categories).toContain("Layout");
    // Presets (Layout category) are present alongside blocks.
    const layout = groups.find((g) => g.category === "Layout")!;
    expect(layout.items.some((i) => i.kind === "preset" && i.id === "preset-2-col")).toBe(true);
    expect(layout.items.some((i) => i.kind === "block" && i.id === "section")).toBe(true);
  });

  test("each item carries id/label/icon from its registry entry", () => {
    const groups = paletteEntries(source());
    const all = groups.flatMap((g) => g.items);
    const text = all.find((i) => i.id === "text")!;
    expect(text.label).toBe("Text");
    expect(text.icon).toBeTruthy();
  });

  test("hides structural types (column, document) that aren't user-droppable", () => {
    const ids = paletteEntries(source())
      .flatMap((g) => g.items)
      .map((i) => i.id);
    expect(ids).not.toContain("column");
    expect(ids).not.toContain("document");
  });

  test("enabledBlocks filters to the allowlist (blocks AND presets)", () => {
    const groups = paletteEntries({ ...source(), enabledBlocks: ["text", "preset-sidebar"] });
    const ids = groups
      .flatMap((g) => g.items)
      .map((i) => i.id)
      .sort();
    expect(ids).toEqual(["preset-sidebar", "text"]);
  });

  test("undefined enabledBlocks shows everything", () => {
    const all = paletteEntries(source()).flatMap((g) => g.items);
    expect(all.length).toBeGreaterThan(8);
  });
});
