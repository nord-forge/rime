import { describe, expect, test } from "bun:test";
import { createEmptyDoc, createIdFactory, validateDoc } from "@nord-forge/rime-model";
import type { SectionNode } from "@nord-forge/rime-model";
import { MjmlRenderer } from "@nord-forge/rime-mjml";
import { BlockRegistry, registryToMjmlRenderers } from "./registry";
import { registerCoreBlocks } from "./core/index";
import {
  LAYOUT_PRESETS,
  PresetRegistry,
  registerCorePresets,
  presetRegistry as singletonRegistry,
} from "./column-presets";

const ids = () => {
  let n = 0;
  return (prefix = "n") => `${prefix}_${(n += 1)}`;
};

function widths(section: SectionNode): number[] {
  return section.children.map((c) => c.widthPercent);
}

describe("layout preset registry", () => {
  test("registers the four core presets, idempotently", () => {
    const r = new PresetRegistry();
    registerCorePresets(r);
    expect(
      r
        .all()
        .map((p) => p.id)
        .sort(),
    ).toEqual(["preset-2-col", "preset-3-col", "preset-image-text", "preset-sidebar"]);
    const count = r.all().length;
    expect(() => registerCorePresets(r)).not.toThrow();
    expect(r.all()).toHaveLength(count);
  });

  test("every preset is in the Layout category with a label + icon", () => {
    for (const preset of LAYOUT_PRESETS) {
      expect(preset.category).toBe("Layout");
      expect(preset.label).toBeTruthy();
      expect(preset.icon).toBeTruthy();
    }
  });

  test("the core presets are auto-registered on the singleton", () => {
    registerCorePresets();
    expect(singletonRegistry.get("preset-sidebar")?.label).toBe("Sidebar");
  });
});

describe("preset subtrees", () => {
  test.each([
    ["preset-2-col", [50, 50], 0],
    ["preset-3-col", [33, 34, 33], 0],
    ["preset-sidebar", [33, 67], 0],
    ["preset-image-text", [50, 50], 2],
  ] as const)(
    "%s has the right columns/widths and seeded children",
    (id, expectedWidths, seeded) => {
      const preset = LAYOUT_PRESETS.find((p) => p.id === id)!;
      const section = preset.create(ids());
      expect(section.type).toBe("section");
      expect(widths(section)).toEqual([...expectedWidths]);
      expect(widths(section).reduce((a, b) => a + b, 0)).toBe(100);
      const totalChildren = section.children.reduce((n, c) => n + c.children.length, 0);
      expect(totalChildren).toBe(seeded);
    },
  );

  test("image+text seeds an image in the left column and a text in the right", () => {
    const preset = LAYOUT_PRESETS.find((p) => p.id === "preset-image-text")!;
    const section = preset.create(ids());
    expect(section.children[0]!.children[0]!.type).toBe("image");
    expect(section.children[1]!.children[0]!.type).toBe("text");
  });

  test("produces fresh ids on every create (no duplicates across two drops)", () => {
    const preset = LAYOUT_PRESETS.find((p) => p.id === "preset-image-text")!;
    const newId = createIdFactory();
    const a = preset.create(newId);
    const b = preset.create(newId);
    const idsOf = (s: SectionNode): string[] => [
      s.id,
      ...s.children.flatMap((c) => [c.id, ...c.children.map((leaf) => leaf.id)]),
    ];
    const all = [...idsOf(a), ...idsOf(b)];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("preset subtrees validate + export", () => {
  const registry = new BlockRegistry();
  registerCoreBlocks(registry);
  const renderer = new MjmlRenderer({ blockRenderers: registryToMjmlRenderers(registry) });

  test.each(LAYOUT_PRESETS.map((p) => p.id))("a document with the %s subtree is valid", (id) => {
    const preset = LAYOUT_PRESETS.find((p) => p.id === id)!;
    const doc = createEmptyDoc(ids());
    doc.children.push(preset.create(ids()));
    expect(validateDoc(doc).ok).toBe(true);
  });

  test("the image+text preset compiles through the MJML renderer", async () => {
    const preset = LAYOUT_PRESETS.find((p) => p.id === "preset-image-text")!;
    const doc = createEmptyDoc(ids());
    doc.children.push(preset.create(ids()));
    const html = await renderer.render(doc);
    expect(html.toLowerCase()).toContain("<table");
  });
});
