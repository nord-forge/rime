import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createColumn, createIdFactory, createSection, validateDoc } from "@nord-forge/rime-model";
import type { BaseNode } from "@nord-forge/rime-model";
import { MjmlRenderer } from "@nord-forge/rime-mjml";
import { BlockRegistry, registryToMjmlRenderers } from "../registry";
import type { CanvasRenderContext, ExportRenderContext } from "../types";
import { htmlBlock, registerCoreBlocks } from "./index";
import type { HtmlBlock } from "./html";

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

function makeHtml(over: Partial<HtmlBlock> = {}): HtmlBlock {
  return { id: "h1", type: "html", html: "<p>Hello</p>", style: {}, ...over };
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

describe("html block schema", () => {
  test("exposes a code field for the html plus spacing", () => {
    const keys = htmlBlock.schema.fields.map((f) => f.key);
    expect(keys).toEqual(["html", "style.paddingTop"]);
    expect(htmlBlock.schema.fields.find((f) => f.key === "html")?.type).toBe("code");
  });

  test("is in the Advanced category", () => {
    expect(htmlBlock.palette.category).toBe("Advanced");
  });
});

describe("html block renderCanvas", () => {
  test("renders the supplied HTML into a contained bordered wrapper with data-node-id", () => {
    const el = htmlBlock.renderCanvas(makeHtml(), canvasCtx());
    expect(el.dataset["nodeId"]).toBe("h1");
    const wrapper = el.querySelector('[data-html-preview="1"]') as HTMLElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper.style.border).toContain("dashed");
    expect(wrapper.querySelector("p")!.textContent).toBe("Hello");
  });
});

describe("html block renderExport", () => {
  test("wraps the html verbatim (un-escaped) in <mj-raw> via the { raw } path", () => {
    const out = htmlBlock.renderExport(makeHtml({ html: '<div class="x">A & B</div>' }), exportCtx);
    expect("raw" in out).toBe(true);
    expect("raw" in out && out.raw).toBe('<mj-raw><div class="x">A & B</div></mj-raw>');
  });

  test("does NOT escape markup or ampersands (passthrough)", () => {
    const out = htmlBlock.renderExport(makeHtml({ html: "<b>&amp;</b>" }), exportCtx);
    const raw = "raw" in out ? out.raw : "";
    expect(raw).toContain("<b>&amp;</b>");
    expect(raw).not.toContain("&lt;b&gt;");
  });
});

describe("html validateDoc round-trip (extraLeafTypes)", () => {
  test("the dropped default is valid", () => {
    const result = validateDoc(docWithLeaf(makeHtml()), { extraLeafTypes: ["html"] });
    expect(result.ok).toBe(true);
  });
});

describe("html MJML export compiles through the renderer", () => {
  const registry = new BlockRegistry();
  registerCoreBlocks(registry);
  const renderer = new MjmlRenderer({ blockRenderers: registryToMjmlRenderers(registry) });

  test("the raw HTML passes through to the rendered output verbatim", async () => {
    const html = await renderer.render(
      docWithLeaf(makeHtml({ html: '<span id="marker">RAWPASS</span>' })),
    );
    expect(html).toContain('<span id="marker">RAWPASS</span>');
  });
});
