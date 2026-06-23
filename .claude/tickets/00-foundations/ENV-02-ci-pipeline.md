---
id: ENV-02
title: CI pipeline + bundle-size gate
status: done
priority: P0
milestone: 0 — Foundations
depends_on: [ENV-01]
blocks: []
package: root
prd: [§10]
estimate: M
---

# ENV-02 — CI pipeline + bundle-size gate

## Context
Every later ticket leans on a green CI to prove "done". This ticket stands up the
GitHub Actions pipeline that runs the same checks the local `_conventions.md` gate
demands — install, lint, format-check, unit tests, build — plus the one gate that
cannot be left to a human: the **`@enveloppe/core` ≤ ~100 kB gzip budget** (§10,
OD-4). The toolchain is already proven (OD-2): `.claude/spikes/od2-toolchain/measure.ts`
is the working prototype of the size gate and `.claude/spikes/od2-toolchain/FINDINGS.md`
shows the exact pipeline stages that pass in Chromium + WebKit. Reuse them; do not
re-spike.

## Goal
A GitHub Actions workflow that fails the PR if oxlint, oxfmt-check, `bun test`, the
build, or the core gzip budget regresses — green on a clean `main`.

## Prerequisites
- ENV-01 done: workspaces build, `bun run build`/`test`/`lint`/`format:check`
  scripts exist at root, and ENV-01 copied `measure.ts` into a shared
  `scripts/measure.ts` location (its "Out of scope" note). If that copy is absent,
  port `.claude/spikes/od2-toolchain/measure.ts` as the first step of this ticket.

## Implementation notes
1. **Workflow file** — create `.github/workflows/ci.yml`:
   - Trigger on `push` to the default branch and on `pull_request`.
   - `runs-on: ubuntu-latest`. Single job `build` is fine for v1; keep steps
     ordered so the cheapest fail first (lint → format → test → build → size).
   - Use `oven-sh/setup-bun@v2` (pin a version), then `bun install --frozen-lockfile`.
   - Steps (each its own `run:` so failures are legible):
     ```yaml
     - run: bun install --frozen-lockfile
     - run: bun run lint            # oxlint
     - run: bun run format:check    # oxfmt --check
     - run: bun test
     - run: bun run build           # builds all packages to dist/
     - run: bun run size            # the bundle-size GATE (below)
     ```
2. **Bundle-size gate** — adapt the proven `measure.ts` pattern (gzip/brotli via
   `node:zlib`, `process.exit(1)` over budget) to point at the real core build:
   - Add `scripts/measure-core.ts` (or parameterize the shared `scripts/measure.ts`)
     that measures `packages/core/dist/*.js` (the ESM entry; Lit is externalized in
     the lib build so this measures OUR code, mirroring how core ships).
   - Set the budget from the env with the OD-4 default:
     `const BUDGET_GZIP = Number(process.env.BUDGET_GZIP ?? 100 * 1024);`
   - On regression: print `raw / gzip / brotli` for the entry, then
     `console.error("❌ FAIL …"); process.exit(1);` so the CI step turns red.
   - Add a root script `"size": "bun scripts/measure-core.ts"`; CI runs `bun run size`.
3. **Determinism** — pin action versions and the Bun version; rely on
   `bun.lock` + `--frozen-lockfile` so CI installs exactly what was committed.
4. **No Playwright here.** Browser E2E is wired in ENV-03; this pipeline must not
   require browser binaries (keeps CI fast). If ENV-03 lands first, leave a TODO
   comment pointing at where its `bun run e2e` step would be added.
5. **Caching** (optional, nice-to-have): cache `~/.bun/install/cache` keyed on
   `bun.lock`. Skip if it complicates the first green run.

## Acceptance criteria
- [ ] `.github/workflows/ci.yml` runs on push + pull_request and executes, in order:
      install (frozen) · oxlint · oxfmt-check · `bun test` · build · size gate.
- [ ] The size gate measures `@enveloppe/core`'s built gzip and **fails (exit 1)**
      when it exceeds `BUDGET_GZIP` (default 100 kB); passes when under.
- [ ] Budget is overridable via the `BUDGET_GZIP` env var.
- [ ] A deliberate over-budget core build turns the `size` step red (demonstrated
      locally by lowering `BUDGET_GZIP`).
- [ ] Workflow is green on a clean checkout of the default branch.
- [ ] Action + Bun versions are pinned; install uses `--frozen-lockfile`.

## Out of scope
- Playwright / browser E2E in CI (ENV-03).
- npm publish / release automation (ENV-52).
- Per-package size budgets beyond core; matrix OS/browser runs.

## Verification
```bash
cd <repo>
# Reproduce CI locally:
bun install --frozen-lockfile
bun run lint
bun run format:check
bun test
bun run build
bun run size                              # PASS within 100 kB
BUDGET_GZIP=1 bun run size; echo "exit=$?"  # must print FAIL and exit 1
# Lint the workflow file (optional, if actionlint available):
# actionlint .github/workflows/ci.yml
```

## Definition of done
See `_conventions.md`. CI green on default branch; size gate proven to fail over
budget; status → `review`.
