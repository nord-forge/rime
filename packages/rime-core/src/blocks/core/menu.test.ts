import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createColumn, createIdFactory, createSection, validateDoc } from "@nord-forge/rime-model";
import type { BaseNode } from "@nord-forge/rime-model";
import { MjmlRenderer } from "@nord-forge/rime-mjml";
import { BlockRegistry, registryToMjmlRenderers } from "../registry";
import type { CanvasRenderContext, ExportRenderContext } from "../types";
import { menuBlock, registerCoreBlocks } from "./index";
import type { MenuBlock } from "./menu";

let win: Window;
let doc: Document;
beforeEach(() => {
  win = new Window();
  doc = win.document as unknown as Document;
});

function canvasCtx(): CanvasRenderContext {
  return { doc, renderChild: () => doc.createElement("div") };
}

const exportCtx: ExportRenderContext = {
  renderChild: () => "",
  escape: (s) => s,
};

function makeMenu(over: Partial<MenuBlock> = {}): MenuBlock {
  return {
    id: "m1",
    type: "menu",
    items: [
      { label: "Home", href: "https://x.test" },
      { label: "About", href: "https://x.test/about" },
    ],
    layout: "horizontal",
    style: {},
    ...over,
  };
}

function docWithLeaf(leaf: BaseNode) {
  const id = createIdFactory();
  const section = createSection(id, 1);
  (section.children[0] as ReturnType<typeof createColumn>).children.push(leaf as never);
  return {
    id: id("document"),
    type: "document" as const,
    settings: { contentWidth: 600, backgroundColor: "#ffffff", fontFamily: "Arial" },
    children: [section],
  };
}

describe("menu block schema", () => {
  test("exposes an items list with label/url item fields, plus layout/color/align/padding", () => {
    const keys = menuBlock.schema.fields.map((f) => f.key);
    expect(keys).toEqual(["items", "layout", "color", "style.align", "style.paddingTop"]);
    const items = menuBlock.schema.fields.find((f) => f.key === "items")!;
    expect(items.type).toBe("list");
    expect(items.itemFields?.map((f) => f.key)).toEqual(["label", "href"]);
  });
});

describe("menu block renderCanvas", () => {
  test("paints a horizontal <nav> of anchors with data-node-id and no table", () => {
    const el = menuBlock.renderCanvas(makeMenu(), canvasCtx());
    expect(el.dataset["nodeId"]).toBe("m1");
    expect(el.querySelector("table")).toBeNull();
    const nav = el.querySelector("nav")!;
    expect(nav.style.flexDirection).toBe("row");
    expect(nav.querySelectorAll("a")).toHaveLength(2);
    expect(nav.querySelector("a")!.textContent).toBe("Home");
  });

  test("applies the link color when set", () => {
    const el = menuBlock.renderCanvas(makeMenu({ color: "#ff0000" }), canvasCtx());
    expect(el.querySelector("a")!.style.color).toBe("#ff0000");
  });

  test("drops an unsafe href but still renders the label", () => {
    const el = menuBlock.renderCanvas(
      makeMenu({ items: [{ label: "Bad", href: "javascript:alert(1)" }] }),
      canvasCtx(),
    );
    const a = el.querySelector("a")!;
    expect(a.hasAttribute("href")).toBe(false);
    expect(a.textContent).toBe("Bad");
  });
});

describe("menu block renderExport", () => {
  test("emits <mj-navbar> with one <mj-navbar-link> per item, labels + hrefs escaped", () => {
    const out = menuBlock.renderExport(makeMenu(), exportCtx);
    const mjml = "mjml" in out ? out.mjml : "";
    expect(mjml).toContain("<mj-navbar>");
    // normalizeHref canonicalizes URLs (adds a trailing slash on the origin).
    expect(mjml).toContain('<mj-navbar-link href="https://x.test/">Home</mj-navbar-link>');
    expect(mjml).toContain('<mj-navbar-link href="https://x.test/about">About</mj-navbar-link>');
    expect(mjml).toContain("</mj-navbar>");
  });

  test("escapes a label with markup", () => {
    const out = menuBlock.renderExport(
      makeMenu({ items: [{ label: "<b> & co", href: "https://x.test" }] }),
      exportCtx,
    );
    expect("mjml" in out && out.mjml).toContain("&lt;b&gt; &amp; co");
  });

  test("omits an item whose href fails the safety guard", () => {
    const out = menuBlock.renderExport(
      makeMenu({
        items: [
          { label: "Bad", href: "javascript:alert(1)" },
          { label: "Good", href: "https://x.test" },
        ],
      }),
      exportCtx,
    );
    const mjml = "mjml" in out ? out.mjml : "";
    expect(mjml).not.toContain("Bad");
    expect(mjml).toContain("Good");
  });

  test("inlines the color attribute on each link when set", () => {
    const out = menuBlock.renderExport(makeMenu({ color: "#123456" }), exportCtx);
    expect("mjml" in out && out.mjml).toContain('color="#123456"');
  });
});

describe("menu validateDoc round-trip (extraLeafTypes)", () => {
  test("the dropped default is valid", () => {
    const result = validateDoc(docWithLeaf(makeMenu()), { extraLeafTypes: ["menu"] });
    expect(result.ok).toBe(true);
  });
});

describe("menu MJML export compiles through the renderer", () => {
  const registry = new BlockRegistry();
  registerCoreBlocks(registry);
  const renderer = new MjmlRenderer({ blockRenderers: registryToMjmlRenderers(registry) });

  test("a menu document renders to HTML with the links", async () => {
    const html = await renderer.render(docWithLeaf(makeMenu()));
    expect(html).toContain("Home");
    expect(html).toContain("About");
  });
});
