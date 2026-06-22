---
id: ENV-103
title: Docs site / API reference
status: ready
priority: P1
milestone: 10 — Release readiness
depends_on: [ENV-60, ENV-72]
blocks: [ENV-104]
package: root
prd: [§1]
estimate: M
---

# ENV-103 — Docs site / API reference

## Context
v1 must be embeddable in <30 minutes from docs (§1, §11). This ticket produces the API
reference covering the four public surfaces a developer needs: the `init`/`config`
shape, `registerBlock` (the custom-block SDK), `registerToken` (custom merge tags), and
the `--eb-*` theming tokens. It pulls the canonical example custom block (ENV-64) in as
the worked SDK example. Accurate, runnable, matching the real exported APIs — not
aspirational prose.

## Goal
A docs site / API reference documents `EnveloppeConfig`/`init`, `registerBlock`,
`registerToken`, and the `--eb-*` theming tokens — accurate to the shipped public APIs,
with the ENV-64 example as the SDK walkthrough.

## Prerequisites
- ENV-60 done (`registerBlock`/`BlockDefinition`/schema) and ENV-72 done
  (`registerToken`/token sources) — the SDKs being documented.
- ENV-30 (`EnveloppeConfig`), ENV-34 (the `--eb-*` token catalog), ENV-64 (the example
  custom block), ENV-90/91/93 (framework usage snippets).

## Implementation notes
1. **Where/how.** A docs site under `docs/` (or `apps/docs`) using a lightweight static
   docs tool (Astro/Starlight or similar — keep it simple, Bun-friendly). It can lead
   with the README content and expand into reference pages. Don't over-build; the bar is
   accurate + navigable.
2. **Pages (the four surfaces):**
   - **Getting started / `init` config:** the `EnveloppeConfig` shape (`theme`,
     `enabledBlocks`, `onImageUpload`, `tokenSources`) with the vanilla/React/Vue
     embedding snippets (link ENV-90/91/93). Show `loadDoc`/`getDoc`/`change` (ENV-80).
   - **`registerBlock` (custom blocks SDK):** document `BlockDefinition`
     (`type`/`schema`/`palette`/`renderCanvas`/`renderExport`), the schema field types
     (ENV-60), the canvas vs export render contexts, and the raw-table fallback. Embed
     the **ENV-64 example** as the full walkthrough (it's heavily commented for this).
   - **`registerToken` / token sources:** `registerToken`/`registerTokenSource` +
     `config.tokenSources` (ENV-72), and how tokens export to `{{var}}` (ENV-70).
   - **Theming tokens:** the full `--eb-*` catalog (ENV-34) — names, defaults, purpose —
     and the two-surface model (chrome via `--eb-*`, canvas walled off).
3. **Accuracy.** Pull signatures from the actual exported types; keep code samples
   runnable (ideally lifted from real example files/tests so they can't drift). Note the
   ≤100 kB core budget and headless/no-backend constraints where relevant to integrators.
4. **Cross-links.** Link to the demo (ENV-92) and the embed-test note (ENV-100). Surface
   the package table (which package exports what).
5. **Buildable.** `bun run docs` (or equivalent) builds/serves the site; it's part of the
   release artifacts referenced by ENV-104.

## Acceptance criteria
- [ ] Docs cover all four surfaces: `init`/`EnveloppeConfig`, `registerBlock`,
      `registerToken`, and `--eb-*` theming tokens — accurate to the shipped exports.
- [ ] The `registerBlock` page embeds the ENV-64 example as a complete, runnable
      walkthrough (schema → properties → canvas → export, incl. raw-table fallback).
- [ ] The theming page lists the `--eb-*` token catalog with defaults + the two-surface
      model explained.
- [ ] Vanilla/React/Vue embedding snippets match the wrappers (ENV-90/91/93) and the
      `loadDoc`/`getDoc`/`change` API (ENV-80).
- [ ] The site builds/serves via a documented command and is referenced by ENV-104.
- [ ] Code samples are runnable / lifted from real sources (don't drift from the API).

## Out of scope
- Auto-generated TypeDoc dumps as the only docs (hand-written reference is the bar; a
  generated API appendix is optional).
- Marketing copy beyond what clarifies usage. Tutorials beyond the SDK walkthrough.

## Verification
```bash
bun run docs      # builds/serves the docs site
# spot-check: every documented signature matches the exported type; samples run
bun run build     # ensure docs build is part of the pipeline
```

## Definition of done
See `_conventions.md`. Accurate API reference for config/registerBlock/registerToken/
theming with the ENV-64 walkthrough; status → `review`.
