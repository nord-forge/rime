---
id: ENV-42
title: Public JSON in/out API (load / getDoc / change)
status: done
priority: P0
milestone: 8 — Persistence & images
depends_on: [ENV-09, ENV-14]
blocks: [ENV-44, ENV-45, ENV-46, ENV-48]
package: core
prd: [§6.10]
estimate: M
---

# ENV-42 — Public JSON in/out API (load / getDoc / change)

## Context
Persistence is headless (§6.10): the library emits and accepts JSON, the host owns
storage. This ticket wires the **public persistence surface** on `<rime-editor>`
that ENV-14 stubbed — `loadDoc(doc)`, `getDoc()`, and a `change` event emitting the
current doc — using the doc-model codec (ENV-09) for validation on load and the doc as
the single source of truth. The React/Vue wrappers (ENV-44/91) and demo (ENV-46) all
sit on top of this; get the contract right here.

## Goal
`<rime-editor>` exposes `loadDoc(doc)`, `getDoc()`, and a `change` CustomEvent
(`detail: { doc }`) that together let a host load JSON in, read it back out, and react
to every edit — all validated through ENV-09.

## Prerequisites
- ENV-09 done (`serialize`/`deserialize`, `validateDoc` via the codec — use these;
  don't re-validate by hand).
- ENV-14 done (the `loadDoc`/`getDoc`/`change` stubs + `RimeConfig`).
- The editor's internal doc state + the edit pipeline (ENV-06/32/62 emit new docs).

## Implementation notes
In `packages/core/src/rime-editor.ts` (and a small `persistence/` helper if it
keeps the element lean):

1. **Internal source of truth.** The editor holds the current `RimeDoc` (one
   immutable doc; edits replace it with a new doc + patch from ENV-06). Every consumer
   (canvas ENV-16, panel ENV-35) reads/writes through this single field.
2. **`loadDoc(input: RimeDoc): void`.** Validate via the codec. Accept a doc object
   directly; for a string, the host uses `deserialize` from `@nord-forge/rime-model`
   first (document this — the element takes a doc object; the wrappers/demo handle
   string ↔ doc). On invalid input, **throw** a typed error listing validation errors
   (don't silently no-op — the host needs to know its save was bad). On valid input,
   replace internal state, reset the canvas/selection, and **do not** emit `change`
   (loading is host-driven, not a user edit — prevents save loops).
3. **`getDoc(): RimeDoc`.** Return the current doc. Return a **structurally stable**
   reference (the immutable doc) — callers may `serialize` it. Never return internal
   mutable scratch state.
4. **`change` event.** Emit a `CustomEvent("change", { detail: { doc } })` whenever a
   **user edit** mutates the doc (palette drop, DnD reorder, property change, rich-text
   edit, undo/redo). `detail.doc` is the new immutable doc. Debounce/coalesce rapid
   edits (e.g. rich-text typing) to a bounded rate so hosts aren't flooded — but never
   drop the final state. Do **not** emit on `loadDoc`.
   - Match the README: `el.addEventListener("change", e => save(e.detail.doc))`.
5. **Initial doc.** If no doc is loaded, start from `createEmptyDoc()` (ENV-05 factory)
   so the editor is always in a valid state.
6. **Wrapper-friendliness.** Keep the surface plain DOM (methods + a `CustomEvent`) so
   the React/Vue wrappers (ENV-44/91) map props/events/refs onto it without special
   cases. `getDoc()` + `change` enable controlled-value usage.
7. **Budget** — no new runtime dep; reuse `@nord-forge/rime-model`.

## Acceptance criteria
- [ ] `loadDoc(doc)` validates via ENV-09, replaces editor state, repaints the canvas,
      and does **not** emit `change`.
- [ ] `loadDoc` throws a typed error (with validation errors) on an invalid doc.
- [ ] `getDoc()` returns the current immutable doc, serializable via `serialize`.
- [ ] A user edit (drop, reorder, property change, text edit, undo/redo) emits a
      `change` CustomEvent with the new doc in `detail.doc`; rapid edits are coalesced.
- [ ] Round-trip: `loadDoc(d)` then `getDoc()` deep-equals `d` for a valid `d`.
- [ ] The editor starts from a valid empty doc when nothing is loaded.
- [ ] The surface matches the README usage exactly.
- [ ] Unit tests cover load/get/round-trip/invalid-throw and change emission/coalescing;
      a Playwright test edits and asserts a `change` event fires (chromium + webkit).

## Out of scope
- React/Vue wrappers (ENV-44/91) — they consume this surface.
- `onImageUpload` (ENV-43). Any backend/storage (headless — host owns it).
- The doc codec internals (ENV-09).

## Verification
```bash
cd packages/core
bun test
bun run build
bun run lint
bun run e2e  # chromium + webkit: loadDoc → getDoc round-trip; edit fires `change`
```

## Definition of done
See `_conventions.md`. Headless JSON in/out + change events on the public element;
size gate green; status → `review`.
