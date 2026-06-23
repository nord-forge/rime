---
id: ENV-14
title: <enveloppe-editor> Lit component shell
status: done
priority: P0
milestone: 3 — Canvas & shell
depends_on: [ENV-01]
blocks: [ENV-15, ENV-18, ENV-42, ENV-44, ENV-45]
package: core
prd: [§6.5]
estimate: M
---

# ENV-14 — `<enveloppe-editor>` Lit component shell

## Context
`<enveloppe-editor>` is the single public custom element the whole product ships as
— the thing integrators embed (§6.5, README). This ticket builds its **shell**: the
three-region layout (palette / canvas / properties), the slots and parts, and the
public `config` surface (theme tokens, enabled blocks, `onImageUpload`, token
sources). Everything later (canvas, DnD, rich text, panels) plugs into regions this
ticket defines. Chrome is themed exclusively via `--eb-*` CSS custom properties that
pierce the shadow boundary — the proven pattern from `.claude/spikes/od2-toolchain/src/themed-panel.ts`.
> Note: the board lists ENV-14's dep as OD-2, but OD-2 is **DONE** (toolchain
> spike). The real prerequisite is ENV-01. Reuse OD-2's outputs (rolldown-vite
> lib config, the `css\`\``/`--eb-*` pattern) — do not redo them.

## Goal
`<enveloppe-editor>` is defined, renders palette/canvas/properties regions, accepts
a typed `config`, and exposes theme via `--eb-*` — with no feature logic inside yet.

## Prerequisites
- ENV-01 done (core builds in lib mode, `lit` installed, decorators on).
- `@enveloppe/doc-model` exists for the `EnveloppeDoc` type (ENV-05); if not yet
  available, import its type behind a local alias and tighten when it lands.

## Implementation notes
Create under `packages/core/src/`:

1. **`enveloppe-editor.ts`** — the Lit element `EnveloppeEditor`, registered as
   `enveloppe-editor`. Layout via CSS grid; expose regions as both **slots**
   (host-overridable) and **parts** (themable/targetable). Keep it presentational —
   regions are mount points, not feature owners.
   ```ts
   import { LitElement, html, css, type CSSResultGroup } from "lit";
   import { property } from "lit/decorators.js";
   import type { EnveloppeDoc } from "@enveloppe/doc-model";

   export interface EnveloppeConfig {
     /** --eb-* token overrides applied to the chrome (host-piercing). */
     theme?: Record<`--eb-${string}`, string>;
     /** Block type ids enabled in the palette; undefined = all built-ins. */
     enabledBlocks?: string[];
     /** Host uploader; returns the final URL for an image block. */
     onImageUpload?: (file: File) => Promise<string>;
     /** Declarative merge-token sources (consumed in M7). */
     tokenSources?: TokenSource[];
   }
   export interface TokenSource { id: string; label: string; tokens: { key: string; label: string }[]; }

   export class EnveloppeEditor extends LitElement {
     static styles: CSSResultGroup = css`
       :host {
         display: grid;
         grid-template-columns: var(--eb-palette-width, 240px) 1fr var(--eb-properties-width, 300px);
         grid-template-areas: "palette canvas properties";
         block-size: 100%;
         font: var(--eb-font-ui, 14px system-ui);
         color: var(--eb-color-fg, #18181b);
         background: var(--eb-color-bg, #fff);
       }
       [part="palette"]    { grid-area: palette;    border-inline-end: 1px solid var(--eb-color-border, #e4e4e7); }
       [part="canvas"]     { grid-area: canvas;     overflow: auto; }
       [part="properties"] { grid-area: properties; border-inline-start: 1px solid var(--eb-color-border, #e4e4e7); }
     `;

     @property({ attribute: false }) config: EnveloppeConfig = {};

     render() {
       return html`
         <section part="palette"><slot name="palette"></slot></section>
         <section part="canvas"><slot name="canvas"></slot></section>
         <section part="properties"><slot name="properties"></slot></section>
       `;
     }
   }
   customElements.define("enveloppe-editor", EnveloppeEditor);
   ```
2. **Config application** — when `config.theme` is set, apply each `--eb-*` pair to
   the host via `this.style.setProperty(k, v)` in `willUpdate`/`updated`. This is the
   only theming channel for chrome (see ENV-18). Do NOT read host stylesheets.
3. **Public surface, stubbed** — declare the methods later tickets fill so the type
   shape is stable now: `loadDoc(doc: EnveloppeDoc): void` and
   `getDoc(): EnveloppeDoc` (wired in ENV-42), and a `change` CustomEvent contract
   (`detail: { doc }`). Stub bodies are fine; document them as ENV-42's job.
4. **Empty regions for now** — palette/canvas/properties render empty containers
   (and their named slots). ENV-15 mounts the iframe into `part="canvas"`; ENV-35/63
   fill properties/palette. Keep this ticket free of feature code.
5. **Export** `EnveloppeEditor`, `EnveloppeConfig`, `TokenSource` from
   `packages/core/src/index.ts`. No `any` in the public config types.
6. **Budget** — Lit is externalized in the lib build (ENV-01); this shell adds
   negligible weight. Keep it that way (no heavy imports here).

## Acceptance criteria
- [ ] `customElements.get("enveloppe-editor")` is defined after importing core.
- [ ] Shell renders three regions with `part="palette|canvas|properties"` and
      matching named slots; layout is a 3-column grid.
- [ ] `config.theme` overrides apply as `--eb-*` on the host and visibly affect the
      chrome (e.g. `--eb-color-border`).
- [ ] `EnveloppeConfig` (theme, enabledBlocks, onImageUpload, tokenSources) is typed
      and exported; no `any`.
- [ ] `loadDoc`/`getDoc`/`change` are declared with stable signatures (stubbed).
- [ ] Importing core stays within the ≤ ~100 kB gzip budget (CI size gate green).

## Out of scope
- The iframe canvas itself (ENV-15) and doc rendering (ENV-16).
- Palette (ENV-36), properties panel (ENV-35), DnD (ENV-19), rich text (ENV-27).
- Real `loadDoc`/`getDoc`/change-event wiring (ENV-42).

## Verification
```bash
cd packages/core
bun test
bun run build
bun run lint
# browser (uses the ENV-03 harness):
bun run e2e   # smoke: element defined, three parts present, theme token applied — chromium + webkit
```

## Definition of done
See `_conventions.md`. Shell + config surface in place; size gate green;
status → `review`.
