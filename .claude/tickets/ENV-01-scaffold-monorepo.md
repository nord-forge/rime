---
id: ENV-01
title: Scaffold Bun-workspaces monorepo
status: ready
priority: P0
milestone: 0 — Foundations
depends_on: []
blocks: [ENV-03, ENV-04, ENV-06, ENV-10, ENV-20, ENV-30, ENV-90, ENV-91, ENV-92]
package: root
prd: [§8]
estimate: M
---

# ENV-01 — Scaffold Bun-workspaces monorepo

## Context
The repo currently has a placeholder skeleton (`packages/*/package.json` +
placeholder `src/index.ts`, plus `spikes/`). This ticket turns it into a real,
buildable Bun-workspaces monorepo with shared tooling config, so every later
ticket has a consistent place to add code and a working `build`/`test`/`lint`.
The toolchain is already decided (ENV-02): rolldown-vite + oxlint + oxfmt + tsc.
Working reference config exists in `spikes/od2-toolchain/` — copy patterns from it.

## Goal
`bun install && bun run build && bun test && bun run lint` all succeed from the
repo root against the five packages + demo app, with shared TS/lint/format config.

## Prerequisites
- None. This is the foundation ticket.
- Read `spikes/od2-toolchain/FINDINGS.md` and its `vite.config.ts`,
  `tsconfig.json`, `measure.ts` — reuse those proven patterns.

## Implementation notes
1. **Root config**
   - Root `package.json` already declares `workspaces: ["packages/*","apps/*"]`.
     Add a `spikes/*`? **No** — keep spikes OUT of workspaces so they never leak
     into prod builds. Leave root scripts: `lint`, `format`, `format:check`,
     `test`, `build`, `e2e` (already present).
   - Add root `tsconfig.base.json` with the decided compiler options
     (`strict`, `module: ESNext`, `moduleResolution: bundler`,
     `useDefineForClassFields: false`, `experimentalDecorators: true`,
     `target: ES2022`, `lib: [ES2022, DOM, DOM.Iterable]`). Each package's
     `tsconfig.json` extends it.
   - Add root `.oxlintrc.json` (oxlint config) and an `oxfmt` config if oxfmt
     supports one (`oxfmt --init`); commit explicit style so it's deterministic.
2. **Per package** (`doc-model`, `core`, `renderer-mjml`, `react`, `vue`,
   `apps/demo`): give each a real `tsconfig.json` extending the base, a
   `vite.config.ts` (library mode for the 5 packages; app mode for demo) modeled
   on the spike, and a `build` script (`vite build`) + `test` script. Externalize
   `lit` (and framework peers) in library builds.
3. **Dependency graph** (use `workspace:*`): `core` → `doc-model`;
   `renderer-mjml` → `doc-model`; `react`/`vue` → `core`; `demo` → `core` +
   `renderer-mjml`. Already declared in the placeholder package.jsons — verify.
4. **Install the agreed runtime deps** at the right package:
   - `core`: `lit`, `@atlaskit/pragmatic-drag-and-drop`, `lexical` +
     `@lexical/rich-text` + `@lexical/clipboard` + `@lexical/html` +
     `@lexical/utils` (engine decided in ENV-57). **Do NOT install Tiptap.**
   - `renderer-mjml`: `mjml` (or `mjml-browser` — evaluate which fits; MJML runs
     at export, can be Node-side).
   - Keep placeholder `src/index.ts` files; real code arrives in later tickets.
5. **Replace** each placeholder `build` echo with a real `vite build`.

## Acceptance criteria
- [ ] `bun install` resolves all workspaces with no errors.
- [ ] `bun run build` builds all five packages to `dist/` (ESM + `.d.ts`).
- [ ] `bun test` runs (zero tests is fine now) and exits 0.
- [ ] `bun run lint` (oxlint) and `bun run format:check` (oxfmt) pass on the repo.
- [ ] `core` has Lexical + Pragmatic DnD + Lit installed; Tiptap is absent.
- [ ] Root `tsconfig.base.json`, `.oxlintrc.json` exist and are extended/used.
- [ ] `spikes/*` is NOT part of the workspaces graph.

## Out of scope
- CI wiring (ENV-03). Playwright harness (ENV-04). Any feature code.
- The bundle-size GATE enforcement (ENV-03) — but DO copy `measure.ts` into a
  shared `scripts/` location so ENV-03 can wire it.

## Verification
```bash
cd <repo>
bun install
bun run build
bun test
bun run lint
bun run format:check
# confirm Lexical present, Tiptap absent in core:
cat packages/core/package.json | grep -E "lexical|tiptap" || true
```

## Definition of done
See `_conventions.md`. All acceptance criteria + verification commands green;
status → `review`.
