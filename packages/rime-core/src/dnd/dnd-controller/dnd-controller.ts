// The single owner of canvas drag-and-drop. The canvas lives in
// a same-origin srcdoc iframe; a host-document drag library (Pragmatic) can't see
// iframe-originated drags and native HTML5 drag isn't reliably testable, so we
// drive dragging with POINTER EVENTS and resolve every drop through the
// coordinate controller. Two sources:
//   - host palette items (pointerdown on a host element → insert a new block)
//   - canvas leaf blocks (delegated pointerdown in the iframe → move existing)
// Every drop goes through an immutable doc op; we never mutate canvas DOM directly.

import {
  type BaseNode,
  type RimeDoc,
  type NodeId,
  type OpResult,
  isSection,
} from "@nord-forge/rime-model";
import type { CanvasRenderer } from "../../canvas/canvas-renderer/canvas-renderer";
import type {
  DragCoordinateController,
  Point,
} from "../../canvas/coordinate-controller/coordinate-controller";
import type { DragData, DropTarget } from "../dnd-types/dnd-types";
import {
  type ColumnGeometry,
  type DocumentGeometry,
  resolveDropTarget,
  resolveSectionDropTarget,
} from "../resolve-drop-target/resolve-drop-target";
import { DropDetector, type Scheduler } from "../drop-detector/drop-detector";
import { InsertionIndicator } from "../insertion-indicator/insertion-indicator";
import { DragPreview } from "../drag-preview/drag-preview";
import { CleanupRegistry } from "../cleanup-registry/cleanup-registry";

/** Pointer move past this many px (host space) counts as a drag, not a click. */
const DRAG_THRESHOLD_PX = 4;

export interface DndDeps {
  /** The iframe document where canvas drag sources live. */
  canvasDocument: Document;
  /** The host window pointer events are tracked on. Defaults to globalThis. */
  hostWindow?: Pick<Window, "addEventListener" | "removeEventListener">;
  coords: DragCoordinateController;
  renderer: CanvasRenderer;
  /** Where the insertion indicator (chrome overlay) is appended — e.g. the shadow
   *  root, so --rime-* tokens cascade to it. */
  overlayHost: ParentNode & { ownerDocument: Document };
  getDoc: () => RimeDoc;
  createBlock: (blockType: string) => BaseNode;
  /** True for a drag whose block lives at the document level (a band like a hero,
   *  or a column-layout preset's Section subtree). Such drags resolve BETWEEN
   *  sections, not into a column. `blockType` is a palette block type, a preset id,
   *  or an existing node's type (for canvas moves). Defaults to "leaf" if omitted. */
  isSectionLevel?: (blockType: string) => boolean;
  /** Apply an op result: the editor merges patch into doc + undo history + re-renders. */
  dispatch: (op: OpResult) => void;
  /** Announce a completed drop (insert for palette, move for canvas) against the result doc. */
  announceDrop?: (kind: "insert" | "move", resultDoc: RimeDoc, nodeId: NodeId) => void;
  ops: {
    insertNode: (doc: RimeDoc, parentId: NodeId, index: number, node: BaseNode) => OpResult;
    moveNode: (doc: RimeDoc, id: NodeId, newParentId: NodeId, newIndex: number) => OpResult;
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
  /** Document-level geometry (section rects) for section-level drops. */
  docGeometry: DocumentGeometry;
  /** This drag inserts at the document level (a band/preset), not into a column. */
  sectionLevel: boolean;
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
  #preview: DragPreview | null = null;
  // Every transient registration of a single drag (the 4 listeners, the rAF
  // detector, the preview node) routes through here so it is countable + fully
  // disposable — the leak guard asserts this returns to 0 after each drag.
  #dragCleanups = new CleanupRegistry();
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
  registerPaletteItem(element: HTMLElement, blockType: string): () => void {
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
    // End any in-progress drag before starting a new one. Without this, a second
    // pointerdown arriving before the previous drag's pointerup (possible when the
    // machine is slow enough to interleave/coalesce events, e.g. CI) would orphan
    // the prior drag's listeners + preview node in the shared cleanup registry.
    if (this.#active) this.#endDrag();
    // Snapshot geometry ONCE per drag (no live getBoundingClientRect per move —
    // layout-thrash killer). Re-snapshotted on scroll/resize via refresh().
    this.#active = {
      data,
      startX: hostX,
      startY: hostY,
      started: false,
      geometry: this.#columnGeometry(),
      docGeometry: this.#documentGeometry(),
      sectionLevel: this.#isSectionLevel(data),
      lastTarget: null,
    };
    // rAF-gated detection: a burst of moves → one hit-test per frame.
    const detector = new DropDetector(
      (p) => (this.#active ? this.#resolveAt(this.#active, p) : null),
      (target) => this.#onDetect(target),
      this.#deps.scheduler,
    );
    this.#detector = detector;
    this.#dragCleanups.add(() => detector.cancel());

    // Track the pointer in BOTH realms; register each remover with the registry.
    const win = this.#deps.hostWindow ?? (globalThis as unknown as Window);
    const cdoc = this.#deps.canvasDocument;
    win.addEventListener("pointermove", this.#onHostMove);
    this.#dragCleanups.add(() => win.removeEventListener("pointermove", this.#onHostMove));
    win.addEventListener("pointerup", this.#onHostUp);
    this.#dragCleanups.add(() => win.removeEventListener("pointerup", this.#onHostUp));
    cdoc.addEventListener("pointermove", this.#onCanvasMove);
    this.#dragCleanups.add(() => cdoc.removeEventListener("pointermove", this.#onCanvasMove));
    cdoc.addEventListener("pointerup", this.#onCanvasUp);
    this.#dragCleanups.add(() => cdoc.removeEventListener("pointerup", this.#onCanvasUp));
  }

  /** Live count of transient drag cleanups (0 when idle). Test/diagnostic. */
  get activeCleanupCount(): number {
    return this.#dragCleanups.size;
  }

  /** True while a drag is in progress (geometry only needs refreshing then). */
  get isDragging(): boolean {
    return this.#active !== null;
  }

  /** Re-snapshot geometry (call when the canvas scrolls/resizes mid-drag). */
  refreshGeometry(): void {
    if (!this.#active) return;
    this.#active.geometry = this.#columnGeometry();
    this.#active.docGeometry = this.#documentGeometry();
  }

  /** Resolve a host-space point to a drop target via the active drag's resolver. */
  // Resolve against a SPECIFIC active drag (the caller passes it so resolution
  // survives #endDrag() niling #active — e.g. #onUp ends the drag, then resolves).
  #resolveAt(active: ActiveDrag, p: Point): DropTarget | null {
    const canvasPoint = this.#deps.coords.hostToCanvasClient(p);
    return active.sectionLevel
      ? resolveSectionDropTarget(canvasPoint, active.docGeometry)
      : resolveDropTarget(canvasPoint, active.geometry);
  }

  #isSectionLevel(data: DragData): boolean {
    const type = data.source === "palette" ? data.blockType : this.#nodeType(data.nodeId);
    return type !== null && (this.#deps.isSectionLevel?.(type) ?? false);
  }

  /** The type of an existing node by id (for canvas-move drags), or null. */
  #nodeType(id: NodeId): string | null {
    const el = this.#deps.renderer.elementForNode(id);
    return el?.dataset["nodeType"] ?? null;
  }

  #onMove(hostX: number, hostY: number): void {
    if (!this.#active) return;
    if (!this.#active.started) {
      const dx = hostX - this.#active.startX;
      const dy = hostY - this.#active.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      this.#active.started = true;
      // Show the branded preview only once the drag actually begins. Defensively
      // destroy any prior preview first so an interleaved/late event sequence can
      // never orphan a node in the overlay (belt-and-braces over #dragCleanups).
      this.#preview?.destroy();
      const preview = new DragPreview(this.#deps.overlayHost, this.#active.data);
      this.#preview = preview;
      this.#dragCleanups.add(() => preview.destroy());
    }
    this.#preview?.move(hostX, hostY);
    // O(1): stash the point + schedule a frame. Hit-test happens in the detector.
    this.#detector?.onMove({ x: hostX, y: hostY });
  }

  // Called once per frame with the resolved target: position/hide the indicator.
  #onDetect(target: DropTarget | null): void {
    if (!this.#active) return;
    this.#active.lastTarget = target;
    if (!target) {
      this.#indicator.hide();
      return;
    }
    if (this.#active.sectionLevel) {
      this.#indicator.showSection(target, this.#active.docGeometry);
    } else {
      this.#indicator.show(target, this.#active.geometry);
    }
  }

  #onUp(hostX: number, hostY: number): void {
    const active = this.#active;
    this.#endDrag();
    if (!active) return;
    // Treat as a drag if movement crossed the threshold at ANY point — including
    // only at release (fast pointerup before a move event landed; WebKit timing).
    const movedAtUp = Math.hypot(hostX - active.startX, hostY - active.startY) >= DRAG_THRESHOLD_PX;
    if (!active.started && !movedAtUp) return; // a genuine click, not a drag
    // Resolve at the drop point (lastTarget may be stale if no frame ran yet).
    const point: Point = { x: hostX, y: hostY };
    if (!this.#deps.coords.isOverCanvas(point)) return;
    const target = this.#resolveAt(active, point);
    if (target) this.#applyDrop(active.data, target);
  }

  #endDrag(): void {
    // Disposes the 4 listeners, the rAF detector, and the preview node — all
    // routed through the registry, so the live count returns to 0.
    this.#dragCleanups.disposeAll();
    this.#detector = null;
    this.#preview = null;
    this.#indicator.hide();
    this.#active = null;
  }

  #applyDrop(data: DragData, target: DropTarget): void {
    const doc = this.#deps.getDoc();
    try {
      let op: OpResult;
      let kind: "insert" | "move";
      let nodeId: NodeId;
      if (data.source === "palette") {
        const block = this.#deps.createBlock(data.blockType);
        op = this.#deps.ops.insertNode(doc, target.parentId, target.index, block);
        kind = "insert";
        nodeId = block.id;
      } else {
        op = this.#deps.ops.moveNode(doc, data.nodeId, target.parentId, target.index);
        kind = "move";
        nodeId = data.nodeId;
      }
      this.#deps.dispatch(op);
      this.#deps.announceDrop?.(kind, op.doc, nodeId);
    } catch {
      // An invalid drop (e.g. would break column-width invariants) is a no-op.
    }
  }

  /** Read current column + child rects from the rendered DOM (iframe-client space). */
  #columnGeometry(): ColumnGeometry[] {
    const doc = this.#deps.getDoc();
    const columns: ColumnGeometry[] = [];
    for (const section of doc.children) {
      // Skip section-level band blocks (e.g. a hero) — they hold no columns.
      if (!isSection(section)) continue;
      const sectionEl = this.#deps.renderer.elementForNode(section.id);
      const sectionRect = sectionEl?.getBoundingClientRect();
      for (const column of section.children) {
        const colEl = this.#deps.renderer.elementForNode(column.id);
        if (!colEl) continue;
        const colRect = colEl.getBoundingClientRect();
        // A flex column shrinks to its content, so there's no droppable area below
        // the last block (the trailing section padding is dead). Extend the column's
        // HIT rect to its section's vertical bounds so dropping anywhere in the
        // section — incl. the padding below the content — targets this column and
        // appends. X stays the column's own so multi-column sections resolve by X.
        const rect: ColumnGeometry["rect"] = {
          left: colRect.left,
          right: colRect.right,
          top: sectionRect ? Math.min(sectionRect.top, colRect.top) : colRect.top,
          bottom: sectionRect ? Math.max(sectionRect.bottom, colRect.bottom) : colRect.bottom,
        };
        columns.push({
          columnId: column.id,
          rect,
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

  /** Read the document body + its children's (sections/bands) rects for
   *  section-level drops. Falls back to a zero rect if the document element isn't
   *  resolvable (then resolveSectionDropTarget just won't match). */
  #documentGeometry(): DocumentGeometry {
    const doc = this.#deps.getDoc();
    const docEl = this.#deps.renderer.elementForNode(doc.id);
    const zero: DocumentGeometry["rect"] = { top: 0, bottom: 0, left: 0, right: 0 };
    const sections = doc.children
      .map((child) => {
        const el = this.#deps.renderer.elementForNode(child.id);
        return el ? { nodeId: child.id, rect: el.getBoundingClientRect() } : null;
      })
      .filter((s): s is { nodeId: string; rect: DOMRect } => s !== null);
    return {
      documentId: doc.id,
      rect: docEl ? docEl.getBoundingClientRect() : zero,
      sections,
    };
  }
}

export type { DropTarget };
