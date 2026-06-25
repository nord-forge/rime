import { expect, type Page, test } from "@playwright/test";

// The schema-driven properties panel mounts in the editor shadow root. Selecting a
// block populates it; editing a field writes back to the doc via updateNode and the
// canvas reflects it. Real browser (Lit lifecycle) — chromium + webkit.

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
              id: "h_1",
              type: "heading",
              level: 2,
              text: "Title",
              style: {},
            },
          ],
        },
      ],
    },
  ],
};

async function setup(page: Page): Promise<void> {
  await page.goto("/e2e/harness.html");
  await page.waitForSelector("rime-editor");
  await page.evaluate(async (doc) => {
    const el = document.querySelector("rime-editor") as unknown as {
      whenCanvasReady(): Promise<unknown>;
      loadDoc(d: unknown): void;
    };
    await el.whenCanvasReady();
    el.loadDoc(doc);
  }, DOC);
}

async function selectBlock(page: Page, id: string): Promise<void> {
  await page.frameLocator("rime-editor iframe").locator(`[data-node-id="${id}"]`).click();
}

// A field input inside the panel, located by its label text.
function panelField(page: Page, label: string) {
  return page
    .locator("rime-editor")
    .locator("eb-properties-panel")
    .locator(
      `.field:has(label:text-is("${label}")) input, .field:has(label:text-is("${label}")) textarea`,
    )
    .first();
}

function canvasNodeStyle(page: Page, id: string): Promise<string> {
  return page.evaluate((nodeId) => {
    const host = document.querySelector("rime-editor")!;
    const f = host.shadowRoot!.querySelector("iframe") as HTMLIFrameElement;
    const node = f.contentDocument!.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement;
    return node.getAttribute("style") ?? "";
  }, id);
}

function headingText(page: Page, id: string): Promise<string> {
  return page.evaluate((nodeId) => {
    const host = document.querySelector("rime-editor")!;
    const f = host.shadowRoot!.querySelector("iframe") as HTMLIFrameElement;
    const node = f.contentDocument!.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement;
    return node.querySelector("h1,h2,h3")?.textContent ?? "";
  }, id);
}

test.describe("schema-driven properties panel", () => {
  test("empty state when nothing is selected", async ({ page }) => {
    await setup(page);
    const empty = page.locator("rime-editor").locator("eb-properties-panel").locator(".empty");
    await expect(empty).toContainText("Select a block");
  });

  test("selecting a block renders its schema fields", async ({ page }) => {
    await setup(page);
    await selectBlock(page, "h_1");
    // The heading schema exposes a Text field and a Level select.
    await expect(panelField(page, "Text")).toHaveValue("Title");
  });

  test("editing a text field updates the canvas", async ({ page }) => {
    await setup(page);
    await selectBlock(page, "h_1");
    const text = panelField(page, "Text");
    await text.fill("Changed");
    // Debounced one op/frame — wait for the canvas to reflect the new text.
    await expect.poll(() => headingText(page, "h_1")).toBe("Changed");
  });

  test("editing padding writes a numeric style the canvas reflects", async ({ page }) => {
    await setup(page);
    await selectBlock(page, "h_1");
    await panelField(page, "Padding").fill("24");
    await expect.poll(() => canvasNodeStyle(page, "h_1")).toContain("padding-top: 24px");
  });
});
