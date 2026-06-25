---
id: ENV-26b
title: Drag-preview final-drag teardown leak on slow runners
status: backlog
priority: P2
milestone: 4 — Drag & drop
depends_on: [ENV-22, ENV-26]
blocks: []
package: core
prd: [§10]
estimate: S
---

# ENV-26b — Drag-preview final-drag teardown leak on slow runners

## Context
Surfaced by CI (slow Linux runner) while landing ENV-28. The e2e
`drag-preview.spec.ts › only one preview node exists across repeated drags`
intermittently finds **one** leftover `[data-rime-overlay="drag-preview"]` node in
the overlay after a burst of rapid palette drags. It passes locally (fast
machine) and only flakes under CI load.

ENV-28's controller hardening removed the *multi-node pile-up* (count was 1–2):
- `DndController#begin` now ends any in-progress drag before starting a new one.
- `DragPreview`'s constructor clears any stale `drag-preview` nodes in the overlay.
- `DndController#onMove` destroys a prior preview before creating a new one.

What remains: the **final** drag's preview teardown (`#onUp → #endDrag →
disposeAll`) does not always complete on a slow runner within the test's poll
window, leaving a single orphan. The test is currently **`test.fixme`** (see
`packages/rime-core/e2e/drag-preview.spec.ts`).

## Goal
Final-drag preview teardown is deterministic regardless of machine speed; the
overlay holds **zero** `drag-preview` nodes once a drag fully ends. Re-enable the
quarantined e2e (remove `test.fixme`).

## Likely investigation points
- Whether a late `pointermove`/`pointerup` arrives after `#endDrag` in a realm
  (host vs iframe) whose listener was already removed, or before it was added.
- Whether the preview node is appended to the overlay but the matching
  `#dragCleanups` entry is disposed before append completes (ordering).
- Confirm `CleanupRegistry.disposeAll()` truly removes the DOM node (it calls
  `preview.destroy()` → `el.remove()`), and that `#preview` can't be reassigned
  between create and dispose.

## Acceptance criteria
- [ ] After any sequence of drags (incl. rapid/overlapping, under CPU throttle),
      `[data-rime-overlay="drag-preview"]` count is 0 when idle.
- [ ] The quarantined e2e is un-`fixme`'d and passes in chromium + webkit on CI.
- [ ] ENV-26 leak-guard invariants still hold.

## Verification
```bash
cd packages/rime-core
bunx playwright test drag-preview.spec.ts   # incl. the re-enabled case, chromium+webkit
```
