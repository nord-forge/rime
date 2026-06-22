---
id: ENV-60
title: Block registration interface (registerBlock)
status: ready
priority: P0
milestone: 6 — Blocks & properties
depends_on: [ENV-32, ENV-21]
blocks: [ENV-61, ENV-62, ENV-63, ENV-64, ENV-65, ENV-72, ENV-103]
package: core
prd: [§6.8]
estimate: L
---

# ENV-60 — Block registration interface (registerBlock)

## Context
Extensibility is a primary product goal (§6.8): integrators register custom blocks,
and the **built-in blocks use the exact same path** — there is no privileged
internal block API. A block is a hybrid of declarative data (schema, palette) and
functions (render). This ticket defines the `registerBlock` contract + a registry
that the properties panel (ENV-62), palette (ENV-63), canvas renderer (ENV-32), and
MJML renderer (ENV-21) all read from. Getting this seam right is what makes ENV-61
(core blocks) and ENV-64 (the SDK proof) fall out cleanly. The README shows the
target shape — match it exactly.

## Goal
`@enveloppe/core` exports `registerBlock(def)` plus a `BlockRegistry` such that a
single definition (`{ schema, renderCanvas, renderExport, palette }`) wires a block
into the palette, properties panel, canvas preview, and export — and the seven core
blocks are registered through this same function with no special-case path.

## Prerequisites
- ENV-32 done (`CanvasRenderer`, `render-node.ts` — the canvas mount/diff this feeds).
- ENV-21 done (`BlockRenderer` registry seam in `renderer-mjml` — `renderExport`
  output must be consumable by `docToMjml`).
- ENV-10 types (`BaseNode`, `BlockStyle`, `RichTextJSON`) for prop typing.

## Implementation notes
Create under `packages/core/src/blocks/`:

1. **`schema.ts`** — the schema DSL that drives the properties form (ENV-62). Keep it
   small, serializable, and JSON-describable:
   ```ts
   export type FieldType =
     | "text" | "number" | "color" | "select" | "boolean"
     | "spacing"   // padding T/R/B/L group
     | "align"     // left | center | right
     | "url" | "richtext";
   export interface FieldDef {
     key: string;            // prop key on the node (dot-path allowed, e.g. "style.paddingTop")
     label: string;
     type: FieldType;
     options?: { value: string; label: string }[]; // for "select"
     min?: number; max?: number; step?: number;     // for "number"/"spacing"
     default?: unknown;
     group?: string;         // properties-panel section, e.g. "Spacing", "Colors"
   }
   export interface BlockSchema { fields: FieldDef[]; }
   ```
2. **`types.ts`** — the `BlockDefinition` (match README):
   ```ts
   import type { BaseNode, BlockStyle } from "@enveloppe/doc-model";
   import type { BlockSchema } from "./schema";

   /** Palette metadata + the default node props a freshly-dropped block gets. */
   export interface PaletteEntry {
     label: string;
     icon: string;            // emoji or inline SVG string
     category: string;        // grouping in the palette (e.g. "Layout", "Content")
     defaults: Record<string, unknown>; // initial node props (sans id/type)
   }

   /** Canvas render: return a fresh detached HTMLElement carrying data-node-id. */
   export type RenderCanvas<N extends BaseNode = BaseNode> =
     (node: N, ctx: CanvasRenderContext) => HTMLElement;
   export interface CanvasRenderContext {
     doc: Document;                       // the iframe document
     renderChild: (child: BaseNode) => HTMLElement; // delegate to nested nodes
   }

   /** Export render: return an MJML element string (preferred) or a raw-table
    *  HTML string flagged via { raw: true } (ENV-22 fallback path). */
   export type RenderExport<N extends BaseNode = BaseNode> =
     (node: N, ctx: ExportRenderContext) => ExportOutput;
   export type ExportOutput = { mjml: string } | { raw: string };
   export interface ExportRenderContext {
     renderChild: (child: BaseNode) => string; // serialized child output
     escape: (s: string) => string;
   }

   export interface BlockDefinition<N extends BaseNode = BaseNode> {
     type: string;                 // the node `type` this handles (e.g. "text")
     schema: BlockSchema;
     palette: PaletteEntry;
     renderCanvas: RenderCanvas<N>;
     renderExport: RenderExport<N>;
   }
   ```
3. **`registry.ts`** — the registry + public `registerBlock`:
   ```ts
   export class BlockRegistry {
     register(def: BlockDefinition): void;       // throws on duplicate `type`
     get(type: string): BlockDefinition | undefined;
     all(): BlockDefinition[];
     byCategory(): Map<string, BlockDefinition[]>; // for the palette
   }
   /** Module-level default registry used by the editor + the public API. */
   export const blockRegistry: BlockRegistry;
   export function registerBlock(def: BlockDefinition): void; // → blockRegistry.register
   ```
   - **Single registry instance** is the source of truth. Re-registering an existing
     `type` throws (built-ins register first; a host override is a deliberate,
     separate `replaceBlock` — out of scope here, just don't silently clobber).
   - The registry holds **no per-editor state**; it maps `type → definition` only.
4. **Wire the consumers (thin adapters, not re-renders):**
   - **Canvas (ENV-32):** `render-node.ts`'s dispatch resolves a node's element via
     `blockRegistry.get(node.type).renderCanvas(node, ctx)`. Built-ins move behind
     this in ENV-61; here, provide the dispatch helper
     `renderNodeViaRegistry(node, ctx)` and an inert placeholder for unknown types.
   - **Export (ENV-21):** expose a function that turns `renderExport` output into the
     `BlockRenderer` shape `docToMjml` already consumes (`{ mjml }` → inline,
     `{ raw }` → raw-table passthrough for ENV-22). Keep the renderer-mjml package
     free of a `@enveloppe/core` import — pass the registry's export functions **in**
     (the editor calls the renderer with a doc; the renderer stays standalone). For
     core-block export, ENV-61 registers handlers that mirror ENV-21's built-in
     mapping; document that the registry is the SDK seam, ENV-21's hardcoded handlers
     are the renderer's standalone default, and they must stay in sync for core types.
5. **Export** `registerBlock`, `blockRegistry`, `BlockRegistry`, `BlockDefinition`,
   `BlockSchema`, `FieldDef`, `PaletteEntry`, and the render context types from
   `packages/core/src/index.ts`. No `any` in public signatures.
6. **Budget** — pure TS + a Map; negligible weight. No new runtime dep.

## Acceptance criteria
- [ ] `registerBlock({ type, schema, renderCanvas, renderExport, palette })` registers
      a block; `blockRegistry.get(type)` returns it; `all()`/`byCategory()` expose it.
- [ ] Re-registering an existing `type` throws (no silent clobber).
- [ ] `renderCanvas` output is an `HTMLElement` stamped with `data-node-id`; the canvas
      dispatch helper resolves a node to its element via the registry.
- [ ] `renderExport` returns `{ mjml }` or `{ raw }`; an adapter converts it to the
      ENV-21 `BlockRenderer` shape without `renderer-mjml` importing `core`.
- [ ] The public `BlockDefinition` shape matches the README `registerBlock` example.
- [ ] Built-in blocks have **no privileged path** — the design has them call
      `registerBlock` (verified by ENV-61; here, no built-in is hardcoded into dispatch).
- [ ] Unit tests cover register/duplicate/get/byCategory and both render adapters
      (`bun test`). Core bundle still within budget.

## Out of scope
- Implementing the seven core blocks (ENV-61) — this is the interface only.
- The properties-panel UI (ENV-62), palette UI (ENV-63), example custom block (ENV-64).
- `replaceBlock`/host overrides of built-ins. `registerToken` (ENV-72).

## Verification
```bash
cd packages/core
bun test     # register/duplicate/get/byCategory, canvas+export adapters
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. registerBlock + registry + consumer seams in place; size gate
green; status → `review`.
