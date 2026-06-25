---
id: ENV-24
title: ARIA live-region announcements
status: done
priority: P0
milestone: 4 — Drag & drop
depends_on: [ENV-23]
blocks: []
package: core
prd: [§6.6]
estimate: S
---

# ENV-24 — ARIA live-region announcements

## Context
§6.6 requires ARIA live-region announcements so screen-reader users hear the
result of structural changes — "Moved Button to Column 2, position 1 of 3".
ENV-23 left an `announce(msg)` hook on the keyboard-move path; this ticket builds
the actual polite live region and the message builder, and wires it to all three
structural events — move, insert, delete — from both the keyboard path (ENV-23)
and the pointer DnD path (ENV-19). Without spoken feedback the keyboard reorder
is unusable for non-sighted users, so this is a P0 a11y gate.

## Goal
Move, insert, and delete operations are announced via a polite ARIA live region
with a clear, positional message, verified to update the live region in
Chromium + WebKit.

## Prerequisites
- ENV-23 done (`KeyboardMoveController` with the `announce` hook + selection).
- ENV-19 done (pointer drops via `DndController`; hook its drop completion to
  announce too).
- ENV-05 node types (to label a block by a human name + read its position).

## Implementation notes
Create under `packages/core/src/a11y/`:

1. **`live-region.ts`** — `LiveAnnouncer`, owning one visually-hidden polite live
   region appended to the editor shell (host document, NOT the iframe — screen
   readers track the host).
   ```ts
   export class LiveAnnouncer {
     constructor(host: HTMLElement);     // creates <div aria-live="polite" aria-atomic="true" class="rime-sr-only">
     announce(message: string): void;    // sets textContent; clears+sets to force re-read of identical msgs
     destroy(): void;                    // remove the region (no leak)
   }
   ```
   - Use the standard visually-hidden pattern (`rime-sr-only`: 1px clip, off-screen)
     — NOT `display:none` (that suppresses announcements).
   - To force re-announcement of an identical message (e.g. two moves in the same
     direction), clear `textContent` then set it on the next frame.
2. **`announce-messages.ts`** — pure message builders so wording is testable:
   ```ts
   export function blockLabel(node: BaseNode): string;  // "Button", "Text", "Image"…
   export function moveMessage(node, toParentLabel, index, total): string;
     // "Moved Button to Column 2, position 1 of 3"
   export function insertMessage(node, parentLabel, index, total): string;
     // "Inserted Image into Column 1, position 2 of 2"
   export function removeMessage(node, fromParentLabel): string;
     // "Removed Divider from Column 3"
   ```
   - Parent label: "Column N" / "Section N" — derive N from the parent's index
     among its siblings (1-based, human-friendly). Position = `index + 1` of
     `total` children after the operation.
3. **Wire the events:**
   - ENV-23 `KeyboardMoveController.announce` → `LiveAnnouncer.announce(moveMessage(...))`.
   - ENV-19 `DndController` drop completion → announce `move`/`insert` accordingly
     (insert for palette drops, move for canvas-block drops).
   - The delete path (wherever a block is removed — selection toolbar `Delete`)
     → `removeMessage`. If delete UI does not exist yet, expose
     `announceRemove(node, parent)` for that future caller and at minimum wire the
     keyboard `Delete`/`Backspace` on a selected block here.
4. **One announcer instance** — owned by the editor shell, shared by both paths.
   Construct in the shell, pass into the controllers; `destroy()` on shell teardown.

## Acceptance criteria
- [ ] A single polite, visually-hidden live region exists in the shell (host doc),
      using the clip pattern (not `display:none`).
- [ ] Keyboard move announces e.g. "Moved Button to Column 2, position 1 of 3".
- [ ] Pointer drop announces insert (palette) / move (existing block) with the
      correct parent label + position.
- [ ] Delete announces "Removed <Block> from <Parent>".
- [ ] Repeating an identical move re-announces (region cleared+set), not silent.
- [ ] Message builders are pure + unit-tested for label, parent numbering, and
      `position X of Y`.
- [ ] Live region updates observed in Chromium + WebKit (assert `textContent`).
- [ ] `destroy()` removes the region (no leak).

## Out of scope
- The keyboard move semantics themselves (ENV-23) and pointer DnD (ENV-19).
- Selection chrome / toolbar visuals; full delete UI (only the announce hook +
  basic keyboard delete here).

## Verification
```bash
cd packages/core
bun test     # message builders (label, "Column N", "position X of Y"); LiveAnnouncer clears+sets for repeats
bun run build
bun run lint
bun run e2e  # chromium + webkit: perform move/insert/delete → live region textContent matches expected message
```

## Definition of done
See `_conventions.md`. Polite live region announcing move/insert/delete from both
input paths, cross-browser; status → `review`.
