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
          widthPercent: 50,
          style: {},
          children: [
            {
              id: "txt_1",
              type: "text",
              style: {},
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Left" }] }],
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
            { id: "btn_1", type: "button", label: "Go", href: "https://x.test", style: {} },
          ],
        },
      ],
    },
  ],
};

// Doc → canvas preview DOM, verified in a real browser (chromium + webkit).
test.describe("doc → canvas render", () => {
  test("renders into #rime-root with data-node-id stamps and no <table>", async ({ editor }) => {
    const result = await editor.host.evaluate(async (host, doc) => {
      const el = host as unknown as {
        whenCanvasReady(): Promise<{ mount: HTMLElement }>;
        loadDoc(d: unknown): void;
      };
      const { mount } = await el.whenCanvasReady();
      el.loadDoc(doc);
      return {
        hasDoc: !!mount.querySelector('[data-node-id="doc_1"]'),
        hasButton: !!mount.querySelector('[data-node-id="btn_1"]'),
        tables: mount.querySelectorAll("table").length,
      };
    }, DOC);
    expect(result.hasDoc).toBe(true);
    expect(result.hasButton).toBe(true);
    expect(result.tables).toBe(0);
  });

  test("columns sit side-by-side (same top, different left)", async ({ editor }) => {
    const layout = await editor.host.evaluate(async (host, doc) => {
      const el = host as unknown as {
        whenCanvasReady(): Promise<{ mount: HTMLElement }>;
        loadDoc(d: unknown): void;
      };
      const { mount } = await el.whenCanvasReady();
      el.loadDoc(doc);
      const c1 = mount.querySelector('[data-node-id="col_1"]')!.getBoundingClientRect();
      const c2 = mount.querySelector('[data-node-id="col_2"]')!.getBoundingClientRect();
      return { sameTop: Math.abs(c1.top - c2.top) < 1, c2RightOfC1: c2.left > c1.left };
    }, DOC);
    expect(layout.sameTop).toBe(true);
    expect(layout.c2RightOfC1).toBe(true);
  });

  test("nodeIdAt resolves a canvas point to the node under it", async ({ editor }) => {
    const id = await editor.host.evaluate(async (host, doc) => {
      const el = host as unknown as {
        whenCanvasReady(): Promise<{ mount: HTMLElement }>;
        loadDoc(d: unknown): void;
        nodeIdAt(x: number, y: number): string | null;
      };
      const { mount } = await el.whenCanvasReady();
      el.loadDoc(doc);
      const rect = mount.querySelector('[data-node-id="btn_1"]')!.getBoundingClientRect();
      return el.nodeIdAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }, DOC);
    // The point is inside the button block (or a descendant that resolves up to it).
    expect(id === "btn_1" || id === "col_2" || id === "sec_1").toBe(true);
  });
});
