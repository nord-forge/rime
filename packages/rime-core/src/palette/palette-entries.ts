// Pure assembly of the palette's entries from the block + preset registries,
// grouped by category and filtered by an optional enabledBlocks allowlist. Kept
// DOM-free so the grouping/filter logic is unit-testable; the Lit component just
// renders the result.

import { type BlockRegistry, blockRegistry } from "../blocks/registry";
import { type PresetRegistry, presetRegistry } from "../blocks/column-presets";

// One draggable/addable palette item. `id` is the block type OR preset id — the
// editor's createBlock resolves either. `kind` lets the UI label presets distinctly.
export interface PaletteItem {
  id: string;
  label: string;
  icon: string;
  category: string;
  kind: "block" | "preset";
}

export interface PaletteGroup {
  category: string;
  items: PaletteItem[];
}

export interface PaletteSource {
  blocks?: BlockRegistry;
  presets?: PresetRegistry;
  // Allowlist of block-type / preset ids to show; undefined = show all.
  enabledBlocks?: string[];
}

// Container/structural types users don't drag from the palette (a Column only
// exists inside a Section; the document/section scaffolding is implicit).
const HIDDEN_BLOCK_TYPES = new Set<string>(["column", "document"]);

/** Build category-grouped palette items from the registries, in stable order. */
export function paletteEntries(source: PaletteSource = {}): PaletteGroup[] {
  const blocks = source.blocks ?? blockRegistry;
  const presets = source.presets ?? presetRegistry;
  const allow = source.enabledBlocks ? new Set(source.enabledBlocks) : null;
  const allowed = (id: string) => allow === null || allow.has(id);

  const items: PaletteItem[] = [];
  for (const def of blocks.all()) {
    if (HIDDEN_BLOCK_TYPES.has(def.type)) continue;
    if (!allowed(def.type)) continue;
    items.push({
      id: def.type,
      label: def.palette.label,
      icon: def.palette.icon,
      category: def.palette.category,
      kind: "block",
    });
  }
  for (const preset of presets.all()) {
    if (!allowed(preset.id)) continue;
    items.push({
      id: preset.id,
      label: preset.label,
      icon: preset.icon,
      category: preset.category,
      kind: "preset",
    });
  }

  // Group by category, preserving first-seen category order.
  const order: string[] = [];
  const byCategory = new Map<string, PaletteItem[]>();
  for (const item of items) {
    if (!byCategory.has(item.category)) {
      byCategory.set(item.category, []);
      order.push(item.category);
    }
    byCategory.get(item.category)!.push(item);
  }
  return order.map((category) => ({ category, items: byCategory.get(category)! }));
}
