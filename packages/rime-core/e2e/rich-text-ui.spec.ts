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
          children: [mk("txt_1", "hello world")],
        },
      ],
    },
  ],
};

// The toolbar lives in the host shadow root; helpers reach its buttons by aria-label.
async function enterEditAndSelectAll(
  editor: { loadDoc(d: unknown): Promise<void> },
  page: import("@playwright/test").Page,
) {
  await editor.loadDoc(DOC);
  const frame = page.frameLocator("rime-editor iframe");
  const block = frame.locator('[data-node-id="txt_1"]');
  await block.click();
  await block.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.waitForFunction(() => {
    const tb = document
      .querySelector("rime-editor")!
      .shadowRoot!.querySelector("rime-rich-text-toolbar");
    return tb?.hasAttribute("open");
  });
}

function clickToolbar(page: import("@playwright/test").Page, label: string) {
  return page.evaluate((lbl) => {
    const tb = document
      .querySelector("rime-editor")!
      .shadowRoot!.querySelector("rime-rich-text-toolbar")!;
    const btn = tb.shadowRoot!.querySelector<HTMLButtonElement>(`button[aria-label="${lbl}"]`)!;
    btn.click();
  }, label);
}

// Blur the editor so its content commits into the doc (pointerdown on the iframe
// body, outside any text block — the same gesture a click on empty canvas makes).
function blurEditor(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const iframe = document.querySelector("rime-editor")!.shadowRoot!.querySelector("iframe")!;
    const d = iframe.contentDocument!;
    d.body.dispatchEvent(
      new (d.defaultView as typeof globalThis).PointerEvent("pointerdown", { bubbles: true }),
    );
  });
}

function firstBlock(editor: { getDoc(): Promise<unknown> }) {
  return editor.getDoc().then((d) => {
    const doc = d as {
      children: { children: { children: { content: { content: unknown[] } }[] }[] }[];
    };
    return doc.children[0]!.children[0]!.children[0]!.content.content[0] as {
      type: string;
      level?: number;
      ordered?: boolean;
      content?: { marks?: string[]; link?: string }[];
    };
  });
}

test.describe("rich-text toolbar", () => {
  test("Bold button bolds the selection", async ({ editor, page }) => {
    await enterEditAndSelectAll(editor, page);
    await clickToolbar(page, "Bold");
    await blurEditor(page);
    await expect.poll(async () => (await firstBlock(editor)).content?.[0]?.marks).toContain("bold");
  });

  test("Heading 2 turns the block into a heading", async ({ editor, page }) => {
    await enterEditAndSelectAll(editor, page);
    await clickToolbar(page, "Heading 2");
    await blurEditor(page);
    await expect.poll(async () => (await firstBlock(editor)).type).toBe("heading");
    expect((await firstBlock(editor)).level).toBe(2);
  });

  test("Bulleted list wraps the block in a list", async ({ editor, page }) => {
    await enterEditAndSelectAll(editor, page);
    await clickToolbar(page, "Bulleted list");
    await blurEditor(page);
    await expect.poll(async () => (await firstBlock(editor)).type).toBe("list");
    expect((await firstBlock(editor)).ordered).toBe(false);
  });

  test("link popover applies and removes a link; rejects javascript:", async ({ editor, page }) => {
    await enterEditAndSelectAll(editor, page);

    const setUrl = (url: string) =>
      page.evaluate((u) => {
        const pop = document
          .querySelector("rime-editor")!
          .shadowRoot!.querySelector("rime-link-popover")!;
        const input = pop.shadowRoot!.querySelector<HTMLInputElement>("input")!;
        input.value = u;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }, url);
    const clickPopover = (cls: string) =>
      page.evaluate((c) => {
        const pop = document
          .querySelector("rime-editor")!
          .shadowRoot!.querySelector("rime-link-popover")!;
        pop.shadowRoot!.querySelector<HTMLButtonElement>(`button.${c}`)!.click();
      }, cls);

    // javascript: is rejected — no link applied.
    await clickToolbar(page, "Link");
    await setUrl("javascript:alert(1)");
    await clickPopover("apply");
    await blurEditor(page);
    expect((await firstBlock(editor)).content?.[0]?.link).toBeUndefined();

    // a real URL applies and commits on blur.
    await enterEditAndSelectAll(editor, page);
    await clickToolbar(page, "Link");
    await setUrl("https://x.test");
    await clickPopover("apply");
    await blurEditor(page);
    await expect
      .poll(async () => (await firstBlock(editor)).content?.find((r) => r.link)?.link)
      .toBe("https://x.test/");
  });
});
