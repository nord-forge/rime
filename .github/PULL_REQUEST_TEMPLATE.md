## What & why

<!-- What does this change do, and why? Link the ticket: e.g. "Implements ENV-NN". -->

Closes:

## Done-gate checklist

- [ ] Acceptance criteria for the linked ticket are met
- [ ] `bun test` passes (unit tests cover the change)
- [ ] Cross-browser test passes where applicable (`chromium` + `webkit`)
- [ ] `bun run lint` (oxlint) clean
- [ ] `bun run format:check` (oxfmt) clean
- [ ] `bun run typecheck` (tsc) clean
- [ ] `bun run build` succeeds
- [ ] **`@enveloppe/core` bundle still within budget** (`bun run size`)

## Bundle impact

<!-- Did you add a runtime dependency? If so, state its gzip cost. If core's
     measured gzip changed, note the before/after. Otherwise: "no change". -->

## Notes for reviewers

<!-- Anything that needs special attention, screenshots, or follow-ups.
     Reminder: no `Co-Authored-By` / AI attribution in commits or this PR. -->
