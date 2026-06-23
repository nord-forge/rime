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
- [ ] All commits are **signed off** per the DCO (see below)

## Developer Certificate of Origin (DCO)

By submitting this pull request, I certify that my contribution complies with the
[Developer Certificate of Origin 1.1](https://developercertificate.org/), and
every commit carries a `Signed-off-by:` trailer matching the author.

Sign off your commits with:

```bash
git commit -s -m "type(ENV-NN): summary"   # adds the Signed-off-by trailer
# already committed? add it with:
git commit --amend -s --no-edit
```

> Note: `Signed-off-by:` is the DCO sign-off (allowed and required). It is **not**
> the same as `Co-Authored-By:` / AI attribution, which must **not** appear in
> commits or this PR.

## Bundle impact

<!-- Did you add a runtime dependency? If so, state its gzip cost. If core's
     measured gzip changed, note the before/after. Otherwise: "no change". -->

## Notes for reviewers

<!-- Anything that needs special attention, screenshots, or follow-ups.
     Reminder: no `Co-Authored-By` / AI attribution in commits or this PR. -->
