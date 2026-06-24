// Typed payloads carried on drags, and the resolved place a block can land.

import type { LeafBlock, NodeId } from "@nord-forge/rime-model";

/** What a drag carries: a new block from the palette, or an existing canvas block. */
export type DragData =
  | { source: "palette"; blockType: LeafBlock["type"] }
  | { source: "canvas"; nodeId: NodeId };

/** A resolved insertion point: which parent, and the index among its children. */
export interface DropTarget {
  /** The column (or section, for section-level drops) to drop into. */
  parentId: NodeId;
  /** Insertion index among that parent's children. */
  index: number;
}

/** Type guard for the drag payload shape. */
export function isDragData(value: unknown): value is DragData {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v["source"] === "palette") return typeof v["blockType"] === "string";
  if (v["source"] === "canvas") return typeof v["nodeId"] === "string";
  return false;
}
