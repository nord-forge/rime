---
id: ENV-102
title: Output-correctness sign-off (email-client matrix)
status: ready
priority: P0
milestone: 10 — Release readiness
depends_on: [ENV-23]
blocks: [ENV-104]
package: root
prd: [§11]
estimate: M
---

# ENV-102 — Output-correctness sign-off (email-client matrix)

## Context
Output correctness is a **hard release gate** (§11): generated emails must render
correctly across the major clients — including Windows Outlook, Gmail, and Apple Mail —
verified against the ENV-23 fixture set. This ticket is the formal sign-off: render the
fixtures through the MJML renderer and verify them across the client matrix, recording
pass/fail. Any failing client is a release blocker.

## Goal
A recorded sign-off confirming the ENV-23 fixtures render correctly across the
Outlook/Gmail/Apple Mail matrix, with the golden snapshots green and the manual client
matrix passing.

## Prerequisites
- ENV-23 done (output-correctness fixtures: core blocks rendered + the
  snapshot/manual matrix scaffolding for Outlook/Gmail/Apple Mail).
- ENV-21 (`MjmlRenderer`) and ENV-22 (raw-table fallback) — the renderers under test.

## Implementation notes
This is verification + evidence. Use the ENV-23 fixtures as the source of truth.

1. **Regenerate output.** Render every ENV-23 fixture doc through `MjmlRenderer`
   (and any raw-table-fallback blocks via ENV-22). Confirm the golden HTML snapshots are
   current and stable (deterministic output, ENV-21).
2. **Run the client matrix.** Verify rendering across the required clients:
   - **Windows Outlook** (the hard one — ghost tables, VML buttons, `mso` conditionals),
   - **Gmail** (web + the Gmail-clipping/CSS-stripping behaviors),
   - **Apple Mail** (macOS + iOS).
   Use the ENV-23 process — automated rendering/screenshot service (e.g. an
   Email-on-Acid/Litmus-style matrix or the project's chosen tooling) and/or the manual
   matrix it defines. Cover each core block (section/column/text/image/button/divider/
   spacer) and a combined newsletter fixture.
3. **Record results.** A matrix table (client × fixture → pass/fail + screenshot/notes)
   in a durable note (PR / `docs/output-signoff.md`). Note known, acceptable client
   quirks vs. real defects.
4. **Failures are blockers.** Any incorrect render routes back to ENV-21/22 (mapping fix
   or a raw-table fallback for that block, per OD-5). Re-render and re-verify after fixes;
   do not waive a failing core client.
5. **Lock the snapshots.** Ensure the golden snapshots committed match the signed-off
   output so regressions are caught in CI going forward.

## Acceptance criteria
- [ ] All ENV-23 fixtures render through `MjmlRenderer` (+ ENV-22 where used) with
      current, stable golden snapshots.
- [ ] Each core block + a combined newsletter fixture is verified on Windows Outlook,
      Gmail, and Apple Mail (macOS + iOS).
- [ ] A client × fixture pass/fail matrix with evidence (screenshots/notes) is recorded
      in a durable note.
- [ ] Any failing core client was fixed in ENV-21/22 (not waived) and re-verified.
- [ ] The committed golden snapshots match the signed-off output (CI regression guard).

## Out of scope
- Building the fixtures/harness (ENV-23) — this consumes them.
- Perf (ENV-101) and DX (ENV-100) gates.
- Custom third-party blocks' correctness (the integrator owns their `renderExport`).

## Verification
```bash
cd packages/renderer-mjml
bun test       # golden snapshots green (ENV-23 fixtures)
# then run the ENV-23 client-matrix process (automated screenshots and/or manual matrix)
# record results in the sign-off note
```

## Definition of done
See `_conventions.md`. Email-client matrix passes against ENV-23 fixtures with recorded
evidence; status → `review`.
