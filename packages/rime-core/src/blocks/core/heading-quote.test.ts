import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createColumn, createIdFactory, createSection, validateDoc } from "@nord-forge/rime-model";
import type { BaseNode } from "@nord-forge/rime-model";
import { MjmlRenderer } from "@nord-forge/rime-mjml";
import { BlockRegistry, registryToMjmlRenderers } from "../registry";
import type { CanvasRenderContext, ExportRenderContext } from "../types";
import { headingBlock, quoteBlock } from "./index";
import { registerCoreBlocks } from "./index";
import type { HeadingBlock } from "./heading";
import type { QuoteBlock } from "./quote";

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

function makeHeading(over: Partial<HeadingBlock> = {}): HeadingBlock {
  return { id: "h1", type: "heading", level: 2, text: "Title", style: {}, ...over };
}

function makeQuote(over: Partial<QuoteBlock> = {}): QuoteBlock {
  return { id: "q1", type: "quote", text: "Wise words", style: {}, ...over };
}

// Wrap a leaf in a full document so it round-trips through validateDoc and the renderer.
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

describe("heading block", () => {
  test("schema exposes level/text/color/align/padding", () => {
    const keys = headingBlock.schema.fields.map((f) => f.key);
    expect(keys).toEqual(["level", "text", "color", "style.align", "style.paddingTop"]);
    const level = headingBlock.schema.fields.find((f) => f.key === "level")!;
    expect(level.type).toBe("select");
    expect(level.options?.map((o) => o.value)).toEqual(["1", "2", "3"]);
  });

  test.each([1, 2, 3] as const)("renderCanvas paints <h%i> with the text and no table", (level) => {
    const el = headingBlock.renderCanvas(makeHeading({ level }), canvasCtx());
    expect(el.dataset["nodeId"]).toBe("h1");
    expect(el.querySelector("table")).toBeNull();
    const h = el.querySelector(`h${level}`)!;
    expect(h).not.toBeNull();
    expect(h.textContent).toBe("Title");
  });

  test("renderCanvas applies color when set", () => {
    const el = headingBlock.renderCanvas(makeHeading({ color: "#ff0000" }), canvasCtx());
    expect(el.querySelector("h2")!.style.color).toBe("#ff0000");
  });

  test("renderExport wraps the matching <h*> in <mj-text> and escapes text", () => {
    const out = headingBlock.renderExport(makeHeading({ level: 3, text: "<b> & co" }), exportCtx);
    expect("mjml" in out && out.mjml).toBe("<mj-text><h3>&lt;b&gt; &amp; co</h3></mj-text>");
  });

  test("renderExport inlines color into the heading", () => {
    const out = headingBlock.renderExport(makeHeading({ color: "#123456" }), exportCtx);
    expect("mjml" in out && out.mjml).toContain('<h2 style="color:#123456">');
  });

  test("renderExport/renderCanvas tolerate a missing text (no crash, empty heading)", () => {
    const node = { id: "h", type: "heading", level: 2, style: {} } as unknown as HeadingBlock;
    expect(() => headingBlock.renderCanvas(node, canvasCtx())).not.toThrow();
    const out = headingBlock.renderExport(node, exportCtx);
    expect("mjml" in out && out.mjml).toBe("<mj-text><h2></h2></mj-text>");
  });
});

describe("quote block", () => {
  test("renderCanvas paints a blockquote with the accent border, no citation by default", () => {
    const el = quoteBlock.renderCanvas(makeQuote({ accentColor: "#abcdef" }), canvasCtx());
    const bq = el.querySelector("blockquote")!;
    expect(bq.style.borderLeft).toContain("#abcdef");
    expect(el.querySelector("cite")).toBeNull();
    expect(bq.textContent).toContain("Wise words");
  });

  test("renderCanvas adds a citation line when set", () => {
    const el = quoteBlock.renderCanvas(makeQuote({ citation: "— Someone" }), canvasCtx());
    expect(el.querySelector("cite")!.textContent).toBe("— Someone");
  });

  test("renderExport wraps a styled blockquote in <mj-text>, omits empty citation", () => {
    const out = quoteBlock.renderExport(makeQuote({ accentColor: "#cccccc" }), exportCtx);
    const mjml = "mjml" in out ? out.mjml : "";
    expect(mjml).toContain('<blockquote style="border-left:4px solid #cccccc;padding-left:16px;');
    expect(mjml).not.toContain("<cite");
  });

  test("renderExport includes an escaped citation when set", () => {
    const out = quoteBlock.renderExport(makeQuote({ citation: "A & B" }), exportCtx);
    expect("mjml" in out && out.mjml).toContain('<cite style="display:block">A &amp; B</cite>');
  });
});

describe("validateDoc round-trip (extraLeafTypes)", () => {
  test.each([makeHeading(), makeQuote()])("the dropped default for %o is valid", (leaf) => {
    const result = validateDoc(docWithLeaf(leaf), { extraLeafTypes: ["heading", "quote"] });
    expect(result.ok).toBe(true);
  });
});

describe("MJML export compiles through the renderer", () => {
  const registry = new BlockRegistry();
  registerCoreBlocks(registry);
  const renderer = new MjmlRenderer({ blockRenderers: registryToMjmlRenderers(registry) });

  test("a heading document renders to HTML", async () => {
    const html = await renderer.render(docWithLeaf(makeHeading({ level: 1, text: "Hello" })));
    expect(html).toContain("Hello");
    expect(html.toLowerCase()).toContain("<h1");
  });

  test("a quote document renders to HTML", async () => {
    const html = await renderer.render(docWithLeaf(makeQuote({ citation: "Anon" })));
    expect(html).toContain("Wise words");
    expect(html).toContain("Anon");
  });
});
