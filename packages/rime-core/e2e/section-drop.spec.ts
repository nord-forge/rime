import { expect, type Page, test } from "@playwright/test";

// Section-level drops: a column-layout preset (and a band like a hero) inserts at
// the DOCUMENT level, between sections — not into a column. Driven by real pointer
// events like the rest of canvas DnD.

const ONE_SECTION_DOC = {
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
      registerPaletteItem(elm: HTMLElement, t: string): () => void;
    };
    await el.whenCanvasReady();
    el.loadDoc(doc);
    const item = document.createElement("div");
    item.id = "palette-preset";
    item.textContent = "2 columns";
    item.style.cssText = "position:fixed;top:0;right:0;width:80px;height:24px;z-index:9999";
    document.body.append(item);
    el.registerPaletteItem(item, "preset-2-col");
  }, ONE_SECTION_DOC);
}

function docChildTypes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const el = document.querySelector("rime-editor") as unknown as {
      getDoc(): { children: { type: string }[] };
    };
    return el.getDoc().children.map((c) => c.type);
  });
}

function sectionShape(page: Page): Promise<number[][]> {
  return page.evaluate(() => {
    const el = document.querySelector("rime-editor") as unknown as {
      getDoc(): { children: { type: string; children?: { widthPercent: number }[] }[] };
    };
    return el
      .getDoc()
      .children.filter((c) => c.type === "section")
      .map((s) => (s.children ?? []).map((col) => col.widthPercent));
  });
}

async function canvasRect(page: Page, nodeId: string): Promise<DOMRect> {
  return page.evaluate((id) => {
    const host = document.querySelector("rime-editor")!;
    const frame = host.shadowRoot!.querySelector("iframe") as HTMLIFrameElement;
    const fr = frame.getBoundingClientRect();
    const r = frame
      .contentDocument!.querySelector(`[data-node-id="${id}"]`)!
      .getBoundingClientRect();
    return { x: fr.left + r.left, y: fr.top + r.top, width: r.width, height: r.height } as DOMRect;
  }, nodeId);
}

async function pointerDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 6, from.y + 6);
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

test.describe("section-level drop (pointer)", () => {
  test("dropping a 2-column preset inserts a new section at the document level", async ({
    page,
  }) => {
    await setup(page);
    expect(await docChildTypes(page)).toEqual(["section"]);

    const palette = (await page.locator("#palette-preset").boundingBox())!;
    const sec = await canvasRect(page, "sec_1");
    // Drop near the bottom of the existing section → after it.
    await pointerDrag(
      page,
      { x: palette.x + palette.width / 2, y: palette.y + palette.height / 2 },
      { x: sec.x + sec.width / 2, y: sec.y + sec.height - 4 },
    );

    // A second section now exists, and the dropped one is split 50/50.
    const shape = await sectionShape(page);
    expect(shape.length).toBe(2);
    expect(shape).toContainEqual([50, 50]);
    expect(await docChildTypes(page)).toEqual(["section", "section"]);
  });
});
