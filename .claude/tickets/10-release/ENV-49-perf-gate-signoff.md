---
id: ENV-49
title: Perf gate sign-off (§10 budgets)
status: done
priority: P0
milestone: 10 — Release readiness
depends_on: [ENV-21, ENV-26, ENV-28]
blocks: [ENV-52]
package: root
prd: [§10]
estimate: M
---

# ENV-49 — Perf gate sign-off (§10 budgets)

## Context
The §10 performance budgets are **hard release gates**, measured on a low-end ("potato
PC") reference machine as well as a high-end one. This ticket is the formal sign-off
that all of them are met before release: 60fps drag, bounded drop-detection latency, a
single live rich-text instance, no leaked listeners/observers across drag ops, and
`@nord-forge/rime-core` ≤ ~100 kB gzip. Most are verified by upstream tickets — this collects
the evidence, runs the gates on the reference machine, and records pass/fail.

## Goal
A recorded sign-off showing every §10 budget passes on the low-end reference machine
(and high-end), with the measurements captured and the core bundle confirmed within
budget.

## Prerequisites
- ENV-21 done (DnD perf pass: 60fps drag + the OD-3 ms drop-detection budget set).
- ENV-26 done (memory-leak guard: no leaked listeners/observers across drag ops).
- ENV-28 done (one-instance rich-text lifecycle: exactly one live editor).
- ENV-02's CI bundle-size gate (`measure.ts`) for the ≤100 kB core check.

## Implementation notes
This is verification + evidence, not new features. Produce a checklist run on the
reference hardware (define it explicitly: CPU class, RAM, browser versions — including
WebKit/Safari).

1. **Drag at ~60fps.** Drive a realistic newsletter doc (the ENV-13 fixtures or a
   representative large doc) and drag a block across it while recording frame timing
   (Playwright tracing / `performance` marks from the ENV-21 harness). Assert no frames
   over budget on the low-end machine.
2. **Drop-detection latency.** Confirm hit-testing/drop-zone detection stays within the
   OD-3 per-frame ms budget set in ENV-21 (well under one frame at 60fps). Use ENV-21's
   instrumentation; record the measured p95/max.
3. **One live rich-text instance.** Assert via ENV-28's check that focusing across many
   text blocks never yields >1 live Lexical instance (instance counter / destroy-on-blur
   evidence).
4. **No leaked listeners/observers.** Re-run ENV-26's leak guard over repeated
   drag/drop/edit cycles; assert listener/observer counts return to baseline (no
   monotonic growth). Capture before/after.
5. **Bundle ≤ ~100 kB gzip.** Run `measure.ts` on `@nord-forge/rime-core` (renderer-mjml
   excluded); record the number; confirm the CI gate is green.
6. **Record the matrix.** A short report (PR / `docs/perf-signoff.md`): reference-machine
   spec, each budget, measured value, pass/fail, and links to the runs. Any miss is a
   release blocker routed back to the owning ticket (ENV-21/47/51) — do not waive.

## Acceptance criteria
- [ ] Reference (low-end) and high-end machine specs + browser versions (incl. WebKit)
      are recorded.
- [ ] Drag holds ~60fps over a realistic newsletter on the low-end machine (measured).
- [ ] Drop-detection latency is within the OD-3 ms budget (measured p95/max recorded).
- [ ] Exactly one live rich-text instance is observed across heavy text-block focus
      cycling.
- [ ] No listener/observer leaks across repeated drag/edit cycles (baseline-returning
      counts recorded).
- [ ] `@nord-forge/rime-core` ≤ ~100 kB gzip (`measure.ts` value recorded; CI gate green).
- [ ] All results captured in a durable sign-off note; any miss filed back to its ticket
      as a blocker.

## Out of scope
- Implementing the perf work itself (ENV-21/47/51) — this verifies and signs off.
- Output-correctness (ENV-50) and DX (ENV-48) gates.

## Verification
```bash
# bundle gate
bun run build
bun run size   # measure.ts → @nord-forge/rime-core gzip ≤ ~100 kB
# perf/leak/instance runs (reuse ENV-21/47/51 harnesses), on the reference machine:
bun run e2e    # chromium + webkit perf + leak + single-instance assertions
```

## Definition of done
See `_conventions.md`. All §10 budgets pass on the reference machine with recorded
evidence; status → `review`.
