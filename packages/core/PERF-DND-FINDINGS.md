# DnD performance findings (ENV-21 / OD-3)

## Committed budget (resolves OD-3)

- **Drop-detection per-frame budget: p95 ≤ 8 ms** (resolve + indicator-position
  work), i.e. half a 16.6 ms frame, leaving headroom for paint.
- **Frame cadence: ≥ 95% of drag frames ≤ 16.6 ms** (~60fps).

Both are enforced by `bench/dnd-perf.bench.ts` (exits non-zero if breached) and
cited by the perf sign-off (ENV-49).

## Reference-machine profile

The low-end ("potato PC") target is approximated in the automated run via Chrome
DevTools Protocol **CPU throttling at 4×** (`Emulation.setCPUThrottlingRate`),
run headless in Chromium. The physical reference-hardware sign-off is ENV-49;
this benchmark is the reproducible proxy gate.

## Measured results (CPU throttle 4×)

Driving a long drag across the realistic newsletter fixture
(`test/fixtures/newsletter.ts` — 6 sections, mixed 1/2-column, ~40 leaf blocks):

| Metric | Gate | Measured |
|---|---|---|
| frames ≤ 16.6 ms | ≥ 95% | **99.2%** |
| detection p95 | ≤ 8 ms | **< 0.1 ms** |

Detection latency is effectively unmeasurable (sub-`performance.now()`-resolution)
because the per-frame work is pure arithmetic over a **pre-snapshotted** column
geometry — no `getBoundingClientRect`, `elementFromPoint`, or layout read happens
per frame during a drag (ENV-20 design). The only per-frame cost is the rAF-gated
midpoint comparison + one style write for the indicator.

## Optimisations relied on (from ENV-19/20, not new here)

- rAF-gated detection: a burst of pointer moves collapses to one hit-test/frame.
- Column + child rects snapshotted once at drag start; re-snapshotted only on
  scroll/resize, never per frame.
- Indicator positioned with a single absolute style write; no reflow-inducing
  reads in the hot path.

No further tightening was required — both gates pass with wide margin.

## How to run

```bash
bun run --filter='@enveloppe/core' bench:dnd
```
