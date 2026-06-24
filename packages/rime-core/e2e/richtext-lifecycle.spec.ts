import { expect, test } from "./fixtures";

// Exactly one live Lexical editor at a time. Clicking through several text
// blocks must never leave more than one contenteditable element live in the iframe
// — the memory invariant. Verified in chromium + webkit (focus/blur
// transitions differ between engines).

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
            mkText("txt_1", "First block"),
            mkText("txt_2", "Second block"),
            mkText("txt_3", "Third block"),
          ],
        },
      ],
    },
  ],
};

function mkText(id: string, text: string) {
  return {
    id,
    type: "text",
    style: {},
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
  };
}

// Count elements currently marked contenteditable inside the canvas mount.
async function liveEditorCount(editor: { host: import("@playwright/test").Locator }) {
  return editor.host.evaluate(async (host) => {
    const el = host as unknown as { whenCanvasReady(): Promise<{ mount: HTMLElement }> };
    const { mount } = await el.whenCanvasReady();
    return mount.querySelectorAll('[contenteditable="true"]').length;
  });
}

// Two-stage text interaction: first click selects, second click enters edit and
// mounts the editor. enterEdit performs both so the block ends up being edited.
async function enterEdit(
  frame: ReturnType<import("@playwright/test").Page["frameLocator"]>,
  id: string,
) {
  const block = frame.locator(`[data-node-id="${id}"]`);
  await block.click(); // select
  await block.click(); // edit
}

test.describe("one-instance rich-text lifecycle", () => {
  test("clicking through text blocks keeps exactly one editor live", async ({ editor, page }) => {
    await editor.loadDoc(DOC);
    const frame = page.frameLocator("rime-editor iframe");

    // Initially nothing is editable.
    expect(await liveEditorCount(editor)).toBe(0);

    for (const id of ["txt_1", "txt_2", "txt_3", "txt_1"]) {
      await enterEdit(frame, id);
      // After each focus there is exactly one live editor, and it's the clicked one.
      expect(await liveEditorCount(editor)).toBe(1);
      const activeId = await editor.host.evaluate(async (host) => {
        const el = host as unknown as { whenCanvasReady(): Promise<{ mount: HTMLElement }> };
        const { mount } = await el.whenCanvasReady();
        return (
          mount.querySelector('[contenteditable="true"]')?.getAttribute("data-node-id") ?? null
        );
      });
      expect(activeId).toBe(id);
    }
  });

  test("clicking outside any text block blurs the editor (zero live)", async ({ editor, page }) => {
    await editor.loadDoc(DOC);
    const frame = page.frameLocator("rime-editor iframe");

    await enterEdit(frame, "txt_1");
    expect(await liveEditorCount(editor)).toBe(1);

    // Click the document background (not a text block) → blur.
    await frame.locator('[data-node-id="doc_1"]').click({ position: { x: 2, y: 2 } });
    expect(await liveEditorCount(editor)).toBe(0);
  });

  test("re-clicking the active block does not churn (still exactly one)", async ({
    editor,
    page,
  }) => {
    await editor.loadDoc(DOC);
    const frame = page.frameLocator("rime-editor iframe");
    await enterEdit(frame, "txt_2"); // select + edit
    const block = frame.locator('[data-node-id="txt_2"]');
    await block.click(); // re-click while editing → no churn
    await block.click();
    expect(await liveEditorCount(editor)).toBe(1);
  });
});
