---
id: ENV-11
title: MjmlRenderer (doc → MJML → HTML)
status: done
priority: P0
milestone: 2 — Export renderer (MJML)
depends_on: [ENV-10]
blocks: [ENV-12, ENV-13, ENV-33]
package: renderer-mjml
prd: [§6.3]
estimate: L
---

# ENV-11 — MjmlRenderer (doc → MJML → HTML)

## Context
This is the v1 default export renderer. It maps each core block to MJML, then compiles MJML to
bulletproof, Outlook-safe HTML via the `mjml` library — inheriting MJML's battle-tested handling
of `mso` conditionals, VML buttons, and ghost tables (PRD §6.3). It runs at **export**, not on
the canvas hot path, so it can be Node-side and is **excluded from the `@nord-forge/rime-core` bundle
budget** (it lives in its own package). `MjmlRenderer` implements the ENV-10 `Renderer` contract.

## Goal
`@nord-forge/rime-mjml` exports `MjmlRenderer implements Renderer` that turns any valid
`RimeDoc` (all core block types) into Outlook-safe email HTML by emitting MJML and compiling
it with the `mjml` library.

## Prerequisites
- ENV-10 done (`Renderer`, `RenderOptions`, `RenderError`, `BlockRenderer`, `RenderContext`).
- ENV-05 done (the node types being mapped: `document/section/column/text/image/button/divider/spacer`,
  `BlockStyle`, and `RichTextJSON`).

## Implementation notes
Create in `packages/renderer-mjml/src/`. Add the `mjml` library as a runtime dependency of THIS
package only (it is Node-side and outside the core budget — note this in the PR per conventions).

1. **`mjml-renderer.ts`** — the class:
   ```ts
   import mjml2html from "mjml";
   import type { RimeDoc } from "@nord-forge/rime-model";
   import type { Renderer, RenderOptions } from "./renderer";
   import { RenderError } from "./renderer";
   import { docToMjml } from "./to-mjml";

   export class MjmlRenderer implements Renderer {
     async render(doc: RimeDoc, options: RenderOptions = {}): Promise<string> {
       const mjmlSrc = docToMjml(doc, options);
       const { html, errors } = mjml2html(mjmlSrc, { validationLevel: "soft", minify: options.minify });
       if (errors?.length) throw new RenderError("MJML compile errors", errors);
       return html;
     }
   }
   ```
2. **`to-mjml.ts`** — the doc → MJML-string mapper, built as a registry of `BlockRenderer`s
   (the ENV-10 seam) so ENV-12 can register a raw-table renderer per block. One handler per
   node type; the MJML mapping table:
   | node | MJML |
   |------|------|
   | `document` | `<mjml><mj-head>…(fonts/contentWidth/bg)…</mj-head><mj-body background-color=…>…sections…</mj-body></mjml>` |
   | `section` | `<mj-section …style→attrs…>…columns…</mj-section>` |
   | `column` | `<mj-column width="{widthPercent}%" …style…>…leaves…</mj-column>` |
   | `text` | `<mj-text …style…>{richTextToInlineHtml(content)}</mj-text>` |
   | `image` | `<mj-image src alt href? …style… />` |
   | `button` | `<mj-button href …style…>{label}</mj-button>` |
   | `divider` | `<mj-divider …style… />` |
   | `spacer` | `<mj-spacer height="{height}px" />` |
   - Map `BlockStyle` → MJML attributes (`paddingTop`→`padding-top="Npx"`, `backgroundColor`→
     `background-color`, `align`→`align`). Centralize this in a `styleToMjmlAttrs(style)` helper
     so every handler is consistent. Escape all attribute values and text.
   - `document.settings.contentWidth` → `<mj-body width>`/`<mj-section>` width; `fontFamily` →
     `<mj-attributes><mj-all font-family>`; `backgroundColor` → `<mj-body background-color>`.
   - Containers (`document`/`section`/`column`) delegate to children via `ctx.renderChild` so the
     registry stays the single dispatch point (this is also the seam ENV-12 hooks).
3. **`rich-text-to-html.ts`** — `richTextToInlineHtml(content: RichTextJSON): string`. Walk the
   portable rich-text shape (ENV-05: doc → paragraphs → text runs with
   `marks: ('bold'|'italic'|'underline')[]` and optional `link`). Emit inline-styled HTML safe
   inside `<mj-text>`: paragraphs → `<p>…</p>`; runs → wrap with `<strong>`/`<em>`/`<u>` per mark
   and `<a href>` for links. **Escape all text** (`&`,`<`,`>`,`"`). This is plain string building —
   no DOM, no rich-text engine import (the doc model carries portable JSON, not a Lexical tree).
4. **Unknown node types.** If a node's `type` has no registered handler, throw `RenderError`
   naming the type and its path (the raw-table fallback in ENV-12 is how a block opts out of MJML;
   absent that, an unknown type is an error, not silent omission).
5. **Determinism.** Same doc → same HTML string (modulo MJML's own output). No `Date.now()`/random
   in the mapper. This is what makes ENV-13's golden snapshots stable.
6. Export `MjmlRenderer` (and `docToMjml`, `richTextToInlineHtml` for testing) from `src/index.ts`.

## Acceptance criteria
- [ ] `MjmlRenderer implements Renderer`; `render(doc)` returns a `Promise<string>` of compiled HTML.
- [ ] Every core block type (`document/section/column/text/image/button/divider/spacer`) maps to
      the correct MJML element with `BlockStyle` reflected in attributes.
- [ ] `richTextToInlineHtml` converts `RichTextJSON` (paragraphs + bold/italic/underline marks +
      links) to correctly nested, **escaped** inline HTML; text content is HTML-escaped everywhere.
- [ ] Output HTML contains MJML's Outlook-safe scaffolding (e.g. `<!--[if mso]>` / ghost-table
      markup) for a doc with a button + section — asserted by substring.
- [ ] MJML compile errors surface as a thrown `RenderError` (not a silent empty/garbage string).
- [ ] An unknown node type throws `RenderError` naming the type/path.
- [ ] `mjml` is a dependency of **renderer-mjml only**; nothing here is imported by `@nord-forge/rime-core`
      (does not affect the core bundle budget). PR notes the dep.
- [ ] Unit tests cover each block mapping, the rich-text conversion + escaping, and the error paths
      (`bun test`).

## Out of scope
- The per-block **raw-table fallback** path (ENV-12) — only the `BlockRenderer` registry seam it
  plugs into is built here.
- Golden-snapshot fixtures + the manual email-client verification matrix (ENV-13).
- The block-registration SDK (`registerBlock`, ENV-33); built-ins are hardcoded handlers here.
- Canvas-side rendering (Milestone 3) — this is export only.

## Verification
```bash
cd packages/renderer-mjml
bun test
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. status → `review`.
