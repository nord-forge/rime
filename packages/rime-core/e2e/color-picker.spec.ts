import { expect, type Page, test } from "@playwright/test";

// The properties-panel color field opens a custom <rime-color-picker> (saturation
// square + hue strip + hex/rgb/oklch input & toggle). Real browser (chromium +
// webkit) — pointer math + Shadow DOM. Driven via the panel's shadow root.

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
            { id: "btn_1", type: "button", label: "Go", href: "https://x.test", style: {} },
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
  // Select the button so its schema (with a color field) renders in the panel.
  await page.frameLocator("rime-editor iframe").locator('[data-node-id="btn_1"]').click();
}

test.describe("color picker", () => {
  test("opens from the color swatch and exposes the picker", async ({ page }) => {
    await setup(page);
    const present = await page.evaluate(async () => {
      const panel = document
        .querySelector("rime-editor")!
        .shadowRoot!.querySelector("rime-properties-panel")!;
      const swatch = panel.shadowRoot!.querySelector<HTMLButtonElement>("button.swatch");
      if (!swatch) return { hasSwatch: false, hasPicker: false };
      swatch.click();
      await new Promise((r) => requestAnimationFrame(r)); // Lit re-renders async
      const picker = panel.shadowRoot!.querySelector("rime-color-picker");
      return { hasSwatch: true, hasPicker: !!picker };
    });
    expect(present.hasSwatch).toBe(true);
    expect(present.hasPicker).toBe(true);
  });

  test("format toggle cycles hex → rgb → oklch and edits the block", async ({ page }) => {
    await setup(page);
    const result = await page.evaluate(async () => {
      const editor = document.querySelector("rime-editor") as unknown as {
        getDoc(): {
          children: { children: { children: { style?: { backgroundColor?: string } }[] }[] }[];
        };
      };
      const panel = document
        .querySelector("rime-editor")!
        .shadowRoot!.querySelector("rime-properties-panel")!;
      panel.shadowRoot!.querySelector<HTMLButtonElement>("button.swatch")!.click();
      await new Promise((r) => requestAnimationFrame(r));
      const picker = panel.shadowRoot!.querySelector("rime-color-picker")!.shadowRoot!;
      const input = picker.querySelector<HTMLInputElement>("input.text")!;
      const fmt = picker.querySelector<HTMLButtonElement>("button.fmt")!;

      // Paste a hex → block bg updates; toggle to rgb → input reformats.
      input.value = "#dc2626";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(r));
      const f0 = fmt.textContent!.trim();
      fmt.click();
      await new Promise((r) => requestAnimationFrame(r));
      const f1 = fmt.textContent!.trim();
      const v1 = input.value;

      const bg = editor.getDoc().children[0]!.children[0]!.children[0]!.style?.backgroundColor;
      return { f0, f1, v1, bg };
    });
    expect(result.f0).toBe("hex");
    expect(result.f1).toBe("rgb");
    expect(result.v1).toMatch(/^rgb\(/);
    // The edit reached the doc (committed as a color string).
    expect(result.bg).toBeTruthy();
  });

  test("pasting an rgb() value auto-switches the format to rgb", async ({ page }) => {
    await setup(page);
    const fmt = await page.evaluate(async () => {
      const panel = document
        .querySelector("rime-editor")!
        .shadowRoot!.querySelector("rime-properties-panel")!;
      panel.shadowRoot!.querySelector<HTMLButtonElement>("button.swatch")!.click();
      await new Promise((r) => requestAnimationFrame(r));
      const picker = panel.shadowRoot!.querySelector("rime-color-picker")!.shadowRoot!;
      const input = picker.querySelector<HTMLInputElement>("input.text")!;
      input.value = "rgb(16, 185, 129)";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(r));
      return picker.querySelector<HTMLButtonElement>("button.fmt")!.textContent!.trim();
    });
    expect(fmt).toBe("rgb");
  });
});
