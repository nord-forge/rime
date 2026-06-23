---
id: ENV-48
title: "<30-min embed test"
status: ready
priority: P1
milestone: 10 — Release readiness
depends_on: [ENV-44, ENV-46]
blocks: [ENV-52]
package: root
prd: [§11]
estimate: S
---

# ENV-48 — <30-min embed test

## Context
The primary success metric (§11) is DX: "a developer can embed `<enveloppe-editor>`,
theme it, and save/load a template in **< 30 minutes** from the README." This ticket is
the measured proof — a fresh developer (or a developer simulating one, on a clean
machine/checkout, README only, no tribal knowledge) does exactly that and **times it**.
Failures here are README/DX bugs to fix before release, not just notes.

## Goal
A fresh developer follows only the README and successfully embeds, themes, and
save/loads a template in under 30 minutes; the run is timed and recorded, with any
friction filed as fixes.

## Prerequisites
- ENV-44 done (React wrapper — the most common embed path) and ENV-46 done (demo + the
  integration patterns the README points to).
- A published-or-linkable build of the packages (workspace link or a local tarball via
  `bun pm pack`) so the test mirrors a real consumer install, not a monorepo dev setup.

## Implementation notes
1. **Set up a clean consumer.** Outside the monorepo (or a throwaway dir), create a
   minimal app (React via the wrapper, and/or vanilla per ENV-47). Install
   `@enveloppe/*` from a local tarball/link as a real consumer would.
2. **Follow the README literally.** Only the README's usage section — embed
   `<EnveloppeEditor>` (or the element), apply a `theme` override, wire `onChange`/
   `loadDoc` to a trivial store, set an `onImageUpload`. No reading source, no asking the
   author.
3. **Time it.** Record wall-clock from "empty project" to "themed editor that saves and
   reloads a doc." Note where time goes (install, types, unclear step, missing import).
4. **Capture friction → fixes.** Every stumble (a wrong import path, a missing type, an
   undocumented step, a peer-dep surprise, a custom-element registration gotcha) becomes
   a concrete fix in the README / wrapper / package `exports` — not just a comment.
   Re-run after fixes if the first pass exceeded budget.
5. **Record the result.** Write the timing + findings into a short note (e.g.
   `docs/embed-test.md` or the PR description): elapsed time, environment, the steps, and
   the fixes made. This is the artifact that proves the §11 gate.
6. **Cross-check both paths.** At minimum the React wrapper path; ideally also the
   vanilla path (ENV-47) since they share the README.

## Acceptance criteria
- [ ] A clean-room consumer project installs `@enveloppe/*` as a real dependency
      (tarball/link), not via monorepo internals.
- [ ] Following only the README, the tester embeds, themes (`--eb-*`), and save/loads a
      template — working end to end.
- [ ] The elapsed time is measured and is **< 30 minutes** (or, if over, friction is
      fixed and a re-run lands under budget).
- [ ] Every friction point is filed as a concrete README/wrapper/exports fix and
      addressed.
- [ ] The timing + findings are recorded in a durable note referenced from the PR.

## Out of scope
- Perf/output-correctness gates (ENV-49/102) — this is the DX gate only.
- npm publishing (ENV-52) — uses a local tarball/link to simulate a consumer.

## Verification
```bash
# build + pack the packages, install into a fresh app, follow README, time it
bun run build
bun pm pack   # per publishable package, or `bun link`
# in a throwaway consumer dir: install, implement README steps, record elapsed time
```

## Definition of done
See `_conventions.md`. A timed, recorded clean-room embed under 30 minutes with friction
fixed; status → `review`.
