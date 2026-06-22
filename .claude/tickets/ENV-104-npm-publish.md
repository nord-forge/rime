---
id: ENV-104
title: "npm publish @enveloppe/*"
status: ready
priority: P1
milestone: 10 — Release readiness
depends_on: [ENV-100, ENV-101, ENV-102, ENV-103]
blocks: []
package: root
prd: [§8]
estimate: M
---

# ENV-104 — npm publish `@enveloppe/*`

## Context
The final release step: publish the five public packages — `@enveloppe/core`,
`@enveloppe/doc-model`, `@enveloppe/renderer-mjml`, `@enveloppe/react`,
`@enveloppe/vue` (§8) — to npm under the `@enveloppe` scope, with correct versioning,
provenance, per-package READMEs, and `exports` maps. This is gated on the three hard
gates (perf ENV-101, output-correctness ENV-102) and DX (ENV-100, ENV-103) passing —
nothing ships until those are green.

## Goal
All five `@enveloppe/*` packages publish to npm with aligned versions, provenance, a
correct `exports`/`types` map, and a per-package README — installable and usable exactly
as the docs describe.

## Prerequisites
- ENV-100 (embed <30 min), ENV-101 (perf gate), ENV-102 (output correctness),
  ENV-103 (docs) — all done/green. These are the release gates.
- ENV-01 build pipeline producing ESM + `.d.ts` per package; ENV-03 CI green.

## Implementation notes
1. **Package manifests (each publishable package).**
   - Scoped name `@enveloppe/<pkg>`, `"type": "module"`, `"license": "MIT"`,
     `"sideEffects"` set correctly (core registers the element — mark its entry as having
     a side effect so it isn't tree-shaken away by consumers).
   - **`exports` map**: a clean ESM entry + `types` condition pointing at the emitted
     `.d.ts`; no deep-import surface (consumers must only touch the public entry — this is
     what ENV-64 relies on). Set `"files"` to ship `dist` + README + LICENSE only.
   - **`publishConfig.access: "public"`** (scoped packages default to restricted).
2. **Versioning.** Align versions across the five packages for the v1 release (a single
   coordinated version, e.g. `0.1.0`). Inter-package deps use the published version range
   (not `workspace:*`) at publish time — let Bun/the release tool rewrite `workspace:*` →
   the concrete version on pack/publish. Decide and document the bump strategy (changesets
   or manual coordinated bump — keep it simple for v1).
3. **Provenance.** Publish with npm provenance (`--provenance`) from CI (trusted
   publishing / OIDC) so packages carry a verifiable build origin. Document the CI release
   job.
4. **Per-package README.** Each package ships its own README (purpose, install, minimal
   usage, link to the docs site ENV-103). The package table in the root README stays
   accurate.
5. **Peer/external deps correct.** `react`/`react-dom` (react pkg), `vue` (vue pkg), and
   `lit` (core) are peer/externalized — not bundled (verified upstream; re-confirm in the
   published tarballs). `mjml` stays a dep of `renderer-mjml` only.
6. **Dry run first.** `bun pm pack` (or `npm publish --dry-run`) each package; inspect the
   tarball contents (only `dist` + README + LICENSE; correct `exports`/`types`; no source
   or test files). Install the tarballs into a clean app and run the ENV-100 flow as a
   final smoke before the real publish.
7. **Tag + release notes.** Git tag the release; publish notes summarizing v1 (the §12
   done-bar). Order publish so dependencies go first (doc-model/renderer-mjml → core →
   react/vue).

## Acceptance criteria
- [ ] All five packages publish to npm under `@enveloppe/*` with `access: public` and
      aligned v1 versions.
- [ ] Each package has a correct `exports`/`types` map (public entry only, `.d.ts`
      resolved) and ships only `dist` + README + LICENSE.
- [ ] `workspace:*` inter-package deps are rewritten to concrete versions in the
      published manifests.
- [ ] Packages are published with provenance from CI.
- [ ] Peer/external deps (`lit`, `react`/`react-dom`, `vue`) are not bundled; `mjml` is
      only in `renderer-mjml`.
- [ ] Each package has its own README; the root package table is accurate.
- [ ] A dry-run + clean-room install + ENV-100 smoke passed before the real publish.
- [ ] All release gates (ENV-100/101/102/103) were green at publish time.

## Out of scope
- The gates themselves (ENV-100/101/102/103) — this depends on them being green.
- Post-v1 release automation beyond a working, documented release job.

## Verification
```bash
bun run build
bun pm pack           # per package; inspect tarball contents + exports/types
# clean-room install of the tarballs + ENV-100 smoke
# then (from CI, with provenance): publish in dependency order
```

## Definition of done
See `_conventions.md`. Five `@enveloppe/*` packages published with provenance, correct
exports, and per-package READMEs, gated on all release gates; status → `review`.
