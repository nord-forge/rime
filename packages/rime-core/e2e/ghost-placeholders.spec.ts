import { expect, test } from "./fixtures";

// Builder-only ghost placeholders make otherwise-invisible blocks (empty text,
// image with no source, spacer) visible and clickable in the canvas. The chrome
// styling lives in a dedicated #rime-chrome stylesheet so it never reaches the
// exported email. Real browser (Lit + iframe) — chromium + webkit.

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
              id: "text_1",
              type: "text",
              content: { type: "doc", content: [{ type: "paragraph", content: [] }] },
              style: {},
            },
            { id: "img_1", type: "image", src: "", alt: "", style: {} },
            { id: "spacer_1", type: "spacer", height: 24, style: {} },
          ],
        },
      ],
    },
  ],
};

test.describe("ghost placeholders", () => {
  test.beforeEach(async ({ editor }) => {
    await editor.host.evaluate(async (host) => {
      await (host as unknown as { whenCanvasReady(): Promise<unknown> }).whenCanvasReady();
    });
    await editor.loadDoc(DOC);
  });

  test("empty blocks are stamped data-empty", async ({ editor }) => {
    const frame = editor.canvasFrame();
    await expect(frame.locator('[data-node-id="text_1"]')).toHaveAttribute("data-empty", "1");
    await expect(frame.locator('[data-node-id="img_1"]')).toHaveAttribute("data-empty", "1");
    await expect(frame.locator('[data-node-id="spacer_1"]')).toHaveAttribute("data-empty", "1");
  });

  test("the ghost gives an empty block a visible, clickable box", async ({ editor }) => {
    const text = editor.canvasFrame().locator('[data-node-id="text_1"]');
    const box = await text.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(40);
  });

  test("the placeholder label is exposed via data-placeholder", async ({ editor }) => {
    await expect(editor.canvasFrame().locator('[data-node-id="img_1"]')).toHaveAttribute(
      "data-placeholder",
      /image/i,
    );
  });

  test("clicking a block sets data-selected for the selection outline", async ({ editor }) => {
    const spacer = editor.canvasFrame().locator('[data-node-id="spacer_1"]');
    await spacer.click();
    await expect(spacer).toHaveAttribute("data-selected", "");
  });

  test("chrome styling stays out of the email base stylesheet", async ({ editor }) => {
    const sheets = await editor.host.evaluate(async (host) => {
      const el = host as unknown as {
        whenCanvasReady(): Promise<unknown>;
        canvas: { document: Document };
      };
      await el.whenCanvasReady();
      const d = el.canvas.document;
      return {
        chrome: d.getElementById("rime-chrome")?.textContent ?? "",
        base: d.getElementById("rime-base")?.textContent ?? "",
      };
    });
    expect(sheets.chrome).toContain("data-empty");
    expect(sheets.base).not.toContain("data-empty");
  });
});
