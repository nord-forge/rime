---
id: ENV-04
title: Repo hygiene — README, CONTRIBUTING, templates, LICENSE
status: done
priority: P1
milestone: 0 — Foundations
depends_on: [ENV-01]
blocks: []
package: root
prd: [§1]
estimate: S
---

# ENV-04 — Repo hygiene — README, CONTRIBUTING, templates, LICENSE

## Context
Enveloppe is an OSS project whose primary persona is the embedding developer (§1,
§4). First impressions are the README and contribution scaffolding; a clean,
welcoming repo is part of the product. A README draft already exists at the repo
root — refine it (don't rewrite from scratch) — and add the standard OSS files a
public MIT repo is expected to carry.

## Goal
A new contributor lands on the repo and finds: an accurate README quickstart, a
CONTRIBUTING guide, a CODE_OF_CONDUCT, GitHub issue/PR templates, and a confirmed
MIT LICENSE — all consistent with the PRD/board.

## Prerequisites
- ENV-01 done (the layout, scripts, and stack the docs describe actually exist).
- Read the current root `README.md`, `LICENSE`, and `_conventions.md` (commit/PR
  rules the CONTRIBUTING must reflect).

## Implementation notes
1. **README refinement** (`README.md`, root) — keep its structure; correct anything
   stale against the PRD:
   - Rich-text engine line currently reads "Tiptap-core or Lexical". The decision is
     **Lexical** (OD-1, §6.7). Update to reflect Lexical (note it's used headless,
     custom UI) rather than presenting it as undecided.
   - Add a short **Develop locally** block (the canonical commands), e.g.:
     ````md
     ## Develop locally
     ```bash
     bun install
     bun run build      # build all packages
     bun test           # unit tests
     bun run lint       # oxlint
     bun run e2e        # cross-browser Playwright (chromium + webkit)
     ```
     ````
   - Keep the "pre-implementation" status banner honest.
2. **`CONTRIBUTING.md`** (root) — concise, points at the source of truth rather than
   duplicating it:
   - How to set up (`bun install`), run checks (lint/format/test/build/e2e), and the
     "Done" gate (link `.claude/tickets/_conventions.md`).
   - Branch + commit conventions from `_conventions.md`: branch off default; commit
     message `type(ENV-NN): summary`; **no AI/`Co-Authored-By` attribution** in
     commits or PRs.
   - Note the bundle budget (`@enveloppe/core` ≤ ~100 kB gzip) and that new runtime
     deps must declare their gzip cost in the PR.
   - Point to `board.md` for the ticket plan and to the `.claude/tickets/` files.
3. **`CODE_OF_CONDUCT.md`** (root) — adopt **Contributor Covenant v2.1** verbatim;
   set the contact to `nick@spatie.be` in the enforcement section.
4. **GitHub templates** under `.github/`:
   - `ISSUE_TEMPLATE/bug_report.md` — repro, expected/actual, browser (call out
     Safari/WebKit explicitly, per §9), package + version.
   - `ISSUE_TEMPLATE/feature_request.md` — problem, proposal, alternatives, scope
     check against the v1 non-goals (§3).
   - `ISSUE_TEMPLATE/config.yml` — optional; can link discussions.
   - `PULL_REQUEST_TEMPLATE.md` — checklist mirroring the Done gate: tests pass,
     oxlint/oxfmt clean, `tsc` clean, **core bundle within budget**, cross-browser
     where applicable, linked ticket `ENV-NN`.
5. **LICENSE** — confirm root `LICENSE` is MIT (it is: "MIT License", 2026 Enveloppe
   contributors). Add an SPDX line / `"license": "MIT"` to any package.json missing
   it. No change if already correct — just verify and note in the PR.

## Acceptance criteria
- [ ] README's rich-text line reflects the **Lexical** decision and includes a
      "Develop locally" command block; status banner intact.
- [ ] `CONTRIBUTING.md` exists: setup, check commands, the Done gate, commit/branch
      rules (incl. **no AI attribution**), and the bundle-budget note.
- [ ] `CODE_OF_CONDUCT.md` exists (Contributor Covenant 2.1) with `nick@spatie.be`
      as the contact.
- [ ] `.github/ISSUE_TEMPLATE/{bug_report,feature_request}.md` and
      `.github/PULL_REQUEST_TEMPLATE.md` exist; bug template prompts for browser
      (Safari/WebKit called out); PR template lists the Done-gate checklist.
- [ ] Root `LICENSE` confirmed MIT; package.jsons carry `"license": "MIT"`.

## Out of scope
- CI workflows (ENV-02) and the docs site / API reference (ENV-51).
- Funding/security policy files (`FUNDING.yml`, `SECURITY.md`) unless trivial.

## Verification
```bash
cd <repo>
ls CONTRIBUTING.md CODE_OF_CONDUCT.md LICENSE
ls .github/ISSUE_TEMPLATE/bug_report.md .github/ISSUE_TEMPLATE/feature_request.md .github/PULL_REQUEST_TEMPLATE.md
head -1 LICENSE                         # "MIT License"
grep -i lexical README.md               # engine line updated
grep -i "Co-Authored" CONTRIBUTING.md   # the rule is stated (as forbidden)
```

## Definition of done
See `_conventions.md`. Files present and consistent with PRD/conventions;
status → `review`.
