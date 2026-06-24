import { expect, type Page, test } from "@playwright/test";

const DOC = {
  id: "doc_1",
  type: "document",
  settings: { contentWidth: 600, backgroundColor: "#fff", fontFamily: "Arial" },
  children: [
    {
      id: "sec_1",
      type: "section",
      style: {},
      children: [
        {
          id: "col_1",
          type: "column",
          widthPercent: 100,
          style: {},
          children: [
            {
              id: "t_a",
              type: "text",
              style: { paddingTop: 24, paddingBottom: 24 },
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }],
              },
            },
            {
              id: "t_b",
              type: "text",
              style: { paddingTop: 24, paddingBottom: 24 },
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }],
              },
            },
          ],
        },
      ],
    },
  ],
};

async function setup(page: Page): Promise<void> {
  await page.goto("/e2e/harness.html");
  await page.waitForSelector("rime-editor");
  await page.evaluate(async (doc) => {
    const el = document.querySelector("rime-editor") as unknown as {
      whenCanvasReady(): Promise<unknown>;
      loadDoc(d: unknown): void;
      registerPaletteItem(elm: HTMLElement, t: string): () => void;
    };
    await el.whenCanvasReady();
    el.loadDoc(doc);
    el.config = { theme: { "--eb-color-accent": "rgb(10, 20, 30)" } };
    const item = document.createElement("div");
    item.id = "palette-button";
    item.style.cssText = "position:fixed;top:0;right:0;width:80px;height:24px;z-index:9999";
    document.body.append(item);
    el.registerPaletteItem(item, "button");
  }, DOC);
}

function indicatorState(page: Page) {
  return page.evaluate(async () => {
    // The indicator updates on the next animation frame (rAF-gated detection),
    // so wait one frame before reading.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const host = document.querySelector("rime-editor")!;
    const ind = host.shadowRoot!.querySelector(
      '[data-eb-overlay="drop-indicator"]',
    ) as HTMLElement | null;
    if (!ind) return { present: false };
    const cs = getComputedStyle(ind);
    return {
      present: true,
      visible: cs.display !== "none",
      bg: cs.backgroundColor,
      top: ind.getBoundingClientRect().top,
    };
  });
}

async function nodeCenter(page: Page, id: string) {
  return page.evaluate((nodeId) => {
    const host = document.querySelector("rime-editor")!;
    const f = host.shadowRoot!.querySelector("iframe") as HTMLIFrameElement;
    const fr = f.getBoundingClientRect();
    const r = f
      .contentDocument!.querySelector(`[data-node-id="${nodeId}"]`)!
      .getBoundingClientRect();
    return { x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 };
  }, id);
}

test.describe("drop indicator", () => {
  test("appears while dragging over the canvas, themed by --eb-accent", async ({ page }) => {
    await setup(page);
    const palette = (await page.locator("#palette-button").boundingBox())!;
    const b = await nodeCenter(page, "t_b");

    await page.mouse.move(palette.x + 40, palette.y + 12);
    await page.mouse.down();
    await page.mouse.move(palette.x + 46, palette.y + 18);
    await page.mouse.move(b.x, b.y, { steps: 6 });
    // mid-drag: indicator visible + accent-colored
    const mid = await indicatorState(page);
    expect(mid.present).toBe(true);
    expect(mid.visible).toBe(true);
    expect(mid.bg).toBe("rgb(10, 20, 30)");

    await page.mouse.up();
    // after drop: hidden
    const after = await indicatorState(page);
    expect(after.visible).toBe(false);
  });

  test("hides when the pointer leaves the canvas (off-zone)", async ({ page }) => {
    await setup(page);
    const a = await nodeCenter(page, "t_a");
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x, a.y + 10, { steps: 3 }); // over canvas → visible
    expect((await indicatorState(page)).visible).toBe(true);

    // move far away to the bottom-right corner, off the canvas
    await page.mouse.move(5, 5, { steps: 4 });
    expect((await indicatorState(page)).visible).toBe(false);
    await page.mouse.up();
  });
});
