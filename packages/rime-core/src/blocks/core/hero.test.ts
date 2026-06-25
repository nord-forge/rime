import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createIdFactory, createSection, validateDoc } from "@nord-forge/rime-model";
import type { BaseNode } from "@nord-forge/rime-model";
import { MjmlRenderer } from "@nord-forge/rime-mjml";
import { BlockRegistry, placementOf, registryToMjmlRenderers } from "../registry";
import type { CanvasRenderContext, ExportRenderContext } from "../types";
import { heroBlock, registerCoreBlocks } from "./index";
import type { HeroBlock } from "./hero";

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

function makeHero(over: Partial<HeroBlock> = {}): HeroBlock {
  return {
    id: "hero1",
    type: "hero",
    backgroundColor: "#333333",
    heading: "Big headline",
    height: 300,
    textColor: "#ffffff",
    style: { align: "center" },
    ...over,
  };
}

// A hero is a section-level band: it lives at the DOCUMENT level, beside sections.
function docWithHero(hero: BaseNode) {
  const id = createIdFactory();
  return {
    id: id("document"),
    type: "document" as const,
    settings: { contentWidth: 600, backgroundColor: "#ffffff", fontFamily: "Arial" },
    children: [hero, createSection(id, 1)],
  };
}

describe("hero block placement", () => {
  test("declares section-level placement", () => {
    expect(placementOf(heroBlock)).toBe("section");
  });
});

describe("hero block schema", () => {
  test("exposes background/heading/subtext/button/height/color fields", () => {
    const keys = heroBlock.schema.fields.map((f) => f.key);
    expect(keys).toContain("backgroundImage");
    expect(keys).toContain("backgroundColor");
    expect(keys).toContain("heading");
    expect(keys).toContain("button.label");
    expect(keys).toContain("button.href");
    expect(keys).toContain("height");
  });
});

describe("hero block renderCanvas", () => {
  test("paints a fixed-height banner with the heading and no table", () => {
    const el = heroBlock.renderCanvas(makeHero(), canvasCtx());
    expect(el.dataset["nodeId"]).toBe("hero1");
    expect(el.querySelector("table")).toBeNull();
    expect(el.style.height).toBe("300px");
    expect(el.querySelector("h2")!.textContent).toBe("Big headline");
  });

  test("uses the background color, and the image when set", () => {
    const plain = heroBlock.renderCanvas(makeHero(), canvasCtx());
    expect(plain.style.backgroundColor).toBe("#333333");
    expect(plain.style.backgroundImage).toBe("");
    const withImg = heroBlock.renderCanvas(
      makeHero({ backgroundImage: "https://x.test/bg.jpg" }),
      canvasCtx(),
    );
    expect(withImg.style.backgroundImage).toContain("bg.jpg");
  });

  test("renders the CTA as a link, dropping an unsafe href", () => {
    const ok = heroBlock.renderCanvas(
      makeHero({ button: { label: "Go", href: "https://x.test" } }),
      canvasCtx(),
    );
    expect(ok.querySelector("a")!.getAttribute("href")).toBe("https://x.test/");
    const unsafe = heroBlock.renderCanvas(
      makeHero({ button: { label: "Go", href: "javascript:alert(1)" } }),
      canvasCtx(),
    );
    expect(unsafe.querySelector("a")).toBeNull();
    expect(unsafe.textContent).toContain("Go");
  });
});

describe("hero block renderExport", () => {
  test("emits a body-level <mj-hero> with an always-present background-color fallback", () => {
    const out = heroBlock.renderExport(makeHero(), exportCtx);
    const mjml = "mjml" in out ? out.mjml : "";
    expect(mjml).toContain("<mj-hero");
    expect(mjml).toContain('mode="fixed-height"');
    expect(mjml).toContain('height="300px"');
    expect(mjml).toContain('background-color="#333333"');
    // No image set → no background-url.
    expect(mjml).not.toContain("background-url");
    expect(mjml).toContain("Big headline");
  });

  test("includes background-url when an image is set", () => {
    const out = heroBlock.renderExport(
      makeHero({ backgroundImage: "https://x.test/bg.jpg" }),
      exportCtx,
    );
    expect("mjml" in out && out.mjml).toContain('background-url="https://x.test/bg.jpg"');
  });

  test("emits the CTA as <mj-button>, omitting it for an unsafe href", () => {
    const ok = heroBlock.renderExport(
      makeHero({ button: { label: "Go", href: "https://x.test" } }),
      exportCtx,
    );
    expect("mjml" in ok && ok.mjml).toContain('<mj-button href="https://x.test/"');
    const unsafe = heroBlock.renderExport(
      makeHero({ button: { label: "Go", href: "javascript:alert(1)" } }),
      exportCtx,
    );
    expect("mjml" in unsafe && unsafe.mjml).not.toContain("mj-button");
  });

  test("escapes heading text", () => {
    const out = heroBlock.renderExport(makeHero({ heading: "<b> & co" }), exportCtx);
    expect("mjml" in out && out.mjml).toContain("&lt;b&gt; &amp; co");
  });
});

describe("hero validateDoc round-trip (extraSectionTypes)", () => {
  test("a document with a hero band beside a section is valid", () => {
    const result = validateDoc(docWithHero(makeHero()), { extraSectionTypes: ["hero"] });
    expect(result.ok).toBe(true);
  });

  test("a hero band is rejected without extraSectionTypes", () => {
    const result = validateDoc(docWithHero(makeHero()));
    expect(result.ok).toBe(false);
  });
});

describe("hero MJML export compiles through the renderer", () => {
  const registry = new BlockRegistry();
  registerCoreBlocks(registry);
  const renderer = new MjmlRenderer({ blockRenderers: registryToMjmlRenderers(registry) });

  test("a hero document renders to bulletproof HTML with the banner", async () => {
    const html = await renderer.render(
      docWithHero(makeHero({ backgroundImage: "https://x.test/bg.jpg", heading: "Welcome" })),
    );
    expect(html).toContain("Welcome");
    expect(html).toContain("bg.jpg");
  });
});
