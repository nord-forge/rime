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
          ],
        },
      ],
    },
  ],
};

async function setup(page: Page): Promise<void> {
  await page.goto("/e2e/harness.html");
  await page.waitForSelector("enveloppe-editor");
  await page.evaluate(async (doc) => {
    const el = document.querySelector("enveloppe-editor") as unknown as {
      whenCanvasReady(): Promise<unknown>;
      loadDoc(d: unknown): void;
      registerPaletteItem(elm: HTMLElement, t: string): () => void;
    };
    await el.whenCanvasReady();
    el.loadDoc(doc);
    el.config = { theme: { "--eb-color-bg": "rgb(7, 8, 9)" } };
    const item = document.createElement("div");
    item.id = "palette-button";
    item.style.cssText = "position:fixed;top:0;right:0;width:80px;height:24px;z-index:9999";
    document.body.append(item);
    el.registerPaletteItem(item, "button");
  }, DOC);
}

function previewState(page: Page) {
  return page.evaluate(() => {
    const host = document.querySelector("enveloppe-editor")!;
    const el = host.shadowRoot!.querySelector(
      '[data-eb-overlay="drag-preview"]',
    ) as HTMLElement | null;
    if (!el) return { present: false };
    const cs = getComputedStyle(el);
    return { present: true, label: el.textContent, bg: cs.backgroundColor };
  });
}

test.describe("drag preview", () => {
  test("palette drag shows a themed preview with the block label, cleaned up after", async ({
    page,
  }) => {
    await setup(page);
    expect((await previewState(page)).present).toBe(false);

    const palette = (await page.locator("#palette-button").boundingBox())!;
    await page.mouse.move(palette.x + 40, palette.y + 12);
    await page.mouse.down();
    await page.mouse.move(palette.x + 60, palette.y + 40, { steps: 3 });
    await page.mouse.move(palette.x + 120, palette.y + 120, { steps: 4 });

    const mid = await previewState(page);
    expect(mid.present).toBe(true);
    expect(mid.label).toContain("Button");
    expect(mid.bg).toBe("rgb(7, 8, 9)"); // --eb-color-bg applied

    await page.mouse.up();
    // cleaned up: no detached preview node remains
    expect((await previewState(page)).present).toBe(false);
  });

  test("only one preview node exists across repeated drags", async ({ page }) => {
    await setup(page);
    const palette = (await page.locator("#palette-button").boundingBox())!;
    for (let i = 0; i < 3; i++) {
      await page.mouse.move(palette.x + 40, palette.y + 12);
      await page.mouse.down();
      await page.mouse.move(palette.x + 80, palette.y + 80, { steps: 3 });
      await page.mouse.up();
    }
    const count = await page.evaluate(() => {
      const host = document.querySelector("enveloppe-editor")!;
      return host.shadowRoot!.querySelectorAll('[data-eb-overlay="drag-preview"]').length;
    });
    expect(count).toBe(0);
  });
});
