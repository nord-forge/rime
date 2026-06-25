import { expect, test } from "@playwright/test";

// Inserting a merge tag into the live Lexical editor produces an atomic, themed
// chip in the canvas DOM and a token inline in the serialized RichTextJSON. Driven
// through the real in-iframe selection (the same path the picker UI will take in a
// later ticket) — real-browser verification (chromium + webkit) because the chip is
// a contenteditable child whose rendering/selection differs across engines.

const DOC = {
  id: "doc_1",
  type: "document",
  settings: { contentWidth: 600, backgroundColor: "#ffffff", fontFamily: "Arial" },
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
              id: "txt_1",
              type: "text",
              style: {},
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Hi " }] }],
              },
            },
          ],
        },
      ],
    },
  ],
};

async function mountOnTextBlock(host: import("@playwright/test").Locator) {
  await host.evaluate(async (el, doc) => {
    const editor = el as unknown as {
      whenCanvasReady(): Promise<{ mount: HTMLElement }>;
      loadDoc(d: unknown): void;
    };
    const { mount } = await editor.whenCanvasReady();
    editor.loadDoc(doc);
    const blockEl = mount.querySelector('[data-node-id="txt_1"]') as HTMLElement;
    const mountLexical = (
      window as unknown as { __mountLexical: typeof import("../src/index.ts").mountLexical }
    ).__mountLexical;
    (window as unknown as { __mount: unknown }).__mount = mountLexical(
      blockEl,
      doc.children[0].children[0].children[0].content,
    );
  }, DOC);
}

test.describe("insertToken in the canvas", () => {
  test("inserts a chip and a token inline at the live selection", async ({ page }) => {
    await page.goto("/e2e/richtext-harness.html");
    await page.waitForSelector("rime-editor");
    const host = page.locator("rime-editor");
    await mountOnTextBlock(host);

    // Click into the editable so Lexical resolves a real RangeSelection from the
    // browser's caret, then insert a token through the public mount API.
    const frame = page.frameLocator("rime-editor iframe");
    const block = frame.locator('[data-node-id="txt_1"]');
    await block.click();

    const json = await host.evaluate((el) => {
      void el;
      const m = (
        window as unknown as {
          __mount: { insertToken(token: string, label?: string): void; toJSON(): unknown };
        }
      ).__mount;
      m.insertToken("first_name", "First name");
      return m.toJSON() as {
        content: { content?: { type: string; token?: string; label?: string }[] }[];
      };
    });

    // A themed chip carrying the bare key is painted in the canvas.
    const chip = frame.locator('[data-node-id="txt_1"] [data-token="first_name"]');
    await expect(chip).toBeVisible();
    await expect(chip).toHaveText("First name");

    // ...and the serialized content carries the token inline (bare key, no braces).
    const inlines = json.content[0]!.content!;
    const token = inlines.find((r) => r.type === "token");
    expect(token).toEqual({ type: "token", token: "first_name", label: "First name" });
  });
});
