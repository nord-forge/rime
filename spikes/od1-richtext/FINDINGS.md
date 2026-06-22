# OD-1 Findings — Rich-text engine: Tiptap/ProseMirror vs Lexical

**Date:** 2026-06-22 · **Decision:** ✅ **Tiptap / ProseMirror**
Measured inside the real condition: a Lit web component → same-origin `srcdoc`
iframe → engine mounted on a plain node, one-instance lifecycle. Tested in
Chromium **and** WebKit (Safari's engine) via Playwright.

## 0. Premise check (the thing that drove the original wrong instinct)
- `@tiptap/core`, `@tiptap/starter-kit`, and `lexical` core all have **zero
  runtime dependencies** and **no React/Vue anywhere** in the install tree.
- ✅ The "Tiptap is React-leaning" premise is **false**. Both are genuinely
  framework-agnostic and mount on a plain DOM node in Lit. Confirmed by
  inspecting installed `package.json` dependency blocks.

## 1. Bundle size (gzipped, minified, library mode) — the surprise
Marginal cost = engine bundle − Lit-only baseline (baseline ≈ 7.6 kB gzip).

| Engine | raw | gzip | brotli | **marginal gzip** |
|---|---|---|---|---|
| baseline (Lit only) | 23.6 kB | 7.6 kB | 6.6 kB | — |
| **Tiptap** (StarterKit) | 468.6 kB | 126.2 kB | 103.3 kB | **+118.6 kB** |
| **Lexical** (rich-text) | 166.3 kB | 45.2 kB | 38.1 kB | **+37.6 kB** |

➡️ **Tiptap is ~3.2× heavier than Lexical.** This is much larger than the
"tens of KB" the PRD originally assumed — corrected. Note: StarterKit bundles
many extensions we may not ship; a hand-picked Tiptap extension set will be
smaller than 118 kB, but is very unlikely to reach Lexical's 37 kB.

## 2. Cross-browser (Chromium + WebKit/Safari)
- Both engines: mount, seed, format, and round-trip work in **both** browsers.
- The one failure observed during the spike (Lexical round-trip empty) was
  **identical in Chromium and WebKit** → it was Lexical's deferred-update model,
  **not a Safari quirk**. No engine showed a WebKit-specific divergence in these
  tests. (Deeper IME/mobile testing still recommended before production.)

## 3. JSON round-trip (text + bold/italic marks)
- **Tiptap:** ✅ perfect out of the box. `editor.getJSON()` is synchronous and
  returns a clean schema'd tree immediately after `create()`.
- **Lexical:** ✅ works, **but** only after using `editor.update(fn, {discrete:true})`
  to force synchronous reconciliation. Lexical's update model is **async/deferred**
  by design; a naive synchronous read returns an empty doc. → more lifecycle
  ceremony to integrate correctly.

## 4. Paste sanitization (Word/Outlook-style garbage: mso styles, font tags, `<script>`)
- **Tiptap:** ✅ Garbage **inserted and then sanitized** to schema-valid content
  (`Pasted / bold[bold] / junk`). The strict ProseMirror schema rejects anything
  outside the model. This is the headline advantage and it works with **zero
  extra wiring**.
- **Lexical:** ⚠️ The paste **did not insert at all** out of the box — Lexical
  needs `@lexical/html` + explicit paste-command handling to process pasted HTML.
  It "passed" the no-garbage assertion only because nothing was inserted. → paste
  is **DIY** in Lexical.

## Scorecard

| Axis | Tiptap | Lexical | Winner |
|---|---|---|---|
| No React/Vue dep | ✅ | ✅ | tie |
| Bundle (gzip marginal) | 118.6 kB | **37.6 kB** | **Lexical** |
| Cross-browser/WebKit | ✅ | ✅ | tie |
| JSON round-trip | ✅ sync, zero-effort | ✅ but needs `{discrete}` | **Tiptap** |
| Paste sanitization | ✅ built-in, strict schema | ⚠️ DIY (`@lexical/html`) | **Tiptap** |
| API ergonomics for our use | simpler (sync getJSON) | more ceremony (deferred) | **Tiptap** |

## Decision & rationale
**Choose Tiptap / ProseMirror.** Lexical's only win is bundle size (a real,
notable ~80 kB gzip saving). But the project's **stated hardest risk is
cross-browser rich-text correctness**, and the two axes that most reduce that
risk — **strict-schema paste sanitization** and **effortless, synchronous JSON
round-trip into the doc model** — are exactly where Tiptap wins decisively and
works with no extra wiring. Lexical would push paste handling and update-timing
correctness onto us, increasing the surface for the very Safari/contenteditable
bugs we want to avoid. The bundle cost is mitigated by hand-picking Tiptap
extensions instead of shipping all of StarterKit.

## Follow-ups created
- **OD-4 input:** core bundle budget must account for ~80–120 kB of rich text;
  set the budget with a curated Tiptap extension list, not StarterKit.
- New ticket: **trim Tiptap to a minimal extension set** (bold/italic/link/list/
  heading) and re-measure; target < 90 kB gzip marginal.
- Pre-production: real iOS Safari + IME (CJK) manual pass — not covered by the
  WebKit automated run.

## How to reproduce
```
cd spikes/od1-richtext
bun install
bun run build && bun run size      # bundle table
bunx playwright install webkit chromium
bunx playwright test               # cross-browser, round-trip, paste
```
