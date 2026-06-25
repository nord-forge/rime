---
id: ENV-68
title: rAF-coalesce the mid-drag viewport (scroll/resize) path
status: done
priority: P1
milestone: 10 — Release readiness
depends_on: [ENV-21]
blocks: [ENV-49]
package: core
prd: [§10]
estimate: S
---

# ENV-68 — rAF-coalesce the mid-drag viewport (scroll/resize) path

## Context
The audit (verified high-confidence) found the one un-rAF-gated hot path in the
otherwise meticulously frame-budgeted DnD system. `#onViewportChange` in
`rime-editor/rime-editor.ts:230-236` is registered on `window` `scroll` (capture =
true, so it fires for every scroll container) and `resize`, and **synchronously**
calls `coords.invalidate()`, `dnd.refreshGeometry()`, and `richtext.reposition()`.
`refreshGeometry()` walks the whole tree doing `getBoundingClientRect()` per
section/column/leaf — no per-frame coalescing — unlike the move path which is
carefully rAF-gated (see `DropDetector`). Rapid scroll-while-dragging can blow the
≤16.6ms frame budget (§10).

A related, lower finding (verified, severity lowered to low): the leaf-drop detection
scans the columns array twice per detected frame — once in `resolveDropTarget` and
again in the indicator placement. Fold in if cheap.

## Goal
Viewport scroll/resize during a drag does at most one geometry re-walk +
reposition per animation frame, and does no `refreshGeometry` work when no drag is
active.

## Implementation notes
1. Route `#onViewportChange` through a dirty-flag + single `requestAnimationFrame`
   (mirror `DropDetector`'s gating): coalesce bursts of scroll/resize into one
   `invalidate()` + `refreshGeometry()` + `reposition()` per frame.
2. Short-circuit entirely when no drag is in progress (the geometry only matters
   mid-drag; `reposition()` of richtext chrome may still be wanted on scroll — keep
   that, but skip the expensive `refreshGeometry`).
3. Cancel any pending rAF on drag end / disconnect (no leaked frame callback — the
   leak-guard discipline applies).
4. Optional: have the drop resolver return the resolved `ColumnGeometry` so the
   indicator reuses it instead of a second `columns.find(...)` scan.

## Acceptance criteria
- [ ] Scroll/resize during a drag triggers at most one geometry re-walk + reposition
      per frame (coalesced).
- [ ] No `refreshGeometry` work when no drag is active.
- [ ] No leaked rAF after drag end / component disconnect.
- [ ] The DnD perf bench (`bench/dnd-perf.bench.ts`) still meets §10 budgets; e2e green.

## Out of scope
- Re-architecting the geometry snapshot model (DocumentGeometry stays).

## Verification
```bash
bun run test && bun run e2e
cd packages/rime-core && bun run bench:dnd
```

## Definition of done
See `_conventions.md`. Viewport path is rAF-coalesced + drag-gated; budgets hold;
status → `review`.
