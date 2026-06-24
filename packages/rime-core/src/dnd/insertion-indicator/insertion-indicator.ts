// The insertion indicator: a 2px line showing where a dragged block will land.
// It is CHROME (lives in the host overlay, themed by --eb-*), but points at a
// position inside the iframe canvas — so its screen rect is computed from the
// cached canvas geometry and converted to host space via the coordinate
// controller. A plain absolutely-positioned element (lighter than a component).

import type {
  DragCoordinateController,
  Point,
} from "../../canvas/coordinate-controller/coordinate-controller";
import type { ColumnGeometry } from "../resolve-drop-target/resolve-drop-target";
import type { DropTarget } from "../dnd-types/dnd-types";

/** Compute the indicator line (in iframe-client coords) for a resolved target. */
export function indicatorLineFor(
  target: DropTarget,
  columns: ColumnGeometry[],
): { x: number; y: number; width: number } | null {
  const column = columns.find((c) => c.columnId === target.parentId);
  if (!column) return null;

  const left = column.rect.left;
  const width = column.rect.right - column.rect.left;

  // Empty column or insert-at-start: line at the column's top.
  if (column.children.length === 0) {
    return { x: left, y: column.rect.top, width };
  }
  // Insert before child[index]: line at that child's top. Append: below the last.
  if (target.index >= column.children.length) {
    const last = column.children[column.children.length - 1]!;
    return { x: left, y: last.rect.bottom, width };
  }
  const child = column.children[target.index]!;
  return { x: left, y: child.rect.top, width };
}

export class InsertionIndicator {
  readonly #el: HTMLElement;
  readonly #coords: DragCoordinateController;

  constructor(parent: ParentNode & { ownerDocument: Document }, coords: DragCoordinateController) {
    this.#coords = coords;
    this.#el = parent.ownerDocument.createElement("div");
    this.#el.dataset["ebOverlay"] = "drop-indicator";
    this.#el.style.cssText = [
      "position:fixed",
      "block-size:2px",
      "background:var(--eb-color-accent, #5b5bd6)",
      "border-radius:var(--eb-radius, 8px)",
      "pointer-events:none",
      "z-index:2147483647",
      "display:none",
    ].join(";");
    parent.append(this.#el);
  }

  /** Show the indicator for a resolved target using cached column geometry. */
  show(target: DropTarget, columns: ColumnGeometry[]): void {
    const line = indicatorLineFor(target, columns);
    if (!line) {
      this.hide();
      return;
    }
    // iframe-client → host space.
    const topLeft: Point = this.#coords.canvasClientToHost({ x: line.x, y: line.y });
    this.#el.style.insetInlineStart = `${topLeft.x}px`;
    this.#el.style.insetBlockStart = `${topLeft.y}px`;
    this.#el.style.inlineSize = `${line.width}px`;
    this.#el.style.display = "block";
  }

  hide(): void {
    this.#el.style.display = "none";
  }

  destroy(): void {
    this.#el.remove();
  }
}
