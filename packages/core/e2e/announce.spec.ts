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
          widthPercent: 50,
          style: {},
          children: [
            {
              id: "t_a",
              type: "text",
              style: { paddingTop: 16, paddingBottom: 16 },
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }],
              },
            },
            {
              id: "t_b",
              type: "text",
              style: { paddingTop: 16, paddingBottom: 16 },
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }],
              },
            },
          ],
        },
        {
          id: "col_2",
          type: "column",
          widthPercent: 50,
          style: {},
          children: [
            {
              id: "btn_c",
              type: "button",
              label: "C",
              href: "#",
              style: { paddingTop: 16, paddingBottom: 16 },
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
    const item = document.createElement("div");
    item.id = "palette-image";
    item.style.cssText = "position:fixed;top:0;right:0;width:80px;height:24px;z-index:9999";
    document.body.append(item);
    el.registerPaletteItem(item, "image");
  }, DOC);
}

function liveText(page: Page) {
  return page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 20)); // clear-then-set settles
    const host = document.querySelector("enveloppe-editor")!;
    return host.shadowRoot!.querySelector("[aria-live]")?.textContent ?? "";
  });
}

async function selectBlock(page: Page, id: string): Promise<void> {
  await page.frameLocator("enveloppe-editor iframe").locator(`[data-node-id="${id}"]`).click();
}

async function nodeCenter(page: Page, id: string) {
  return page.evaluate((nodeId) => {
    const host = document.querySelector("enveloppe-editor")!;
    const f = host.shadowRoot!.querySelector("iframe") as HTMLIFrameElement;
    const fr = f.getBoundingClientRect();
    const r = f
      .contentDocument!.querySelector(`[data-node-id="${nodeId}"]`)!
      .getBoundingClientRect();
    return { x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 };
  }, id);
}

test.describe("ARIA live announcements", () => {
  test("keyboard move announces a positional message", async ({ page }) => {
    await setup(page);
    await selectBlock(page, "t_a");
    await page.keyboard.press("Alt+ArrowDown");
    expect(await liveText(page)).toBe("Moved Text to Column 1, position 2 of 2");
  });

  test("pointer palette drop announces an insert message", async ({ page }) => {
    await setup(page);
    const palette = (await page.locator("#palette-image").boundingBox())!;
    const c = await nodeCenter(page, "btn_c");
    await page.mouse.move(palette.x + 40, palette.y + 12);
    await page.mouse.down();
    await page.mouse.move(palette.x + 60, palette.y + 40, { steps: 3 });
    await page.mouse.move(c.x, c.y + 8, { steps: 4 });
    await page.mouse.up();
    expect(await liveText(page)).toContain("Inserted Image into Column 2");
  });

  test("delete announces a removal message", async ({ page }) => {
    await setup(page);
    await selectBlock(page, "t_b");
    await page.keyboard.press("Delete");
    expect(await liveText(page)).toBe("Removed Text from Column 1");
  });
});
