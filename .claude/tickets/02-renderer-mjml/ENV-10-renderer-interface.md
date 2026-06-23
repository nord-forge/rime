---
id: ENV-10
title: Swappable Renderer interface
status: done
priority: P0
milestone: 2 — Export renderer (MJML)
depends_on: [ENV-05]
blocks: [ENV-11, ENV-12]
package: renderer-mjml
prd: [§6.3]
estimate: S
---

# ENV-10 — Swappable Renderer interface

## Context
Export is decoupled from MJML behind a swappable **`Renderer` interface** (PRD §6.3): the v1
default is `MjmlRenderer` (ENV-11), but a future hand-rolled renderer must be a **non-breaking
swap, not a rewrite**. This ticket defines that interface (and supporting types) so ENV-11 and
the per-block fallback (ENV-12) implement a contract rather than an ad-hoc function. The
interface is intentionally tiny and async, because the concrete renderer runs at **export
time** (Node-side, off the in-browser hot path) and the MJML compile step is async.

## Goal
`@enveloppe/renderer-mjml` exports a `Renderer` interface (`render(doc): Promise<string>`) plus
the shared types a renderer implementation needs, with no MJML coupling in the interface itself.

## Prerequisites
- ENV-05 done (`EnveloppeDoc` type to render against; imported via `workspace:*`).
- No MJML dependency in *this* ticket — the interface must not reference MJML types.

## Implementation notes
Create in `packages/renderer-mjml/src/`:

1. **`renderer.ts`** — the contract. Keep it minimal and engine-agnostic:
   ```ts
   import type { EnveloppeDoc } from "@enveloppe/doc-model";

   /** Options common to any renderer; concrete renderers may extend with their own. */
   export interface RenderOptions {
     /** Optional inline-CSS / minify toggles a renderer may honor. */
     minify?: boolean;
     /** Future: language/dir, default fonts, etc. Keep optional + serializable. */
   }

   /**
    * The swappable export contract. A renderer turns the immutable doc into a final
    * email-HTML string. Async because the default (MJML) compiles asynchronously and runs
    * at export, NOT on the canvas hot path.
    */
   export interface Renderer {
     render(doc: EnveloppeDoc, options?: RenderOptions): Promise<string>;
   }

   /** Thrown by renderers for a doc they cannot turn into HTML (vs. silently emitting junk). */
   export class RenderError extends Error {
     constructor(message: string, public readonly cause?: unknown);
   }
   ```
2. **Per-block seam (declare here, implement later).** The block → output mapping that ENV-11
   fills in and ENV-12 escape-hatches should be expressed as a typed seam so both tickets share
   one shape. Declare it here but leave it un-implemented:
   ```ts
   import type { EnveloppeDoc } from "@enveloppe/doc-model";
   type AnyNode = EnveloppeDoc | EnveloppeDoc["children"][number]; // narrow per node in ENV-11

   /** A renderer maps each block node to a fragment of its target markup. */
   export interface BlockRenderer<TNode = unknown> {
     /** node.type this handles, e.g. "button". */
     readonly type: string;
     /** produce the renderer-native fragment (MJML string for MjmlRenderer, raw table for fallback). */
     renderExport(node: TNode, ctx: RenderContext): string;
   }

   export interface RenderContext {
     /** render a child node by delegating back to the registry (for containers). */
     renderChild(node: unknown): string;
     options: RenderOptions;
   }
   ```
   ENV-11 wires a registry of `BlockRenderer`s; ENV-12 registers a raw-table `BlockRenderer` for
   blocks MJML can't express. This ticket only declares the types — no concrete block logic.
3. **Do NOT** import or depend on the `mjml` library here. The interface package surface must
   stay renderer-neutral so a non-MJML renderer can implement `Renderer` without touching MJML.
4. Export `Renderer`, `RenderOptions`, `RenderError`, `BlockRenderer`, `RenderContext` from
   `src/index.ts`. Add `@enveloppe/doc-model` as a `workspace:*` dependency if not already present.

## Acceptance criteria
- [ ] `Renderer` interface exported with `render(doc, options?): Promise<string>`; signature
      matches §6.3 (`render(doc) → email HTML`).
- [ ] `RenderOptions`, `RenderError`, `BlockRenderer`, `RenderContext` exported from `src/index.ts`.
- [ ] The interface module has **zero** dependency on the `mjml` library or any MJML type (a
      future non-MJML renderer can implement `Renderer` without importing MJML).
- [ ] A trivial in-test stub `class NoopRenderer implements Renderer { async render() { return ""; } }`
      type-checks against the interface (proves the contract is implementable and swap-friendly).
- [ ] No `any` in the public signatures. Unit/type tests confirm the shape (`bun test`).

## Out of scope
- The actual `MjmlRenderer` and any block → MJML mapping (ENV-11).
- The raw-table fallback implementation (ENV-12) — only the `BlockRenderer` seam is declared here.
- Rich-text → HTML conversion (ENV-11).

## Verification
```bash
cd packages/renderer-mjml
bun test
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. status → `review`.
