// Factory helpers that build valid nodes with fresh ids. ID generation is
// injectable so the package stays pure and deterministically testable — no
// Date.now()/Math.random() at module load.

import type {
  ButtonBlock,
  ColumnNode,
  DividerBlock,
  DocumentNode,
  DocumentSettings,
  ImageBlock,
  NodeId,
  SectionNode,
  SpacerBlock,
  TextBlock,
} from "./types";
import { emptyRichText, type RichTextJSON } from "./rich-text";

/** Generates a unique node id; optionally namespaced by `prefix`. */
export type IdFactory = (prefix?: string) => NodeId;

/**
 * Default id factory: a monotonic counter plus a short random suffix, created
 * lazily (the counter lives in the closure, not at module top-level). Pass your
 * own `IdFactory` for fully deterministic output in tests.
 */
export function createIdFactory(seed = 0): IdFactory {
  let counter = seed;
  return (prefix = "n") => {
    counter += 1;
    const rand = Math.floor(Math.random() * 0xffff).toString(16);
    return `${prefix}_${counter.toString(36)}${rand}`;
  };
}

const DEFAULT_SETTINGS: DocumentSettings = {
  contentWidth: 600,
  backgroundColor: "#f4f4f5",
  fontFamily: "Arial, Helvetica, sans-serif",
};

export function createTextBlock(newId: IdFactory, content?: RichTextJSON): TextBlock {
  return {
    id: newId("text"),
    type: "text",
    content: content ?? emptyRichText(),
    style: {},
  };
}

export function createImageBlock(newId: IdFactory, src = "", alt = ""): ImageBlock {
  return { id: newId("image"), type: "image", src, alt, style: {} };
}

export function createButtonBlock(newId: IdFactory, label = "Button", href = "#"): ButtonBlock {
  return { id: newId("button"), type: "button", label, href, style: {} };
}

export function createDividerBlock(newId: IdFactory): DividerBlock {
  return { id: newId("divider"), type: "divider", style: {} };
}

export function createSpacerBlock(newId: IdFactory, height = 24): SpacerBlock {
  return { id: newId("spacer"), type: "spacer", height };
}

export function createColumn(newId: IdFactory, widthPercent = 100): ColumnNode {
  return {
    id: newId("column"),
    type: "column",
    widthPercent,
    style: {},
    children: [],
  };
}

/**
 * Create a section with `columnCount` evenly-sized columns (widths sum to 100,
 * remainder folded into the last column to stay exact).
 */
export function createSection(newId: IdFactory, columnCount = 1): SectionNode {
  const count = Math.max(1, Math.floor(columnCount));
  const base = Math.floor(100 / count);
  const columns: ColumnNode[] = [];
  for (let i = 0; i < count; i += 1) {
    const width = i === count - 1 ? 100 - base * (count - 1) : base;
    columns.push(createColumn(newId, width));
  }
  return { id: newId("section"), type: "section", style: {}, children: columns };
}

/** Create an empty document (no sections) with default settings. */
export function createEmptyDoc(
  newId: IdFactory = createIdFactory(),
  settings: Partial<DocumentSettings> = {},
): DocumentNode {
  return {
    id: newId("document"),
    type: "document",
    settings: { ...DEFAULT_SETTINGS, ...settings },
    children: [],
  };
}
