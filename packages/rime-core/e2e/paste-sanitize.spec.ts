import { expect, test } from "./fixtures";
import { MALICIOUS, WORD_OUTLOOK } from "../src/richtext/paste-fixtures";

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
        { id: "col_1", type: "column", widthPercent: 100, style: {}, children: [mk("txt_1", "x")] },
      ],
    },
  ],
};

async function pasteInto(page: import("@playwright/test").Page, html: string) {
  const frame = page.frameLocator("rime-editor iframe");
  const block = frame.locator('[data-node-id="txt_1"]');
  await block.click();
  await block.click();
  await page.keyboard.press("ControlOrMeta+a");

  await page.evaluate((h) => {
    const iframe = document.querySelector("rime-editor")!.shadowRoot!.querySelector("iframe")!;
    const d = iframe.contentDocument!;
    const ed = d.querySelector('[data-node-id="txt_1"]') as HTMLElement;
    ed.focus();
    const w = d.defaultView as typeof globalThis;
    const dt = new w.DataTransfer();
    dt.setData("text/html", h);
    dt.setData("text/plain", "fallback");
    ed.dispatchEvent(
      new w.ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }),
    );
  }, html);

  // Blur to commit the pasted content into the doc.
  await page.evaluate(() => {
    const iframe = document.querySelector("rime-editor")!.shadowRoot!.querySelector("iframe")!;
    const d = iframe.contentDocument!;
    d.body.dispatchEvent(
      new (d.defaultView as typeof globalThis).PointerEvent("pointerdown", { bubbles: true }),
    );
  });
}

function docJson(editor: { getDoc(): Promise<unknown> }) {
  return editor.getDoc().then((d) => JSON.stringify(d));
}

test.describe("paste sanitization", () => {
  test("Word/Outlook paste lands clean (no mso/font/o:p)", async ({ editor, page }) => {
    await editor.loadDoc(DOC);
    await pasteInto(page, WORD_OUTLOOK.html);
    await expect.poll(() => docJson(editor)).toContain("Hello");
    const json = await docJson(editor);
    for (const banned of WORD_OUTLOOK.forbidden) expect(json).not.toContain(banned);
    expect(json).not.toContain("<table");
  });

  test("malicious paste is neutralized (no script/js-href/iframe)", async ({ editor, page }) => {
    await editor.loadDoc(DOC);
    await pasteInto(page, MALICIOUS.html);
    await expect.poll(() => docJson(editor)).toContain("https://ok.test");
    const json = await docJson(editor);
    expect(json).not.toContain("javascript:");
    expect(json).not.toContain("<script");
    expect(json).not.toContain("onerror");
    expect(json).not.toContain("<iframe");
  });
});
