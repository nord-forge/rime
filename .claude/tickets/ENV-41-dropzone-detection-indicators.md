---
id: ENV-41
title: Drop-zone detection + insertion indicators
status: ready
priority: P0
milestone: 4 — Drag & drop
depends_on: [ENV-40]
blocks: [ENV-42, ENV-46]
package: core
prd: [§6.6]
estimate: L
---

# ENV-41 — Drop-zone detection + insertion indicators

## Context
The PRD names drop-zone detection as the stated do-or-die: it must be performant
(throttled / `requestAnimationFrame`-disciplined hit-testing) and consistent
across browsers and hardware tiers (§6.6). ENV-40 made drops *correct*; this
ticket makes detection *fast* and gives the user a clear **insertion indicator**
showing exactly where the block will land. The indicator is chrome (lives in the
host, themed by `--eb-*`), but it points at a position inside the iframe canvas,
so it is positioned using the ENV-33 coordinate controller.

## Goal
While dragging, drop-zone detection runs at most once per animation frame and a
themed insertion indicator renders at the resolved drop position, updating
smoothly in Chromium + WebKit.

## Prerequisites
- ENV-40 done (`DndController`, `resolveDropTarget`, host↔iframe bridge).
- ENV-33 `DragCoordinateController` (`canvasToHost` to place a host-space
  indicator over the iframe; `invalidate` on scroll/resize).
- `--eb-*` theming tokens exist (ENV-34) for the indicator styling.

## Implementation notes
Create under `packages/core/src/dnd/`:

1. **`drop-detector.ts`** — wrap detection in a rAF gate so a burst of pointer
   moves collapses to one hit-test per frame:
   ```ts
   export class DropDetector {
     private pending: Point | null = null;
     private frame = 0;
     constructor(private resolve: (p: Point) => DropTarget | null,
                 private onResult: (t: DropTarget | null, p: Point) => void) {}
     /** Cheap: just stash the latest point; never hit-test synchronously here. */
     onMove(p: Point): void {
       this.pending = p;
       if (!this.frame) this.frame = requestAnimationFrame(() => this.flush());
     }
     private flush(): void {
       this.frame = 0;
       const p = this.pending; this.pending = null;
       if (p) this.onResult(this.resolve(p), p);
     }
     cancel(): void { if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0; this.pending = null; }
   }
   ```
   The pointer-move handler MUST do O(1) work (stash + schedule); all
   `elementFromPoint` / rect-math happens in `flush`. Coalesce so we never run
   two hit-tests in one frame.
2. **Cache geometry per drag** — at drag start, snapshot the candidate columns'
   child rects once and reuse them across the drag (invalidate on canvas scroll
   via `coords.invalidate()` + re-snapshot). Midpoint comparison then reads
   cached numbers, not live `getBoundingClientRect()` per move (layout-thrash
   killer). Re-snapshot only on scroll/resize, not per frame.
3. **`insertion-indicator.ts`** — a Lit component `<eb-drop-indicator>` (or a
   plain absolutely-positioned host element if lighter) rendered in the chrome
   overlay layer, NOT inside the iframe.
   - Given a resolved `DropTarget`, compute the screen line: take the gap between
     the relevant child elements inside the iframe, convert their edges to host
     coords via `coords.canvasToHost(...)`, and draw a 2px line (horizontal for
     vertical stacks, vertical for the column gap case).
   - Style strictly from tokens: `background: var(--eb-color-accent)`,
     `border-radius: var(--eb-radius)`; no hard-coded colors.
   - Hide the indicator when `resolveDropTarget` returns `null` (not over a valid
     zone) and on drop/cancel.
4. **Wire into `DndController`** — replace the inline move handling from ENV-40
   with: `onMove → DropDetector.onMove`; `DropDetector.onResult → position
   indicator + remember the target for `onDrop``. Drop uses the last resolved
   target (already computed this frame — do not re-hit-test on drop).
5. **Cross-browser** — Safari/WebKit timing of `requestAnimationFrame` and
   `elementFromPoint` under iframe scroll diverges; the indicator must track the
   pointer with no perceptible lag in both engines. Cover scrolled-canvas in the
   Playwright test.
6. **Cleanup** — the indicator element and any rAF must be torn down on drag end
   and on `DndController.destroy()` (no orphaned frame loop; ENV-47 verifies).

## Acceptance criteria
- [ ] Detection is rAF-gated: the pointer-move handler stashes + schedules only;
      at most one hit-test runs per frame (unit-test the coalescing — N
      synchronous `onMove` calls → one `resolve` per frame).
- [ ] An insertion indicator appears at the resolved drop position and updates as
      the pointer moves (within/between columns, empty column, section gap).
- [ ] The indicator is positioned over the iframe via `coords.canvasToHost` and
      stays correct when the canvas is scrolled.
- [ ] The indicator is themed only via `--eb-*` tokens (no hard-coded colors).
- [ ] Indicator hides when not over a valid drop zone, and on drop/cancel.
- [ ] No live `getBoundingClientRect()` per move — geometry is snapshotted +
      invalidated on scroll/resize.
- [ ] rAF + indicator torn down on drag end / `destroy()`.
- [ ] Works in Chromium + WebKit including scrolled canvas.

## Out of scope
- The actual ms latency budget + measurement on the reference machine (ENV-42).
- Custom drag preview (ENV-43), keyboard path (ENV-44), touch E2E (ENV-46).

## Verification
```bash
cd packages/core
bun test     # DropDetector coalescing (one resolve/frame via fake rAF); indicator position math from injected rects
bun run build
bun run lint
bun run e2e  # chromium + webkit: indicator tracks pointer, correct gap, hides off-zone, correct with canvas scrolled
```

## Definition of done
See `_conventions.md`. rAF-disciplined detection + themed insertion indicator,
cross-browser; status → `review`.
