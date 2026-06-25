---
id: ENV-29
title: Custom rich-text UI (toolbar / bubble / link popover)
status: done
priority: P0
milestone: 5 — Inline rich text
depends_on: [ENV-27]
blocks: []
package: core
prd: [§6.5]
estimate: L
---

# ENV-29 — Custom rich-text UI (toolbar / bubble / link popover)

## Context
All rich-text UI is **100% custom-rendered** as Lit components themed by `--rime-*`,
so the editing experience matches the builder design exactly; the engine is used
headless with no library-shipped toolbar (§6.5, §6.7). This ticket builds that
chrome — an inline/bubble toolbar and a link popover — living in the **host
document** (chrome side), wired to Lexical commands on the active editor that
ENV-27 mounted **inside the iframe**. The UI reads the current selection's format
to show active states and dispatches Lexical commands to change it.

## Goal
A custom Lit bubble toolbar and link popover, themed by `--rime-*`, drive
bold/italic/underline/link/list/heading on the active Lexical editor, with active
states reflecting the current selection, in Chromium + WebKit.

## Prerequisites
- ENV-27 done (Lexical mounted in-iframe; access to the active `LexicalEditor`).
- ENV-28 (the active editor / `activeNodeId`) so the toolbar targets the right
  instance and hides when no editor is live.
- ENV-17 coordinate controller (`canvasToHost`) to position the bubble toolbar
  over the in-iframe selection.
- `--rime-*` theme tokens (ENV-18).

## Implementation notes
Create under `packages/core/src/richtext/ui/`:

1. **`rich-text-commands.ts`** — a thin command facade so UI never touches Lexical
   internals directly:
   ```ts
   import { FORMAT_TEXT_COMMAND } from "lexical";
   import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
   import { $createHeadingNode } from "@lexical/rich-text";
   import { TOGGLE_LINK_COMMAND } from "@lexical/link";

   export interface RichTextCommands {
     toggleBold(): void;   // editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")
     toggleItalic(): void;
     toggleUnderline(): void;
     toggleBulletList(): void;
     toggleOrderedList(): void;
     setHeading(level: 1 | 2 | 3 | null): void; // null = paragraph
     setLink(href: string | null): void;        // null = remove link
   }
   export function makeCommands(editor: LexicalEditor): RichTextCommands;
   ```
   Adding list/link/heading requires registering their nodes/commands:
   `ListNode`/`ListItemNode` (`@lexical/list`, `registerList(editor)`) and
   `LinkNode` (`@lexical/link`) — add these nodes to the curated set in ENV-27's
   `createEditor({ nodes: [...] })` and register their plugins on mount. **Note
   the added gzip** (budget) — link pulls a little; lists a little. Keep the set
   minimal (only the features listed).
2. **`selection-format.ts`** — read the active selection's current formats so the
   toolbar shows active states. Use `editor.registerUpdateListener` /
   `registerCommand(SELECTION_CHANGE_COMMAND, ...)` to recompute on selection
   change inside an `editor.getEditorState().read(() => { const s = $getSelection();
   ... s.hasFormat("bold") ... })`, emitting a `FormatState`
   (`{ bold, italic, underline, list: "bullet"|"ordered"|null, heading: 1|2|3|null,
   link: string|null }`).
3. **`<rime-rich-text-toolbar>`** — the bubble toolbar Lit component:
   - Positioned over the current selection: get the selection's client rect from
     inside the iframe (`getSelection().getRangeAt(0).getBoundingClientRect()` in
     the iframe document), translate to host coords via `coords.canvasToHost`,
     render the floating bar above it. Reposition on selection/scroll change.
   - Buttons: B / I / U / bullet / ordered / H1–H3 / link. Each calls the
     corresponding `RichTextCommands` method; active state from `FormatState`
     (`aria-pressed`). Themed only with `--rime-*` (`--rime-color-surface`,
     `--rime-color-accent`, `--rime-radius`, `--rime-font-ui`).
   - Show only while an editor is active with a non-collapsed selection (or always
     while focused — your call, but hide when no active editor).
4. **`<rime-link-popover>`** — link editor: an input for the URL + apply/remove
   buttons, opened by the toolbar link button. Pre-fills from `FormatState.link`.
   Apply → `commands.setLink(href)`, remove → `setLink(null)`. Keyboard-operable
   (`Enter` apply, `Esc` close), themed via `--rime-*`. Validate/normalize the href
   minimally (allow `http(s):`, `mailto:`; reject `javascript:`).
5. **Keyboard shortcuts** — wire B/I/U to `Cmd/Ctrl+B/I/U` via Lexical's command
   registration on the editor (so they work whether or not the toolbar is visible).
6. **Accessibility** — toolbar buttons are real `<button>`s with `aria-pressed`
   and labels; the toolbar is reachable/operable by keyboard; focus management
   returns to the editor after applying a command.

## Acceptance criteria
- [ ] A custom Lit bubble toolbar appears over the active selection (positioned via
      `coords.canvasToHost`) and is themed only with `--rime-*` (no Lexical CSS).
- [ ] Bold / italic / underline toggle on the active editor and reflect the
      selection's current format as active states.
- [ ] Bullet + ordered list and H1–H3 / paragraph work via the toolbar
      (`@lexical/list` + heading nodes registered + added to the curated node set).
- [ ] A custom link popover sets/removes a link; pre-fills the current href;
      rejects `javascript:` URLs; keyboard-operable.
- [ ] `Cmd/Ctrl+B/I/U` shortcuts work via Lexical command registration.
- [ ] No Lexical-shipped UI/CSS imported; toolbar/popover are real buttons/inputs
      with correct ARIA.
- [ ] Added node deps' gzip cost noted; core still ≤ budget.
- [ ] Works in Chromium + WebKit.

## Out of scope
- Lifecycle (ENV-28), doc round-trip on blur (ENV-30), paste (ENV-31).
- Merge-tag/token picker (ENV-39/71). Slash/insert menu (future).

## Verification
```bash
cd packages/core
bun test     # makeCommands dispatches correct Lexical commands; FormatState derived from selection; href validation
bun run build
bun run lint
bun run size  # confirm list/link/heading additions keep core ≤ budget
bun run e2e   # chromium + webkit: select text → bubble toolbar → B/I/U/list/heading apply; link popover sets/removes
```

## Definition of done
See `_conventions.md`. Custom `--rime-*`-themed rich-text UI driving Lexical
commands, cross-browser, within budget; status → `review`.
