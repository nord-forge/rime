---
id: ENV-42
title: DnD performance pass + drop-detection budget (OD-3)
status: ready
priority: P0
milestone: 4 — Drag & drop
depends_on: [ENV-41]
blocks: [ENV-101]
package: core
prd: [§10]
estimate: M
---

# ENV-42 — DnD performance pass + drop-detection budget (OD-3)

## Context
§10 makes drag at ~60fps and **bounded drop-detection latency** hard release
gates, measured on a low-end ("potato PC") reference machine. The exact ms budget
is still open as **OD-3** — this ticket *resolves OD-3* by setting the per-frame
drop-detection budget, then measuring ENV-40/41's DnD against it and documenting
the result. Pure measurement + tightening; no new feature surface.

## Goal
A reproducible benchmark proves drag stays at ~60fps and drop-detection latency
stays within a written ms budget on the reference machine; the budget number is
recorded (resolving OD-3) and enforced in the benchmark.

## Prerequisites
- ENV-41 done (rAF-gated `DropDetector`, geometry snapshot, insertion indicator).
- The ENV-04 Playwright harness (for instrumented browser runs).
- A defined "realistic newsletter" doc fixture (multi-section, multi-column,
  dozens of leaf blocks) to drag over — create one if absent under
  `packages/core/test/fixtures/`.

## Implementation notes
1. **Set the budget (OD-3)** — write the number down. Target from §10: "well
   under one frame at 60fps" → a frame is 16.6 ms; set the drop-detection
   (resolve + indicator-position) per-frame budget at **≤ 8 ms on the reference
   machine** (half a frame, leaving headroom for paint). Record the exact chosen
   value + machine spec in the FINDINGS doc (below) and reference it in
   `PRD.md` OD-3 / `board.md`. If measurement forces a different number, set the
   number to the measured-achievable one and justify it — but it MUST be a single
   committed value.
2. **`packages/core/bench/dnd-perf.bench.ts`** — an instrumented drag run:
   - Programmatically drive a drag across the realistic fixture (synthetic
     pointer move sequence covering many columns / gaps).
   - Measure (a) **frame cadence** via `requestAnimationFrame` deltas / the
     Performance API during the drag — assert the share of frames ≤ 16.6 ms stays
     above a threshold (e.g. ≥ 95% of frames), and (b) **detection latency** per
     `DropDetector.flush` via `performance.now()` around `resolve` +
     indicator-position — assert p95 ≤ the OD-3 budget.
   - Use `PerformanceObserver`(longtask) where available to flag jank.
3. **Reference-machine profile** — the low-end target. Approximate it in CI by
   enabling CPU throttling in the Playwright/Chromium run
   (`session.send("Emulation.setCPUThrottlingRate", { rate: 4 })` via CDP) so the
   benchmark is meaningful without owning the physical box; document the real
   hardware spec used for the manual sign-off (ENV-101 consumes this).
4. **Tighten if over budget** — if a gate fails, optimise WITHIN ENV-40/41's
   design (don't redesign): batch DOM reads, avoid forced reflow in the indicator,
   pre-compute column rects, drop redundant style writes. Re-measure. The output
   of this ticket is "green gate + recorded numbers", not new features.
5. **`packages/core/PERF-DND-FINDINGS.md`** — record: chosen OD-3 ms budget,
   reference-machine spec + CPU-throttle factor, measured fps distribution and
   p50/p95 detection latency, and any optimisations applied. ENV-101 (perf
   sign-off) and OD-3 cite this.

## Acceptance criteria
- [ ] A single drop-detection ms budget is committed and written into
      `PERF-DND-FINDINGS.md` + reflected in PRD OD-3 / board (OD-3 resolved).
- [ ] `dnd-perf.bench.ts` drives a drag over the realistic newsletter fixture and
      measures frame cadence + per-frame detection latency.
- [ ] Under CPU throttling emulating the low-end machine, ≥95% of drag frames are
      ≤ 16.6 ms (≈60fps) and p95 detection latency ≤ the committed budget.
- [ ] The benchmark fails (non-zero exit) if either gate is breached, so it can
      gate CI / ENV-101.
- [ ] Findings doc records machine spec, throttle factor, measured numbers, and
      any optimisations.

## Out of scope
- Memory-leak verification (ENV-47) — a separate §10 gate.
- Cross-browser correctness E2E (ENV-46). Rich-text perf (ENV-51).
- Redesigning the detection algorithm — only tighten the existing one.

## Verification
```bash
cd packages/core
bun run bench:dnd     # runs dnd-perf.bench.ts under CPU throttling; prints fps + latency, exits non-zero if over budget
bun test
bun run e2e           # chromium + webkit smoke that the instrumented drag still functions
```

## Definition of done
See `_conventions.md`. OD-3 budget committed, benchmark green on the throttled
reference profile, findings recorded; status → `review`.
