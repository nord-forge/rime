// The single owner of canvas drag-and-drop (PRD §6.6, OD-6). The canvas lives in
// a same-origin srcdoc iframe; a host-document drag library (Pragmatic) can't see
// iframe-originated drags and native HTML5 drag isn't reliably testable, so we
// drive dragging with POINTER EVENTS and resolve every drop through the ENV-17
// coordinate controller. Two sources:
//   - host palette items (pointerdown on a host element → insert a new block)
//   - canvas leaf blocks (delegated pointerdown in the iframe → move existing)
// Every drop goes through an immutable doc op; we never mutate canvas DOM directly.

import type { EnveloppeDoc, LeafBlock, NodeId, OpResult } from "@enveloppe/doc-model";
import type { CanvasRenderer } from "../canvas/canvas-renderer";
import type { DragCoordinateController } from "../canvas/coordinate-controller";
import type { DragData, DropTarget } from "./dnd-types";
import { type ColumnGeometry, resolveDropTarget } from "./resolve-drop-target";

/** Pointer move past this many px (host space) counts as a drag, not a click. */
const DRAG_THRESHOLD_PX = 4;

export interface DndDeps {
  /** The iframe document where canvas drag sources live. */
  canvasDocument: Document;
  coords: DragCoordinateController;
  renderer: CanvasRenderer;
  getDoc: () => EnveloppeDoc;
  createBlock: (blockType: LeafBlock["type"]) => LeafBlock;
  /** Apply an op result: the editor merges patch into doc + undo history + re-renders. */
  dispatch: (op: OpResult) => void;
  ops: {
    insertNode: (doc: EnveloppeDoc, parentId: NodeId, index: number, node: LeafBlock) => OpResult;
    moveNode: (doc: EnveloppeDoc, id: NodeId, newParentId: NodeId, newIndex: number) => OpResult;
  };
}

interface ActiveDrag {
  data: DragData;
  startX: number;
  startY: number;
  started: boolean; // crossed the threshold
}

export class DndController {
  readonly #deps: DndDeps;
  #paletteCleanups = new Set<() => void>();
  #canvasCleanup: (() => void) | null = null;
  #active: ActiveDrag | null = null;
  // Pointer events route to whichever document the pointer is currently over —
  // a drag can traverse BOTH the host (palette) and the iframe (canvas), so we
  // listen in both realms and normalize every coord to host space. Host handlers
  // get host coords already; iframe handlers convert via the coordinate controller.
  readonly #onHostMove = (e: PointerEvent) => this.#onMove(e.clientX, e.clientY);
  readonly #onHostUp = (e: PointerEvent) => this.#onUp(e.clientX, e.clientY);
  readonly #onCanvasMove = (e: PointerEvent) => {
    const h = this.#deps.coords.canvasClientToHost({ x: e.clientX, y: e.clientY });
    this.#onMove(h.x, h.y);
  };
  readonly #onCanvasUp = (e: PointerEvent) => {
    const h = this.#deps.coords.canvasClientToHost({ x: e.clientX, y: e.clientY });
    this.#onUp(h.x, h.y);
  };

  constructor(deps: DndDeps) {
    this.#deps = deps;
    this.#installCanvasSource();
  }

  /** Register a host palette element as a drag source creating `blockType`. */
  registerPaletteItem(element: HTMLElement, blockType: LeafBlock["type"]): () => void {
    const onDown = (e: PointerEvent) => {
      this.#begin({ source: "palette", blockType }, e.clientX, e.clientY);
    };
    element.addEventListener("pointerdown", onDown);
    const cleanup = () => {
      element.removeEventListener("pointerdown", onDown);
      this.#paletteCleanups.delete(cleanup);
    };
    this.#paletteCleanups.add(cleanup);
    return cleanup;
  }

  /** No-op kept for API symmetry: canvas sources are handled by delegation. */
  syncCanvasTargets(): void {
    /* delegation covers all current + future blocks; nothing to re-register */
  }

  destroy(): void {
    this.#canvasCleanup?.();
    this.#canvasCleanup = null;
    // Snapshot first: each cleanup removes itself from the set.
    const cleanups = Array.from(this.#paletteCleanups);
    this.#paletteCleanups.clear();
    for (const cleanup of cleanups) cleanup();
    this.#endDrag();
  }

  // ---- internal ----

  /** Delegated pointerdown inside the iframe: start moving the nearest leaf block. */
  #installCanvasSource(): void {
    const doc = this.#deps.canvasDocument;
    const onDown = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-node-id]");
      const nodeId = el?.dataset["nodeId"];
      const nodeType = el?.dataset["nodeType"];
      // Only leaf blocks are draggable for reordering.
      if (
        !nodeId ||
        !nodeType ||
        nodeType === "document" ||
        nodeType === "section" ||
        nodeType === "column"
      ) {
        return;
      }
      // Canvas pointer coords are iframe-viewport; convert to host space so all
      // tracking happens in one space (the coordinate controller's input).
      const host = this.#deps.coords.canvasClientToHost({ x: e.clientX, y: e.clientY });
      this.#begin({ source: "canvas", nodeId }, host.x, host.y);
    };
    doc.addEventListener("pointerdown", onDown);
    this.#canvasCleanup = () => doc.removeEventListener("pointerdown", onDown);
  }

  #begin(data: DragData, hostX: number, hostY: number): void {
    this.#active = { data, startX: hostX, startY: hostY, started: false };
    window.addEventListener("pointermove", this.#onHostMove);
    window.addEventListener("pointerup", this.#onHostUp);
    this.#deps.canvasDocument.addEventListener("pointermove", this.#onCanvasMove);
    this.#deps.canvasDocument.addEventListener("pointerup", this.#onCanvasUp);
  }

  #onMove(hostX: number, hostY: number): void {
    if (!this.#active || this.#active.started) return;
    const dx = hostX - this.#active.startX;
    const dy = hostY - this.#active.startY;
    if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) this.#active.started = true;
    // (ENV-20 adds throttled hit-testing + insertion indicators here.)
  }

  #onUp(hostX: number, hostY: number): void {
    const active = this.#active;
    this.#endDrag();
    if (!active || !active.started) return; // a click, not a drag
    this.#performDrop(active.data, { x: hostX, y: hostY });
  }

  #endDrag(): void {
    window.removeEventListener("pointermove", this.#onHostMove);
    window.removeEventListener("pointerup", this.#onHostUp);
    this.#deps.canvasDocument.removeEventListener("pointermove", this.#onCanvasMove);
    this.#deps.canvasDocument.removeEventListener("pointerup", this.#onCanvasUp);
    this.#active = null;
  }

  #performDrop(data: DragData, hostPoint: { x: number; y: number }): void {
    if (!this.#deps.coords.isOverCanvas(hostPoint)) return;
    // Resolve in iframe VIEWPORT (client) space so the pointer and the column
    // geometry (getBoundingClientRect, also client-space) agree under scroll.
    const canvasPoint = this.#deps.coords.hostToCanvasClient(hostPoint);
    const target = resolveDropTarget(canvasPoint, this.#columnGeometry());
    if (!target) return;

    const doc = this.#deps.getDoc();
    try {
      const op =
        data.source === "palette"
          ? this.#deps.ops.insertNode(
              doc,
              target.parentId,
              target.index,
              this.#deps.createBlock(data.blockType),
            )
          : this.#deps.ops.moveNode(doc, data.nodeId, target.parentId, target.index);
      this.#deps.dispatch(op);
    } catch {
      // An invalid drop (e.g. would break column-width invariants) is a no-op.
    }
  }

  /** Read current column + child rects from the rendered DOM (iframe-client space). */
  #columnGeometry(): ColumnGeometry[] {
    const doc = this.#deps.getDoc() as {
      children: { children: { id: NodeId; children: { id: NodeId }[] }[] }[];
    };
    const columns: ColumnGeometry[] = [];
    for (const section of doc.children) {
      for (const column of section.children) {
        const colEl = this.#deps.renderer.elementForNode(column.id);
        if (!colEl) continue;
        columns.push({
          columnId: column.id,
          rect: colEl.getBoundingClientRect(),
          children: column.children
            .map((c) => {
              const el = this.#deps.renderer.elementForNode(c.id);
              return el ? { id: c.id, rect: el.getBoundingClientRect() } : null;
            })
            .filter((c): c is { id: string; rect: DOMRect } => c !== null),
        });
      }
    }
    return columns;
  }
}

export type { DropTarget };
