import { expect, type Page, test } from "@playwright/test";

// The image block's "Choose image" control hands the File to config.onImageUpload
// and stores the returned URL into src — the library uploads nothing itself. Real
// browser (chromium + webkit): file input + Shadow DOM + the canvas <img>.

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
          children: [{ id: "img_1", type: "image", src: "", alt: "", style: {} }],
        },
      ],
    },
  ],
};

async function setup(page: Page, withUploader: boolean): Promise<void> {
  await page.goto("/e2e/harness.html");
  await page.waitForSelector("rime-editor");
  await page.evaluate(
    async ({ doc, withUploader }) => {
      const el = document.querySelector("rime-editor") as unknown as {
        whenCanvasReady(): Promise<unknown>;
        loadDoc(d: unknown): void;
        config: Record<string, unknown>;
      };
      await el.whenCanvasReady();
      if (withUploader) {
        // Stub uploader: ignores the bytes, returns a fixed CDN-ish URL after a tick.
        el.config = {
          ...el.config,
          onImageUpload: (_file: File) =>
            new Promise<string>((r) => setTimeout(() => r("https://cdn.test/uploaded.png"), 10)),
        };
      }
      el.loadDoc(doc);
    },
    { doc: DOC, withUploader },
  );
}

function panelRoot(page: Page) {
  return page.locator("rime-editor").locator("eb-properties-panel");
}

async function selectImage(page: Page): Promise<void> {
  await page.frameLocator("rime-editor iframe").locator('[data-node-id="img_1"]').click();
  // The panel renders the image field once the block is selected.
  await expect(panelRoot(page).locator(".upload-btn")).toBeVisible();
}

function canvasImgSrc(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.querySelector("rime-editor")!;
    const f = host.shadowRoot!.querySelector("iframe") as HTMLIFrameElement;
    return (
      f.contentDocument!.querySelector('[data-node-id="img_1"] img')?.getAttribute("src") ?? ""
    );
  });
}

test.describe("image upload via onImageUpload", () => {
  test("choosing a file stores the host-returned URL into src", async ({ page }) => {
    await setup(page, true);
    await selectImage(page);
    expect(await canvasImgSrc(page)).toBe("");

    // Set a file on the hidden <input type=file> inside the panel's shadow root.
    const fileInput = panelRoot(page).locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "pic.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });

    await expect.poll(() => canvasImgSrc(page)).toBe("https://cdn.test/uploaded.png");
  });

  test("without onImageUpload the picker is disabled, with a hint", async ({ page }) => {
    await setup(page, false);
    await selectImage(page);
    await expect(panelRoot(page).locator(".upload-btn")).toBeDisabled();
    await expect(panelRoot(page).locator(".hint")).toContainText("onImageUpload");
  });
});
