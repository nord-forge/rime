---
id: ENV-17
title: Coordinate-translation drag controller
status: done
priority: P0
milestone: 3 — Canvas & shell
depends_on: [ENV-15]
blocks: [ENV-19]
package: core
prd: [§6.4]
estimate: M
---

# ENV-17 — Coordinate-translation drag controller

## Context
The host pointer lives in the host document's coordinate space; the canvas content
lives inside the iframe's. Drag-and-drop, drop-zone hit-testing, and selection all
need a **single owner** that translates between those two spaces correctly across
scroll, and across browser quirks — most of which surface in WebKit/Safari (§6.4,
R-2). This ticket builds that controller as the foundation ENV-19 (Pragmatic DnD)
builds on; getting the math in one place avoids every consumer re-deriving (and
re-breaking) it.

## Goal
A single `DragCoordinateController` converts `clientX/Y` ↔ iframe-document
coordinates and answers "what node is under this host pointer?", verified consistent
in Chromium + WebKit.

## Prerequisites
- ENV-15 done (`CanvasController` gives the iframe + its `contentDocument`).
- ENV-16's `nodeIdAt`/`elementForNode` exist for resolving points to nodes (this
  ticket may consume them; if ordering lands ENV-17 first, resolve via
  `contentDocument.elementFromPoint` + `closest("[data-node-id]")` directly).

## Implementation notes
Create under `packages/core/src/`:

1. **`canvas/coordinate-controller.ts`**:
   ```ts
   export interface Point { x: number; y: number; }

   export class DragCoordinateController {
     constructor(private iframe: HTMLIFrameElement) {}

     /** Host clientX/Y → iframe-document coords (accounts for iframe offset + canvas scroll). */
     hostToCanvas(p: Point): Point;
     /** Iframe-document coords → host clientX/Y. */
     canvasToHost(p: Point): Point;
     /** True if a host pointer is over the canvas viewport. */
     isOverCanvas(p: Point): boolean;
     /** Node id under a HOST pointer, or null. Does the translation + hit-test in one call. */
     nodeIdAtHostPoint(p: Point): string | null;
     /** Invalidate cached iframe rect (call on scroll/resize). */
     invalidate(): void;
   }
   ```
2. **The translation** — `hostToCanvas` = subtract the iframe's bounding-client rect
   origin (and any border/padding via `getComputedStyle` if the iframe is styled),
   then add the iframe document's scroll offset:
   ```ts
   const r = this.iframe.getBoundingClientRect();
   const win = this.iframe.contentWindow!;
   return { x: p.x - r.left + win.scrollX, y: p.y - r.top + win.scrollY };
   ```
   `canvasToHost` is the inverse. Use `contentWindow.scrollX/Y` for the **iframe's**
   scroll (the canvas scrolls independently of the host).
3. **Hit-testing** — `nodeIdAtHostPoint`:
   ```ts
   const c = this.hostToCanvas(p);
   const doc = this.iframe.contentDocument!;
   const hit = doc.elementFromPoint(c.x, c.y);            // iframe-LOCAL, no host interference
   return hit?.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId ?? null;
   ```
   Note `elementFromPoint` takes **client** (viewport) coords in the iframe, so pass
   `p.x - r.left`, `p.y - r.top` (pre-scroll) to it — keep a private helper that
   returns viewport-relative iframe coords distinct from document coords, and unit
   test both so the scroll case is unambiguous.
4. **Caching + invalidation** — cache `getBoundingClientRect()` and recompute on a
   listener for host scroll/resize and iframe-content scroll; expose `invalidate()`.
   During an active drag, hit-testing runs every move — keep the per-call work O(1)
   (no layout thrash): read the cached rect, only `elementFromPoint` per call.
5. **WebKit emphasis** — Safari has historically diverged on iframe
   `getBoundingClientRect` under page scroll and on `elementFromPoint` coordinate
   basis. The Playwright test MUST cover: page scrolled, canvas scrolled, and a
   non-zero iframe offset — asserting `nodeIdAtHostPoint` returns the right node in
   **both** chromium and webkit.
6. **No DnD here** — this controller is pure coordinate/hit-test math. Pragmatic
   drag-and-drop integration, drop zones, and indicators are ENV-19/41. Keep this
   independently unit-testable (inject a fake iframe rect in unit tests; real-browser
   asserts via Playwright).

## Acceptance criteria
- [ ] `hostToCanvas`/`canvasToHost` are exact inverses (round-trip a point → same
      point) including when the canvas iframe is scrolled.
- [ ] `nodeIdAtHostPoint` returns the correct `data-node-id` for a host pointer over
      a rendered block, with page scrolled AND canvas scrolled AND iframe offset ≠ 0.
- [ ] `isOverCanvas` correctly reports inside/outside the canvas viewport.
- [ ] `invalidate()` refreshes the cached rect; results stay correct after a resize.
- [ ] Cross-browser test passes in **chromium + webkit** (WebKit is the hard case).
- [ ] No Pragmatic-DnD dependency pulled in by this module.

## Out of scope
- Pragmatic drag-and-drop wiring, drag previews (ENV-19/43).
- Drop-zone detection + insertion indicators (ENV-20).
- Zoom support — note as a future concern; v1 assumes 100% canvas zoom.

## Verification
```bash
cd packages/core
bun test     # inverse law + hit-test with injected rect/scroll fixtures
bun run build
bun run e2e  # chromium + webkit: scrolled page + scrolled canvas + offset iframe → correct node under pointer
```

## Definition of done
See `_conventions.md`. Single coordinate owner, cross-browser-verified; status →
`review`.
