---
id: ENV-69
title: Lit chrome lifecycle & a11y hardening
status: ready
priority: P1
milestone: 10 — Release readiness
depends_on: [ENV-40]
blocks: []
package: core
prd: [§6.5, §10]
estimate: M
---

# ENV-69 — Lit chrome lifecycle & a11y hardening

## Context
The audit (all five items adversarially verified) found a cluster of small
lifecycle/cleanup and a11y gaps in the core Lit chrome. None is critical alone; together
they're the "discipline gaps" theme. One ticket — same subsystem, all small.

## Findings being fixed
1. **Palette drag sources registered only once** (`rime-editor.ts:275,385-393`) —
   `#registerPaletteSources` runs only in `firstUpdated`. When `config.enabledBlocks`
   changes at runtime, the palette re-renders fresh `.item` nodes that get no drag
   source, and old listeners leak on detached nodes (keyboard-add still works, masking
   it). Fix: re-run `#registerPaletteSources` from `updated()` when `enabledBlocks`
   changed, after `await this.#palette.updateComplete` (it already disposes prior regs).
2. **Properties-panel debounce timer never cleared on disconnect**
   (`properties/properties-panel.ts:144,159`) — the `setTimeout` flush has no
   `disconnectedCallback`; teardown between input and the 0 ms flush dispatches
   `eb-doc-change` from a detached element. Fix: `disconnectedCallback` that
   `clearTimeout`s `#flushHandle` and nulls `#pending`.
3. **`EbTokenPicker` mutates reactive `@state active` inside `render()`**
   (`richtext/token-picker/token-picker.ts:139`) — Lit anti-pattern (dev-mode
   change-in-update warning, possible extra render). Fix: clamp in `willUpdate`/
   `updated`, or compute a local read-only value for rendering.
4. **`MoveToMenu.updated()` unconditionally focuses the active item**
   (`dnd/move-to-menu/move-to-menu.ts:74-78`) — every reactive update (e.g.
   reassigning `destinations`) refocuses, stealing focus; it's on the public
   `/register` barrel. Fix: guard `focus()` with a focus-within check or a
   `#shouldFocus` flag set only on keyboard nav.
5. **Link popover lacks `dialog` role / focus trap / restore**
   (`richtext/ui/link-popover.ts:118-138,70-75`) — no `role="dialog"`/`aria-label`
   (unlike the token picker), Tab escapes into background controls, no focus restore
   for standalone consumers. Fix: add `role="dialog" aria-label`, trap Tab, restore
   focus on `hide()`.

## Goal
The core Lit chrome cleans up timers/listeners on disconnect, re-registers palette
drag sources on `enabledBlocks` change, and the link popover matches the token
picker's a11y (dialog role, focus trap, focus restore); no reactive writes in
`render()`.

## Acceptance criteria
- [ ] Changing `enabledBlocks` at runtime re-registers palette drag sources (new items
      draggable, no leaked listeners on detached nodes).
- [ ] Properties panel clears its debounce timer on disconnect (no dispatch from a
      detached element).
- [ ] `EbTokenPicker` no longer writes `active` during `render()`.
- [ ] `MoveToMenu` only focuses when focus is already within it (or on keyboard nav).
- [ ] Link popover has `role="dialog"`/`aria-label`, traps Tab, and restores focus on
      close.
- [ ] Unit/e2e cover the observable changes (palette re-register, popover focus); all
      green; size within budget.

## Out of scope
- The export-boundary sanitization (ENV-67) and the viewport rAF work (ENV-68).

## Verification
```bash
bun run test && bun run typecheck && bun run lint && bun run e2e && bun run size
```

## Definition of done
See `_conventions.md`. Chrome lifecycle/a11y gaps closed; status → `review`.
