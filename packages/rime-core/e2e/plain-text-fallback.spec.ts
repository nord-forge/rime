import { expect, type Page, test } from "@playwright/test";

// With `lexicalEditor: false`, text blocks are edited with a plain <textarea> and
// Lexical is never loaded. Uses a dedicated harness that sets the flag before the
// editor first renders. Real browser — chromium + webkit.

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
              id: "t_a",
              type: "text",
              style: {},
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
              },
            },
          ],
        },
      ],
    },
  ],
};

async function setup(page: Page): Promise<void> {
  await page.goto("/e2e/harness-plain.html");
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

function textOf(page: Page, nodeId: string): Promise<string> {
  return page.evaluate((id) => {
    const el = document.querySelector("rime-editor") as unknown as {
      getDoc(): {
        children: { children?: { children: { id: string; content?: unknown }[] }[] }[];
      };
    };
    for (const section of el.getDoc().children) {
      for (const col of section.children ?? []) {
        for (const leaf of col.children) {
          if (leaf.id === id) {
            const c = leaf.content as { content: { content?: { text: string }[] }[] };
            return c.content.map((b) => (b.content ?? []).map((r) => r.text).join("")).join("\n");
          }
        }
      }
    }
    return "(not found)";
  }, nodeId);
}

const block = (page: Page, id: string) =>
  page.frameLocator("rime-editor iframe").locator(`[data-node-id="${id}"]`);

test.describe("plain-text fallback (lexicalEditor: false)", () => {
  test("clicking a text block twice opens a plain textarea (no Lexical)", async ({ page }) => {
    await setup(page);
    const b = block(page, "t_a");
    await b.click(); // select
    await b.click(); // enter edit
    await expect(block(page, "t_a").locator("textarea")).toBeVisible();
    // No Lexical contenteditable is created in this tier.
    await expect(block(page, "t_a").locator("[contenteditable]")).toHaveCount(0);
  });

  test("editing the textarea and blurring commits the new text to the doc", async ({ page }) => {
    await setup(page);
    expect(await textOf(page, "t_a")).toBe("Hello");
    const b = block(page, "t_a");
    await b.click();
    await b.click();
    const ta = block(page, "t_a").locator("textarea");
    await ta.fill("Changed");
    // Blur by clicking elsewhere on the canvas.
    await page
      .frameLocator("rime-editor iframe")
      .locator("body")
      .click({ position: { x: 5, y: 5 } });
    await expect.poll(() => textOf(page, "t_a")).toBe("Changed");
  });

  // NB: that the Lexical CHUNK isn't loaded is a production-build property (the
  // dynamic import() splits it into a lazy chunk fetched only when enabled) — Vite's
  // dev server pre-bundles modules, so a network assertion here is unreliable. The
  // split is verified against `bun run build` output instead. This tier's behavior —
  // editing via a textarea with no contenteditable — is covered by the tests above.
});
