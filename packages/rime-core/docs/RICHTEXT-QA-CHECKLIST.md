# Rich-text QA checklist — iOS Safari & IME

Manual test pass for the inline rich-text editor on real devices and input methods
that automated WebKit (Playwright) cannot exercise. Run every item on the listed
environment, record the result in `RICHTEXT-QA-FINDINGS.md`.

How to run: open the demo (or any embed of `<rime-editor>`), load a document with
a few text blocks, and work through each case. "Automated" items also have a
Playwright regression; the rest are manual-only.

Legend: ✅ pass · ❌ fail (file an issue + fix) · ⚠️ partial/with-caveat.

## Environments to cover

- iOS Safari on a real iPhone (note iOS version).
- iPadOS Safari (different visual-viewport behaviour).
- A CJK IME on desktop Safari/Chrome: macOS Pinyin **or** Japanese (Romaji→Kana).
- Android Chrome (secondary; note if skipped).

---

## 1. CJK IME composition (manual + partial automation)

| # | Steps | Expected | Result |
|---|-------|----------|--------|
| 1.1 | Focus a text block, switch to Pinyin/Japanese IME, type a multi-key syllable (don't commit yet) | Pre-edit (underlined) composition is visible inside the editable; no characters committed to the doc yet | |
| 1.2 | Select a candidate to commit | Composed characters are inserted once; no duplicates, no dropped glyphs | |
| 1.3 | While a composition is active, tap outside the text block | The editor does **not** blur/commit mid-composition; blur is deferred until composition ends (composition guard) | |
| 1.4 | Compose, commit, then blur → reload the doc (getDoc/loadDoc) | Composed text round-trips losslessly; no mojibake, no mark corruption | |
| 1.5 | Compose into the middle of existing styled text (e.g. inside a bold run) | Inserted text inherits the surrounding marks; composition doesn't split/duplicate runs | |

> Automated: synthetic `compositionstart`/`compositionend` are dispatched in the
> Playwright WebKit suite to assert no premature blur/commit (1.3). Real candidate
> selection + glyph fidelity (1.1, 1.2, 1.4, 1.5) is manual.

## 2. iOS Safari focus & soft keyboard (manual)

| # | Steps | Expected | Result |
|---|-------|----------|--------|
| 2.1 | Tap a text block inside the iframe canvas | The block focuses, becomes editable, and the soft keyboard appears | |
| 2.2 | With the keyboard up, type | Characters land in the tapped block (not a sibling); caret tracks input | |
| 2.3 | Tap a different text block | First commits on blur; second focuses; only one editor live at a time | |
| 2.4 | Tap empty canvas area | Active editor blurs and commits; keyboard dismisses | |
| 2.5 | Scroll the page while editing | The focused editor stays usable; caret/selection not lost | |

> Known iOS quirk: contenteditable inside an iframe has historically mis-focused.
> 2.1/2.2 specifically validate the same-origin srcdoc iframe focus path.

## 3. Selection + custom bubble toolbar on iOS (manual)

| # | Steps | Expected | Result |
|---|-------|----------|--------|
| 3.1 | Select a word by long-press | The native callout AND our custom bubble toolbar appear | |
| 3.2 | Observe toolbar position | The toolbar sits over the selection, correctly offset for the visual-viewport (no drift when the keyboard/URL bar resize the viewport) | |
| 3.3 | Tap a toolbar button (Bold) | The button is large enough to tap; the format applies; the selection is not dismissed | |
| 3.4 | Open the link popover, type a URL, tap Apply | The input is reachable above the keyboard; Apply works; `javascript:` is rejected | |
| 3.5 | Rotate the device while the toolbar is open | The toolbar repositions to the selection after rotation | |

> If the toolbar drifts under keyboard/URL-bar resize, the fix is to offset by
> `window.visualViewport` in the positioning math (host side).

## 4. Autocorrect / autocapitalize / smart punctuation (manual)

| # | Steps | Expected | Result |
|---|-------|----------|--------|
| 4.1 | Type a lowercase sentence start | Autocapitalize integrates without duplicating the first character | |
| 4.2 | Type a misspelled word and accept the correction | The correction replaces the word cleanly; surrounding marks intact | |
| 4.3 | Type quotes/dashes (smart punctuation) | Smart substitutions don't corrupt runs or inject styling | |

## 5. Mobile paste (manual)

| # | Steps | Expected | Result |
|---|-------|----------|--------|
| 5.1 | Copy formatted text from Mail/Notes/Docs, long-press → Paste into a text block | Content is sanitized the same as desktop: no `mso`/`font`/`script`; safe links survive, `javascript:` stripped | |
| 5.2 | Paste plain text | Plain paragraphs only, no formatting injection | |

## 6. Undo on iOS (manual)

| # | Steps | Expected | Result |
|---|-------|----------|--------|
| 6.1 | Make an edit, then shake-to-undo (or keyboard undo) | The patch-undo stack reverts the edit sanely (no partial/corrupt state) | |
| 6.2 | Undo across a blur boundary | Undo restores the committed prior content; redo re-applies | |

---

## Sign-off

The engine is signed off for iOS Safari + IME when sections 1–6 are all ✅ (or ⚠️
with a documented, accepted caveat) on the environments above, recorded in
`RICHTEXT-QA-FINDINGS.md`.
