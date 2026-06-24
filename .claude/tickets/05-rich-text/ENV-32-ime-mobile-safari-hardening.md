---
id: ENV-32
title: IME / mobile / Safari rich-text hardening
status: done
priority: P1
milestone: 5 — Inline rich text
depends_on: [ENV-27]
blocks: []
package: core
prd: [§9]
estimate: M
---

# ENV-32 — IME / mobile / Safari rich-text hardening

## Context
Choosing Lexical raised the cross-browser text-editing risk (R-1): it needs more
manual wiring than Tiptap, and the project's hardest risk is contenteditable
divergence on Safari/iOS and with IME (§9, R-1). Automated WebKit (Playwright)
does **not** exercise a real iOS Safari device or a CJK IME composition — the
spike explicitly flagged this as a pre-production gap. This ticket offsets that
risk with a documented **manual** test checklist run on real devices/IMEs, plus
fixes for whatever it surfaces. It is the QA budget the PRD set aside for Safari
to make Lexical a safe choice.

## Goal
A documented IME/mobile/Safari test checklist is executed on real iOS Safari and
a CJK IME, issues found are fixed, and the results are recorded so the rich-text
engine is signed off for those environments.

## Prerequisites
- ENV-27 done (Lexical mounted in-iframe), ENV-28 (focus/blur lifecycle), ENV-29
  (custom toolbar — its positioning is a Safari/mobile risk), ENV-30 (round-trip
  — must survive IME composition without corruption).
- Access to a real iOS Safari device (or BrowserStack/Sauce real-device) and a
  CJK IME (macOS/Windows Pinyin or Japanese IME) for the manual pass.

## Implementation notes
1. **`packages/core/docs/RICHTEXT-QA-CHECKLIST.md`** — the executable manual
   checklist. Each item: environment, steps, expected result, pass/fail, notes.
   Cover the known contenteditable/iframe/IME failure modes:
   - **CJK IME composition:** type with Pinyin/Japanese IME — the composition
     (preedit underline) shows, candidate selection commits correctly, and
     `compositionstart/update/end` do NOT trigger a premature doc commit or a
     destroy via the focus lifecycle (ENV-28 must not blur mid-composition). The
     round-trip (ENV-30) must not drop composed characters.
   - **iOS Safari focus/keyboard:** tapping a TextBlock inside the iframe focuses
     it and brings up the soft keyboard; the editor scrolls into view; blur on tap
     elsewhere commits. Test the iframe + contenteditable focus quirk specifically
     (iOS has historically mis-focused contenteditable in iframes).
   - **iOS selection + toolbar:** selecting text shows the native callout AND our
     custom bubble toolbar; our toolbar positions correctly over the iframe
     selection (ENV-29's `canvasToHost`) despite iOS visual-viewport offset; the
     toolbar buttons are tappable (hit-target size) and don't dismiss the selection.
   - **Autocorrect/autocapitalize/smart punctuation:** iOS substitutions integrate
     without corrupting marks or duplicating characters.
   - **Mobile paste:** long-press paste of formatted content sanitizes (ENV-31)
     the same as desktop.
   - **Undo on iOS** (shake/keyboard) interacts sanely with the patch-undo stack.
2. **Fix surfaced issues** — for each failure, implement the fix in the relevant
   module (likely ENV-28 lifecycle guarding `isComposing`, ENV-29 toolbar
   positioning using `window.visualViewport`, or focus handling in ENV-27). Add a
   regression unit test where the fix is unit-testable (e.g. "do not blur while
   `editor.isComposing()`").
3. **Composition guard (most likely fix, do proactively)** — ensure the lifecycle
   and any commit/serialize path checks composition state: do not destroy the
   editor or commit on `focusout` if an IME composition is in progress; defer to
   `compositionend`. Wire `compositionstart`/`compositionend` listeners (iframe
   document) into ENV-28's lifecycle so a blur mid-composition is deferred.
4. **`packages/core/docs/RICHTEXT-QA-FINDINGS.md`** — record device/OS/IME
   versions tested, each checklist result, issues found + their fixes (link to
   commits/tickets). This is the sign-off artifact R-1 points at and ENV-49 can
   cite.
5. **Augment automated WebKit where possible** — anything reproducible in
   Playwright WebKit (e.g. composition events can be dispatched synthetically)
   gets an automated regression test; the rest stays in the manual checklist
   (clearly marked "manual — not automatable").

## Acceptance criteria
- [ ] `RICHTEXT-QA-CHECKLIST.md` exists with concrete steps + expected results for
      CJK IME, iOS Safari focus/keyboard, selection+toolbar, autocorrect, mobile
      paste, and undo.
- [ ] The checklist is executed on a real iOS Safari device and a CJK IME; results
      recorded in `RICHTEXT-QA-FINDINGS.md` with versions tested.
- [ ] Editor does NOT blur/commit/destroy mid-IME-composition (composition guard
      wired into the lifecycle), with a regression test where automatable.
- [ ] Custom toolbar positions correctly over the iframe selection on iOS
      (visual-viewport aware), buttons tappable.
- [ ] Every failure found has a fix + (where possible) a regression test.
- [ ] Any synthesizable case (e.g. composition events) is added to the automated
      WebKit Playwright suite.

## Out of scope
- Engine choice re-litigation (decided: Lexical, OD-1). Paste mechanism (ENV-31) —
  only its mobile-paste behaviour is checklisted here.
- Non-text DnD touch behaviour (ENV-25).

## Verification
```bash
cd packages/core
bun test     # composition-guard regression (no blur/commit while isComposing); any other automatable fixes
bun run build
bun run lint
bun run e2e  # chromium + webkit incl. synthetic compositionstart/update/end → content intact, no premature blur
# MANUAL: execute RICHTEXT-QA-CHECKLIST.md on real iOS Safari + a CJK IME; record in RICHTEXT-QA-FINDINGS.md
```

## Definition of done
See `_conventions.md`. Manual iOS/IME checklist executed + recorded, composition
guard in place, fixes landed; status → `review`.
