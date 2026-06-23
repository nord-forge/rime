// Pure drop-target resolution: given a point and the rendered geometry, decide
// which column to drop into and at what index. Kept dependency-free and free of
// the live DOM (geometry is injected) so the midpoint/empty-column logic is
// unit-testable; the live wiring (ENV-19 controller) and the fast/throttled
// version (ENV-20) call it.

import type { DropTarget } from "./dnd-types";

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

function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Resolve a drop target from a point (in canvas-document coords) against the
 * columns' geometry. Returns the column to drop into and the insertion index
 * (decided by the pointer Y vs. each child's vertical midpoint); an empty column
 * yields index 0. Returns null if the point is over no column.
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
