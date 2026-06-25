// Pure drop-target resolution: given a point and the rendered geometry, decide
// which column to drop into (a leaf drop) or where among the document's
// sections/bands (a section-level drop), and at what index. Kept dependency-free
// and free of the live DOM (geometry is injected) so the midpoint/empty logic is
// unit-testable; the live wiring (the controller) and the fast/throttled version
// call it.

import type { DropTarget } from "../dnd-types/dnd-types";

export interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** A column candidate the pointer might be over, with its children's rects. */
export interface ColumnGeometry {
  columnId: string;
  rect: Rect;
  /** Child leaf blocks in document order, with their ids + rects. */
  children: { id: string; rect: Rect }[];
}

/** A document child (section or section-level band) with its rendered rect. */
export interface SectionGeometry {
  nodeId: string;
  rect: Rect;
}

/** The document level: the id to insert under, and each child's rect in order. */
export interface DocumentGeometry {
  documentId: string;
  rect: Rect;
  sections: SectionGeometry[];
}

function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Resolve a leaf drop target from a point (canvas-document coords) against the
 * columns' geometry. Returns the column to drop into and the insertion index
 * (pointer Y vs. each child's vertical midpoint); an empty column yields index 0.
 * Returns null if the point is over no column.
 */
export function resolveDropTarget(
  point: { x: number; y: number },
  columns: ColumnGeometry[],
): DropTarget | null {
  const column = columns.find((c) => contains(c.rect, point.x, point.y));
  if (!column) return null;

  // Empty column → drop at the start.
  if (column.children.length === 0) {
    return { parentId: column.columnId, index: 0 };
  }

  // Insert before the first child whose vertical midpoint is below the pointer;
  // if the pointer is below every child's midpoint, append at the end.
  for (let i = 0; i < column.children.length; i += 1) {
    const child = column.children[i]!;
    const midpoint = (child.rect.top + child.rect.bottom) / 2;
    if (point.y < midpoint) {
      return { parentId: column.columnId, index: i };
    }
  }
  return { parentId: column.columnId, index: column.children.length };
}

/**
 * Resolve a SECTION-LEVEL drop target (for a section-placement block — a band
 * like a hero, or a column-layout preset's Section subtree). The insertion index
 * among the document's children is decided by the pointer Y vs. each section's
 * vertical midpoint; below every midpoint appends at the end. Returns null only
 * if the pointer is outside the document body entirely.
 */
export function resolveSectionDropTarget(
  point: { x: number; y: number },
  doc: DocumentGeometry,
): DropTarget | null {
  if (!contains(doc.rect, point.x, point.y)) return null;
  for (let i = 0; i < doc.sections.length; i += 1) {
    const midpoint = (doc.sections[i]!.rect.top + doc.sections[i]!.rect.bottom) / 2;
    if (point.y < midpoint) {
      return { parentId: doc.documentId, index: i };
    }
  }
  return { parentId: doc.documentId, index: doc.sections.length };
}
