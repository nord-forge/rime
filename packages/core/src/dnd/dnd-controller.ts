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
import type { DragCoordinateController, Point } from "../canvas/coordinate-controller";
import type { DragData, DropTarget } from "./dnd-types";
import { type ColumnGeometry, resolveDropTarget } from "./resolve-drop-target";
import { DropDetector, type Scheduler } from "./drop-detector";
import { InsertionIndicator } from "./insertion-indicator";

/** Pointer move past this many px (host space) counts as a drag, not a click. */
const DRAG_THRESHOLD_PX = 4;

export interface DndDeps {
  /** The iframe document where canvas drag sources live. */
  canvasDocument: Document;
  coords: DragCoordinateController;
  renderer: CanvasRenderer;
  /** Where the insertion indicator (chrome overlay) is appended — e.g. the shadow
   *  root, so --eb-* tokens cascade to it. */
  overlayHost: ParentNode & { ownerDocument: Document };
  getDoc: () => EnveloppeDoc;
  createBlock: (blockType: LeafBlock["type"]) => LeafBlock;
  /** Apply an op result: the editor merges patch into doc + undo history + re-renders. */
  dispatch: (op: OpResult) => void;
  ops: {
    insertNode: (doc: EnveloppeDoc, parentId: NodeId, index: number, node: LeafBlock) => OpResult;
    moveNode: (doc: EnveloppeDoc, id: NodeId, newParentId: NodeId, newIndex: number) => OpResult;
  };
  /** Injectable rAF (for tests). Defaults to requestAnimationFrame. */
  scheduler?: Scheduler;
}

interface ActiveDrag {
  data: DragData;
  startX: number;
  startY: number;
  started: boolean; // crossed the threshold
  /** Column geometry snapshotted at drag start (re-snapshotted on scroll/resize). */
  geometry: ColumnGeometry[];
  /** Last target resolved this drag — used by drop (no re-hit-test on drop). */
  lastTarget: DropTarget | null;
}

export class DndController {
  readonly #deps: DndDeps;
  readonly #indicator: InsertionIndicator;
  #paletteCleanups = new Set<() => void>();
  #canvasCleanup: (() => void) | null = null;
  #active: ActiveDrag | null = null;
  #detector: DropDetector | null = null;
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
    this.#indicator = new InsertionIndicator(deps.overlayHost, deps.coords);
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
    this.#indicator.destroy();
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
    // Snapshot column geometry ONCE per drag (no live getBoundingClientRect per
    // move — layout-thrash killer). Re-snapshotted on scroll/resize via refresh().
    this.#active = {
      data,
      startX: hostX,
      startY: hostY,
      started: false,
      geometry: this.#columnGeometry(),
      lastTarget: null,
    };
    // rAF-gated detection: a burst of moves → one hit-test per frame.
    this.#detector = new DropDetector(
      (p) => resolveDropTarget(this.#deps.coords.hostToCanvasClient(p), this.#active!.geometry),
      (target) => this.#onDetect(target),
      this.#deps.scheduler,
    );
    window.addEventListener("pointermove", this.#onHostMove);
    window.addEventListener("pointerup", this.#onHostUp);
    this.#deps.canvasDocument.addEventListener("pointermove", this.#onCanvasMove);
    this.#deps.canvasDocument.addEventListener("pointerup", this.#onCanvasUp);
  }

  /** Re-snapshot geometry (call when the canvas scrolls/resizes mid-drag). */
  refreshGeometry(): void {
    if (this.#active) this.#active.geometry = this.#columnGeometry();
  }

  #onMove(hostX: number, hostY: number): void {
    if (!this.#active) return;
    if (!this.#active.started) {
      const dx = hostX - this.#active.startX;
      const dy = hostY - this.#active.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      this.#active.started = true;
    }
    // O(1): stash the point + schedule a frame. Hit-test happens in the detector.
    this.#detector?.onMove({ x: hostX, y: hostY });
  }

  // Called once per frame with the resolved target: position/hide the indicator.
  #onDetect(target: DropTarget | null): void {
    if (!this.#active) return;
    this.#active.lastTarget = target;
    if (target) this.#indicator.show(target, this.#active.geometry);
    else this.#indicator.hide();
  }

  #onUp(hostX: number, hostY: number): void {
    const active = this.#active;
    this.#endDrag();
    if (!active || !active.started) return; // a click, not a drag
    // Use the last target resolved this drag if the pointer hasn't moved since;
    // otherwise resolve at the drop point (covers a fast drop between frames).
    const point: Point = { x: hostX, y: hostY };
    const target =
      active.lastTarget ??
      resolveDropTarget(this.#deps.coords.hostToCanvasClient(point), active.geometry);
    if (target && this.#deps.coords.isOverCanvas(point)) {
      this.#applyDrop(active.data, target);
    }
  }

  #endDrag(): void {
    window.removeEventListener("pointermove", this.#onHostMove);
    window.removeEventListener("pointerup", this.#onHostUp);
    this.#deps.canvasDocument.removeEventListener("pointermove", this.#onCanvasMove);
    this.#deps.canvasDocument.removeEventListener("pointerup", this.#onCanvasUp);
    this.#detector?.cancel();
    this.#detector = null;
    this.#indicator.hide();
    this.#active = null;
  }

  #applyDrop(data: DragData, target: DropTarget): void {
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
