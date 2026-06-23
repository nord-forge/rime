---
id: ENV-23
title: Keyboard reordering path (a11y)
status: done
priority: P0
milestone: 4 — Drag & drop
depends_on: [ENV-19]
blocks: [ENV-24]
package: core
prd: [§6.6]
estimate: M
---

# ENV-23 — Keyboard reordering path (a11y)

## Context
Accessibility is owned by Enveloppe regardless of the DnD engine (§6.6).
Screen-reader and keyboard users cannot drag, so a **parallel** input model is
mandatory, not optional: select a block, then move it up/down or into a sibling
column via the keyboard or a "move to" menu. Like DnD, every move mutates the doc
through ENV-06 ops — the keyboard path and the pointer path converge on the same
mutation layer, so behaviour and undo stay identical. The spoken feedback
(ARIA live announcements) is ENV-24, built directly on this ticket's events.

## Goal
A keyboard user can select a leaf block and move it up/down within its column,
across to an adjacent column, and reorder via a "move to" menu — each move
applying an ENV-06 op, with focus following the moved block.

## Prerequisites
- ENV-19 done (canvas blocks rendered with `data-node-id`; ENV-06 `moveNode`
  available; `dispatch` applies op results to editor state + re-render).
- ENV-16 `CanvasRenderer.elementForNode(id)` to move focus to the moved element.
- Selection state: a single "selected node id" owned by the editor (introduce a
  minimal selection store here if none exists yet).

## Implementation notes
Create under `packages/core/src/dnd/`:

1. **`keyboard-move.ts`** — `KeyboardMoveController`, owning selection + keyboard
   move semantics. Pure move logic is separated from key handling so it is
   unit-testable.
   ```ts
   export type MoveDirection = "up" | "down" | "into-prev-column" | "into-next-column";

   export interface KeyboardMoveDeps {
     getDoc(): EnveloppeDoc;
     dispatch(op: OpResult): void;             // ENV-06 result → editor
     getSelected(): NodeId | null;
     setSelected(id: NodeId | null): void;
     focusNode(id: NodeId): void;              // elementForNode(id)?.focus()
     announce(msg: string): void;              // ENV-24 hook (no-op stub until then)
   }

   export class KeyboardMoveController {
     constructor(private deps: KeyboardMoveDeps) {}
     /** Compute the target parent+index for a direction; null if not possible. */
     resolveMove(id: NodeId, dir: MoveDirection): DropTarget | null;
     /** Apply a move via ENV-06 moveNode; updates selection + focus + announce. */
     move(id: NodeId, dir: MoveDirection): boolean;
     handleKeydown(e: KeyboardEvent): void;    // attached to the editor shell
   }
   ```
2. **Key bindings** — on the focused/selected block (modifier chosen to not clash
   with rich-text editing, which owns plain arrows inside a focused TextBlock):
   - `Alt/Option + ArrowUp` → `move(id, "up")`, `Alt + ArrowDown` → `"down"`.
   - `Alt + ArrowLeft` / `Alt + ArrowRight` → `"into-prev-column"` /
     `"into-next-column"` (move to end of the adjacent column).
   - When at the top/bottom of a column, "up"/"down" can carry the block into the
     previous/next column's end/start (resolveMove decides; null if no neighbour).
   - Do NOT intercept arrows when a Lexical editor is focused inside a TextBlock
     (ENV-27/51) — guard on whether the active element is the live editor.
3. **"Move to" menu** — `<eb-move-to-menu>` Lit component: a small popover listing
   valid destinations (this column ↑/↓, each other column, each section) for the
   selected block, each invoking `move(...)` / a direct `moveNode` to an explicit
   target. Themed via `--eb-*`. Opened from a block's selection toolbar / a key
   (e.g. `Alt+M`). Fully keyboard-operable (roving focus, `Enter` to apply,
   `Esc` to close).
4. **Every move = ENV-06** — `move()` calls `moveNode(doc, id, target.parentId,
   target.index)` and `dispatch`es the result; never touches the DOM. After
   dispatch + re-render, call `setSelected(id)` and `focusNode(id)` so focus
   follows the block (critical for keyboard users) and `announce(...)` the result.
5. **Make blocks focusable** — ensure each rendered leaf block element is reachable
   (`tabindex="0"` or a roving tabindex managed here) so keyboard users can select
   one to move. Selection should also be settable by click (shared selection store).

## Acceptance criteria
- [ ] A selected block moves up/down within its column via keyboard, applying
      `moveNode` (doc + undo updated), with focus staying on the moved block.
- [ ] A selected block moves into an adjacent column via keyboard.
- [ ] At a column boundary, up/down carries the block to the neighbouring column
      (or is a no-op with no neighbour) — `resolveMove` unit-tested for edges.
- [ ] An `<eb-move-to-menu>` lists valid destinations and applies a move on
      selection; fully keyboard-operable (`Tab`/arrows/`Enter`/`Esc`), themed via
      `--eb-*`.
- [ ] Arrow keys are NOT hijacked while a Lexical text editor is focused.
- [ ] Every move goes through ENV-06 `moveNode`; no direct DOM mutation.
- [ ] `announce(...)` is called with a message on each move (content filled by
      ENV-24; here a hook + reasonable default string).

## Out of scope
- The actual ARIA live-region wiring + message wording polish (ENV-24).
- Pointer DnD (ENV-19), indicators (ENV-20), perf (ENV-21).

## Verification
```bash
cd packages/core
bun test     # resolveMove for up/down/across + boundary edges; move() calls moveNode + sets selection/focus/announce
bun run build
bun run lint
bun run e2e  # chromium + webkit: keyboard-only reorder within + across columns; focus follows; move-to menu works
```

## Definition of done
See `_conventions.md`. Keyboard reordering + move-to menu, all via ENV-06,
keyboard-operable; status → `review`.
