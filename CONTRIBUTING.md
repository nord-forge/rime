# Contributing to Rime

Thanks for your interest! Rime is an open-source, framework-agnostic email
template builder. This guide covers the essentials; the authoritative engineering
rules live in [`.claude/tickets/_conventions.md`](./.claude/tickets/_conventions.md)
— this file points at them rather than duplicating them.

By participating you agree to abide by our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Getting set up

Rime uses [Bun](https://bun.sh) for the runtime, package management, and
tests.

```bash
bun install
```

## Running the checks

These mirror what CI runs — all must pass before a PR is merged:

```bash
bun run lint          # oxlint
bun run format:check  # oxfmt (run `bun run format` to fix)
bun run typecheck     # tsc
bun test              # unit tests
bun run build         # build all packages
bun run size          # @nord-forge/rime-core bundle-size gate
bun run e2e           # cross-browser Playwright (chromium + webkit)
```

The "Done" gate for any change is defined in
[`_conventions.md`](./.claude/tickets/_conventions.md): acceptance criteria met ·
unit tests pass · cross-browser tests pass where applicable (chromium + webkit) ·
oxlint clean · oxfmt applied · tsc clean · core bundle within budget.

## Project layout

```
packages/rime-model        @nord-forge/rime-model      headless JSON document model
packages/rime-core        @nord-forge/rime-core           the <rime-editor> Lit web component
packages/rime-mjml   @nord-forge/rime-mjml  doc JSON → MJML → email HTML
packages/rime-react         @nord-forge/rime-react          React wrapper
packages/rime-vue          @nord-forge/rime-vue            Vue wrapper
apps/rime-demo             @nord-forge/rime-demo           runnable demo app
```

The work is planned as tickets — see [`board.md`](./board.md) for the rollup and
[`.claude/tickets/`](./.claude/tickets/) for the detailed, self-contained tickets
(grouped into per-milestone subfolders).

## The bundle budget

`@nord-forge/rime-core` must stay **≤ ~100 kB gzip** (editor only; the MJML renderer is
a separate package and excluded). CI fails over budget. If a change pushes core
over, that's a blocker, not a warning. **Any new runtime dependency must declare
its gzip cost in the PR description.**

## Branching & commits

- **Branch off the default branch.** Never commit feature work straight to it.
- **Do NOT add `Co-Authored-By` or any AI attribution** to commits or PRs.
- Commit message format: `type(ENV-NN): summary`, with a body explaining the
  what and the why. (`type` = feat/fix/chore/docs/test/ci/refactor.)
- Reference the ticket ID in the commit/PR — but **not in source-code comments**;
  describe intent in plain language there so code doesn't go stale against the
  tracker.
- **Sign off every commit** per the [Developer Certificate of Origin](https://developercertificate.org/)
  (`git commit -s` adds a `Signed-off-by:` trailer; amend an existing commit with
  `git commit --amend -s --no-edit`). This is the DCO sign-off — distinct from,
  and not to be confused with, `Co-Authored-By:`/AI attribution, which is
  forbidden.
- Sign commits cryptographically if your machine is configured for it; otherwise
  a normal (signed-off) commit is fine.

## Pull requests

Open a PR against the default branch and fill in the
[PR template](./.github/PULL_REQUEST_TEMPLATE.md). It mirrors the Done gate —
make sure every box is honestly checked. Cross-browser behaviour (Safari/WebKit
especially) matters: if your change is browser-observable, add a Playwright test.

## Reporting bugs & requesting features

Use the GitHub issue templates. For bugs, include the browser (call out
Safari/WebKit explicitly — most quirks live there) and a minimal repro.
