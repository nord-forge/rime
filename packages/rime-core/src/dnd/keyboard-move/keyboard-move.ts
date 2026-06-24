// Keyboard reordering — the mandatory parallel input model for users who can't
// drag. Select a leaf block, then move it up/down within its column or
// across to an adjacent column. Like pointer DnD, every move goes through an
// immutable moveNode op, so behaviour + undo stay identical across input methods.
//
// The pure move-resolution logic (resolveMove) is separated from key handling so
// the boundary cases are unit-testable.

import type { RimeDoc, NodeId, OpResult } from "@nord-forge/rime-model";
import type { DropTarget } from "../dnd-types/dnd-types";

export type MoveDirection = "up" | "down" | "into-prev-column" | "into-next-column";

interface LeafLocation {
  sectionIndex: number;
  columnIndex: number;
  leafIndex: number;
  columnId: NodeId;
  columnCount: number;
  leafCount: number;
}

/** Locate a leaf block by id within the document tree. */
export function locateLeaf(doc: RimeDoc, id: NodeId): LeafLocation | null {
  for (let s = 0; s < doc.children.length; s += 1) {
    const section = doc.children[s]!;
    for (let c = 0; c < section.children.length; c += 1) {
      const column = section.children[c]!;
      const leafIndex = column.children.findIndex((leaf) => leaf.id === id);
      if (leafIndex !== -1) {
        return {
          sectionIndex: s,
          columnIndex: c,
          leafIndex,
          columnId: column.id,
          columnCount: section.children.length,
          leafCount: column.children.length,
        };
      }
    }
  }
  return null;
}

/**
 * Resolve where a leaf would move for a direction, or null if not possible.
 * - up/down within the column; at a boundary, carry into the previous/next
 *   column of the SAME section (to its end/start) if one exists.
 * - into-prev/next-column moves to the END of the adjacent column.
 */
export function resolveMove(doc: RimeDoc, id: NodeId, dir: MoveDirection): DropTarget | null {
  const loc = locateLeaf(doc, id);
  if (!loc) return null;
  const section = doc.children[loc.sectionIndex]!;

  const adjacentColumn = (delta: number): { id: NodeId; count: number } | null => {
    const idx = loc.columnIndex + delta;
    if (idx < 0 || idx >= section.children.length) return null;
    const col = section.children[idx]!;
    return { id: col.id, count: col.children.length };
  };

  switch (dir) {
    case "up": {
      if (loc.leafIndex > 0) {
        return { parentId: loc.columnId, index: loc.leafIndex - 1 };
      }
      const prev = adjacentColumn(-1);
      return prev ? { parentId: prev.id, index: prev.count } : null; // to end of prev col
    }
    case "down": {
      if (loc.leafIndex < loc.leafCount - 1) {
        // Move past the next sibling. moveNode removes the item first, so to land
        // one slot LATER the pre-removal target index is leafIndex + 2.
        return { parentId: loc.columnId, index: loc.leafIndex + 2 };
      }
      const next = adjacentColumn(1);
      return next ? { parentId: next.id, index: 0 } : null; // to start of next col
    }
    case "into-prev-column": {
      const prev = adjacentColumn(-1);
      return prev ? { parentId: prev.id, index: prev.count } : null;
    }
    case "into-next-column": {
      const next = adjacentColumn(1);
      return next ? { parentId: next.id, index: next.count } : null;
    }
  }
}

export interface KeyboardMoveDeps {
  getDoc(): RimeDoc;
  dispatch(op: OpResult): void;
  getSelected(): NodeId | null;
  setSelected(id: NodeId | null): void;
  focusNode(id: NodeId): void;
  announce(message: string): void;
  moveNode: (doc: RimeDoc, id: NodeId, parentId: NodeId, index: number) => OpResult;
  /** True when a live rich-text editor is focused (don't hijack arrows then). */
  isEditing?: () => boolean;
}

const KEY_TO_DIRECTION: Record<string, MoveDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "into-prev-column",
  ArrowRight: "into-next-column",
};

export class KeyboardMoveController {
  readonly #deps: KeyboardMoveDeps;

  constructor(deps: KeyboardMoveDeps) {
    this.#deps = deps;
  }

  /** Apply a move via moveNode; update selection + focus + announce. */
  move(id: NodeId, dir: MoveDirection): boolean {
    const doc = this.#deps.getDoc();
    const target = resolveMove(doc, id, dir);
    if (!target) return false;
    try {
      const op = this.#deps.moveNode(doc, id, target.parentId, target.index);
      this.#deps.dispatch(op);
    } catch {
      return false; // invalid move (e.g. would break invariants) → no-op
    }
    this.#deps.setSelected(id);
    this.#deps.focusNode(id);
    this.#deps.announce(this.#describe(dir));
    return true;
  }

  /** Keydown handler attached to the editor shell. Alt+Arrows move the selection. */
  handleKeydown(e: KeyboardEvent): void {
    if (!e.altKey) return;
    if (this.#deps.isEditing?.()) return; // let the text editor own arrows
    const dir = KEY_TO_DIRECTION[e.key];
    if (!dir) return;
    const id = this.#deps.getSelected();
    if (!id) return;
    if (this.move(id, dir)) e.preventDefault();
  }

  #describe(dir: MoveDirection): string {
    switch (dir) {
      case "up":
        return "Moved block up";
      case "down":
        return "Moved block down";
      case "into-prev-column":
        return "Moved block to previous column";
      case "into-next-column":
        return "Moved block to next column";
    }
  }
}
