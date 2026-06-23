---
id: ENV-12
title: Raw-table fallback path
status: ready
priority: P1
milestone: 2 — Export renderer (MJML)
depends_on: [ENV-11]
blocks: []
package: renderer-mjml
prd: [§6.3]
estimate: S
---

# ENV-12 — Raw-table fallback path

## Context
Some blocks (especially future custom blocks) can't be expressed as MJML (OD-5). For those, the
renderer needs a **per-block escape hatch**: instead of emitting MJML, a block supplies
hand-authored, Outlook-safe table HTML that is spliced into the compiled output. This ticket adds
that seam to the ENV-11 renderer and documents it so block authors know how to opt out of MJML for
one block without affecting the rest. Bounded and per-block — not a second renderer.

## Goal
`@enveloppe/renderer-mjml` lets a block render via raw table HTML instead of MJML, with that HTML
landing correctly in the final compiled output, and the seam documented for block authors.

## Prerequisites
- ENV-11 done (`MjmlRenderer`, the `to-mjml.ts` `BlockRenderer` registry, `RenderContext`).
- ENV-10's `BlockRenderer`/`RenderContext` types (the seam this builds on).

## Implementation notes
The problem: MJML compiles a full MJML tree to HTML in one pass, so you can't just drop arbitrary
HTML mid-tree. Use MJML's **`<mj-raw>`** element, which passes its inner HTML through to the
compiled output untouched — that is the splice point.

1. **`raw-fallback.ts`** in `packages/renderer-mjml/src/` — a small helper + a way for a block to
   declare it renders raw:
   ```ts
   import type { BlockRenderer, RenderContext } from "./renderer";

   /**
    * Wrap hand-authored table HTML so MJML passes it through verbatim.
    * The author is responsible for Outlook-safe markup (tables, inline styles, mso conditionals).
    */
   export function rawTableFallback(html: string): string {
     return `<mj-raw>${html}</mj-raw>`;
   }

   /** Build a BlockRenderer that bypasses MJML mapping for a given node type. */
   export function createRawBlockRenderer<TNode>(
     type: string,
     toTableHtml: (node: TNode, ctx: RenderContext) => string,
   ): BlockRenderer<TNode> {
     return {
       type,
       renderExport: (node, ctx) => rawTableFallback(toTableHtml(node, ctx)),
     };
   }
   ```
2. **Wire it into the ENV-11 registry.** `docToMjml`'s dispatch already looks up a `BlockRenderer`
   by `node.type`. A raw block is just a `BlockRenderer` whose `renderExport` returns
   `<mj-raw>…</mj-raw>`. Confirm the registry lets a raw renderer **override or supplement** the
   built-in MJML handlers (so an author can replace `button` with a raw version, or add a new type).
   No special-case branch — the escape hatch reuses the same registration path (mirrors PRD §6.8's
   "built-ins use the same interface" philosophy).
3. **Placement constraint.** `<mj-raw>` is only valid in certain MJML positions (inside
   `<mj-body>`/`<mj-section>`/`<mj-column>` per MJML's rules). Document which container levels
   support raw fallback and validate (throw a clear `RenderError`) if a raw renderer is registered
   for a position MJML rejects, rather than emitting MJML that fails to compile.
4. **Document the seam.** Add a short section to the package README (or `docs/raw-fallback.md`) that
   shows a worked example: a custom block whose `renderExport` returns
   `createRawBlockRenderer('myblock', node => '<table role="presentation" …>…</table>')`, and notes
   the author owns Outlook-safety for that HTML. This is the OD-5 answer block authors will read.
5. Export `rawTableFallback`, `createRawBlockRenderer` from `src/index.ts`.

## Acceptance criteria
- [ ] `rawTableFallback(html)` and `createRawBlockRenderer(type, fn)` exported and usable as a
      `BlockRenderer` in the ENV-11 registry.
- [ ] A doc containing a block registered with a raw renderer compiles, and the **exact** authored
      table HTML appears verbatim in the final compiled output (asserted by substring).
- [ ] A raw renderer can **override** a built-in core block (e.g. swap `button` for a raw table)
      via the same registration path — no special-case code branch.
- [ ] Registering a raw renderer at an MJML-invalid position throws a clear `RenderError` (no
      silent broken output).
- [ ] The seam is documented with a worked custom-block example noting author-owned Outlook-safety.
- [ ] Unit tests cover: verbatim passthrough, override of a built-in, and the invalid-position error
      (`bun test`).

## Out of scope
- Authoring real raw-table HTML for any specific built-in block (the core blocks ship as MJML in
  ENV-11; this is the mechanism, not a catalog of fallbacks).
- The `registerBlock` SDK that custom blocks use end-to-end (ENV-33) — this only provides the
  export-side seam it will call.
- Client-correctness verification of fallback output (ENV-13 / manual matrix).

## Verification
```bash
cd packages/renderer-mjml
bun test
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. status → `review`.
