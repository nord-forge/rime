---
id: ENV-07
title: Undo/redo history stack
status: done
priority: P0
milestone: 1 — Document model
depends_on: [ENV-06]
blocks: []
package: doc-model
prd: [§6.1, §10]
estimate: M
---

# ENV-07 — Undo/redo history stack

## Context
The editor needs undo/redo, and the hard memory constraint (potato-PC target) forbids
storing full-document snapshots. ENV-06 already produces a `{ patch, inverse }` pair for
every operation; this ticket stacks those pairs into a **capped, memory-bounded** history
so the editor can step backward (apply `inverse`) and forward (re-apply `patch`). It also
coalesces bursts of rapid same-target edits (e.g. typing into one text block) into a single
history entry so a sentence isn't 40 undo steps. Pure, headless, framework-free — no Lit, no
DOM, no Lexical here.

## Goal
`@enveloppe/doc-model` exports a `History` that records patch/inverse pairs and exposes
`undo()` / `redo()` / `canUndo` / `canRedo`, with a configurable depth cap and same-target
coalescing.

## Prerequisites
- ENV-06 done (`applyPatch`, `invertPatch`, and the operations returning `{ doc, patch, inverse }`).
- Reuse ENV-06's `Patch` type and `applyPatch`; do NOT re-derive patches here.

## Implementation notes
Create in `packages/doc-model/src/`:

1. **`history.ts`** — the history container. It is the **owner of the current doc**: callers
   push the result of an ENV-06 operation, and the history tracks the resulting tree so
   `undo`/`redo` can return the right doc. Sketch (refine as needed):
   ```ts
   import type { EnveloppeDoc } from "./types";
   import type { Patch } from "./patch";
   import { applyPatch } from "./patch";

   export interface HistoryEntry {
     patch: Patch;       // forward (redo)
     inverse: Patch;     // backward (undo)
     /** coalescing key: same key + within window => merge into previous entry */
     coalesceKey?: string;
     /** wall-clock ms when recorded; injectable clock (see below) for tests */
     time: number;
   }

   export interface HistoryOptions {
     /** max number of entries kept; oldest dropped past this. Default 100. */
     maxDepth?: number;
     /** ms window inside which same-key edits coalesce. Default 500. */
     coalesceWindowMs?: number;
     /** injectable for deterministic tests; defaults to () => Date.now(). */
     now?: () => number;
   }

   export class History {
     constructor(initialDoc: EnveloppeDoc, options?: HistoryOptions);

     get doc(): EnveloppeDoc;          // current document
     get canUndo(): boolean;
     get canRedo(): boolean;

     /**
      * Record an applied operation. `next` is the doc AFTER applying `patch`.
      * Pushing while there is a redo stack clears the redo stack (standard model).
      * If `coalesceKey` matches the previous entry AND it's within the window AND
      * there is no redo stack, merge: keep the FIRST entry's `inverse`, replace its
      * `patch` with the new one, and adopt `next` as current doc.
      */
     push(next: EnveloppeDoc, patch: Patch, inverse: Patch, coalesceKey?: string): void;

     undo(): EnveloppeDoc;   // applies inverse of top undo entry; throws if !canUndo
     redo(): EnveloppeDoc;   // re-applies patch of top redo entry; throws if !canRedo

     clear(): void;          // reset both stacks (keeps current doc)
   }
   ```
2. **Two-stack model.** Keep an `undoStack: HistoryEntry[]` and a `redoStack: HistoryEntry[]`.
   - `push`: clear `redoStack`, then either coalesce into `undoStack[last]` or append a new
     entry. After appending, if `undoStack.length > maxDepth`, drop from the **front**
     (oldest) — this is the memory cap.
   - `undo`: pop from `undoStack`, set `doc = applyPatch(doc, entry.inverse)`, push the entry
     onto `redoStack`, return new doc.
   - `redo`: pop from `redoStack`, set `doc = applyPatch(doc, entry.patch)`, push the entry
     back onto `undoStack`, return new doc.
3. **Coalescing.** Only coalesce when: `coalesceKey` is defined and equal to the previous
   entry's key, the previous entry's `time` is within `coalesceWindowMs` of `now()`, and the
   `redoStack` is empty. Typical key for typing = the edited text block's `NodeId` (e.g.
   `"text:" + nodeId`). The editor (ENV-27/53) supplies the key; this ticket only honors it.
   When coalescing: keep the original `inverse` (so one undo reverts the whole burst), swap in
   the latest `patch`, refresh `time`.
4. **Convenience wrapper (optional but recommended).** Add `record(result, coalesceKey?)`
   taking an ENV-06 op result `{ doc, patch, inverse }` so callers don't destructure:
   ```ts
   record(result: { doc: EnveloppeDoc; patch: Patch; inverse: Patch }, coalesceKey?: string): void;
   ```
5. **Purity / determinism.** No `Date.now()` / `Math.random()` at module top level; the clock
   is injectable via `options.now` (mirrors ENV-05's id-factory rule). `History` holds mutable
   internal stacks but never mutates any doc — all docs flow through `applyPatch` (immutable).
6. Export `History`, `HistoryEntry`, `HistoryOptions` from `src/index.ts`.

## Acceptance criteria
- [ ] `History` records pushed pairs; `canUndo`/`canRedo` reflect stack state accurately.
- [ ] `undo()` returns a doc deep-equal to the state before the last `push` (uses `inverse`);
      `redo()` returns the doc after re-applying `patch`. Round-trips for arbitrary op sequences.
- [ ] A new `push` after one or more `undo()`s clears the redo stack.
- [ ] Depth cap: with `maxDepth: N`, after `> N` pushes the oldest entries are dropped and the
      stack never exceeds `N` (assertable on length).
- [ ] Coalescing: multiple `push`es with the same `coalesceKey` inside `coalesceWindowMs`
      collapse to ONE undo entry that reverts the entire burst in a single `undo()`. Edits
      outside the window OR with a different key produce separate entries.
- [ ] No new runtime dependency. No DOM/Lit/Lexical import. Injectable `now` (tests are
      deterministic without faking timers).
- [ ] Unit tests in `*.test.ts` cover each acceptance criterion (`bun test`).

## Out of scope
- Producing patches/inverses (ENV-06 owns that) — this ticket only stacks them.
- Wiring undo to keyboard shortcuts or the editor UI (Milestone 3+).
- Choosing real coalesce keys for specific editor interactions (ENV-27/53 supply them).
- Persisting history across save/load (history is in-memory and ephemeral).

## Verification
```bash
cd packages/doc-model
bun test
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. status → `review`.
