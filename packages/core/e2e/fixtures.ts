// Reusable Playwright fixtures every browser-observable ticket builds on
// (ENV-31/32/33/34/40+/50+). Tickets write tests, not boilerplate: they get a
// mounted <enveloppe-editor>, a FrameLocator for its iframe canvas, and the
// load/get-doc persistence helpers.

import { type Locator, type Page, test as base, expect } from "@playwright/test";

export interface EditorHarness {
  /** The <enveloppe-editor> host element. */
  host: Locator;
  /** FrameLocator for the same-origin srcdoc canvas iframe (ENV-31). */
  canvasFrame(): ReturnType<Page["frameLocator"]>;
  /** Load a document into the editor (mirrors ENV-80 persistence API). */
  loadDoc(doc: unknown): Promise<void>;
  /** Read the current document back out. */
  getDoc(): Promise<unknown>;
  /**
   * Translate a point in canvas-document space to a host-page pointer action.
   * STUB — the real coordinate math is owned by the drag controller (ENV-33);
   * this throws until then so specs don't silently depend on missing behaviour.
   */
  pointerInCanvas(x: number, y: number): Promise<void>;
}

export const test = base.extend<{ editor: EditorHarness }>({
  editor: async ({ page }, use) => {
    await page.goto("/e2e/harness.html");
    await page.waitForSelector("enveloppe-editor");
    const host = page.locator("enveloppe-editor");

    const harness: EditorHarness = {
      host,
      canvasFrame() {
        // The canvas iframe is exposed as part="canvas" in the shadow root.
        return page.frameLocator("enveloppe-editor iframe");
      },
      async loadDoc(doc) {
        await page.evaluate((d) => {
          const el = document.querySelector("enveloppe-editor") as unknown as {
            loadDoc(doc: unknown): void;
          };
          el.loadDoc(d);
        }, doc);
      },
      async getDoc() {
        return page.evaluate(() => {
          const el = document.querySelector("enveloppe-editor") as unknown as {
            getDoc(): unknown;
          };
          return el.getDoc();
        });
      },
      async pointerInCanvas(x, y) {
        void x;
        void y;
        throw new Error(
          "pointerInCanvas is a stub until ENV-33 (coordinate-translation drag controller)",
        );
      },
    };

    await use(harness);
  },
});

export { expect };
