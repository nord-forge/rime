---
id: ENV-04
title: Shared Playwright harness + editor fixtures
status: done
priority: P0
milestone: 0 — Foundations
depends_on: [ENV-01]
blocks: []
package: core
prd: [§9]
estimate: M
---

# ENV-04 — Shared Playwright harness + editor fixtures

## Context
The do-or-die behaviours of this project — DnD, the iframe canvas, coordinate
translation, contenteditable — are only verifiable in a real browser, and most of
the quirks live in **WebKit/Safari** (§9, R-1, R-2). This ticket stands up the
cross-browser Playwright harness and the reusable fixtures every browser-observable
ticket (ENV-31/32/33/34/40+/50+) will build its specs on, so those tickets write
*tests*, not *boilerplate*. The spikes already prove the config shape: copy
`.claude/spikes/od2-toolchain/playwright.config.ts` (chromium + webkit projects) and the
http-served pattern from `.claude/spikes/od1-richtext/playwright.config.ts` (file:// breaks
srcdoc origin + module workers — must serve over http).

## Goal
`bun run e2e` runs Playwright across **chromium + webkit**, with a fixture that
mounts `<enveloppe-editor>` on a served page and exposes helpers for driving the
iframe canvas — green against a placeholder editor.

## Prerequisites
- ENV-01 done (core builds to `dist/`, `lit` resolvable). The editor shell itself
  (ENV-30) may not exist yet; the harness must work against a minimal placeholder
  custom element so it is unblocked.
- Read both spike `playwright.config.ts` files and `.claude/spikes/od1-richtext/tests/engine.spec.ts`
  (the `__spike` test-bridge pattern for driving an in-iframe engine without UI deps).

## Implementation notes
Create under `packages/core/` (the harness lives where the component lives):

1. **`playwright.config.ts`** — projects `chromium` + `webkit` (WebKit mandatory).
   Serve the built component over http so `srcdoc` origin and module loading behave:
   ```ts
   import { defineConfig } from "@playwright/test";
   export default defineConfig({
     testDir: "./e2e",
     timeout: 30_000,
     webServer: {
       command: "bunx vite preview --outDir dist --port 4318 --strictPort",
       port: 4318,
       reuseExistingServer: !process.env.CI,
     },
     use: { baseURL: "http://localhost:4318" },
     projects: [
       { name: "chromium", use: { browserName: "chromium" } },
       { name: "webkit", use: { browserName: "webkit" } },
     ],
   });
   ```
2. **`e2e/fixtures.ts`** — extend Playwright `test` with an `editor` fixture that
   navigates to a harness page, imports the built `@enveloppe/core` bundle, defines
   the element, and returns handles. Keep helpers minimal but real:
   ```ts
   import { test as base, expect, type Page, type Locator } from "@playwright/test";

   export interface EditorHarness {
     host: Locator;                       // the <enveloppe-editor> element
     canvasFrame(): Promise<import("@playwright/test").FrameLocator>; // the iframe canvas
     loadDoc(doc: unknown): Promise<void>;
     getDoc(): Promise<unknown>;
   }

   export const test = base.extend<{ editor: EditorHarness }>({
     editor: async ({ page }, use) => {
       await page.goto("/e2e/harness.html");        // static page that imports dist + defines the element
       await page.waitForSelector("enveloppe-editor");
       const host = page.locator("enveloppe-editor");
       const harness: EditorHarness = {
         host,
         async canvasFrame() {
           // canvas iframe is `part="canvas"` inside the shadow root (see ENV-31)
           return page.frameLocator("enveloppe-editor iframe");
         },
         async loadDoc(doc) {
           await page.evaluate((d) => (document.querySelector("enveloppe-editor") as any).loadDoc(d), doc);
         },
         async getDoc() {
           return page.evaluate(() => (document.querySelector("enveloppe-editor") as any).getDoc());
         },
       };
       await use(harness);
     },
   });
   export { expect };
   ```
3. **`e2e/harness.html`** — a static page (served by `vite preview` from `dist/` or
   a tiny fixtures dir) that imports the built bundle and places one
   `<enveloppe-editor>`. While ENV-30 is unbuilt, ship a placeholder element that
   renders an empty `part="canvas"` iframe so the fixture resolves; ENV-30 swaps in
   the real shell with no fixture change.
4. **Iframe-canvas helpers** — provide `canvasFrame()` returning a `FrameLocator`
   so later specs do `(await editor.canvasFrame()).locator("[data-node-id]")`. Add a
   `pointerInCanvas(x, y)` helper stub that documents it will be fleshed out by the
   coordinate controller (ENV-33) — do not implement coordinate math here.
5. **`e2e/smoke.spec.ts`** — one cross-browser smoke test using the fixture:
   element is visible and a canvas iframe is present. Mirrors
   `.claude/spikes/od2-toolchain/smoke.spec.ts`.
6. **Root script** — confirm `bun run e2e` (already declared in ENV-01) maps to
   `bunx playwright test` for the core package (or a root config that points at it).
7. **CI note** — ENV-03 intentionally omits browser binaries. Document in the
   ticket's PR how `bun run e2e` would be added to a separate CI job (Playwright
   install of chromium + webkit) if desired; do not wire it into ENV-03's fast job.

## Acceptance criteria
- [ ] `packages/core/playwright.config.ts` defines **chromium + webkit** projects
      and serves the build over http (no `file://`).
- [ ] `editor` fixture mounts `<enveloppe-editor>` and exposes `host`,
      `canvasFrame()`, `loadDoc()`, `getDoc()`.
- [ ] `canvasFrame()` returns a working `FrameLocator` for the canvas iframe.
- [ ] `bun run e2e` passes the smoke spec in **both** chromium and webkit.
- [ ] Harness works against a placeholder element (unblocked by ENV-30) and requires
      no fixture change when the real shell lands.

## Out of scope
- Real coordinate-translation helpers (ENV-33) — only a documented stub here.
- DnD-driving helpers (ENV-40/46) and rich-text-driving helpers (ENV-50+).
- Wiring E2E into the ENV-03 CI job (note only).

## Verification
```bash
cd packages/core
bun run build            # produce dist/ that the harness page imports
bunx playwright install chromium webkit
bun run e2e              # smoke green in chromium AND webkit
```

## Definition of done
See `_conventions.md`. Smoke passes in both browsers; fixtures exported for reuse;
status → `review`.
