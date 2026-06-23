---
id: ENV-26
title: DnD memory-leak guard
status: done
priority: P0
milestone: 4 — Drag & drop
depends_on: [ENV-19]
blocks: [ENV-49]
package: core
prd: [§10]
estimate: M
---

# ENV-26 — DnD memory-leak guard

## Context
§10 makes "no leaked listeners/observers across drag operations (verified)" a
hard release gate, on top of the one-rich-text-instance and patch-undo
constraints — the canvas memory risk the PRD names is exactly leaked
listeners/observers (§6.4), not the iframe container. DnD is the worst offender:
every render re-registers draggables/drop-targets, every drag adds move handlers
+ a rAF loop + a preview node + an indicator. This ticket builds an automated
guard proving that listener/observer/rAF counts return to baseline after drag
operations, so a future regression that orphans a handler fails CI.

## Goal
An automated test proves that after a sequence of drag operations (and a
canvas re-render cycle), the count of DnD-registered listeners/observers/cleanups
returns to its pre-drag baseline.

## Prerequisites
- ENV-19 done (`DndController` with per-`nodeId` cleanup map + `destroy()`;
  `syncCanvasTargets` idempotency). ENV-20's `DropDetector` (rAF) + indicator if
  merged — guard them too if present.

## Implementation notes
1. **Make cleanups countable** — `DndController` (and `DropDetector`,
   `<eb-drop-indicator>`, drag preview from ENV-22 if present) must funnel every
   `addEventListener`, `requestAnimationFrame`, observer, and Pragmatic
   `draggable`/`dropTargetForElements` registration through a single internal
   registry so it can be counted and fully disposed:
   ```ts
   // packages/core/src/dnd/cleanup-registry.ts
   export class CleanupRegistry {
     private fns = new Set<() => void>();
     add(fn: () => void): () => void { this.fns.add(fn); return () => { fn(); this.fns.delete(fn); }; }
     get size(): number { return this.fns.size; }
     disposeAll(): void { for (const f of this.fns) f(); this.fns.clear(); }
   }
   ```
   Route Pragmatic's returned cleanup fns, `combine(...)` results, the rAF cancel,
   listener removers, and preview/indicator removal through this. Expose
   `dndController.activeCleanupCount` (test-only/internal) = `registry.size`.
2. **`packages/core/src/dnd/leak-guard.test.ts`** — unit/integration test in the
   DOM test env (`happy-dom`/`jsdom` per the harness):
   - Record `baseline = controller.activeCleanupCount` after initial canvas sync.
   - Simulate a full drag (start → moves → drop) N times, plus a
     `CanvasRenderer.update` re-render between drags (which re-runs
     `syncCanvasTargets`).
   - Assert `activeCleanupCount` returns to `baseline` after each drag completes
     (transient handlers removed) and does NOT grow across iterations (stale
     per-node cleanups disposed on re-sync, not accumulated).
   - Assert `controller.destroy()` drives the count to 0.
3. **Listener-count cross-check** — additionally spy on
   `EventTarget.prototype.addEventListener`/`removeEventListener` (and
   `requestAnimationFrame`/`cancelAnimationFrame`) within the test to assert added
   == removed for transient drag handlers, catching any listener that bypasses the
   registry. Restore the spies after.
4. **Playwright leak smoke (optional but recommended)** — a browser test that runs
   many drags and checks no detached drag-preview / indicator nodes remain in the
   DOM and the rAF loop is not running at idle (e.g. a flag the detector exposes).
   Real heap measurement is out of scope; node/handler counts are the proxy §10
   accepts.
5. **Fix any leak found** — if the baseline check fails, the registry will point
   at the offending registration; close it (the whole point of routing everything
   through the registry).

## Acceptance criteria
- [ ] All DnD listeners/observers/rAF/Pragmatic registrations route through
      `CleanupRegistry`; `activeCleanupCount` reflects live cleanups.
- [ ] After each simulated drag, the cleanup count returns to baseline; it does
      not grow across N repeated drags + re-renders.
- [ ] `addEventListener`/`requestAnimationFrame` spies show added == removed for
      transient drag handlers.
- [ ] `DndController.destroy()` disposes everything (count → 0; no live handlers).
- [ ] Re-sync after a canvas re-render disposes stale per-node cleanups (no
      accumulation).

## Out of scope
- Rich-text one-instance memory (ENV-28) — separate §10 lever.
- Frame-rate / latency perf (ENV-21). Full heap profiling — counts are the proxy.

## Verification
```bash
cd packages/core
bun test -- leak-guard      # baseline-return + no-growth + destroy()→0 + add/remove parity
bun run build
bun run lint
bun run e2e -- dnd-leak     # optional browser smoke: no detached preview/indicator nodes, rAF idle after drags
```

## Definition of done
See `_conventions.md`. Drag operations return listener/observer/rAF counts to
baseline, verified automatically; status → `review`.
