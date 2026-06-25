import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createColumn, createIdFactory, createSection, validateDoc } from "@nord-forge/rime-model";
import type { BaseNode } from "@nord-forge/rime-model";
import { MjmlRenderer } from "@nord-forge/rime-mjml";
import { BlockRegistry, registryToMjmlRenderers } from "../registry";
import type { CanvasRenderContext, ExportRenderContext } from "../types";
import { registerCoreBlocks, socialBlock } from "./index";
import type { SocialBlock } from "./social";

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

function makeSocial(over: Partial<SocialBlock> = {}): SocialBlock {
  return {
    id: "s1",
    type: "social",
    links: [
      { network: "twitter", href: "https://twitter.com/acme" },
      { network: "github", href: "https://github.com/acme" },
    ],
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

describe("social block schema", () => {
  test("exposes a links list with network/url item fields plus icon size/align/padding", () => {
    const keys = socialBlock.schema.fields.map((f) => f.key);
    expect(keys).toEqual(["links", "iconSize", "style.align", "style.paddingTop"]);
    const links = socialBlock.schema.fields.find((f) => f.key === "links")!;
    expect(links.type).toBe("list");
    expect(links.itemFields?.map((f) => f.key)).toEqual(["network", "href"]);
    expect(links.itemFields?.find((f) => f.key === "network")?.type).toBe("select");
  });
});

describe("social block renderCanvas", () => {
  test("paints an anchor + inline svg per link, with data-node-id and no table", () => {
    const el = socialBlock.renderCanvas(makeSocial(), canvasCtx());
    expect(el.dataset["nodeId"]).toBe("s1");
    expect(el.querySelector("table")).toBeNull();
    expect(el.querySelectorAll("a")).toHaveLength(2);
    expect(el.querySelectorAll("svg")).toHaveLength(2);
  });

  test("uses the configured icon size on the svgs", () => {
    const el = socialBlock.renderCanvas(makeSocial({ iconSize: 40 }), canvasCtx());
    expect(el.querySelector("svg")!.getAttribute("width")).toBe("40");
  });

  test("drops an unsafe href but still paints the icon", () => {
    const el = socialBlock.renderCanvas(
      makeSocial({ links: [{ network: "twitter", href: "javascript:alert(1)" }] }),
      canvasCtx(),
    );
    const a = el.querySelector("a")!;
    expect(a.hasAttribute("href")).toBe(false);
    expect(a.querySelector("svg")).not.toBeNull();
  });

  test("centers the row when aligned center", () => {
    const el = socialBlock.renderCanvas(makeSocial({ style: { align: "center" } }), canvasCtx());
    const row = el.querySelector("div")!;
    expect(row.style.justifyContent).toBe("center");
  });
});

describe("social block renderExport", () => {
  test("emits <mj-social> with one element per link, names + escaped hrefs", () => {
    const out = socialBlock.renderExport(makeSocial(), exportCtx);
    const mjml = "mjml" in out ? out.mjml : "";
    expect(mjml).toContain('<mj-social mode="horizontal" icon-size="24px">');
    expect(mjml).toContain('<mj-social-element name="twitter" href="https://twitter.com/acme" />');
    expect(mjml).toContain('<mj-social-element name="github" href="https://github.com/acme" />');
    expect(mjml).toContain("</mj-social>");
  });

  test("maps an unknown network to the generic web icon", () => {
    const out = socialBlock.renderExport(
      makeSocial({ links: [{ network: "mastodon", href: "https://example.com" }] }),
      exportCtx,
    );
    expect("mjml" in out && out.mjml).toContain('name="web"');
  });

  test("omits links whose href fails the safety guard", () => {
    const out = socialBlock.renderExport(
      makeSocial({
        links: [
          { network: "twitter", href: "javascript:alert(1)" },
          { network: "github", href: "https://github.com/acme" },
        ],
      }),
      exportCtx,
    );
    const mjml = "mjml" in out ? out.mjml : "";
    expect(mjml).not.toContain("twitter");
    expect(mjml).toContain('name="github"');
  });

  test("carries the icon size through to icon-size", () => {
    const out = socialBlock.renderExport(makeSocial({ iconSize: 32 }), exportCtx);
    expect("mjml" in out && out.mjml).toContain('icon-size="32px"');
  });
});

describe("social block validateDoc round-trip (extraLeafTypes)", () => {
  test("the dropped default is valid", () => {
    const result = validateDoc(docWithLeaf(makeSocial()), { extraLeafTypes: ["social"] });
    expect(result.ok).toBe(true);
  });
});

describe("social block MJML export compiles through the renderer", () => {
  const registry = new BlockRegistry();
  registerCoreBlocks(registry);
  const renderer = new MjmlRenderer({ blockRenderers: registryToMjmlRenderers(registry) });

  test("a social document renders to HTML with the link", async () => {
    const html = await renderer.render(docWithLeaf(makeSocial()));
    expect(html).toContain("twitter.com/acme");
    expect(html).toContain("github.com/acme");
  });
});
