---
id: ENV-28
title: One live Lexical instance lifecycle
status: done
priority: P0
milestone: 5 — Inline rich text
depends_on: [ENV-27]
blocks: [ENV-49]
package: core
prd: [§6.7, §10]
estimate: M
---

# ENV-28 — One live Lexical instance lifecycle

## Context
The memory constraint (§6.7, §10) is explicit: **exactly one rich-text editor
instance alive at a time**, created when a TextBlock is focused and destroyed on
blur, regardless of how many text blocks the email contains. On a potato-PC, N
live contenteditable editors would be a memory + listener disaster. ENV-27 gave
us `mountLexical`/`destroy`; this ticket builds the controller that guarantees the
single-instance invariant across focus changes and is a §10 release-gate input
(ENV-49).

## Goal
Focusing any TextBlock mounts exactly one Lexical instance; focusing another or
blurring destroys the previous one — asserted that at most one instance is ever
live no matter how many text blocks exist.

## Prerequisites
- ENV-27 done (`mountLexical(blockEl, initial)` → `LexicalMount` with `destroy()`).
- ENV-16 (TextBlock elements rendered with `data-node-id` in the iframe;
  `elementForNode`).
- A way to read a TextBlock's current `RichTextJSON` from the doc to seed the
  editor (the doc is the source of truth).

## Implementation notes
Create under `packages/core/src/richtext/`:

1. **`richtext-lifecycle.ts`** — `RichTextLifecycle`, the single owner of the (at
   most one) live editor.
   ```ts
   export class RichTextLifecycle {
     private active: { nodeId: NodeId; mount: LexicalMount; el: HTMLElement } | null = null;
     constructor(private deps: {
       getDoc(): RimeDoc;
       contentDoc(): Document;                 // the iframe document
       elementForNode(id: NodeId): HTMLElement | null;
       onCommit(nodeId: NodeId, json: RichTextJSON): void; // ENV-30 blur write-back
     }) {}
     /** Focus a text block: tear down any active editor, mount on this one. */
     focus(nodeId: NodeId): void;
     /** Blur: serialize + commit (ENV-30) then destroy the active editor. */
     blur(): void;
     get activeNodeId(): NodeId | null;
     destroy(): void;  // blur + null refs
   }
   ```
2. **Single-instance invariant** — `focus(id)`:
   - If `active?.nodeId === id` → no-op (already editing it).
   - Else: if `active` exists, `blur()` it first (serialize + `destroy()`), THEN
     `mountLexical(el, json)` for the new node and set `active`. There is never a
     window with two live mounts — destroy precedes create.
3. **Focus wiring** — attach a `focusin`/`pointerdown` listener (in the iframe
   document) that maps the event target → nearest `[data-node-type="text"]` →
   `focus(nodeId)`. A `focusout` / clicking outside any TextBlock →
   `blur()`. Guard against the focus bouncing within the same editor (don't
   destroy+recreate on internal selection changes).
4. **Blur write-back hook** — on `blur()`, before `destroy()`, call
   `mount.toJSON()` and `deps.onCommit(nodeId, json)` so ENV-30 serializes back
   into the doc via ENV-06 `setRichText`. (ENV-30 implements `onCommit`; here just
   call the hook.)
5. **Interaction with DnD/keyboard-move** — when a drag or keyboard reorder
   starts, ensure any active editor is blurred/committed first (call `blur()`), so
   the doc is consistent before a structural op. Expose `blur()` for those callers.
6. **Leak discipline** — `destroy()` and every `blur()` fully release the previous
   mount (ENV-27's `destroy` already does `cleanup()` + `setRootElement(null)`);
   the lifecycle must not retain references to destroyed mounts. This feeds the
   §10 memory gate (no growth in live editors / listeners as you click through
   many text blocks).

## Acceptance criteria
- [ ] Focusing a TextBlock mounts exactly one Lexical editor on it.
- [ ] Focusing a different TextBlock destroys the previous editor before mounting
      the new one — at most one live instance at any moment (asserted via an
      instance counter that destroy precedes create).
- [ ] Blurring (clicking outside any TextBlock) destroys the active editor and
      fires the `onCommit` hook with current `toJSON()`.
- [ ] Re-focusing the same block while already editing it is a no-op (no
      destroy/recreate churn).
- [ ] Clicking through many TextBlocks in sequence never leaves >1 instance live
      and does not grow listener/editor counts (memory).
- [ ] `blur()` is callable by DnD/keyboard-move to commit before a structural op.
- [ ] Works in Chromium + WebKit (focus/blur transitions).

## Out of scope
- The actual serialize-into-doc implementation (ENV-30 `setRichText`) — only the
  `onCommit` hook call here.
- Toolbar/bubble UI (ENV-29), paste (ENV-31), IME/Safari nuances (ENV-32).

## Verification
```bash
cd packages/core
bun test     # focus→1 mount; focus-other→old destroyed before new mount; blur→destroy+onCommit; counter ≤1 always
bun run build
bun run lint
bun run e2e  # chromium + webkit: click through 3 text blocks → only one contenteditable live at a time
```

## Definition of done
See `_conventions.md`. Single-instance create-on-focus/destroy-on-blur enforced +
asserted; status → `review`.
