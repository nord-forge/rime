import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createColumn, createIdFactory, createSection, validateDoc } from "@nord-forge/rime-model";
import type { BaseNode } from "@nord-forge/rime-model";
import { MjmlRenderer } from "@nord-forge/rime-mjml";
import { BlockRegistry, registryToMjmlRenderers } from "../registry";
import type { CanvasRenderContext, ExportRenderContext } from "../types";
import { registerCoreBlocks, videoBlock } from "./index";
import type { VideoBlock } from "./video";

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

function makeVideo(over: Partial<VideoBlock> = {}): VideoBlock {
  return {
    id: "v1",
    type: "video",
    posterImage: "https://x.test/poster.jpg",
    videoUrl: "https://x.test/watch",
    alt: "A video",
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

describe("video block schema", () => {
  test("exposes poster/videoUrl/alt/align/padding (flat, no list field)", () => {
    const keys = videoBlock.schema.fields.map((f) => f.key);
    expect(keys).toEqual(["posterImage", "videoUrl", "alt", "style.align", "style.paddingTop"]);
  });
});

describe("video block renderCanvas", () => {
  test("paints a linked poster with a centered play badge and data-node-id", () => {
    const el = videoBlock.renderCanvas(makeVideo(), canvasCtx());
    expect(el.dataset["nodeId"]).toBe("v1");
    expect(el.querySelector("table")).toBeNull();
    const a = el.querySelector("a")!;
    expect(a.getAttribute("href")).toBe("https://x.test/watch");
    expect(a.querySelector("img")!.getAttribute("src")).toBe("https://x.test/poster.jpg");
    expect(a.querySelector("svg")).not.toBeNull(); // play badge
  });

  test("uses a color placeholder when no poster is set", () => {
    const el = videoBlock.renderCanvas(makeVideo({ posterImage: undefined }), canvasCtx());
    expect(el.querySelector("img")).toBeNull();
    expect(el.querySelector("svg")).not.toBeNull();
  });

  test("drops an unsafe videoUrl (no href) but still paints the poster + badge", () => {
    const el = videoBlock.renderCanvas(makeVideo({ videoUrl: "javascript:alert(1)" }), canvasCtx());
    const a = el.querySelector("a")!;
    expect(a.hasAttribute("href")).toBe(false);
    expect(a.querySelector("svg")).not.toBeNull();
  });
});

describe("video block renderExport", () => {
  test("emits a { raw } linked poster table with the play badge and escaped attrs", () => {
    const out = videoBlock.renderExport(makeVideo(), exportCtx);
    expect("raw" in out).toBe(true);
    const raw = "raw" in out ? out.raw : "";
    expect(raw.startsWith("<mj-raw>")).toBe(true);
    expect(raw).toContain('href="https://x.test/watch"');
    expect(raw).toContain('src="https://x.test/poster.jpg"');
    expect(raw).toContain("data:image/svg+xml"); // play badge overlay
  });

  test("omits the link when videoUrl is unsafe, keeping the poster", () => {
    const out = videoBlock.renderExport(makeVideo({ videoUrl: "javascript:alert(1)" }), exportCtx);
    const raw = "raw" in out ? out.raw : "";
    expect(raw).not.toContain("<a ");
    expect(raw).toContain("poster.jpg");
  });

  test("escapes the alt text", () => {
    const out = videoBlock.renderExport(makeVideo({ alt: '"><x' }), exportCtx);
    const raw = "raw" in out ? out.raw : "";
    expect(raw).toContain("&quot;&gt;&lt;x");
  });
});

describe("video validateDoc round-trip (extraLeafTypes)", () => {
  test("the dropped default is valid", () => {
    const result = validateDoc(docWithLeaf(makeVideo()), { extraLeafTypes: ["video"] });
    expect(result.ok).toBe(true);
  });
});

describe("video MJML export compiles through the renderer", () => {
  const registry = new BlockRegistry();
  registerCoreBlocks(registry);
  const renderer = new MjmlRenderer({ blockRenderers: registryToMjmlRenderers(registry) });

  test("a video document renders to HTML with the poster + link", async () => {
    const html = await renderer.render(makeVideoDoc());
    expect(html).toContain("poster.jpg");
    expect(html).toContain("x.test/watch");
  });
});

function makeVideoDoc() {
  return docWithLeaf(makeVideo());
}
