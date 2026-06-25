---
id: ENV-71
title: Declare /richtext side effects + optional build-granularity polish
status: ready
priority: P2
milestone: 10 — Release readiness
depends_on: [ENV-66]
blocks: []
package: core, mjml
prd: [§7, §8]
estimate: S
---

# ENV-71 — Declare /richtext side effects + (optional) tighten build granularity

## Context
Follow-up polish from the barrel/eager-load audit (verified). After ENV-66 introduced
the `@nord-forge/rime-core/richtext` deep entry, one `sideEffects` gap remains, plus a
couple of informational build-granularity notes.

## Findings being fixed
1. **`/richtext` registers 3 custom elements but is absent from `sideEffects`**
   (`rime-core/package.json` + `rich-text-toolbar.ts:196`, `link-popover.ts:141`,
   `token-picker/token-picker.ts:196`) — `richtext.ts` re-exports element classes whose
   modules `customElements.define()` at top level, yet `sideEffects` lists only
   `register.*`. A consumer importing only a pure value (e.g. `mountLexical`) from
   `/richtext` could have the three element registrations tree-shaken away. (The in-repo
   editor path is safe — the provider references the classes — so no test catches it.)
   Fix: add `./dist/richtext.js` + `./src/richtext.ts` to the `sideEffects` array.

## Optional (do only if touching the build)
- `rime-mjml` exposes no deep-import paths (single barrel mixes the `mjml`-pulling
  `MjmlRenderer` with light type contracts + escape helpers). Consider deep entries
  (e.g. `./contract`, `./html`) so a consumer wanting only the `Renderer` type or
  `escapeHtml` doesn't risk pulling `mjml`. Informational — rime-mjml is off the
  in-browser hot path.
- The pure-SDK closure currently collapses into one `live-region-*` chunk (misleading
  name; it's the whole SDK). Consider a `manualChunks` hint for clarity. Cosmetic.

## Goal
`/richtext`'s element registrations survive tree-shaking for all import shapes; build
granularity notes evaluated.

## Acceptance criteria
- [ ] `rime-core` `sideEffects` includes `./dist/richtext.js` + `./src/richtext.ts`.
- [ ] Importing a single value from `/richtext` still registers the three elements
      (verify against built output or a smoke import).
- [ ] Optional build-granularity items either applied or explicitly deferred with a
      one-line note.
- [ ] Size gate (incl. eager budgets, ENV-66) still passes.

## Out of scope
- Re-splitting the Lexical chunk (ENV-66 settled the eager boundary).

## Verification
```bash
bun run build && bun run size && bun run test
```

## Definition of done
See `_conventions.md`. `/richtext` side effects declared; build notes resolved;
status → `review`.
