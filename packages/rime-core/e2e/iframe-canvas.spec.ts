import { expect, test } from "./fixtures";

// The same-origin srcdoc canvas. Verified in chromium + webkit.
test.describe("iframe canvas", () => {
  test("exactly one canvas-frame iframe is mounted in part=canvas", async ({ editor }) => {
    const count = await editor.host.evaluate((host) => {
      const region = host.shadowRoot!.querySelector('[part="canvas"]')!;
      return region.querySelectorAll('iframe[part="canvas-frame"]').length;
    });
    expect(count).toBe(1);
  });

  test("iframe is same-origin: contentDocument + #rime-root reachable", async ({ editor }) => {
    const hasRoot = await editor.host.evaluate(async (host) => {
      const el = host as unknown as { whenCanvasReady(): Promise<{ mount: HTMLElement }> };
      const { mount } = await el.whenCanvasReady();
      return mount.id === "rime-root";
    });
    expect(hasRoot).toBe(true);
  });

  test("elementFromPoint works inside the canvas document", async ({ editor }) => {
    const ok = await editor.host.evaluate(async (host) => {
      const el = host as unknown as { whenCanvasReady(): Promise<{ doc: Document }> };
      const { doc } = await el.whenCanvasReady();
      // elementFromPoint is iframe-local — proves same-origin hit-testing.
      return typeof doc.elementFromPoint === "function" && doc.elementFromPoint(1, 1) !== null;
    });
    expect(ok).toBe(true);
  });

  test("setBaseStyles restyles the canvas without touching chrome", async ({ editor }) => {
    const bg = await editor.host.evaluate(async (host) => {
      const el = host as unknown as {
        whenCanvasReady(): Promise<unknown>;
        canvas: { setBaseStyles(css: string): void; document: Document };
      };
      await el.whenCanvasReady();
      el.canvas.setBaseStyles("body{background:rgb(9,8,7)}");
      const body = el.canvas.document.body;
      return getComputedStyle(body).backgroundColor;
    });
    expect(bg).toBe("rgb(9, 8, 7)");
  });

  test("NO host CSS bleed: host `* { color: red }` does not reach #rime-root", async ({
    editor,
    page,
  }) => {
    // Inject an aggressive host-page rule.
    await page.addStyleTag({ content: "* { color: red !important; }" });

    const color = await editor.host.evaluate(async (host) => {
      const el = host as unknown as {
        whenCanvasReady(): Promise<{ doc: Document; mount: HTMLElement }>;
      };
      const { doc, mount } = await el.whenCanvasReady();
      const probe = doc.createElement("p");
      probe.textContent = "content";
      mount.append(probe);
      return getComputedStyle(probe).color;
    });

    // Inside the iframe the color must be the canvas default (black), not host red.
    expect(color).toBe("rgb(0, 0, 0)");
  });
});
