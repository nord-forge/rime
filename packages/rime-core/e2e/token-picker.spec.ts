import { expect, test } from "./fixtures";

// The token picker is custom Lit chrome: a toolbar button opens it, it lists the
// host's configured token sources (searchable, grouped), and selecting one inserts
// a chip at the caret via insertToken (ENV-39). Real-browser (chromium + webkit):
// the focus lifecycle, the in-iframe selection, and the chip render are all
// engine-sensitive.

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

const TOKEN_SOURCES = [
  {
    id: "contact",
    label: "Contact",
    tokens: [
      { key: "first_name", label: "First name" },
      { key: "last_name", label: "Last name" },
    ],
  },
  { id: "order", label: "Order", tokens: [{ key: "order_total", label: "Order total" }] },
];

test.describe("token picker", () => {
  test("opens from the toolbar, filters, and inserts a chip on select", async ({
    editor,
    page,
  }) => {
    // Configure token sources on the element, then enter edit mode.
    await page.evaluate((sources) => {
      const el = document.querySelector("rime-editor") as unknown as {
        config: Record<string, unknown>;
      };
      el.config = { ...el.config, tokenSources: sources };
    }, TOKEN_SOURCES);
    await editor.loadDoc(DOC);

    const frame = page.frameLocator("rime-editor iframe");
    const block = frame.locator('[data-node-id="txt_1"]');
    await block.click();
    await block.click();
    await page.waitForFunction(() =>
      document
        .querySelector("rime-editor")!
        .shadowRoot!.querySelector("rime-rich-text-toolbar")
        ?.hasAttribute("open"),
    );

    // Open the picker from the toolbar.
    await page.evaluate(() => {
      const tb = document
        .querySelector("rime-editor")!
        .shadowRoot!.querySelector("rime-rich-text-toolbar")!;
      tb.shadowRoot!.querySelector<HTMLButtonElement>(
        'button[aria-label="Insert merge tag"]',
      )!.click();
    });
    await page.waitForFunction(() =>
      document
        .querySelector("rime-editor")!
        .shadowRoot!.querySelector("rime-token-picker")
        ?.hasAttribute("open"),
    );

    // It lists all three tokens grouped by source.
    const options = await page.evaluate(() => {
      const root = document
        .querySelector("rime-editor")!
        .shadowRoot!.querySelector("rime-token-picker")!.shadowRoot!;
      return [...root.querySelectorAll('[role="option"]')].map((o) => o.textContent!.trim());
    });
    expect(options.length).toBe(3);

    // Filter to a single match and select it via mousedown (so the editor keeps focus).
    await page.evaluate(() => {
      const root = document
        .querySelector("rime-editor")!
        .shadowRoot!.querySelector("rime-token-picker")!.shadowRoot!;
      const input = root.querySelector<HTMLInputElement>("input")!;
      input.value = "first";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.evaluate(() => {
      const root = document
        .querySelector("rime-editor")!
        .shadowRoot!.querySelector("rime-token-picker")!.shadowRoot!;
      const option = root.querySelector<HTMLElement>('[role="option"]')!;
      option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    });

    // A chip carrying the bare key is painted at the caret.
    const chip = frame.locator('[data-node-id="txt_1"] [data-token="first_name"]');
    await expect(chip).toBeVisible();
    await expect(chip).toHaveText("First name");

    // The picker closed after selecting.
    await page.waitForFunction(
      () =>
        !document
          .querySelector("rime-editor")!
          .shadowRoot!.querySelector("rime-token-picker")
          ?.hasAttribute("open"),
    );
  });

  test("shows an empty state when no tokens are configured", async ({ editor, page }) => {
    await editor.loadDoc(DOC);
    const frame = page.frameLocator("rime-editor iframe");
    const block = frame.locator('[data-node-id="txt_1"]');
    await block.click();
    await block.click();
    await page.waitForFunction(() =>
      document
        .querySelector("rime-editor")!
        .shadowRoot!.querySelector("rime-rich-text-toolbar")
        ?.hasAttribute("open"),
    );
    await page.evaluate(() => {
      const tb = document
        .querySelector("rime-editor")!
        .shadowRoot!.querySelector("rime-rich-text-toolbar")!;
      tb.shadowRoot!.querySelector<HTMLButtonElement>(
        'button[aria-label="Insert merge tag"]',
      )!.click();
    });
    const empty = await page.evaluate(() => {
      const root = document
        .querySelector("rime-editor")!
        .shadowRoot!.querySelector("rime-token-picker")!.shadowRoot!;
      return root.querySelector(".empty")?.textContent?.trim();
    });
    expect(empty).toBe("No tokens available");
  });
});
