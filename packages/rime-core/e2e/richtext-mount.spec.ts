import { expect, test } from "@playwright/test";

// A headless Lexical editor mounts on a focused TextBlock element INSIDE
// the iframe canvas and edits the same node the canvas painted. Real-browser
// verification (chromium + webkit) — contenteditable + selection + the Lexical
// reconciler all behave differently in WebKit, which is why this is an e2e, not a
// happy-dom unit test. The focus-driven lifecycle is a later ticket; here we drive
// mountLexical directly via the harness.

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
                content: [{ type: "paragraph", content: [{ type: "text", text: "seed" }] }],
              },
            },
          ],
        },
      ],
    },
  ],
};

// Mount Lexical on the txt_1 element inside the iframe and return the mount via a
// window handle so subsequent steps (type / format / read) share one instance.
async function mountOnTextBlock(host: import("@playwright/test").Locator) {
  await host.evaluate(async (el, doc) => {
    const editor = el as unknown as {
      whenCanvasReady(): Promise<{ mount: HTMLElement }>;
      loadDoc(d: unknown): void;
    };
    const { mount } = await editor.whenCanvasReady();
    editor.loadDoc(doc);
    const blockEl = mount.querySelector('[data-node-id="txt_1"]') as HTMLElement;
    const mountLexical = (
      window as unknown as { __mountLexical: typeof import("../src/index.ts").mountLexical }
    ).__mountLexical;
    (window as unknown as { __mount: unknown }).__mount = mountLexical(
      blockEl,
      doc.children[0].children[0].children[0].content,
    );
  }, DOC);
}

test.describe("headless Lexical mount in canvas", () => {
  test("mounts on the TextBlock element and seeds it editable", async ({ page }) => {
    await page.goto("/e2e/richtext-harness.html");
    await page.waitForSelector("rime-editor");
    const host = page.locator("rime-editor");
    await mountOnTextBlock(host);

    const state = await host.evaluate(async (el) => {
      const editor = el as unknown as { whenCanvasReady(): Promise<{ mount: HTMLElement }> };
      const { mount } = await editor.whenCanvasReady();
      const blockEl = mount.querySelector('[data-node-id="txt_1"]') as HTMLElement;
      const m = (window as unknown as { __mount: { toJSON(): unknown } }).__mount;
      return {
        editable: blockEl.getAttribute("contenteditable"),
        role: blockEl.getAttribute("role"),
        json: m.toJSON(),
      };
    });
    expect(state.editable).toBe("true");
    expect(state.role).toBe("textbox");
    expect(state.json).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "seed" }] }],
    });
  });

  test("an edit at the live in-iframe selection updates toJSON", async ({ page }) => {
    await page.goto("/e2e/richtext-harness.html");
    await page.waitForSelector("rime-editor");
    const host = page.locator("rime-editor");
    await mountOnTextBlock(host);

    // Click into the editable so Lexical resolves a real RangeSelection from the
    // browser's caret (proving the live editor is wired to the in-iframe DOM). Then
    // insert text through that selection — the same path keystrokes/IME take inside
    // Lexical. (Playwright's synthetic key + beforeinput events are untrusted and
    // Lexical ignores them in a srcdoc iframe, so we drive the real command path.)
    const frame = page.frameLocator("rime-editor iframe");
    const block = frame.locator('[data-node-id="txt_1"]');
    await block.click();

    const inserted = await host.evaluate((el) => {
      const m = (
        window as unknown as {
          __mount: {
            editor: import("lexical").LexicalEditor;
            toJSON(): { content: { content?: { text: string }[] }[] };
          };
        }
      ).__mount;
      const { $getSelection, $isRangeSelection } = (
        window as unknown as {
          __lexical: {
            $getSelection: typeof import("lexical").$getSelection;
            $isRangeSelection: typeof import("lexical").$isRangeSelection;
          };
        }
      ).__lexical;
      let hadRealSelection = false;
      m.editor.update(
        () => {
          const sel = $getSelection();
          hadRealSelection = $isRangeSelection(sel);
          if ($isRangeSelection(sel)) {
            sel.modify("move", false, "lineboundary"); // caret to end of line
            sel.insertText("MORE");
          }
        },
        { discrete: true },
      );
      const text = m
        .toJSON()
        .content.map((p) => (p.content ?? []).map((r) => r.text).join(""))
        .join("\n");
      return { hadRealSelection, text };
    });

    // The click produced a genuine RangeSelection against the in-iframe DOM...
    expect(inserted.hadRealSelection).toBe(true);
    // ...and editing through it flows into the portable JSON.
    expect(inserted.text).toContain("seedMORE");
  });

  test("format('bold') applies a mark reflected in toJSON", async ({ page }) => {
    await page.goto("/e2e/richtext-harness.html");
    await page.waitForSelector("rime-editor");
    const host = page.locator("rime-editor");
    await mountOnTextBlock(host);

    const frame = page.frameLocator("rime-editor iframe");
    const block = frame.locator('[data-node-id="txt_1"]');
    await block.click();
    // Select all the seeded text within the editable, then bold it.
    await page.keyboard.press("ControlOrMeta+a");

    const marks = await host.evaluate((el) => {
      const m = (
        window as unknown as {
          __mount: {
            format(mark: string): void;
            toJSON(): { content: { content?: { marks?: string[] }[] }[] };
          };
        }
      ).__mount;
      m.format("bold");
      const json = m.toJSON();
      return json.content.flatMap((p) => (p.content ?? []).flatMap((r) => r.marks ?? []));
    });
    expect(marks).toContain("bold");
  });
});
