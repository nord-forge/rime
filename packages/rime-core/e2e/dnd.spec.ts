import { expect, type Page, test } from "@playwright/test";

// Canvas DnD is pointer-event based, so real page.mouse drives it — no
// native-HTML5-drag or cross-document hacks needed.

const TWO_COL_DOC = {
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
              style: { paddingTop: 20, paddingBottom: 20 },
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }],
              },
            },
            {
              id: "t_b",
              type: "text",
              style: { paddingTop: 20, paddingBottom: 20 },
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
              id: "t_c",
              type: "text",
              style: { paddingTop: 20, paddingBottom: 20 },
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "C" }] }],
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
    const item = document.createElement("div");
    item.id = "palette-button";
    item.textContent = "Button";
    item.style.cssText = "position:fixed;top:0;right:0;width:80px;height:24px;z-index:9999";
    document.body.append(item);
    el.registerPaletteItem(item, "button");
  }, TWO_COL_DOC);
}

async function columnIds(page: Page): Promise<Record<string, string[]>> {
  return page.evaluate(() => {
    const el = document.querySelector("rime-editor") as unknown as {
      getDoc(): { children: { children: { id: string; children: { id: string }[] }[] }[] };
    };
    const doc = el.getDoc();
    const out: Record<string, string[]> = {};
    for (const col of doc.children[0]!.children) out[col.id] = col.children.map((c) => c.id);
    return out;
  });
}

/** Center of a canvas node (host client coords). */
async function nodeCenter(page: Page, nodeId: string): Promise<{ x: number; y: number }> {
  return page.evaluate((id) => {
    const host = document.querySelector("rime-editor")!;
    const frame = host.shadowRoot!.querySelector("iframe") as HTMLIFrameElement;
    const fr = frame.getBoundingClientRect();
    const r = frame
      .contentDocument!.querySelector(`[data-node-id="${id}"]`)!
      .getBoundingClientRect();
    return { x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 };
  }, nodeId);
}

/** Drive a pointer drag from one host point to another, with intermediate moves. */
async function pointerDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 6, from.y + 6); // cross the drag threshold
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

test.describe("drag and drop (pointer)", () => {
  test("palette → column inserts a new block via the doc", async ({ page }) => {
    await setup(page);
    expect((await columnIds(page))["col_2"]).toEqual(["t_c"]);

    const palette = await page.locator("#palette-button").boundingBox();
    const cCenter = await nodeCenter(page, "t_c");
    await pointerDrag(
      page,
      { x: palette!.x + palette!.width / 2, y: palette!.y + palette!.height / 2 },
      { x: cCenter.x, y: cCenter.y + 8 }, // just below t_c's midpoint → after t_c
    );

    const after = await columnIds(page);
    expect(after["col_2"]!.length).toBe(2);
    expect(after["col_2"]!.some((id) => id.startsWith("button"))).toBe(true);
  });

  test("reorder a leaf within its column", async ({ page }) => {
    await setup(page);
    expect((await columnIds(page))["col_1"]).toEqual(["t_a", "t_b"]);

    const a = await nodeCenter(page, "t_a");
    const b = await nodeCenter(page, "t_b");
    await pointerDrag(page, a, { x: b.x, y: b.y + 25 }); // A past B → A after B

    expect((await columnIds(page))["col_1"]).toEqual(["t_b", "t_a"]);
  });

  test("move a leaf across columns", async ({ page }) => {
    await setup(page);
    const a = await nodeCenter(page, "t_a");
    const c = await nodeCenter(page, "t_c");
    await pointerDrag(page, a, { x: c.x, y: c.y - 25 }); // t_a into col_2 above t_c

    const after = await columnIds(page);
    expect(after["col_1"]).toEqual(["t_b"]);
    expect(after["col_2"]).toContain("t_a");
  });

  test("a click (no movement) does not move anything", async ({ page }) => {
    await setup(page);
    const before = await columnIds(page);
    const a = await nodeCenter(page, "t_a");
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.up();
    expect(await columnIds(page)).toEqual(before);
  });

  test("nested resolution: a palette drop lands in the column under the pointer", async ({
    page,
  }) => {
    await setup(page);
    const palette = (await page.locator("#palette-button").boundingBox())!;
    // Drop over col_2 (the right column) specifically.
    const c = await nodeCenter(page, "t_c");
    await pointerDrag(page, { x: palette.x + 40, y: palette.y + 12 }, { x: c.x, y: c.y + 8 });
    const after = await columnIds(page);
    // Resolved to col_2 (nested column level), not col_1.
    expect(after["col_2"]!.some((id) => id.startsWith("button"))).toBe(true);
    expect(after["col_1"]!.some((id) => id.startsWith("button"))).toBe(false);
  });

  test("a drop outside the canvas is a no-op", async ({ page }) => {
    await setup(page);
    const before = await columnIds(page);
    const a = await nodeCenter(page, "t_a");
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 6, a.y + 6);
    await page.mouse.move(5, 5, { steps: 4 }); // top-left, off the canvas (palette region)
    await page.mouse.up();
    expect(await columnIds(page)).toEqual(before);
  });

  test("dropping in a section's bottom padding (below the last block) appends", async ({
    page,
  }) => {
    // A flex column shrinks to its content, so the section's trailing padding sits
    // below the column box. The drop hit-area must still reach it and append there.
    await page.goto("/e2e/harness.html");
    await page.waitForSelector("rime-editor");
    await page.evaluate(async () => {
      const el = document.querySelector("rime-editor") as unknown as {
        whenCanvasReady(): Promise<unknown>;
        loadDoc(d: unknown): void;
        registerPaletteItem(elm: HTMLElement, t: string): () => void;
      };
      await el.whenCanvasReady();
      el.loadDoc({
        id: "d",
        type: "document",
        settings: { contentWidth: 600, backgroundColor: "#fff", fontFamily: "Arial" },
        children: [
          {
            id: "s",
            type: "section",
            style: { paddingTop: 24, paddingBottom: 40 },
            children: [
              {
                id: "c",
                type: "column",
                widthPercent: 100,
                style: {},
                children: [
                  {
                    id: "only",
                    type: "text",
                    style: {},
                    content: {
                      type: "doc",
                      content: [{ type: "paragraph", content: [{ type: "text", text: "Only" }] }],
                    },
                  },
                ],
              },
            ],
          },
        ],
      });
      const item = document.createElement("div");
      item.id = "palette-button";
      item.style.cssText = "position:fixed;top:0;right:0;width:80px;height:24px;z-index:9999";
      document.body.append(item);
      el.registerPaletteItem(item, "spacer");
    });

    // A point clearly below the only block (in the section's bottom padding).
    const target = await page.evaluate(() => {
      const host = document.querySelector("rime-editor")!;
      const frame = host.shadowRoot!.querySelector("iframe") as HTMLIFrameElement;
      const fr = frame.getBoundingClientRect();
      const only = frame
        .contentDocument!.querySelector('[data-node-id="only"]')!
        .getBoundingClientRect();
      return { x: fr.left + only.left + only.width / 2, y: fr.top + only.bottom + 14 };
    });
    const palette = (await page.locator("#palette-button").boundingBox())!;
    await pointerDrag(page, { x: palette.x + 40, y: palette.y + 12 }, { x: target.x, y: target.y });

    const ids = await page.evaluate(() =>
      (
        document.querySelector("rime-editor") as unknown as {
          getDoc(): { children: { children: { children: { id: string }[] }[] }[] };
        }
      )
        .getDoc()
        .children[0]!.children[0]!.children.map((c) => c.id),
    );
    expect(ids[0]).toBe("only");
    expect(ids).toHaveLength(2);
    expect(ids[1]!.startsWith("spacer")).toBe(true);
  });
});
