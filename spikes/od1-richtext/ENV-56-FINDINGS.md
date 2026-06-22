# ENV-56 Findings — Can curating Tiptap extensions approach Lexical's weight?

**Date:** 2026-06-22 · **Answer: NO. Curation cannot close the gap.**

ENV-56's premise was "trim Tiptap from StarterKit to a minimal extension set,
target < 90 kB gzip marginal." The measurements **disprove the premise.**

## Measured (marginal gzip = bundle − Lit baseline, minified library mode)

| Tiptap variant | extensions | marginal gzip |
|---|---|---|
| **minimal** | document, paragraph, text, bold, italic | **108.0 kB** |
| StarterKit | 19 extensions (default) | 118.6 kB |
| **curated (realistic v1)** | doc, para, text, **bold, italic, underline, link, heading, bullet/ordered list, listItem, history** | **128.7 kB** |
| — | — | — |
| **Lexical (wired, for reference)** | rich-text + clipboard, curated nodes | **42.7 kB** |

## The key facts
1. **Minimal Tiptap is already 108 kB.** Stripping StarterKit down to the two
   absolute-minimum marks saves only ~10 kB vs the full kit. The target of
   < 90 kB is **not reachable** by extension curation.
2. **The realistic v1 set is *larger* than StarterKit (128.7 vs 118.6 kB).**
   The extensions email rich text genuinely needs — **link** especially
   (~10 kB, pulls in `linkifyjs`) plus underline + lists + headings — *add* more
   than StarterKit's unused code/codeBlock/strike/blockquote remove.
3. **The cost floor is ProseMirror (`@tiptap/pm`), not the extensions.**
   Model + view + state + transform + commands is a fixed ~100 kB that no
   curation touches. Tiptap's bundle is dominated by its engine, not its feature
   set.

➡️ **Conclusion: the Tiptap-vs-Lexical bundle gap is structural (~3×, ~85 kB
gzip) and permanent.** It cannot be engineered away on the Tiptap side.

## Impact on the OD-1 decision
This **does not auto-reverse OD-1**, but it strengthens the Lexical fallback and
narrows when Tiptap is the right call:

- **Keep Tiptap IF** the bundle budget (OD-4) can absorb ~128 kB gzip of rich
  text. Then Tiptap's batteries-included ergonomics + default-correctness
  (the reason it won OD-1) are worth the weight.
- **Switch to Lexical IF** OD-4 sets a tight core budget (e.g. a "core under
  ~150 kB gzip total" goal). At ~43 kB wired, Lexical leaves ~85 kB of headroom
  that Tiptap consumes entirely on the editor engine alone — before canvas, DnD,
  blocks, and renderer are counted.

**Recommended:** make OD-4 (core bundle budget) the **deciding gate**, and set it
*before* committing engine code. If the budget is generous → Tiptap. If lean →
Lexical (proven paste parity + 3× lighter). The earlier ergonomics argument for
Tiptap stands only while the budget allows it.

## Updated follow-ups
- ENV-56 closed: curation target unachievable; documented here.
- **OD-4 promoted to a blocking decision** for engine choice: set the core gzip
  budget, then confirm OD-1 (Tiptap if budget ≥ ~128 kB rich-text headroom,
  else Lexical).
- If Lexical is chosen later: the wired adapter in `src/lexical-adapter.ts`
  already demonstrates paste parity and is the starting point.

## Reproduce
```
bun run build                       # baseline, StarterKit, lexical
ENGINE=tiptap-curated vite build
ENGINE=tiptap-minimal  vite build
bun run size                        # full comparison table
```
