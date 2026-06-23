---
id: ENV-11
title: Immutable update + patch-diff engine
status: done
priority: P0
milestone: 1 — Document model
depends_on: [ENV-10]
blocks: [ENV-12]
package: doc-model
prd: [§6.1]
estimate: M
---

# ENV-11 — Immutable update + patch-diff engine

## Context
Edits to the doc must be immutable (every edit yields a NEW doc, old one
untouched) and must produce a compact **patch diff** describing the change. The
patches — not full-document snapshots — are what undo/redo (ENV-12) stores, which
is how we hold the line on the potato-PC memory constraint. This is the mutation
layer over the ENV-10 types.

## Goal
`@enveloppe/doc-model` exports pure operations that return
`{ doc: EnveloppeDoc; patch: Patch; inverse: Patch }`, where applying `inverse`
to the new doc reproduces the original.

## Prerequisites
- ENV-10 done (types + validate + factory).

## Implementation notes
Create in `packages/doc-model/src/`:

1. **`patch.ts`** — a minimal patch format. Prefer a tiny, well-defined shape over
   pulling a dependency (budget; doc-model is also used headless). Sketch:
   ```ts
   export type Patch = PatchOp[];
   export type PatchOp =
     | { op: 'set'; path: Path; value: unknown }        // replace a field
     | { op: 'insert'; path: Path; index: number; value: unknown } // into children[]
     | { op: 'remove'; path: Path; index: number }      // from children[]
     | { op: 'move'; from: Path; fromIndex: number; to: Path; toIndex: number };
   export type Path = (string | number)[]; // structural path from doc root
   export function applyPatch(doc: EnveloppeDoc, patch: Patch): EnveloppeDoc; // immutable
   export function invertPatch(doc: EnveloppeDoc, patch: Patch): Patch;       // for undo
   ```
   `applyPatch` must use structural sharing (clone only the nodes on the changed
   path, reuse the rest) — do NOT deep-clone the whole tree (memory + perf).
2. **`operations.ts`** — high-level, ergonomic ops the editor calls. Each returns
   `{ doc, patch, inverse }` and never mutates input:
   - `updateNode(doc, id, partial)` — shallow-merge fields/style of a node.
   - `insertNode(doc, parentId, index, node)`.
   - `removeNode(doc, id)`.
   - `moveNode(doc, id, newParentId, newIndex)`.
   - `setRichText(doc, textBlockId, RichTextJSON)`.
   Resolve `id → path` internally (keep an id→path lookup or walk; walking is fine
   for email-sized docs).
3. **Invariants:** after any operation, `validateDoc(result.doc)` must still be
   `ok` (e.g. moving the last column should keep section validity, or the op
   rejects). Operations that would produce an invalid doc throw a typed error.
4. **Round-trip law (the core guarantee):** for any op,
   `applyPatch(result.doc, result.inverse)` deep-equals the original `doc`.
5. Export from `src/index.ts`.

## Acceptance criteria
- [ ] All five operations implemented, pure (input frozen/unchanged), returning
      `{ doc, patch, inverse }`.
- [ ] `applyPatch` uses structural sharing (unit-test: unchanged sibling node is
      `===` the original reference).
- [ ] **Inverse law** holds for every op type (property-style tests with several docs).
- [ ] Result docs always pass `validateDoc`; invalid ops throw a typed error.
- [ ] No new runtime dependency.
- [ ] Unit tests cover each op + the inverse law + structural-sharing (`bun test`).

## Out of scope
- The undo/redo STACK + history cap (ENV-12) — this ticket only produces the
  patch+inverse pairs it will store.
- Serialization (ENV-14).

## Verification
```bash
cd packages/doc-model
bun test
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. status → `review`.
