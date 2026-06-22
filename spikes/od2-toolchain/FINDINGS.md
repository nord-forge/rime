# OD-2 Findings — Build toolchain (Vite / rolldown-vite + Lit + CSS) + OD-4 size gate

**Date:** 2026-06-22 · **Decision:** ✅ **rolldown-vite works; adopt it. Stock Vite stays as a zero-risk fallback.**

The OD-2 question was narrow: *does rolldown-vite correctly build a real Lit web
component with `css\`\`` styles, CSS custom-property theming, and an iframe — or
does it fight Lit's CSS handling?* Answer: **it builds AND runs, identically to
stock Vite.** No fallback required.

## What was tested
A real Lit component (`src/themed-panel.ts`) exercising the toolchain's hardest
cases for this project:
- `static styles = css\`...\`` (Lit tagged-template CSS — must survive minify)
- `--eb-*` CSS custom properties piercing shadow DOM (the theming model)
- a same-origin `srcdoc` iframe (the canvas pattern)
- a `@property` decorator (needs `useDefineForClassFields:false`)

Run through the full intended pipeline with **both** engines.

## Results

| Stage | stock Vite | rolldown-vite | Notes |
|---|---|---|---|
| `oxlint` | ✅ clean | — (lint is engine-independent) | oxlint 1.71 |
| `oxfmt --check` | ✅ (after applying) | — | **oxfmt is Lit-safe** — reformatted code incl. CSS *inside* `css\`\`` without breaking the template; switched to double-quotes |
| `tsc` declaration emit | ✅ clean | ✅ | decorators OK with `useDefineForClassFields:false` |
| `vite build` (lib, ESM) | ✅ 36ms | ✅ 111ms | both succeed |
| CSS vars in output | ✅ | ✅ | `--eb-color-accent` present |
| `customElements.define` | ✅ | ✅ | element registers |
| iframe `srcdoc` | ✅ | ✅ | canvas pattern intact |
| **Browser smoke (Chromium + WebKit)** | ✅ 2/2 | ✅ 2/2 | element renders, heading shows, **CSS var applies through shadow DOM** (`rgb(10,20,30)`), iframe mounts |

**Total: build + 4/4 browser smoke tests pass across both engines and both browsers.**

## Bundle size (component code, Lit externalized)
| Engine | raw | gzip | brotli |
|---|---|---|---|
| stock Vite | 1.39 kB | **0.74 kB** | 0.60 kB |
| rolldown-vite | 1.62 kB | 0.84 kB | 0.68 kB |

- rolldown is **+0.10 kB gzip (+13.6%)** at this tiny scale — fixed wrapper/runtime
  overhead, negligible and **non-linear** (won't scale with real code). Not a concern.
- The **size gate** (`measure.ts`) works: reports gzip/brotli, compares engines,
  and **fails CI when over budget** (`BUDGET_GZIP` env, default 8 kB for the spike).

## OD-4 input (the bundle gate this establishes)
`measure.ts` is the prototype of the CI bundle gate ENV-57/OD-4 needs. For the
real `@enveloppe/core`, set `BUDGET_GZIP` to the agreed budget; the script exits
non-zero on regression. **Reminder from ENV-56:** the engine choice (Tiptap ~128 kB
vs Lexical ~43 kB rich text) should be made against whatever total budget OD-4 sets.

## Decision
- **Bundler:** **rolldown-vite** — proven to build + run Lit/CSS/iframe with no
  issues. Keep stock Vite pinned as a drop-in fallback (same config API) if a
  future Rolldown regression appears.
- **Lint/format:** **oxlint + oxfmt**, confirmed fast and Lit-safe. Commit to
  oxfmt's style repo-wide (it has opinions: double quotes, expands CSS rules).
- **Types:** `tsc` for declaration emit (`emitDeclarationOnly`), Vite/rolldown
  for JS. Decorators require `useDefineForClassFields:false`.
- **Size gate:** adopt `measure.ts` as the CI bundle-budget check (OD-4).

## Caveats / follow-ups
- oxfmt is pre-1.0 (0.56) — pin the version; its defaults may shift. Add an
  `oxfmt` config + an oxlint config to the real repo so style is explicit.
- Pin rolldown-vite (7.3.1) and re-run this smoke suite on upgrades.
- Re-validate once real CSS volume + multiple components exist (this is one
  small component); the gate + smoke test are reusable for that.

## Reproduce
```
cd spikes/od2-toolchain
bun install
bun run lint && bunx oxfmt --check src
bun run types
bun run build            # stock vite → dist/vite
bun run build:rolldown   # rolldown-vite → dist/rolldown   (needs rolldown-vite's vite bin)
bun run size             # comparison + budget gate
bunx playwright test     # browser smoke, both engines, Chromium + WebKit
```
