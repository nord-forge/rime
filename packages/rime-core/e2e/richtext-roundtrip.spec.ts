import { expect, test } from "./fixtures";

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
                content: [
                  { type: "heading", level: 2, content: [{ type: "text", text: "Welcome" }] },
                  {
                    type: "paragraph",
                    content: [
                      { type: "text", text: "see " },
                      { type: "text", text: "docs", link: "https://x.test" },
                    ],
                  },
                  {
                    type: "list",
                    ordered: false,
                    items: [
                      { type: "listitem", content: [{ type: "text", text: "alpha" }] },
                      {
                        type: "listitem",
                        content: [{ type: "text", text: "beta", marks: ["bold"] }],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
};

test.describe("rich-text round-trip", () => {
  test("heading, list and link render in the canvas preview DOM", async ({ editor }) => {
    await editor.loadDoc(DOC);
    const tags = await editor.host.evaluate(async (host) => {
      const el = host as unknown as { whenCanvasReady(): Promise<{ mount: HTMLElement }> };
      const { mount } = await el.whenCanvasReady();
      const block = mount.querySelector('[data-node-id="txt_1"]')!;
      return {
        h2: !!block.querySelector("h2"),
        ul: !!block.querySelector("ul"),
        li: block.querySelectorAll("li").length,
        link: block.querySelector("a")?.getAttribute("href") ?? null,
        bold: !!block.querySelector("li strong"),
      };
    });
    expect(tags.h2).toBe(true);
    expect(tags.ul).toBe(true);
    expect(tags.li).toBe(2);
    expect(tags.link).toBe("https://x.test");
    expect(tags.bold).toBe(true);
  });

  test("focus then blur with no edit leaves the doc unchanged", async ({ editor, page }) => {
    await editor.loadDoc(DOC);
    const before = await editor.getDoc();

    const frame = page.frameLocator("rime-editor iframe");
    const block = frame.locator('[data-node-id="txt_1"]');
    // Two-stage: select, then edit (mounts the editor).
    await block.click();
    await block.click();
    // Blur by clicking the document background.
    await frame.locator('[data-node-id="doc_1"]').click({ position: { x: 2, y: 2 } });

    const after = await editor.getDoc();
    expect(after).toEqual(before);
  });
});
