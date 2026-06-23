---
id: ENV-08
title: CRDT-friendly shape audit (design only)
status: ready
priority: P1
milestone: 1 — Document model
depends_on: [ENV-05]
blocks: []
package: doc-model
prd: [§6.1]
estimate: S
---

# ENV-08 — CRDT-friendly shape audit (design only)

## Context
Real-time collaboration is explicitly out of scope for v1, but the PRD (§3, §6.1) promises the
doc model is shaped so a **Yjs/CRDT layer can slot in later without a rewrite**. This ticket
is a **design-only audit** — it ships **no runtime feature**. It documents where the ENV-05
node identity + children-ordering choices will or won't block a future CRDT, and records
concrete recommendations as an ADR so later collaboration work (and any change to ENV-05/11)
inherits the constraints. No code, no new exports, no new deps.

## Goal
A reviewed ADR at `packages/doc-model/docs/crdt-readiness.md` that states, with concrete
references to the ENV-05 types, what is CRDT-ready, what is a risk, and what (if anything)
should change now versus later.

## Prerequisites
- ENV-05 done (the `types.ts` node tree, `NodeId`, `children[]` arrays exist to audit).
- Familiarity with the Yjs shared types (`Y.Map`, `Y.Array`, `Y.Text`) — name them concretely
  in the ADR; do not add `yjs` as a dependency.

## Implementation notes
Create **one markdown file**: `packages/doc-model/docs/crdt-readiness.md`. (Create the `docs/`
dir if absent.) No `src/` changes, no exports, no tests. Structure it as a lightweight ADR:

1. **Status / context** — "design only, v1 ships no CRDT; this records readiness." Link back to
   PRD §6.1 and ENV-05.
2. **What's already CRDT-friendly** — cite the actual ENV-05 shapes:
   - **Stable node identity (✓).** Every node has a required, unique `NodeId` (ENV-05
     `BaseNode.id`). Stable ids are the precondition for mapping each node to a CRDT object and
     for conflict-free reference. Confirm the id factory is collision-resistant enough for
     concurrent generation (note: client-prefixed ids or UUIDs avoid cross-client collisions —
     flag if the current counter+random factory needs a per-client seed later).
   - **Tree of maps.** Each node ↔ a `Y.Map` keyed by field; `settings`/`style` objects ↔
     nested `Y.Map`. Scalar fields (numbers, strings, enums) merge with last-writer-wins, which
     is acceptable for style props.
3. **The ordering concern (the real risk).** `children[]` is a plain JS array (ENV-05
   `DocumentNode.children`, `SectionNode.children`, `ColumnNode.children`). Plain arrays are
   **index-addressed**, and ENV-06 patches use numeric `index` for `insert`/`remove`/`move`.
   Concurrent index-based edits are the classic CRDT failure (two clients insert at index 2 →
   ambiguous order / lost intent). Document concretely:
   - A `Y.Array` of node-ids (or `Y.Array` of `Y.Map`) gives conflict-free ordering — the CRDT
     would **attach at the `children` arrays**, not at the scalar fields.
   - ENV-06's `move` op (`from`/`to` index) is the operation most at odds with a CRDT; note that
     a future Yjs binding maps it to a `Y.Array` delete+insert and that **intent may not survive
     concurrent moves** — call this an accepted v1 limitation, not a blocker.
   - Recommend that nothing in v1 should rely on array **index** as a stable identity (always
     resolve by `id`); confirm ENV-06 operations are id-addressed at the API surface (they are:
     `updateNode(doc, id, …)`), and that index only appears inside patches.
4. **Where a CRDT would attach** — a small diagram/table: `document` map → `children` `Y.Array` →
   `section` map → `children` `Y.Array` → … → leaf map. Rich text (`TextBlock.content`,
   ENV-05 `RichTextJSON`) → maps to `Y.Text`/`Y.XmlFragment`; note the portable RichTextJSON
   shape is convertible but is **not itself** a CRDT (the editor engine, ENV-27, owns live
   collaborative text later).
5. **Concrete recommendations** — a short checklist of "do now (cheap, prevents rewrite)" vs
   "defer to the collab milestone." E.g. *do now:* keep all public ops id-addressed; keep
   `children` the only ordered arrays; ensure ids are globally unique-able. *Defer:* the actual
   Yjs binding, awareness/cursors, the `move`-intent question.
6. **Decision** — one line: the ENV-05 shape is CRDT-ready **provided** the array-ordering and
   id-uniqueness notes above are honored; no ENV-05/11 change is required for v1.

Keep it concise (1–2 pages). It is a reference doc, not a tutorial.

## Acceptance criteria
- [ ] `packages/doc-model/docs/crdt-readiness.md` exists and is a self-contained ADR.
- [ ] It cites the **actual** ENV-05 symbols (`NodeId`/`BaseNode.id`, the per-node `children[]`
      arrays, `RichTextJSON`) and ENV-06's index-based patch ops by name — not generic prose.
- [ ] It explicitly flags the **children-array ordering / index-based `move`** concern and names
      `Y.Array` as the resolution and the attach point.
- [ ] It marks **stable ids** as ✓ and notes any cross-client uniqueness caveat for the id factory.
- [ ] It ends with a concrete do-now-vs-defer recommendation list and a one-line decision.
- [ ] **No** `src/` changes, **no** new exports, **no** new runtime dependency (`yjs` is named in
      prose only, not installed).

## Out of scope
- Any actual CRDT/Yjs integration, awareness, or cursors (a future collaboration milestone).
- Changing the ENV-05 types or ENV-06 patch format (this audit may *recommend* future changes
  but does not make them).
- Code, tests, or benchmarks.

## Verification
```bash
test -f packages/doc-model/docs/crdt-readiness.md && echo "ADR present"
# sanity: the ADR references the real symbols it audits
grep -Eq "NodeId|children|RichTextJSON" packages/doc-model/docs/crdt-readiness.md && echo "cites ENV-05 symbols"
grep -Eq "Y\\.Array|ordering|index" packages/doc-model/docs/crdt-readiness.md && echo "covers ordering concern"
# confirm no stray dependency was added
! grep -q '"yjs"' packages/doc-model/package.json && echo "no yjs dep added"
```

## Definition of done
Design-only: the ADR exists, is reviewed, and meets the acceptance criteria. No code/tests are
introduced, so the `bun test`/bundle gates are N/A; `oxfmt`/`oxlint` over source still clean
(nothing changed). status → `review`. (See `_conventions.md` for the general gate.)
