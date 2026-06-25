---
id: ENV-66
title: Pure SDK barrel leaks Lexical into the eager bundle
status: done
priority: P0
milestone: 10 — Release readiness
depends_on: [ENV-39, ENV-40]
blocks: [ENV-52]
package: core
prd: [§6.7, §7, §10]
estimate: M
---

# ENV-66 — Pure SDK barrel leaks Lexical into the eager bundle

## Context
A bundle-size audit of `@nord-forge/rime-core` found that the **dynamic-import code
split for Lexical is currently defeated**: importing the package eagerly pulls in
the full Lexical chunk (~57 kB gzip) even when rich text is never used. The
size gate (`bun run size`) passes at ~86 kB because it **sums all dist chunks**, so
it is blind to *what loads eagerly* — the regression hides inside a green gate.

This violates the architecture rule in `CLAUDE.md`:
> **Pure SDK barrel:** a value-export on the root barrel must not transitively
> import [the heavy deps the split isolates]; pure logic co-located with a
> Lexical/Lit module must be split into its own module to be barrel-exported.

It also breaks the PRD §6.7 promise that `lexicalEditor: false` ships a
Lexical-free build, and erodes the §10 budget discipline.

## Findings (measured, gzip)
Per-chunk: `index.js` 1.2 · `register.js` 7.9 · `live-region.js` 15.1 ·
`selection-format.js` **57.3 (inlined Lexical)** · `richtext-lifecycle.js` 2.8 ·
`token-picker.js` 3.4 · `lexical-provider.js` 1.3 · total 86 kB.

Eager-load per usage:
- `import "@nord-forge/rime-core"` (PURE SDK) → **~74 kB** (should be ~17 kB).
- `import "@nord-forge/rime-core/register"` (full editor) → **~81 kB** eager
  (Lexical loads eagerly, not on first focus).
- `defineRimeEditor({ lexicalEditor: false })` → still **~81 kB** (should be ~24 kB).

### Root causes
1. **`src/index.ts` value-exports Lexical-coupled modules** directly:
   `mountLexical`, `$applyRichTextJSON`/`$readRichTextJSON`/`canonicalize`/
   `richTextEqual` (serialize), `registerSelectionFormat`/`EMPTY_FORMAT`/`FormatState`,
   `RichTextLifecycle`/`Mounter`, `makeCommands`/`RichTextCommands`. None of these are
   consumed *through* the barrel anywhere (internal code uses deep paths) — pure leak.
2. **`register.js` statically imports the `selection-format` chunk**, and the
   bundler merged the PURE a11y `announce-messages` helpers into that same
   Lexical-heavy chunk. So even `lexicalEditor: false` builds pull all of Lexical.
3. **The guard test is too narrow.** `no-static-lexical.test.ts` inspects only
   `rime-editor.ts`'s own import lines — it never catches a barrel/chunk-level leak.

## Goal
`import "@nord-forge/rime-core"` (pure barrel) and the `lexicalEditor: false` editor
build contain **zero Lexical**; Lexical loads only via the dynamic
`lexical-provider` split on first text-block focus. The size gate measures and
enforces **eager-load** budgets per entry, not just the all-chunks sum.

## Implementation notes
1. **Purge Lexical from `src/index.ts`.** Remove the value-exports that transitively
   import `lexical`/`@lexical/*` (the serialize fns, `mountLexical`, `selection-format`,
   `RichTextLifecycle`, `makeCommands`). Keep only DOM-free / Lexical-free logic on the
   pure barrel (types, registry, blocks, render helpers, `normalizeHref` if it doesn't
   drag Lexical, a11y message builders). Anything Lexical-coupled that is genuinely part
   of the public API moves to a deep subpath (e.g. `@nord-forge/rime-core/richtext`) or to
   `/register`. Update the e2e harness (`richtext-harness.html` imports `mountLexical`
   from `../src/index.ts`) to the new path.
2. **Break the a11y/Lexical chunk merge.** Ensure the pure `announce-messages`
   helpers do not share a chunk with `selection-format`. Options: a `manualChunks`
   hint in `scripts/vite-lib.ts`, or restructure imports so the bundler can't
   co-locate them. Verify `register.js` no longer statically references the Lexical
   chunk.
3. **Strengthen the size gate (`scripts/measure.ts`).** Add per-entry eager-load
   budgets: compute the static import closure of `index.js` and `register.js`
   separately and assert each is Lexical-free / within budget. Fail if the Lexical
   chunk appears in either eager closure. Keep the existing total as a secondary
   check.
4. **Widen the guard test.** Extend `no-static-lexical.test.ts` (or add a sibling) to
   assert the built `index.js` and `register.js` do NOT statically import the Lexical
   chunk — a build-output assertion, not just a source-line scan.

## Acceptance criteria
- [ ] `import "@nord-forge/rime-core"` pulls NO Lexical (verified against built output).
- [ ] `register.js` does not statically import the Lexical chunk; Lexical loads only via
      the dynamic `lexical-provider` import.
- [ ] `defineRimeEditor({ lexicalEditor: false })` eager-load excludes Lexical.
- [ ] `scripts/measure.ts` enforces per-entry eager budgets and fails if Lexical leaks
      into an eager closure.
- [ ] The guard test fails if a future change re-introduces a static Lexical import in
      the pure barrel or `register.js`.
- [ ] All existing unit + e2e tests still pass; total core size still ≤ budget.

## Out of scope
- Reducing Lexical's own size (that's the engine; OD-4 settled the budget).
- The broader barrel/perf audit (separate follow-up).

## Verification
```bash
cd packages/rime-core
bun test           # incl. the widened guard
bun run build
bun run size       # now enforces per-entry eager budgets
bun run e2e        # chromium + webkit
```

## Definition of done
See `_conventions.md`. Pure barrel + `lexicalEditor:false` are Lexical-free; size gate
enforces eager budgets; guard prevents regression; status → `review`.
