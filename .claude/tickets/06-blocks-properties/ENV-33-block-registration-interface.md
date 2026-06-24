---
id: ENV-33
title: Block registration interface (registerBlock)
status: done
priority: P0
milestone: 6 — Blocks & properties
depends_on: [ENV-16, ENV-11]
blocks: [ENV-34, ENV-35, ENV-36, ENV-37, ENV-38, ENV-41, ENV-51]
package: core
prd: [§6.8]
estimate: L
---

# ENV-33 — Block registration interface (registerBlock)

## Context
Extensibility is a primary product goal (§6.8): integrators register custom blocks,
and the **built-in blocks use the exact same path** — there is no privileged
internal block API. A block is a hybrid of declarative data (schema, palette) and
functions (render). This ticket defines the `registerBlock` contract + a registry
that the properties panel (ENV-35), palette (ENV-36), canvas renderer (ENV-16), and
MJML renderer (ENV-11) all read from. Getting this seam right is what makes ENV-34
(core blocks) and ENV-37 (the SDK proof) fall out cleanly. The README shows the
target shape — match it exactly.

## Goal
`@nord-forge/rime-core` exports `registerBlock(def)` plus a `BlockRegistry` such that a
single definition (`{ schema, renderCanvas, renderExport, palette }`) wires a block
into the palette, properties panel, canvas preview, and export — and the seven core
blocks are registered through this same function with no special-case path.

## Prerequisites
- ENV-16 done (`CanvasRenderer`, `render-node.ts` — the canvas mount/diff this feeds).
- ENV-11 done (`BlockRenderer` registry seam in `renderer-mjml` — `renderExport`
  output must be consumable by `docToMjml`).
- ENV-05 types (`BaseNode`, `BlockStyle`, `RichTextJSON`) for prop typing.

## Implementation notes
Create under `packages/core/src/blocks/`:

1. **`schema.ts`** — the schema DSL that drives the properties form (ENV-35). Keep it
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
   import type { BaseNode, BlockStyle } from "@nord-forge/rime-model";
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
    *  HTML string flagged via { raw: true } (ENV-12 fallback path). */
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
   - **Canvas (ENV-16):** `render-node.ts`'s dispatch resolves a node's element via
     `blockRegistry.get(node.type).renderCanvas(node, ctx)`. Built-ins move behind
     this in ENV-34; here, provide the dispatch helper
     `renderNodeViaRegistry(node, ctx)` and an inert placeholder for unknown types.
   - **Export (ENV-11):** expose a function that turns `renderExport` output into the
     `BlockRenderer` shape `docToMjml` already consumes (`{ mjml }` → inline,
     `{ raw }` → raw-table passthrough for ENV-12). Keep the renderer-mjml package
     free of a `@nord-forge/rime-core` import — pass the registry's export functions **in**
     (the editor calls the renderer with a doc; the renderer stays standalone). For
     core-block export, ENV-34 registers handlers that mirror ENV-11's built-in
     mapping; document that the registry is the SDK seam, ENV-11's hardcoded handlers
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
      ENV-11 `BlockRenderer` shape without `renderer-mjml` importing `core`.
- [ ] The public `BlockDefinition` shape matches the README `registerBlock` example.
- [ ] Built-in blocks have **no privileged path** — the design has them call
      `registerBlock` (verified by ENV-34; here, no built-in is hardcoded into dispatch).
- [ ] Unit tests cover register/duplicate/get/byCategory and both render adapters
      (`bun test`). Core bundle still within budget.

## Out of scope
- Implementing the seven core blocks (ENV-34) — this is the interface only.
- The properties-panel UI (ENV-35), palette UI (ENV-36), example custom block (ENV-37).
- `replaceBlock`/host overrides of built-ins. `registerToken` (ENV-41).

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
