---
id: ENV-19
title: Integrate Pragmatic drag-and-drop
status: done
priority: P0
milestone: 4 — Drag & drop
depends_on: [ENV-16, ENV-17]
blocks: [ENV-20, ENV-22, ENV-23, ENV-25, ENV-26]
package: core
prd: [§6.6]
estimate: L
---

# ENV-19 — Integrate Pragmatic drag-and-drop

> **Resolved differently (OD-6, 2026-06-23): Pragmatic was DROPPED.** It binds
> drag listeners to the host `document` + uses native HTML5 drag, which the
> same-origin srcdoc iframe canvas defeats (iframe-originated drags never reach
> it; native drag isn't reliably testable cross-browser/touch). Implemented
> instead as **custom pointer-event dragging inside the iframe**, bridged by the
> ENV-17 coordinate controller. All other goals (palette→canvas insert,
> within/between-column reorder, drops via immutable ops, idempotent teardown)
> are met as written. See PRD OD-6 / §6.6.

## Context
Drag-and-drop is the do-or-die feature (§6.6). This ticket wires
`@atlaskit/pragmatic-drag-and-drop` into the canvas so a user can drag a block
from the palette onto the canvas, and reorder leaf blocks within and between
columns, through the **nested** structure section → column → leaf. The hard part
is that the draggable lives in the host document while the drop targets live
**inside the iframe** — so every pointer position must go through the ENV-17
`DragCoordinateController`, and every successful drop must mutate the doc through
ENV-06 immutable operations (never by poking the DOM directly). This ticket
establishes the wiring + drop semantics; the *performant* hit-testing + visual
indicators are ENV-20, and a11y/keyboard is ENV-23/45.

## Goal
A block dragged from the palette drops into a valid canvas location, and an
existing leaf block reorders within/between columns — each drop producing an
ENV-06 patch that updates the doc (and re-renders via ENV-16), in Chromium +
WebKit.

## Prerequisites
- ENV-16 done (`CanvasRenderer` paints the doc; every element has
  `data-node-id` + `data-node-type`; `elementForNode`/`nodeIdAt` exist).
- ENV-17 done (`DragCoordinateController` — `hostToCanvas`, `nodeIdAtHostPoint`,
  `isOverCanvas`, `invalidate`).
- ENV-06 done (`insertNode`, `moveNode`, `removeNode` returning
  `{ doc, patch, inverse }`).
- `@atlaskit/pragmatic-drag-and-drop` added as a runtime dep — **note its gzip
  cost in the PR** (budget; core ≤ ~100 kB gzip). Import only the entry-point
  adapter (`element` + `external` adapters), not extras.

## Implementation notes
Create under `packages/core/src/dnd/`:

1. **`dnd-types.ts`** — the typed payloads carried on drags.
   ```ts
   import type { NodeId, LeafBlock } from "@nord-forge/rime-model";

   // What a palette item offers, and what an existing block carries.
   export type DragData =
     | { source: "palette"; blockType: LeafBlock["type"] } // new block, no id yet
     | { source: "canvas"; nodeId: NodeId };               // existing block being moved

   // A resolved place a block can land.
   export interface DropTarget {
     parentId: NodeId;   // the COLUMN (or section, for section-level) to drop into
     index: number;      // insertion index among that parent's children
   }
   ```
2. **`dnd-controller.ts`** — `DndController`, the single owner of the DnD wiring.
   It is constructed with the coordinate controller, the canvas renderer, and a
   `dispatch` callback that applies an ENV-06 operation result to the editor
   state (so the editor owns the doc + undo stack, ENV-07).
   ```ts
   import { draggable, dropTargetForElements }
     from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
   import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";

   export interface DndDeps {
     coords: DragCoordinateController;
     renderer: CanvasRenderer;
     // Applies an op result; the editor merges patch into doc + undo history.
     dispatch: (op: OpResult) => void; // OpResult = { doc, patch, inverse } from ENV-06
   }

   export class DndController {
     constructor(private deps: DndDeps) {}
     /** Register a palette element as a drag source for `blockType`. */
     registerPaletteItem(el: HTMLElement, blockType: LeafBlock["type"]): () => void;
     /** Make every rendered canvas block draggable + a drop target. Re-run after render. */
     syncCanvasTargets(): void;
     destroy(): void; // tear down ALL registered cleanups (memory; ENV-26)
   }
   ```
3. **Drop target resolution** — on every drag move over the canvas, compute the
   `DropTarget` from the host pointer:
   - Use `coords.nodeIdAtHostPoint(p)` to find the node under the pointer, then
     `closest` up to the nearest column (`data-node-type="column"`); the
     insertion `index` is decided by comparing the pointer Y against the
     midpoints of that column's child rects (above midpoint → before, below →
     after). Empty column → `index: 0`.
   - Nested zones: if the pointer is over a section gap (between columns) resolve
     to a section-level target; if over a column, a leaf-level target. Keep a
     pure helper `resolveDropTarget(point): DropTarget | null` so it is
     unit-testable with injected rects (the *fast/throttled* version is ENV-20 —
     here, correctness first).
4. **Drop → doc mutation (ENV-06 only)** — on `onDrop`:
   ```ts
   const data = source.data as DragData;
   const target = resolveDropTarget(lastPoint);
   if (!target) return;
   const op = data.source === "palette"
     ? insertNode(doc, target.parentId, target.index, createBlock(data.blockType))
     : moveNode(doc, data.nodeId, target.parentId, target.index);
   this.deps.dispatch(op); // editor merges + re-renders via CanvasRenderer.update
   ```
   Never mutate the canvas DOM directly — the re-render flows from the new doc.
   Reject drops that would make an invalid doc (ENV-06 throws → swallow + no-op).
5. **Host ↔ iframe bridge** — palette draggables are host elements; canvas drop
   targets are iframe elements. Pragmatic's element adapter must be initialised
   **inside the iframe document too** (drop targets registered against
   `iframe.contentDocument` elements). Use the `external`/`element` adapters such
   that a host-originated drag is visible to in-iframe drop targets; if a single
   monitor cannot span both documents, run a host monitor that feeds resolved
   points via `coords` and performs the drop logic itself (the coordinate
   controller is the bridge — do not try to make Pragmatic reconcile two
   coordinate spaces).
6. **Re-sync after render** — `CanvasRenderer.update` may add/remove elements;
   `syncCanvasTargets()` must re-register draggable/dropTarget cleanups idempotently
   (track per-`nodeId` cleanup fns in a `Map`, dispose stale ones). This is the
   seam ENV-26 (leak guard) checks.

## Acceptance criteria
- [ ] Dragging a palette item over a column and dropping inserts a new block of
      that type at the correct index via `insertNode` (doc updated, canvas
      re-rendered).
- [ ] Dragging an existing leaf block reorders it within its column (`moveNode`).
- [ ] Dragging a leaf block into a *different* column moves it across (`moveNode`,
      correct new parent + index).
- [ ] Nested resolution works: a drop resolves to the nearest column; section-gap
      drops resolve to a section-level target.
- [ ] Every drop goes through an ENV-06 op (`{ doc, patch, inverse }`); no direct
      canvas DOM mutation; an invalid drop is a no-op.
- [ ] `resolveDropTarget` is unit-tested with injected child rects (above/below
      midpoint, empty column).
- [ ] `destroy()` removes every registered drag/drop cleanup (no leaks).
- [ ] Works in Chromium + WebKit.

## Out of scope
- Throttled/rAF hit-testing + insertion indicators (ENV-20).
- Perf budget measurement (ENV-21), custom drag preview (ENV-22).
- Keyboard reordering + ARIA announcements (ENV-23/45).
- Touch-specific E2E (ENV-25) — basic pointer path here.

## Verification
```bash
cd packages/core
bun test     # resolveDropTarget midpoint/empty-column cases; drop → correct ENV-06 op called
bun run build
bun run lint
bun run e2e  # chromium + webkit: palette→column insert; reorder within; move across columns; doc reflects it
```

## Definition of done
See `_conventions.md`. DnD wired host↔iframe through the coordinate controller,
all drops via ENV-06; bundle still ≤ budget (note Pragmatic's gzip cost);
status → `review`.
