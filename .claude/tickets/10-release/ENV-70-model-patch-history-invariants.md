---
id: ENV-70
title: Model correctness — patch round-trip + history coalesce invariant
status: done
priority: P2
milestone: 10 — Release readiness
depends_on: [ENV-07, ENV-09]
blocks: []
package: model
prd: [§6.1, §6.10]
estimate: S
---

# ENV-70 — Model correctness: patch round-trip + history coalesce invariant

## Context
Two latent model-layer correctness items surfaced by the audit (both verified;
severity lowered to low/medium). Neither breaks current behavior, but both violate a
stated invariant and would bite a future change.

## Findings being fixed
1. **`invertPatch` of an additive `set` emits `value: undefined`**
   (`patch.ts:153-156,48-67`) — undoing a `set` that ADDED a previously-absent optional
   field leaves `{key: undefined}` on the object instead of deleting the key. So
   `deserialize(serialize(undoneDoc))` no longer deep-equals the undone doc (the key
   vanishes through JSON). Masked today because the existing test uses `toEqual`
   (which treats `{a: undefined}` == `{}`). Fix: have `setAtPath` delete the key when
   value is `undefined` (or emit an explicit unset op), and add a
   serialize-round-trip-AFTER-undo test.
2. **History coalescing assumes only single absolute `set` ops coalesce**
   (`history.ts:97-101,128-133`) — redo of a coalesced burst replays only the LAST
   forward patch, correct solely because the only coalescing op today is `setRichText`
   (one absolute set). A future `coalesceKey` on a structural/relative op would desync
   undo/redo silently. Fix: document + assert the single-absolute-set invariant (or
   accumulate forward patches), and add a redo-after-coalesce test.

## Goal
Undo of an additive set restores serialize round-trip identity; the history
coalescing invariant is enforced or documented with a guarding test.

## Acceptance criteria
- [ ] After undoing a set that added an optional field, the key is ABSENT (not
      `undefined`); `deserialize(serialize(doc))` deep-equals the undone doc.
- [ ] A redo-after-coalesce test passes and a comment/assert pins the
      single-absolute-set coalescing invariant.
- [ ] All existing model tests still pass.

## Out of scope
- Reworking the patch/diff representation; CRDT layer.

## Verification
```bash
cd packages/rime-model && bun test
```

## Definition of done
See `_conventions.md`. Patch round-trip identity restored; coalesce invariant guarded;
status → `review`.
