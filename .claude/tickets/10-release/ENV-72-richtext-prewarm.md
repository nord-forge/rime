---
id: ENV-72
title: Prewarm the rich-text editor at init (no first-focus stutter)
status: done
priority: P2
milestone: 10 — Release readiness
depends_on: [ENV-27, ENV-66]
blocks: []
package: core
prd: [§6.7, §10]
estimate: S
---

# ENV-72 — Prewarm the rich-text editor at init (no first-focus stutter)

## Context
Review question on the load behavior. Clarified the actual flow: the Lexical chunk is
`await import()`-ed at **editor init** (`firstUpdated` → `#initRichText`), NOT on first
focus — so the chunk download/parse is already off the focus path. But the very first
`mountLexical()` (create-on-focus, the ENV-28 single-instance lifecycle) still paid
Lexical's cold start (createEditor + node/plugin registration + first reconcile)
synchronous to the user's click — a possible first-edit micro-stutter. (The README also
mis-described this as "imported on first focus".)

## Goal
Pay Lexical's cold start during idle init time so the user's first text-block focus is
instant; correct the README.

## Implementation notes
1. `RichTextProvider.prewarm?()` (optional) — the Lexical provider mounts a throwaway
   editor on a DETACHED element (`mountLexical(scratch, emptyRichText()).destroy()`),
   exercising the cold path, then tears it down. Best-effort (try/catch); leaves zero
   live editors and never touches a real block or the single-instance invariant. The
   plain-text provider omits it (no-op).
2. The editor calls `prewarm()` after `#initRichText` resolves, scheduled via
   `requestIdleCallback` (fallback `setTimeout`) so warm-up never competes with first
   paint / canvas setup; guarded on `isConnected`.
3. README: corrected the import section — the chunk loads at init (not on first focus)
   and is warmed on idle; `lexicalEditor: false` never fetches it.

## Acceptance criteria
- [x] First text-block focus does not pay Lexical's cold start (warmed at init).
- [x] `prewarm()` leaves zero live editors; mount+destroy on a detached element works
      (unit test in `lexical-editor.test.ts`).
- [x] Single-live-instance lifecycle e2e still passes; full e2e green.
- [x] README import section reflects the real behavior.
- [x] Eager-load budgets unchanged (prewarm is reachable only via the dynamic chunk).

## Verification
```bash
bun run test && bun run typecheck && bun run lint && bun run build && bun run size && bun run e2e
```

## Definition of done
See `_conventions.md`. Rich text warmed at init; README accurate; status → `done`.
