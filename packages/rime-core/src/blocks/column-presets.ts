// Column-layout presets: ready-made multi-column structures a designer drops as
// a unit. Unlike a BlockDefinition, a preset has no own node type — it produces a
// Section + Column subtree of existing nodes (built via the model factories so
// every node is valid and gets fresh ids on each drop). They live in their own
// small registry, read by the palette ALONGSIDE the block registry — no
// privileged path: a preset drop goes through the same insertNode as any block,
// it just inserts a section-level subtree.

import {
  createColumn,
  createImageBlock,
  createTextBlock,
  type IdFactory,
  type SectionNode,
} from "@nord-forge/rime-model";
import { ICON_COLS_2, ICON_COLS_3, ICON_IMAGE_TEXT, ICON_SIDEBAR } from "../palette/icons";

export interface LayoutPreset {
  // Stable preset id (NOT a node type — the produced node is a plain "section").
  id: string;
  label: string;
  // Emoji or inline SVG string.
  icon: string;
  // Palette grouping — always "Layout" for these.
  category: string;
  // Build the Section subtree with fresh ids. Columns sum to 100% widthPercent.
  create(newId: IdFactory): SectionNode;
}

function section(newId: IdFactory, columns: SectionNode["children"]): SectionNode {
  return { id: newId("section"), type: "section", style: {}, children: columns };
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "preset-2-col",
    label: "2 columns",
    icon: ICON_COLS_2,
    category: "Layout",
    create: (newId) => section(newId, [createColumn(newId, 50), createColumn(newId, 50)]),
  },
  {
    id: "preset-3-col",
    label: "3 columns",
    icon: ICON_COLS_3,
    category: "Layout",
    // 33 / 34 / 33 = 100 (middle absorbs the remainder).
    create: (newId) =>
      section(newId, [createColumn(newId, 33), createColumn(newId, 34), createColumn(newId, 33)]),
  },
  {
    id: "preset-sidebar",
    label: "Sidebar",
    icon: ICON_SIDEBAR,
    category: "Layout",
    create: (newId) => section(newId, [createColumn(newId, 33), createColumn(newId, 67)]),
  },
  {
    id: "preset-image-text",
    label: "Image + text",
    icon: ICON_IMAGE_TEXT,
    category: "Layout",
    create: (newId) => {
      const left = createColumn(newId, 50);
      left.children.push(createImageBlock(newId));
      const right = createColumn(newId, 50);
      right.children.push(createTextBlock(newId));
      return section(newId, [left, right]);
    },
  },
];

export class PresetRegistry {
  #byId = new Map<string, LayoutPreset>();

  register(preset: LayoutPreset): void {
    if (this.#byId.has(preset.id)) {
      throw new Error(`layout preset "${preset.id}" is already registered`);
    }
    this.#byId.set(preset.id, preset);
  }

  get(id: string): LayoutPreset | undefined {
    return this.#byId.get(id);
  }

  all(): LayoutPreset[] {
    return [...this.#byId.values()];
  }
}

// The single preset registry the editor + palette read alongside blockRegistry.
export const presetRegistry = new PresetRegistry();

export function registerLayoutPreset(preset: LayoutPreset): void {
  presetRegistry.register(preset);
}

// Register the built-in presets. Idempotent — a re-call is a no-op rather than
// throwing on duplicates (mirrors registerCoreBlocks).
export function registerCorePresets(registry: PresetRegistry = presetRegistry): void {
  for (const preset of LAYOUT_PRESETS) {
    if (!registry.get(preset.id)) registry.register(preset);
  }
}
