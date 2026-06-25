// Proves the example custom block works through the PUBLIC SDK only — the same path
// a third-party host would use. If this test ever needs a deep/internal import, the
// public surface (ENV-33) is missing something; fix the export there, not here.

import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import {
  BlockRegistry,
  blockRegistry,
  type CanvasRenderContext,
  type ExportRenderContext,
  registerBlock,
  registryToMjmlRenderers,
} from "@nord-forge/rime-core";
import { MjmlRenderer } from "@nord-forge/rime-mjml";
import { type CouponNode, couponBlock } from "./coupon-block";

let win: Window;
let doc: Document;
beforeEach(() => {
  win = new Window();
  doc = win.document as unknown as Document;
});

const canvasCtx = (): CanvasRenderContext => ({
  doc,
  renderChild: () => doc.createElement("div"),
});
const exportCtx: ExportRenderContext = {
  renderChild: () => "",
  escape: (s) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;"),
};

function makeCoupon(over: Partial<CouponNode> = {}): CouponNode {
  return { id: "c1", type: "coupon", label: "10% off", code: "SAVE10", style: {}, ...over };
}

describe("coupon example block — palette + schema", () => {
  test("declares its palette entry (Marketing) and defaults", () => {
    expect(couponBlock.palette.category).toBe("Marketing");
    expect(couponBlock.palette.label).toBe("Coupon");
    expect(couponBlock.palette.defaults).toMatchObject({ code: "SAVE10" });
  });

  test("schema exposes label/code/background/padding", () => {
    expect(couponBlock.schema.fields.map((f) => f.key)).toEqual([
      "label",
      "code",
      "style.backgroundColor",
      "style.paddingTop",
    ]);
  });
});

describe("coupon example block — renderCanvas", () => {
  test("paints a card with data-node-id, the headline and the code chip", () => {
    const el = couponBlock.renderCanvas(makeCoupon(), canvasCtx());
    expect(el.dataset["nodeId"]).toBe("c1");
    expect(el.dataset["nodeType"]).toBe("coupon");
    expect(el.textContent).toContain("10% off");
    expect(el.textContent).toContain("SAVE10");
  });

  test("applies the editable BlockStyle (background + padding)", () => {
    const el = couponBlock.renderCanvas(
      makeCoupon({ style: { backgroundColor: "#ffeeee", paddingTop: 20 } }),
      canvasCtx(),
    );
    expect(el.style.backgroundColor).toBe("#ffeeee");
    expect(el.style.paddingTop).toBe("20px");
  });
});

describe("coupon example block — renderExport (raw-table fallback)", () => {
  test("returns { raw } wrapping an email-safe <table> in <mj-raw>", () => {
    const out = couponBlock.renderExport(makeCoupon(), exportCtx);
    expect("raw" in out).toBe(true);
    expect(out.raw.startsWith("<mj-raw>")).toBe(true);
    expect(out.raw).toContain("<table");
    expect(out.raw).toContain("SAVE10");
  });

  test("escapes interpolated text", () => {
    const out = couponBlock.renderExport(makeCoupon({ label: "<b>&", code: '"x' }), exportCtx);
    expect(out.raw).toContain("&lt;b&gt;&amp;");
    expect(out.raw).toContain("&quot;x");
  });
});

describe("coupon example block — end to end via the public registry", () => {
  test("the public registerBlock adds it to the global registry", () => {
    if (!blockRegistry.get("coupon")) registerBlock(couponBlock);
    expect(blockRegistry.get("coupon")?.palette.label).toBe("Coupon");
  });

  test("registers and exports through the MjmlRenderer to bulletproof HTML", async () => {
    const registry = new BlockRegistry();
    registry.register(couponBlock);
    const renderer = new MjmlRenderer({ blockRenderers: registryToMjmlRenderers(registry) });

    const docNode = {
      id: "doc",
      type: "document" as const,
      settings: { contentWidth: 600, backgroundColor: "#fff", fontFamily: "Arial" },
      children: [
        {
          id: "s",
          type: "section" as const,
          style: {},
          children: [
            {
              id: "col",
              type: "column" as const,
              widthPercent: 100,
              style: {},
              children: [makeCoupon({ label: "Welcome", code: "HELLO" })],
            },
          ],
        },
      ],
    };
    const html = await renderer.render(docNode as never);
    expect(html).toContain("Welcome");
    expect(html).toContain("HELLO");
  });
});
