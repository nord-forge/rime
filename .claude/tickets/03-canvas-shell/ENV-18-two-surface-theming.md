---
id: ENV-18
title: Two-surface theming + no-CSS-bleed guarantee
status: done
priority: P1
milestone: 3 — Canvas & shell
depends_on: [ENV-14]
blocks: []
package: core
prd: [§6.5]
estimate: S
---

# ENV-18 — Two-surface theming + no-CSS-bleed guarantee

## Context
Enveloppe has two visually distinct surfaces with deliberately separate styling
channels (§6.5): the **chrome** (palette, panels, toolbars — Lit shadow DOM) themed
by `--eb-*` CSS custom properties that intentionally pierce shadow boundaries, and
the **canvas** (the email preview iframe) styled by an injected base stylesheet that
is walled off from both the host app and the chrome theme. This ticket formalises
that contract and, most importantly, proves the wall holds: **no host CSS and no
chrome `--eb-*` token bleeds into the canvas**. The bleed-proof is the whole point —
truthful email preview depends on it. The piercing-token pattern is already proven
in `.claude/spikes/od2-toolchain/` (CSS var applies through shadow DOM in Chromium + WebKit).

## Goal
Document and enforce the two-surface model: `--eb-*` themes chrome only; the canvas
is styled solely by its injected base stylesheet; a Playwright test proves neither
host CSS nor `--eb-*` reaches inside the canvas — in Chromium + WebKit.

## Prerequisites
- ENV-14 done (`--eb-*` applied to the shell host; chrome regions exist).
- ENV-15 ideally done (the iframe canvas + `setBaseStyles`); if ENV-15 isn't merged,
  the bleed test can target a minimal srcdoc iframe and be tightened when ENV-15 lands.

## Implementation notes
1. **Token catalogue** — create `packages/core/src/theme/tokens.ts` documenting the
   supported chrome tokens with defaults, as the source of truth the shell and all
   chrome components consume:
   ```ts
   // Chrome theming tokens. These pierce shadow DOM (set on the host or any ancestor)
   // and MUST NOT be relied on inside the canvas iframe — see no-bleed test below.
   export const EB_TOKENS = {
     "--eb-color-accent": "#5b5bd6",
     "--eb-color-fg":     "#18181b",
     "--eb-color-bg":     "#ffffff",
     "--eb-color-border": "#e4e4e7",
     "--eb-radius":       "8px",
     "--eb-space":        "12px",
     "--eb-font-ui":      "system-ui, sans-serif",
   } as const;
   export type EbToken = keyof typeof EB_TOKENS;
   ```
   Every chrome component reads tokens with a fallback, e.g.
   `color: var(--eb-color-accent, #5b5bd6)` — never hard-codes the themed value.
2. **Chrome channel** — confirm `EnveloppeEditor` applies `config.theme` overrides as
   `--eb-*` on the host (ENV-14). No host stylesheet is ever read or copied.
3. **Canvas channel** — the iframe's only styles come from `#eb-base`
   (`CanvasController.setBaseStyles`, ENV-15) plus what ENV-16 writes into `#eb-root`.
   The canvas does **not** receive `--eb-*` tokens: explicitly do not forward chrome
   tokens into the iframe document. (If a future ticket wants canvas theming, it is a
   separate, named "email theme" channel — out of scope here.)
4. **The no-bleed test** — the deliverable that matters. Create
   `packages/core/e2e/theming.spec.ts` (using the ENV-03 fixtures):
   - On the **host** page, inject aggressive global CSS: `* { color: red !important;
     font-family: "Comic Sans MS" !important; }` and set a wild `--eb-color-accent`.
   - Assert chrome **does** pick up `--eb-color-accent` (token piercing works).
   - Assert content inside the canvas iframe (`#eb-root`) is **NOT** red and **NOT**
     Comic Sans, and that `getComputedStyle(canvasEl).getPropertyValue("--eb-color-accent")`
     inside the iframe is empty/inherited-default — proving the token did not cross.
   - Run in **chromium + webkit**.
5. **Keep it light** — this is mostly documentation + one CSS module + one E2E spec.
   No new runtime dependency; negligible bundle impact.

## Acceptance criteria
- [ ] `theme/tokens.ts` enumerates `--eb-*` chrome tokens + defaults and is the
      catalogue chrome components consume (with `var(--eb-*, default)` fallbacks).
- [ ] Chrome visibly responds to a `--eb-*` override (token piercing confirmed).
- [ ] Host CSS (`* { color:red !important }`, font override) does **not** affect
      content inside the canvas iframe.
- [ ] `--eb-*` tokens set on the host do **not** resolve inside the canvas document.
- [ ] The no-bleed + token-piercing assertions pass in **chromium + webkit**.

## Out of scope
- The iframe canvas implementation itself (ENV-15) and doc rendering (ENV-16).
- A dedicated canvas/email-theme channel (future ticket) — v1 canvas styles come
  only from the injected base stylesheet.
- Properties-panel / palette visual design (ENV-35/63).

## Verification
```bash
cd packages/core
bun run build
bun run e2e   # theming.spec: chrome responds to --eb-*; host CSS + tokens do NOT reach the canvas — chromium + webkit
bun run lint
```

## Definition of done
See `_conventions.md`. Two-surface model documented + bleed-proof passing in both
browsers; status → `review`.
