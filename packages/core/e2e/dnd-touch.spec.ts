import { expect, type Page, test } from "@playwright/test";

// Touch DnD path (PRD §9). Canvas DnD is pointer-event based (OD-6); pointer
// events fire with pointerType "touch" for touch input, so the same controller
// drives touch drags. WebKit + touch is the highest-risk combination — covered
// by running under both Playwright projects with a touch-enabled context.
test.use({ hasTouch: true, isMobile: false });

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
  await page.waitForSelector("enveloppe-editor");
  await page.evaluate(async (doc) => {
    const el = document.querySelector("enveloppe-editor") as unknown as {
      whenCanvasReady(): Promise<unknown>;
      loadDoc(d: unknown): void;
    };
    await el.whenCanvasReady();
    el.loadDoc(doc);
  }, DOC);
}

function columnIds(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector("enveloppe-editor") as unknown as {
      getDoc(): { children: { children: { id: string; children: { id: string }[] }[] }[] };
    };
    return el.getDoc().children[0]!.children[0]!.children.map((c) => c.id);
  });
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

/**
 * Drive a stepped touch drag by dispatching real PointerEvents with
 * pointerType:"touch" at the right element in the right document — portable
 * across chromium + webkit (CDP touch is Chromium-only and doesn't synthesize
 * pointer events). This exercises the exact handlers a real touch gesture hits.
 */
async function touchDrag(
  page: Page,
  start: { x: number; y: number; nodeId: string },
  steps: { x: number; y: number }[],
): Promise<void> {
  await page.evaluate(
    ({ start, steps }) => {
      const host = document.querySelector("enveloppe-editor")!;
      const iframe = host.shadowRoot!.querySelector("iframe") as HTMLIFrameElement;
      const idoc = iframe.contentDocument!;
      const fr = iframe.getBoundingClientRect();
      const target = idoc.querySelector(`[data-node-id="${start.nodeId}"]`)!;

      const opts = (x: number, y: number): PointerEventInit => ({
        pointerType: "touch",
        isPrimary: true,
        bubbles: true,
        cancelable: true,
        clientX: x - fr.left, // iframe-viewport coords for the canvas document
        clientY: y - fr.top,
      });
      // pointerdown on the canvas element (iframe doc), moves/up on the iframe doc.
      target.dispatchEvent(new PointerEvent("pointerdown", opts(start.x, start.y)));
      for (const s of steps) {
        idoc.dispatchEvent(new PointerEvent("pointermove", opts(s.x, s.y)));
      }
      const last = steps[steps.length - 1]!;
      idoc.dispatchEvent(new PointerEvent("pointerup", opts(last.x, last.y)));
    },
    { start, steps },
  );
}

test.describe("touch drag and drop", () => {
  test("a touch drag reorders a block within its column", async ({ page }) => {
    await setup(page);
    expect(await columnIds(page)).toEqual(["t_a", "t_b"]);

    const a = await nodeCenter(page, "t_a");
    const b = await nodeCenter(page, "t_b");
    await touchDrag(page, { ...a, nodeId: "t_a" }, [
      { x: a.x + 6, y: a.y + 6 },
      { x: b.x, y: b.y },
      { x: b.x, y: b.y + 30 },
    ]);

    await expect.poll(() => columnIds(page)).toEqual(["t_b", "t_a"]);
  });
});
