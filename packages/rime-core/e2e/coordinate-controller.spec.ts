import { expect, test } from "./fixtures";

// A tall doc so the canvas scrolls, with a known target block low in the page.
function tallDoc() {
  const blocks = Array.from({ length: 20 }, (_, i) => ({
    id: `txt_${i}`,
    type: "text",
    style: { paddingTop: 24, paddingBottom: 24 },
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: `Block ${i}` }] }],
    },
  }));
  return {
    id: "doc_1",
    type: "document",
    settings: { contentWidth: 600, backgroundColor: "#fff", fontFamily: "Arial" },
    children: [
      {
        id: "sec_1",
        type: "section",
        style: {},
        children: [{ id: "col_1", type: "column", widthPercent: 100, style: {}, children: blocks }],
      },
    ],
  };
}

// The coordinate controller must resolve the right node under a HOST
// pointer with page scrolled + canvas scrolled + a non-zero iframe offset.
// WebKit is the hard case.
test.describe("coordinate controller (cross-browser)", () => {
  test("nodeIdAtHostPoint is correct with page + canvas scroll and iframe offset", async ({
    editor,
    page,
  }) => {
    // Give the host page room to scroll and push the editor down (iframe offset ≠ 0).
    await page.evaluate(() => {
      document.body.style.margin = "0";
      const spacer = document.createElement("div");
      spacer.style.height = "120px";
      document.body.prepend(spacer);
      document.body.style.height = "3000px";
    });

    await editor.host.evaluate(async (host, doc) => {
      const el = host as unknown as {
        whenCanvasReady(): Promise<unknown>;
        loadDoc(d: unknown): void;
      };
      await el.whenCanvasReady();
      el.loadDoc(doc);
    }, tallDoc());

    // Scroll the host page and the canvas iframe independently.
    await page.evaluate(() => window.scrollTo(0, 40));
    await editor.host.evaluate((host) => {
      const frame = host.shadowRoot!.querySelector("iframe") as HTMLIFrameElement;
      frame.contentWindow!.scrollTo(0, 200);
    });

    // Pick a block that is actually visible inside the (scrolled) canvas viewport,
    // compute its on-screen (host client) center, and ask the controller.
    const { hostPoint, expectedId } = await editor.host.evaluate((host) => {
      const frame = host.shadowRoot!.querySelector("iframe") as HTMLIFrameElement;
      const fr = frame.getBoundingClientRect();
      const cdoc = frame.contentDocument!;
      const viewportH = frame.contentWindow!.innerHeight;
      const blocks = Array.from(cdoc.querySelectorAll("[data-node-id^='txt_']"));
      // first block whose center lies within the iframe viewport
      const target = blocks.find((b) => {
        const r = b.getBoundingClientRect();
        const cy = r.top + r.height / 2;
        return cy > 0 && cy < viewportH;
      })!;
      const tr = target.getBoundingClientRect(); // iframe-viewport coords
      return {
        expectedId: (target as HTMLElement).dataset["nodeId"],
        hostPoint: { x: fr.left + tr.left + tr.width / 2, y: fr.top + tr.top + tr.height / 2 },
      };
    });

    const resolved = await editor.host.evaluate(
      (host, p) =>
        (
          host as unknown as { nodeIdAtHostPoint(pt: { x: number; y: number }): string | null }
        ).nodeIdAtHostPoint(p),
      hostPoint,
    );
    expect(resolved).toBe(expectedId);
  });
});
