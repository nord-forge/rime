import { expect, test } from "./fixtures";

const mk = (id: string, t: string) => ({
  id,
  type: "text",
  style: {},
  content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] },
});

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
          children: [mk("txt_1", "seed")],
        },
      ],
    },
  ],
};

function liveEditorCount(editor: { host: import("@playwright/test").Locator }) {
  return editor.host.evaluate(async (host) => {
    const el = host as unknown as { whenCanvasReady(): Promise<{ mount: HTMLElement }> };
    const { mount } = await el.whenCanvasReady();
    return mount.querySelectorAll('[contenteditable="true"]').length;
  });
}

function dispatchComposition(page: import("@playwright/test").Page, type: string) {
  return page.evaluate((t) => {
    const iframe = document.querySelector("rime-editor")!.shadowRoot!.querySelector("iframe")!;
    const d = iframe.contentDocument!;
    const ed = d.querySelector('[data-node-id="txt_1"]') as HTMLElement;
    ed.dispatchEvent(
      new (d.defaultView as typeof globalThis).CompositionEvent(t, { bubbles: true }),
    );
  }, type);
}

function blurOutside(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const iframe = document.querySelector("rime-editor")!.shadowRoot!.querySelector("iframe")!;
    const d = iframe.contentDocument!;
    d.body.dispatchEvent(
      new (d.defaultView as typeof globalThis).PointerEvent("pointerdown", { bubbles: true }),
    );
  });
}

test.describe("IME composition guard", () => {
  test("a blur during composition is deferred until composition ends", async ({ editor, page }) => {
    await editor.loadDoc(DOC);
    const frame = page.frameLocator("rime-editor iframe");
    const block = frame.locator('[data-node-id="txt_1"]');
    await block.click();
    await block.click();
    expect(await liveEditorCount(editor)).toBe(1);

    await dispatchComposition(page, "compositionstart");
    await blurOutside(page);
    // Still live — the blur was deferred mid-composition.
    expect(await liveEditorCount(editor)).toBe(1);

    await dispatchComposition(page, "compositionend");
    // The pending blur now flushes.
    await expect.poll(() => liveEditorCount(editor)).toBe(0);
  });
});
