import { expect, type Page, test } from "@playwright/test";

// The registry-driven palette renders in the editor shadow root. Each item is a
// pointer-drag source (drop on the canvas inserts a new block) and keyboard-operable
// (Enter adds at a default location). Real browser — chromium + webkit.

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
              style: { paddingTop: 30, paddingBottom: 30 },
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
  await page.waitForSelector("rime-editor");
  await page.evaluate(async (doc) => {
    const el = document.querySelector("rime-editor") as unknown as {
      whenCanvasReady(): Promise<unknown>;
      loadDoc(d: unknown): void;
    };
    await el.whenCanvasReady();
    el.loadDoc(doc);
  }, DOC);
}

// A palette item button by its block-type id, inside the editor shadow root.
function paletteItem(page: Page, blockType: string) {
  return page
    .locator("rime-editor")
    .locator("eb-palette")
    .locator(`.item[data-block-type="${blockType}"]`);
}

function colChildCount(page: Page, colId: string): Promise<number> {
  return page.evaluate((id) => {
    const el = document.querySelector("rime-editor") as unknown as {
      getDoc(): { children: { type: string; children?: { id: string; children: unknown[] }[] }[] };
    };
    for (const section of el.getDoc().children) {
      for (const col of section.children ?? []) {
        if (col.id === id) return col.children.length;
      }
    }
    return -1;
  }, colId);
}

function docChildCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (
        document.querySelector("rime-editor") as unknown as { getDoc(): { children: unknown[] } }
      ).getDoc().children.length,
  );
}

async function canvasCenter(page: Page, nodeId: string): Promise<{ x: number; y: number }> {
  return page.evaluate((id) => {
    const host = document.querySelector("rime-editor")!;
    const f = host.shadowRoot!.querySelector("iframe") as HTMLIFrameElement;
    const fr = f.getBoundingClientRect();
    const r = f.contentDocument!.querySelector(`[data-node-id="${id}"]`)!.getBoundingClientRect();
    return { x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 };
  }, nodeId);
}

test.describe("block palette", () => {
  test("renders registry blocks grouped with icon + label", async ({ page }) => {
    await setup(page);
    await expect(paletteItem(page, "text")).toBeVisible();
    await expect(paletteItem(page, "button")).toBeVisible();
    await expect(paletteItem(page, "hero")).toBeVisible();
    // A column-layout preset appears too.
    await expect(paletteItem(page, "preset-2-col")).toBeVisible();
  });

  test("dragging a palette item onto the canvas inserts a new block", async ({ page }) => {
    await setup(page);
    expect(await colChildCount(page, "col_1")).toBe(1);

    const item = await paletteItem(page, "button").boundingBox();
    const target = await canvasCenter(page, "t_a");
    await page.mouse.move(item!.x + item!.width / 2, item!.y + item!.height / 2);
    await page.mouse.down();
    await page.mouse.move(item!.x + 6, item!.y + 6); // cross the drag threshold
    await page.mouse.move(target.x, target.y + 10, { steps: 6 }); // just below t_a → after it
    await page.mouse.up();

    await expect.poll(() => colChildCount(page, "col_1")).toBe(2);
  });

  test("keyboard Enter on a palette item adds a block (no drag)", async ({ page }) => {
    await setup(page);
    expect(await colChildCount(page, "col_1")).toBe(1);
    await paletteItem(page, "divider").focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => colChildCount(page, "col_1")).toBe(2);
  });

  test("keyboard-adding a section-level preset appends a section to the document", async ({
    page,
  }) => {
    await setup(page);
    expect(await docChildCount(page)).toBe(1);
    await paletteItem(page, "preset-2-col").focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => docChildCount(page)).toBe(2);
  });
});
