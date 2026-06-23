---
id: ENV-13
title: Output-correctness fixtures + client matrix
status: ready
priority: P0
milestone: 2 — Export renderer (MJML)
depends_on: [ENV-11]
blocks: [ENV-50]
package: renderer-mjml
prd: [§11]
estimate: M
---

# ENV-13 — Output-correctness fixtures + client matrix

## Context
Output correctness is a **hard release gate** (PRD §11): generated emails must render correctly
across Windows Outlook, Gmail, and Apple Mail, verified against a fixture set. Automated tests
can't open real email clients, so this ticket does two things: (1) **golden HTML snapshots** that
lock the `MjmlRenderer` output against regressions, and (2) a documented **manual email-client
verification matrix** — which fixtures to send, to which clients, and what to check — that feeds
the §11 sign-off (ENV-50). This is the safety net for every future renderer change.

## Goal
A set of golden test docs whose `MjmlRenderer` output is snapshotted (regressions fail `bun test`)
plus a documented, runnable manual-verification procedure for the Outlook/Gmail/Apple Mail matrix.

## Prerequisites
- ENV-11 done (`MjmlRenderer.render`, deterministic output).
- ENV-05 factory helpers to build the fixture docs cleanly.

## Implementation notes
Create under `packages/renderer-mjml/`:

1. **Fixture docs** — `test/fixtures/*.ts` (or `.json`). Build one doc per scenario covering the
   correctness-risky cases, using ENV-05 factories:
   - `single-text.ts` — one section/column/text with mixed marks + a link (rich-text path).
   - `button.ts` — a button (the classic Outlook VML/ghost-table risk).
   - `two-column.ts` — a section with two 50% columns (column stacking on mobile / Outlook).
   - `image-divider-spacer.ts` — image with `href`, divider, spacer (spacing fidelity).
   - `full-newsletter.ts` — a realistic multi-section email combining all core blocks.
   Keep them small and hand-reviewed; these define "correct."
2. **Golden snapshots** — `test/output-correctness.test.ts`. For each fixture: `await new
   MjmlRenderer().render(doc)` and compare to a committed snapshot in `test/__snapshots__/` (or
   `test/golden/<name>.html`). Use `bun test`'s snapshot support (or read a committed `.html` and
   string-compare). Normalize nondeterminism before comparing (e.g. strip MJML version comments /
   any timestamp the lib emits) so snapshots are stable. A renderer change that alters output must
   force a deliberate snapshot update (document `bun test --update-snapshots` in the test header).
3. **Manual verification matrix** — `docs/email-client-matrix.md`. A table and a procedure:
   - **Clients (rows):** Windows Outlook (the must-pass desktop client — Word rendering engine),
     Gmail (web + Android/iOS app), Apple Mail (macOS + iOS). Note which are the §11 gate clients.
   - **Fixtures (columns):** the five docs above.
   - **What to check per cell:** layout intact (no broken columns), button is clickable + styled
     (VML in Outlook), images load + respect width/alt, spacing matches, fonts fall back sanely,
     links work, dark-mode not catastrophically broken.
   - **How to run it:** a documented procedure to produce the HTML files for sending — e.g. a small
     script `bun run render:fixtures` that writes each fixture's rendered HTML to `test/golden/` (or
     a `dist-fixtures/` dir) so a human can paste/send them through a service (Litmus/Email on Acid,
     or manual send) into each client. Document the exact command and where the files land. The
     matrix doc is the checklist a reviewer fills in for the ENV-50 sign-off.
4. **Optional render script** — `scripts/render-fixtures.ts` invoked by a `render:fixtures` package
   script, iterating the fixtures and writing `<name>.html`. Reuse the same fixtures the snapshot
   test uses (single source of truth — don't duplicate doc definitions).
5. No new runtime dependency (test/dev tooling only). `mjml` is already an ENV-11 dep.

## Acceptance criteria
- [ ] At least five fixture docs exist covering text+marks+link, button, two-column, image/divider/
      spacer, and a full newsletter — all built via ENV-05 factories and `validateDoc`-valid.
- [ ] `output-correctness.test.ts` snapshots each fixture's `MjmlRenderer` output; an unintended
      output change fails `bun test`. Snapshot update path is documented.
- [ ] Nondeterministic bits are normalized so snapshots are stable run-to-run.
- [ ] `docs/email-client-matrix.md` documents the clients (incl. Windows Outlook, Gmail, Apple
      Mail), the per-cell checks, and the **exact runnable procedure** to generate the HTML for
      manual sending.
- [ ] A `render:fixtures` script (or equivalent) writes each fixture's rendered HTML to a known dir,
      reusing the same fixture docs as the snapshot test.
- [ ] No new runtime dependency. Tests run under `bun test`.

## Out of scope
- The actual manual client sign-off run (ENV-50 executes the matrix on the release candidate).
- Visual-regression/screenshot diffing of real clients (manual matrix covers clients; snapshots
  cover HTML).
- Raw-table fallback fixtures (ENV-12) beyond what the core blocks already exercise.

## Verification
```bash
cd packages/renderer-mjml
bun test                     # golden snapshots pass
bun run render:fixtures      # writes fixture HTML to the documented dir
test -f docs/email-client-matrix.md && echo "matrix doc present"
```

## Definition of done
See `_conventions.md`. status → `review`. (The manual matrix is documented + runnable here; the
human sign-off itself is ENV-50.)
