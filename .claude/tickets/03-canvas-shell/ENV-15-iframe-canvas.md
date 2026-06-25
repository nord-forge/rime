---
id: ENV-15
title: Same-origin srcdoc iframe canvas
status: done
priority: P0
milestone: 3 — Canvas & shell
depends_on: [ENV-14]
blocks: [ENV-16, ENV-17]
package: core
prd: [§6.4]
estimate: M
---

# ENV-15 — Same-origin srcdoc iframe canvas

## Context
The canvas is a **same-origin `srcdoc` iframe** (§6.4). It is the reason host-app
CSS can never reach the email preview (the iframe boundary makes bleed physically
impossible) and the reason hit-testing has a clean, iframe-local coordinate system
(`elementFromPoint` answers about the canvas, not the host). This ticket builds that
iframe inside the ENV-14 shell: its `srcdoc` skeleton, the injected base stylesheet
(the email's own styles), the load lifecycle, and a clean mount point the doc→DOM
renderer (ENV-16) draws into. The proven pattern lives in
`.claude/spikes/od1-richtext/src/canvas-host.ts` (srcdoc iframe → `#mount` → `load`
listener) and `.claude/spikes/od2-toolchain/src/themed-panel.ts` — reuse it.

## Goal
The shell's `part="canvas"` hosts a same-origin srcdoc iframe that loads a clean
document with an injected base stylesheet and exposes a ready mount node — verified
in Chromium + WebKit to receive **no** host CSS.

## Prerequisites
- ENV-14 done (`<rime-editor>` shell + `part="canvas"` region).
- Read `.claude/spikes/od1-richtext/src/canvas-host.ts` for the `srcdoc` + `load` +
  `#mount` pattern, and the spike `playwright.config.ts` note that file:// breaks
  srcdoc origin (tests run over http via the ENV-03 harness).

## Implementation notes
Create under `packages/core/src/`:

1. **`canvas/iframe-canvas.ts`** — a `CanvasController` (plain class, not a custom
   element) that owns one iframe lifecycle. The shell creates it and places the
   iframe into `part="canvas"`.
   ```ts
   export interface CanvasReadyEvent { doc: Document; mount: HTMLElement; iframe: HTMLIFrameElement; }

   export class CanvasController {
     readonly iframe: HTMLIFrameElement;
     private ready: Promise<CanvasReadyEvent>;
     constructor() { this.iframe = document.createElement("iframe"); this.iframe.setAttribute("part", "canvas-frame"); /* title, etc. */ }
     mount(into: HTMLElement): void;        // append iframe, set srcdoc, resolve `ready` on load
     whenReady(): Promise<CanvasReadyEvent>;
     get document(): Document | null;       // iframe.contentDocument
     get mountPoint(): HTMLElement | null;  // the #rime-root render node
     setBaseStyles(css: string): void;      // replace the injected <style id="rime-base"> textContent
     destroy(): void;                       // remove listeners + iframe
   }
   ```
2. **srcdoc skeleton** — assign `iframe.srcdoc` to a minimal, self-contained
   document (no external requests). Reset margins, set a neutral box model, and
   include two well-known nodes:
   ```ts
   const SRCDOC = `<!doctype html><html><head><meta charset="utf-8">
   <style id="rime-base">/* injected email base styles go here */
   *,*::before,*::after{box-sizing:border-box} html,body{margin:0} body{font:15px system-ui;background:#fff}</style>
   </head><body><div id="rime-root"></div></body></html>`;
   ```
   The renderer (ENV-16) draws into `#rime-root`; `#rime-base` is the swappable email
   stylesheet (`setBaseStyles`).
3. **Same-origin guarantee** — use `srcdoc` (not `src`) so the iframe is same-origin
   with the host → `contentDocument`, `elementFromPoint`, and selection are all
   reachable. Do not sandbox in a way that blocks same-origin access; if `sandbox`
   is set at all, it must include `allow-same-origin` (and `allow-scripts` only if a
   later ticket needs in-iframe script — v1 renders from the host, so prefer no
   script execution inside the canvas).
4. **Load lifecycle** — resolve `whenReady()` on the iframe `load` event with
   `{ doc, mount, iframe }`. Guard against double-mount and against accessing
   `contentDocument` before load. On `destroy()`, remove the `load` listener and the
   iframe element; null internal refs (memory discipline, §10).
5. **CSS isolation is structural, not host-leaked** — the iframe must **not** copy or
   inherit any host/chrome stylesheet. `--rime-*` chrome tokens stop at the iframe
   boundary by design (ENV-18 verifies). The only styles inside are `#rime-base` plus
   whatever ENV-16 writes into `#rime-root`.
6. **Wire into the shell** — `RimeEditor.firstUpdated` constructs a
   `CanvasController`, `mount()`s it into the `part="canvas"` section, and holds the
   `whenReady()` promise for ENV-16 to await. Expose the iframe as `part="canvas-frame"`
   for the ENV-03 `canvasFrame()` helper.

## Acceptance criteria
- [ ] Shell mounts exactly one `<iframe part="canvas-frame">` into `part="canvas"`.
- [ ] iframe uses `srcdoc` and is **same-origin** (`iframe.contentDocument` is
      accessible; `elementFromPoint` works inside it).
- [ ] `whenReady()` resolves after `load` with `{ doc, mount, iframe }` where `mount`
      is `#rime-root`.
- [ ] `setBaseStyles(css)` replaces `#rime-base` contents and visibly restyles the
      canvas without touching the chrome.
- [ ] **No host CSS bleed:** a host rule like `* { color: red }` does NOT affect
      content inside `#rime-root` (Playwright, chromium + webkit).
- [ ] `destroy()` removes the iframe and its listeners (no leaked `load` handler).

## Out of scope
- Rendering the doc into `#rime-root` (ENV-16).
- Coordinate translation / pointer math (ENV-17).
- The full no-bleed theming verification matrix (ENV-18 owns the dedicated test).

## Verification
```bash
cd packages/core
bun test
bun run build
bun run e2e   # chromium + webkit: iframe present, same-origin reachable, host `* { color:red }` does NOT reach #rime-root
```

## Definition of done
See `_conventions.md`. srcdoc canvas live with a clean mount + isolation proven;
status → `review`.
