---
id: ENV-25
title: Cross-browser DnD E2E (WebKit + touch)
status: ready
priority: P0
milestone: 4 — Drag & drop
depends_on: [ENV-20]
blocks: []
package: core
prd: [§9]
estimate: M
---

# ENV-25 — Cross-browser DnD E2E (WebKit + touch)

## Context
DnD is the do-or-die feature and §9 demands cross-browser correctness with
explicit Safari/WebKit coverage; most pointer-event + iframe quirks live there
(R-2). Pragmatic drag-and-drop ships a first-class touch path, which §6.6 calls
out — so this ticket adds a Playwright E2E suite that exercises the full DnD
behaviour (palette→canvas, within/between columns, nested zones, indicators) in
**both** `chromium` and `webkit`, plus a **touch** drag path. It is the
regression net that lets ENV-19/41 changes ship safely.

## Goal
A Playwright DnD E2E suite passes in `chromium` and `webkit`, covering pointer
and touch drags through the nested canvas, against a realistic fixture.

## Prerequisites
- ENV-20 done (drop detection + insertion indicators; the user-visible behaviour
  to assert against).
- ENV-03 Playwright harness (base fixtures, `canvasFrame()` helper to reach the
  iframe document, http server so `srcdoc` is same-origin).
- A realistic newsletter doc fixture (reuse ENV-21's if present, else add one
  under `packages/core/test/fixtures/`).

## Implementation notes
Create under `packages/core/e2e/`:

1. **`dnd.e2e.ts`** — the pointer/mouse suite, run by both Playwright projects
   (`chromium`, `webkit` per `_conventions.md`):
   - **Palette → canvas:** drag a palette item into an empty column → assert a new
     block of that type appears at the expected index (read via `canvasFrame()`
     `[data-node-id]`/`[data-node-type]`).
   - **Reorder within a column:** drag block A below block B → assert order flips
     in the doc/DOM.
   - **Move between columns:** drag a block from column 1 to column 2 → assert new
     parent.
   - **Nested zones:** drop into a section gap vs into a column resolves to the
     right level.
   - **Insertion indicator:** during the drag (mid-move) assert the indicator
     element is present and positioned near the target gap.
   - Drive drags with Playwright's `mouse.move`/`down`/`up` stepped sequence (not
     a single jump) so the move handlers + rAF detection actually run; the drag
     crosses the host→iframe boundary, so target coordinates come from the
     iframe-relative element box translated to page space.
2. **`dnd-touch.e2e.ts`** — the touch path:
   - Use a touch-capable context (`hasTouch: true`) / CDP touch emulation; drive a
     `touchstart → touchmove (stepped) → touchend` drag of a palette item or
     canvas block.
   - Assert the same drop outcome as the mouse path. This specifically guards
     Pragmatic's touch adapter behaviour. Note WebKit + touch is the highest-risk
     combination — it MUST be in the matrix.
3. **Stability discipline** — no arbitrary `waitForTimeout`; wait on observable
   state (the new `[data-node-id]` appearing, the doc-change event, the indicator
   element). Step pointer moves to give rAF detection frames to run. Keep the
   fixture deterministic (fixed ids).
4. **Wire into CI** — this suite runs under the existing `bun run e2e` (ENV-02 CI
   already runs Playwright). Tag it so the DnD suite can be run in isolation
   locally.

## Acceptance criteria
- [ ] Palette→canvas insert, within-column reorder, cross-column move, and nested
      section-vs-column resolution all asserted via the doc/DOM state.
- [ ] Insertion indicator presence/position asserted mid-drag.
- [ ] A **touch** drag path produces the same drop outcome as the mouse path.
- [ ] The entire suite passes in **both** `chromium` and `webkit` (WebKit +
      touch explicitly covered).
- [ ] Drags are stepped (multiple moves) and waits are state-based (no fixed
      sleeps); tests are not flaky across repeated runs.

## Out of scope
- Perf measurement (ENV-21), memory-leak verification (ENV-26).
- Keyboard/ARIA E2E (covered alongside ENV-23/45) — this ticket is pointer/touch.
- New DnD behaviour — this is verification only.

## Verification
```bash
cd packages/core
bunx playwright install chromium webkit
bun run e2e -- dnd            # pointer suite, both projects
bun run e2e -- dnd-touch      # touch suite, both projects
bun run e2e -- dnd --repeat-each=5   # flake check
```

## Definition of done
See `_conventions.md`. DnD E2E green in chromium + webkit incl. touch, non-flaky;
status → `review`.
