---
id: ENV-40
title: Token picker UI
status: ready
priority: P1
milestone: 7 — Personalization tokens
depends_on: [ENV-39]
blocks: []
package: core
prd: [§6.9]
estimate: M
---

# ENV-40 — Token picker UI

## Context
Users need a way to insert merge tags without typing braces by hand (§6.9). This is a
custom Lit UI — a token picker — themed by `--eb-*`, matching the rest of the
100%-custom rich-text chrome (§6.5). It lists the available tokens (from the
`registerToken`/token-source config, ENV-41) and inserts the chosen one into the live
editor via ENV-39's `insertToken`. No library toolbar — ours.

## Goal
A Lit `<eb-token-picker>` lists available tokens (searchable, grouped by source) and,
on select, inserts a token node at the caret via `insertToken`, themed entirely by
`--eb-*`.

## Prerequisites
- ENV-39 done (`insertToken(token, label?)`, the token node + chip render).
- The available token list. ENV-41 supplies it; until then, accept a `tokens` property
  and document the wiring to the token registry. Shape: `{ key: string; label: string;
  source?: string }[]`.
- ENV-29 (the inline rich-text toolbar) is the natural place to surface the trigger —
  reuse its popover/positioning patterns and `--eb-*` theming.

## Implementation notes
Create under `packages/core/src/richtext/token-picker/`:

1. **`token-picker.ts`** — `EbTokenPicker extends LitElement` (`eb-token-picker`):
   ```ts
   @property({ attribute: false }) tokens: TokenItem[] = []; // from ENV-41 registry
   // emits nothing to the doc directly — calls insertToken() (ENV-39) on select
   ```
   - Render a searchable list (filter as the user types), grouped by `source` when
     present (e.g. "Contact", "Order"). Keyboard-navigable (↑/↓/Enter/Esc), focus-trapped
     while open, returns focus to the editor on close (a11y).
   - On select → `insertToken(item.key, item.label)` then close.
2. **Trigger + positioning.** Two entry points:
   - a button in the inline rich-text toolbar (ENV-29),
   - optionally a `{{` autocomplete trigger: when the user types `{{` in the editor,
     open the picker anchored at the caret (nice-to-have; gate behind a flag if it
     complicates ENV-27's IME handling — note the Safari/IME caution from R-1).
   Anchor the popover to the caret/selection rect; clamp to viewport. Reuse ENV-29's
   popover utility if one exists.
3. **Theming.** All of it via `--eb-*` (colors, radius, font, elevation). Shadow DOM;
   no host CSS bleed. Match the builder chrome.
4. **One-instance discipline.** The picker operates on the single live editor instance
   (ENV-28); if no text block is focused, the picker trigger is disabled.
5. **Empty/loading states.** "No tokens available" when the registry is empty (guides
   integrators toward `registerToken`).
6. **Budget** — Lit + a list; no combobox/search library. Lightweight fuzzy/substring
   filter inline.

## Acceptance criteria
- [ ] `<eb-token-picker>` lists provided tokens, searchable and grouped by `source`.
- [ ] Selecting a token calls `insertToken(key, label)` and inserts a chip at the caret
      in the live editor; the picker closes and returns focus to the editor.
- [ ] Fully keyboard-operable (open/navigate/select/close) and focus-managed (a11y).
- [ ] Themed entirely via `--eb-*`; Shadow DOM; no host CSS bleed.
- [ ] Disabled when no text block is focused; empty state when no tokens are registered.
- [ ] Unit tests cover filter/grouping and the insert call; a Playwright test opens the
      picker, selects a token, and asserts a chip is inserted (chromium + webkit).

## Out of scope
- The token node/data + `insertToken` (ENV-39). The token registry/config (ENV-41) —
  picker consumes the list.
- Conditionals/loops.

## Verification
```bash
cd packages/core
bun test
bun run build
bun run lint
bun run e2e  # chromium + webkit: open picker, pick token, chip inserted at caret
```

## Definition of done
See `_conventions.md`. Custom themed token picker inserts via ENV-39; size gate
green; status → `review`.
