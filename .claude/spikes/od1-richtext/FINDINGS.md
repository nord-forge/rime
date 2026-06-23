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
- **Lexical (initial, unwired):** ⚠️ paste **did not insert at all** — the
  adapter built a bare `createEditor()` with no clipboard handlers.
- **Lexical (FIXED — see §4b):** ✅ once wired, paste **inserts AND sanitizes**
  correctly, matching Tiptap (`Pasted / bold[bold] / junk`, no mso/font/script),
  in both Chromium and WebKit. So this is a **wiring gap, not a capability gap.**

## 4b. Lexical paste — researched & fixed (follow-up)
The original failure was an adapter bug, not a Lexical limitation. The fix:
1. **`registerRichText(editor)`** (from `@lexical/rich-text`) — installs the
   `PASTE_COMMAND` handler, which routes through
   `$insertDataTransferForRichText` (`@lexical/clipboard`) →
   `$generateNodesFromDOM` (`@lexical/html`). Without this, `paste` has no handler.
2. **Curated node set** (`[Paragraph, Text, Heading, Quote]` only) = the
   sanitization boundary: `$generateNodesFromDOM` keeps only DOM that a
   registered node's `importDOM()` claims; everything else (mso, `<font>`,
   `<script>`) is dropped. This is Lexical's analogue of ProseMirror's strict schema.

**Cost of the fix:** bundle grew **46.2 → 51.4 kB gzip** (+5 kB for
`registerRichText` + clipboard pipeline). Still ~2.5× lighter than Tiptap.
**Result:** Lexical's paste is now a tie with Tiptap on correctness — but Tiptap
gives it with **zero wiring** (StarterKit includes it), whereas Lexical requires
the explicit `registerRichText` + curated-nodes setup to reach parity.

## Scorecard

| Axis | Tiptap | Lexical | Winner |
|---|---|---|---|
| No React/Vue dep | ✅ | ✅ | tie |
| Bundle (gzip marginal) | 118.6 kB | **~42 kB** (51.4−7.6 baseline, wired) | **Lexical** |
| Cross-browser/WebKit | ✅ | ✅ | tie |
| JSON round-trip | ✅ sync, zero-effort | ✅ but needs `{discrete}` | **Tiptap** |
| Paste sanitization | ✅ built-in, strict schema, **zero wiring** | ✅ parity **after** `registerRichText` + curated nodes | **Tiptap (ergonomics)** |
| API ergonomics for our use | simpler (sync getJSON, batteries-included) | more ceremony (deferred updates, manual wiring) | **Tiptap** |

## Decision & rationale (unchanged after the paste research)
**Choose Tiptap / ProseMirror.** The follow-up research **narrowed the gap**:
once wired with `registerRichText` + a curated node set, Lexical's paste
sanitization reaches **full parity** with Tiptap and stays the lighter bundle
(~42 kB vs ~119 kB gzip). So the decision is no longer "Lexical can't paste."

The decision holds on **ergonomics and default-correctness**, which map directly
to the project's stated hardest risk (cross-browser rich-text correctness):
- Tiptap is **batteries-included** — paste sanitization, sync `getJSON()`, undo,
  and command set all work out of the box. Lexical requires explicit wiring
  (`registerRichText`, `{discrete:true}` updates, manual node curation) to reach
  the same place; each manual step is a place to get cross-browser behaviour
  subtly wrong.
- For a project whose top risk is text-editing correctness across Safari/IME,
  **fewer things we must wire correctly = less risk.** Tiptap's defaults are the
  safer default.

**The honest counter-argument (for the record):** if the **bundle budget (OD-4)
becomes the binding constraint**, Lexical is now a credible fallback — it is
~2.5× lighter and, as proven here, can be wired to full paste parity. Revisit
only if a curated Tiptap build (ENV-56) still blows the budget.

**Mitigation for Tiptap's bundle cost:** hand-pick extensions instead of shipping
all of StarterKit (ENV-56); target < 90 kB gzip marginal.

## Follow-ups created
- **OD-4 input:** core bundle budget must account for ~80–120 kB of rich text;
  set the budget with a curated Tiptap extension list, not StarterKit.
- New ticket: **trim Tiptap to a minimal extension set** (bold/italic/link/list/
  heading) and re-measure; target < 90 kB gzip marginal.
- Pre-production: real iOS Safari + IME (CJK) manual pass — not covered by the
  WebKit automated run.

## How to reproduce
```
cd .claude/spikes/od1-richtext
bun install
bun run build && bun run size      # bundle table
bunx playwright install webkit chromium
bunx playwright test               # cross-browser, round-trip, paste
```
