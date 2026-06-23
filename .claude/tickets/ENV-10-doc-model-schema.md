---
id: ENV-10
title: Document model schema + validation
status: ready
priority: P0
milestone: 1 — Document model
depends_on: [ENV-01]
blocks: [ENV-11, ENV-13, ENV-14, ENV-20, ENV-32, ENV-60]
package: doc-model
prd: [§6.1]
estimate: M
---

# ENV-10 — Document model schema + validation

## Context
The entire product hangs off ONE immutable JSON document tree — it is the single
source of truth that the canvas renders, the MJML renderer exports, and undo/redo
diffs. This ticket defines that tree's types and a validator. Get this right and
everything downstream is clean; get it wrong and every later ticket pays for it.
Pure, headless, framework-free — no Lit, no DOM, no Lexical here.

## Goal
`@enveloppe/doc-model` exports the `EnveloppeDoc` types + a `validateDoc()` that
accepts a value and returns a typed, validated doc or a list of errors.

## Prerequisites
- ENV-01 done (package builds, `bun test` runs).

## Implementation notes
Create in `packages/doc-model/src/`:

1. **`types.ts`** — the node tree. Sketch (refine as needed, keep it minimal):
   ```ts
   export type NodeId = string; // stable, unique; required on every node

   export interface BaseNode { id: NodeId; type: string; }

   export interface DocumentNode extends BaseNode {
     type: 'document';
     // global email settings (width, bg, font) — keep small for v1
     settings: { contentWidth: number; backgroundColor: string; fontFamily: string };
     children: SectionNode[];
   }
   export interface SectionNode extends BaseNode {
     type: 'section';
     style: BlockStyle;            // padding, bg, etc.
     children: ColumnNode[];       // 1..N columns
   }
   export interface ColumnNode extends BaseNode {
     type: 'column';
     widthPercent: number;         // columns in a section sum to 100
     style: BlockStyle;
     children: LeafBlock[];        // text/image/button/divider/spacer
   }
   export type LeafBlock = TextBlock | ImageBlock | ButtonBlock | DividerBlock | SpacerBlock;

   export interface TextBlock extends BaseNode {
     type: 'text';
     // rich text stored as PORTABLE JSON (engine-independent), see RichTextJSON
     content: RichTextJSON;
     style: BlockStyle;
   }
   export interface ImageBlock extends BaseNode {
     type: 'image';
     src: string; alt: string; href?: string; style: BlockStyle;
   }
   export interface ButtonBlock extends BaseNode {
     type: 'button';
     label: string; href: string; style: BlockStyle;
   }
   export interface DividerBlock extends BaseNode { type: 'divider'; style: BlockStyle; }
   export interface SpacerBlock extends BaseNode { type: 'spacer'; height: number; }

   export interface BlockStyle {
     paddingTop?: number; paddingRight?: number; paddingBottom?: number; paddingLeft?: number;
     backgroundColor?: string; align?: 'left' | 'center' | 'right';
     // extend per block; keep optional + serializable (no functions)
   }

   export type EnveloppeDoc = DocumentNode;
   ```
2. **`rich-text.ts`** — the portable rich-text shape (engine-independent so the
   doc model never imports Lexical). Reuse the shape proven in
   `.claude/spikes/od1-richtext/src/adapter.ts` (`RichTextJSON`: doc → paragraphs →
   text runs with `marks: ('bold'|'italic'|'underline')[]`). Add `link?: string`
   to a text run for the link mark.
3. **`validate.ts`** — `validateDoc(value: unknown): { ok: true; doc: EnveloppeDoc } | { ok: false; errors: ValidationError[] }`.
   - Hand-written validator (NO heavy schema lib — budget; this package is also
     used headless/server-side). Check: every node has a unique `id` and a known
     `type`; children types are legal for their parent (document→section→column→
     leaf); column `widthPercent` values in a section sum to ~100 (±1 for rounding);
     numbers are finite; no extra/unknown node types.
   - `ValidationError = { path: string; message: string }` (path like
     `children[0].children[2].widthPercent`).
4. **`factory.ts`** — helpers `createEmptyDoc()`, `createSection()`,
   `createColumn(widthPercent)`, `createTextBlock()`, etc. Each assigns a fresh
   `id`. **ID generation:** accept an injectable id factory
   `(prefix?: string) => string` defaulting to a counter+random; do NOT call
   `Date.now()`/`Math.random()` at module top-level (keep pure/testable).
5. Export everything from `src/index.ts`.

## Acceptance criteria
- [ ] `EnveloppeDoc` + all node types exported and documented with short doc comments.
- [ ] `validateDoc()` accepts a valid doc and returns `{ ok: true, doc }`.
- [ ] `validateDoc()` rejects: duplicate ids, unknown node types, illegal parent→child
      nesting, columns not summing to 100, with precise `path` in each error.
- [ ] Factory helpers produce valid docs (round-trip through `validateDoc` → ok).
- [ ] Zero runtime deps added (hand-written validator). No DOM/Lit/Lexical import.
- [ ] Unit tests in `*.test.ts` cover each acceptance criterion (`bun test`).

## Out of scope
- Immutable update / patch diffs (ENV-11). Undo (ENV-12). Serialize/load (ENV-14).
- Rendering of any kind. Block REGISTRATION interface (ENV-60) — this is just the
  built-in node TYPES.

## Verification
```bash
cd packages/doc-model
bun test
bun run build      # emits dist + .d.ts
bun run lint
```

## Definition of done
See `_conventions.md`. status → `review`.
