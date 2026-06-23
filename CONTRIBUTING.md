# Contributing to Enveloppe

Thanks for your interest! Enveloppe is an open-source, framework-agnostic email
template builder. This guide covers the essentials; the authoritative engineering
rules live in [`.claude/tickets/_conventions.md`](./.claude/tickets/_conventions.md)
— this file points at them rather than duplicating them.

By participating you agree to abide by our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Getting set up

Enveloppe uses [Bun](https://bun.sh) for the runtime, package management, and
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
bun run size          # @enveloppe/core bundle-size gate
bun run e2e           # cross-browser Playwright (chromium + webkit)
```

The "Done" gate for any change is defined in
[`_conventions.md`](./.claude/tickets/_conventions.md): acceptance criteria met ·
unit tests pass · cross-browser tests pass where applicable (chromium + webkit) ·
oxlint clean · oxfmt applied · tsc clean · core bundle within budget.

## Project layout

```
packages/doc-model      @enveloppe/doc-model      headless JSON document model
packages/core           @enveloppe/core           the <enveloppe-editor> Lit web component
packages/renderer-mjml  @enveloppe/renderer-mjml  doc JSON → MJML → email HTML
packages/react          @enveloppe/react          React wrapper
packages/vue            @enveloppe/vue            Vue wrapper
apps/demo               @enveloppe/demo           runnable demo app
```

The work is planned as tickets — see [`board.md`](./board.md) for the rollup and
[`.claude/tickets/`](./.claude/tickets/) for the detailed, self-contained tickets
(grouped into per-milestone subfolders).

## The bundle budget

`@enveloppe/core` must stay **≤ ~100 kB gzip** (editor only; the MJML renderer is
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
- Sign commits if your machine is configured for it; otherwise a normal commit is
  fine.

## Pull requests

Open a PR against the default branch and fill in the
[PR template](./.github/PULL_REQUEST_TEMPLATE.md). It mirrors the Done gate —
make sure every box is honestly checked. Cross-browser behaviour (Safari/WebKit
especially) matters: if your change is browser-observable, add a Playwright test.

## Reporting bugs & requesting features

Use the GitHub issue templates. For bugs, include the browser (call out
Safari/WebKit explicitly — most quirks live there) and a minimal repro.
