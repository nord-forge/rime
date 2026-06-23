---
id: ENV-16
title: Doc → canvas renderer (WYSIWYG preview DOM)
status: done
priority: P0
milestone: 3 — Canvas & shell
depends_on: [ENV-15, ENV-05]
blocks: [ENV-19, ENV-27, ENV-33]
package: core
prd: [§6.2]
estimate: L
---

# ENV-16 — Doc → canvas renderer (WYSIWYG preview DOM)

## Context
This is the WYSIWYG: it turns the `EnveloppeDoc` JSON (the single source of truth,
ENV-05) into the **clean preview DOM** inside the canvas iframe (§6.2). Critically,
this is **NOT** the email export HTML — it renders modern, edit-friendly markup
(divs + flexbox), optimised for editing and hit-testing, while ghost-table/`mso`
email HTML is produced separately at export time (ENV-11, off the hot path). Updates
must be **incremental** (diff the doc, touch only changed nodes) — full re-renders on
every keystroke/drag would blow the §10 perf budget.

## Goal
Given an `EnveloppeDoc`, the renderer paints a divs/flex preview into the canvas
iframe's `#eb-root`, tags each node with its id for hit-testing, and updates
efficiently when the doc changes.

## Prerequisites
- ENV-15 done (`CanvasController` exposes `#eb-root` mount + `whenReady()`).
- ENV-05 done (`EnveloppeDoc`, node types, `validateDoc` from `@enveloppe/doc-model`).
- The doc is immutable and edits arrive as new docs / patches (ENV-06); the renderer
  consumes whole docs and may use patch info later for finer diffing.

## Implementation notes
Create under `packages/core/src/`:

1. **`canvas/render-node.ts`** — pure functions mapping each node type to preview
   DOM. One function per node; all return `HTMLElement` and stamp identity + type:
   ```ts
   // Every rendered element carries its node id so hit-testing/selection (ENV-17/40)
   // can resolve pointer → node via elementFromPoint → closest("[data-node-id]").
   function el(node: BaseNode, tag = "div"): HTMLElement {
     const e = document.createElement(tag);
     e.dataset.nodeId = node.id;
     e.dataset.nodeType = node.type;
     return e;
   }
   export function renderDocument(doc: DocumentNode, d: Document): HTMLElement; // centered, contentWidth, bg, font
   export function renderSection(n: SectionNode, d: Document): HTMLElement;     // block container, style/padding
   export function renderColumn(n: ColumnNode, d: Document): HTMLElement;       // flex child, flex-basis: widthPercent%
   export function renderText(n: TextBlock, d: Document): HTMLElement;          // rich text → DOM (see step 4)
   export function renderImage(n: ImageBlock, d: Document): HTMLElement;
   export function renderButton(n: ButtonBlock, d: Document): HTMLElement;
   export function renderDivider(n: DividerBlock, d: Document): HTMLElement;
   export function renderSpacer(n: SpacerBlock, d: Document): HTMLElement;
   ```
   - **Layout = modern, not email:** section is a block; its columns are a
     `display:flex` row with `flex-basis: <widthPercent>%`. Do **not** emit tables.
   - **Style mapping:** translate `BlockStyle` (padding*, backgroundColor, align)
     onto inline styles / classes. Keep a single `applyStyle(el, style)` helper.
2. **`canvas/canvas-renderer.ts`** — the `CanvasRenderer` orchestrator that owns the
   mount and incremental updates:
   ```ts
   export class CanvasRenderer {
     constructor(private mount: HTMLElement, private doc: Document) {}
     render(doc: EnveloppeDoc): void;      // first paint
     update(next: EnveloppeDoc): void;     // incremental diff vs current doc
     elementForNode(id: NodeId): HTMLElement | null;
     nodeIdAt(x: number, y: number): NodeId | null; // elementFromPoint → closest([data-node-id])
   }
   ```
3. **Incremental update strategy** — keep a `Map<NodeId, HTMLElement>`. On `update`:
   - Walk old vs new tree by id. **Unchanged** node (referentially equal subtree,
     courtesy of ENV-06 structural sharing) → skip entirely. **Changed props** →
     re-apply style/content to the existing element in place. **Added/removed/moved**
     children → insert/remove/reorder only those elements (use the id map; reuse
     existing DOM nodes on move rather than recreating).
   - Reordering must preserve element identity so an in-progress rich-text editor or
     drag state on a node survives a sibling change.
   - Avoid `innerHTML = ...` on the root; that nukes identity + is slow.
4. **Text blocks** — render `RichTextJSON` (the portable shape from ENV-05's
   `rich-text.ts`: paragraphs → runs with `marks`/`link`) into DOM as a read/preview
   rendering. The **live editor** (Lexical) is mounted onto this node only on focus
   by ENV-27 — this ticket just paints the static representation; do not import
   Lexical here.
5. **Wire into the shell** — after `CanvasController.whenReady()`, construct
   `CanvasRenderer(mount, doc)` and `render(currentDoc)`. When the editor's doc
   changes, call `update(nextDoc)`. Expose `nodeIdAt`/`elementForNode` for ENV-17/40.
6. **Validation guard** — assume the doc is valid (validated upstream); the renderer
   must not crash on an unknown type — render an inert placeholder element and warn,
   so a bad custom block can't blank the canvas.
7. **Budget** — pure DOM, no new runtime dep. Keep it lean; this is hot-path code.

## Acceptance criteria
- [ ] `render(doc)` paints document → sections → columns (flex) → leaf blocks into
      `#eb-root`; every element carries `data-node-id` + `data-node-type`.
- [ ] Columns lay out side-by-side via flex with widths matching `widthPercent`.
- [ ] `BlockStyle` (padding/background/align) is applied to the right elements.
- [ ] `update(next)` is incremental: an unchanged subtree's DOM element is the **same
      reference** before/after (asserted), and only changed nodes are touched.
- [ ] Moving a block reuses its existing element (identity preserved), not recreated.
- [ ] `nodeIdAt(x,y)` resolves a canvas pointer to the correct node id.
- [ ] Unknown node types render an inert placeholder without throwing.
- [ ] Output is divs/flex — **no `<table>`** in the preview DOM.

## Out of scope
- Email export HTML / MJML (ENV-11) — different render target entirely.
- Live rich-text editing instance (ENV-27) — only static text rendering here.
- Selection chrome, drop indicators, DnD (ENV-19/41), coordinate math (ENV-17).
- Block registration interface (ENV-33) — built-in types only for now.

## Verification
```bash
cd packages/core
bun test     # render shape, style mapping, incremental-update identity, nodeIdAt, unknown-type guard
bun run build
bun run lint
bun run e2e  # chromium + webkit: load a doc → columns sit side-by-side, data-node-id present, no <table>
```

## Definition of done
See `_conventions.md`. WYSIWYG preview renders + updates incrementally; size gate
green; status → `review`.
