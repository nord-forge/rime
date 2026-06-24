# ADR: CRDT readiness of the document model

**Status:** Accepted — design only. v1 ships **no** CRDT/collaboration runtime.
This document records how the current `@nord-forge/rime-model` shape will accept a
future Yjs/CRDT layer "without a rewrite" (PRD §3, §6.1), and the constraints
later work must honor.

**Scope:** audit only. No `src/` changes, no new exports, no dependency on `yjs`
(named in prose only). This is a reference doc, not an implementation.

---

## Context

The doc model is a single immutable JSON tree (`types.ts`): a `DocumentNode`
whose `children` are `SectionNode`s, whose `children` are `ColumnNode`s, whose
`children` are `LeafBlock`s (text/image/button/divider/spacer). Edits go through
the immutable patch engine (`patch.ts`) via id-addressed operations
(`operations.ts`). The question: can a Yjs binding attach to this shape later
without reshaping the model?

## What is already CRDT-friendly

- **Stable node identity (✓).** Every node carries a required, unique `NodeId`
  (`BaseNode.id` in `types.ts`). Stable ids are the precondition for mapping each
  node to a CRDT object and for conflict-free reference across replicas.
  - **Caveat — cross-client uniqueness.** The default `createIdFactory()`
    (`factory.ts`) is `counter + 16-bit Math.random` with **no per-client seed**.
    That is fine single-client, but two clients generating concurrently can
    collide. Before collaboration, the factory must produce globally unique ids
    (per-client prefix / actorId, or UUIDv4). `IdFactory` is already injectable,
    so this is a config change at the collab milestone, **not** a model change.
- **Tree of maps maps cleanly.** Each node ↔ a `Y.Map` keyed by field; the
  nested `settings` (`DocumentSettings`) and per-node `style` (`BlockStyle`)
  objects ↔ nested `Y.Map`s. Scalar fields (numbers, strings, the `align`/`type`
  enums) merge last-writer-wins, which is acceptable for style/props.
- **Pure, serializable data.** Nodes contain no functions or class instances
  (enforced by the schema + `validateDoc`), so each maps to a CRDT value
  directly.

## The ordering concern (the real risk)

`children` is a plain JS array on `DocumentNode`, `SectionNode`, and
`ColumnNode`. Plain arrays are **index-addressed**, and the patch ops in
`patch.ts` — `insert`, `remove`, and especially `move` — carry a numeric
`index` / `fromIndex` / `toIndex`. Concurrent index-based edits are the classic
CRDT failure mode: two clients each insert "at index 2" and the result is an
ambiguous order or lost intent.

Resolution and attach point:

- A **`Y.Array`** (of node-ids, or of the child `Y.Map`s) replaces each plain
  `children` array and gives conflict-free ordering. The CRDT attaches **at the
  `children` arrays**, not at the scalar fields.
- The **`move` op** (`from`/`fromIndex` → `to`/`toIndex`) is the operation most
  at odds with a CRDT. A Yjs binding maps it to a `Y.Array` delete + insert, and
  **move intent may not survive two concurrent moves** of the same node. This is
  an **accepted v1 limitation**, not a blocker.
- **Index must never be an identity.** Nothing in v1 should treat an array index
  as a stable handle. The public operations are already id-addressed
  (`updateNode(doc, id, …)`, `removeNode(doc, id)`, `moveNode(doc, id, …)`);
  numeric `index` appears **only inside patches**, resolved from an id at call
  time. Keep it that way.

## Where a CRDT would attach

```
DocumentNode            → Y.Map
  settings              → Y.Map (scalars: LWW)
  children              → Y.Array  ← ordering CRDT
    SectionNode         → Y.Map
      style             → Y.Map (LWW)
      children          → Y.Array ← ordering CRDT
        ColumnNode      → Y.Map
          children      → Y.Array ← ordering CRDT
            LeafBlock   → Y.Map
              (TextBlock.content: RichTextJSON) → Y.Text / Y.XmlFragment
```

Rich text: `TextBlock.content` is `RichTextJSON` (`rich-text.ts`) — a **portable,
engine-independent** shape, convertible to `Y.Text`/`Y.XmlFragment` but **not
itself a CRDT**. Live collaborative text is owned by the editor engine (Lexical)
at the collaboration milestone, not by this package.

## Recommendations

**Do now (cheap; prevents a future rewrite):**

- Keep every public operation **id-addressed**; never expose array index as a
  node handle.
- Keep `children` the **only** ordered arrays in the tree (so the CRDT has a
  single, well-known attach surface per node).
- Ensure ids can be made **globally unique** — `IdFactory` stays injectable;
  document that collab requires a per-client/UUID factory.
- Keep nodes pure/serializable (already enforced by `validateDoc`).

**Defer to the collaboration milestone:**

- The actual Yjs binding (`Y.Map`/`Y.Array`/`Y.Text`), document sync, and
  awareness/cursors.
- The concurrent-`move` intent question (accept delete+insert semantics for v1).
- Swapping the id factory for a client-seeded / UUID generator.

## Decision

The current `types.ts` shape is **CRDT-ready** provided the array-ordering and
id-uniqueness notes above are honored. **No change to the schema (`types.ts`) or
the patch format (`patch.ts`) is required for v1.**
