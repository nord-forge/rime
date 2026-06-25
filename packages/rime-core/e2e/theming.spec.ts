import { expect, test } from "./fixtures";

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
                content: [{ type: "paragraph", content: [{ type: "text", text: "Preview" }] }],
              },
            },
          ],
        },
      ],
    },
  ],
};

// The two-surface contract. Chrome is themed by --eb-* (pierces shadow
// DOM); the canvas is walled off from BOTH host CSS and the chrome theme. The
// bleed-proof is the whole point — truthful email preview depends on it.
test.describe("two-surface theming", () => {
  test("chrome picks up --eb-* tokens (piercing works)", async ({ editor }) => {
    const borderColor = await editor.host.evaluate(async (host) => {
      const el = host as unknown as {
        config: { theme: Record<string, string> };
        updateComplete: Promise<unknown>;
      };
      el.config = { theme: { "--eb-color-border": "rgb(0, 128, 0)" } };
      await el.updateComplete;
      const palette = host.shadowRoot!.querySelector('[part="palette"]')!;
      return getComputedStyle(palette).borderInlineEndColor;
    });
    expect(borderColor).toBe("rgb(0, 128, 0)");
  });

  test("switching to a theme that omits a key clears the previous value", async ({ editor }) => {
    const result = await editor.host.evaluate(async (host) => {
      const el = host as unknown as {
        config: { theme: Record<string, string> };
        updateComplete: Promise<unknown>;
      };
      el.config = { theme: { "--eb-color-bg": "rgb(12, 16, 32)" } };
      await el.updateComplete;
      const dark = host.style.getPropertyValue("--eb-color-bg");
      // Switch back to a default ({}) theme — the override must be removed.
      el.config = { theme: {} };
      await el.updateComplete;
      const cleared = host.style.getPropertyValue("--eb-color-bg");
      return { dark, cleared };
    });
    expect(result.dark).toBe("rgb(12, 16, 32)");
    expect(result.cleared).toBe("");
  });

  test("host CSS does NOT bleed into the canvas; --eb-* does NOT cross", async ({
    editor,
    page,
  }) => {
    // Aggressive host-page CSS + a wild chrome token.
    await page.addStyleTag({
      content: `* { color: red !important; font-family: "Comic Sans MS" !important; }`,
    });
    await editor.host.evaluate(async (host) => {
      const el = host as unknown as {
        config: { theme: Record<string, string> };
        updateComplete: Promise<unknown>;
        whenCanvasReady(): Promise<unknown>;
        loadDoc(d: unknown): void;
      };
      el.config = { theme: { "--eb-color-accent": "rgb(255, 0, 255)" } };
      await el.updateComplete;
    });

    const probe = await editor.host.evaluate(async (host, doc) => {
      const el = host as unknown as {
        whenCanvasReady(): Promise<{ doc: Document; mount: HTMLElement }>;
        loadDoc(d: unknown): void;
      };
      const { doc: cdoc, mount } = await el.whenCanvasReady();
      el.loadDoc(doc);
      const text = mount.querySelector('[data-node-id="txt_1"]') as HTMLElement;
      const cs = getComputedStyle(text);
      return {
        color: cs.color,
        font: cs.fontFamily,
        // does the chrome token resolve inside the canvas document?
        tokenInCanvas: getComputedStyle(cdoc.documentElement)
          .getPropertyValue("--eb-color-accent")
          .trim(),
      };
    }, DOC);

    // Inside the canvas: NOT host red, NOT Comic Sans, and the chrome token is absent.
    expect(probe.color).not.toBe("rgb(255, 0, 0)");
    expect(probe.font.toLowerCase()).not.toContain("comic sans");
    expect(probe.tokenInCanvas).toBe("");
  });
});
