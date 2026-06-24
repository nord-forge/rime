import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import {
  createButtonBlock,
  createDividerBlock,
  createIdFactory,
  createImageBlock,
  createSpacerBlock,
  createTextBlock,
  type RichTextJSON,
} from "@nord-forge/rime-model";
import type { BaseNode } from "@nord-forge/rime-model";
import { docToMjml } from "@nord-forge/rime-mjml";
import { BlockRegistry } from "../registry";
import type { ExportRenderContext } from "../types";
import { CORE_BLOCKS, registerCoreBlocks } from "./index";

let win: Window;
let doc: Document;
beforeEach(() => {
  win = new Window();
  doc = win.document as unknown as Document;
});

describe("registerCoreBlocks", () => {
  test("registers exactly the seven core types", () => {
    const r = new BlockRegistry();
    registerCoreBlocks(r);
    expect(
      r
        .all()
        .map((d) => d.type)
        .sort(),
    ).toEqual(["button", "column", "divider", "image", "section", "spacer", "text"].sort());
  });

  test("is idempotent (a second call does not throw)", () => {
    const r = new BlockRegistry();
    registerCoreBlocks(r);
    expect(() => registerCoreBlocks(r)).not.toThrow();
    expect(r.all()).toHaveLength(7);
  });

  test("every core block has palette defaults and a schema", () => {
    for (const def of CORE_BLOCKS) {
      expect(def.palette.label).toBeTruthy();
      expect(def.palette.category).toBeTruthy();
      expect(def.schema.fields.length).toBeGreaterThan(0);
    }
  });
});

describe("renderCanvas", () => {
  const registry = new BlockRegistry();
  registerCoreBlocks(registry);
  const ctx = () => ({
    doc,
    renderChild: (c: BaseNode) => registry.get(c.type)!.renderCanvas(c, ctx()),
  });

  test("text block paints divs with data-node-id, no table", () => {
    const tb = createTextBlock(createIdFactory(), {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
    });
    const el = registry.get("text")!.renderCanvas(tb, ctx());
    expect(el.dataset["nodeId"]).toBe(tb.id);
    expect(el.querySelector("table")).toBeNull();
    expect(el.textContent).toContain("hi");
  });

  test("section is a styled container wrapping its column row", () => {
    const id = createIdFactory();
    const section = {
      id: id("section"),
      type: "section" as const,
      style: { backgroundColor: "#f0f0f0", paddingTop: 16 },
      children: [
        { id: id("column"), type: "column" as const, widthPercent: 100, style: {}, children: [] },
      ],
    };
    const el = registry.get("section")!.renderCanvas(section as unknown as BaseNode, ctx());
    expect(el.style.backgroundColor).toBe("#f0f0f0");
    expect(el.style.paddingTop).toBe("16px");
    // the column lives inside the section's column-row
    const row = el.querySelector('[data-node-role="column-row"]')!;
    expect(row.querySelector('[data-node-type="column"]')).not.toBeNull();
  });
});

// The core blocks' renderExport MUST match renderer-mjml's standalone mapping for
// the same node, so the SDK export path and the default renderer never diverge.
describe("MJML export parity with renderer-mjml", () => {
  const registry = new BlockRegistry();
  registerCoreBlocks(registry);
  const exportCtx: ExportRenderContext = {
    renderChild: (c) => {
      const out = registry.get(c.type)!.renderExport(c, exportCtx);
      return "mjml" in out ? out.mjml : out.raw;
    },
    escape: (s) => s,
  };

  function coreExport(node: BaseNode): string {
    const out = registry.get(node.type)!.renderExport(node, exportCtx);
    return "mjml" in out ? out.mjml : out.raw;
  }

  // Extract the inner MJML the standalone renderer produced for a single block, by
  // wrapping it in a 1-column section and slicing the renderer's output.
  function rendererExportLeaf(leaf: BaseNode): string {
    const id = createIdFactory();
    const docNode = {
      id: id("document"),
      type: "document" as const,
      settings: { contentWidth: 600, backgroundColor: "#fff", fontFamily: "Arial" },
      children: [
        {
          id: id("section"),
          type: "section" as const,
          style: {},
          children: [
            {
              id: id("column"),
              type: "column" as const,
              widthPercent: 100,
              style: {},
              children: [leaf],
            },
          ],
        },
      ],
    };
    const full = docToMjml(docNode as never);
    const inner = full.match(/<mj-column width="100%">(.*)<\/mj-column>/s);
    return inner![1]!;
  }

  const rt: RichTextJSON = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Hello", marks: ["bold"] }] }],
  };

  const cases: Record<string, BaseNode> = {
    text: createTextBlock(createIdFactory(), rt),
    image: {
      ...createImageBlock(createIdFactory(), "https://x.test/i.png", "alt"),
      href: "https://x.test",
    } as BaseNode,
    button: createButtonBlock(createIdFactory(), "Go", "https://x.test"),
    divider: createDividerBlock(createIdFactory()),
    spacer: createSpacerBlock(createIdFactory(), 40),
  };

  for (const [name, node] of Object.entries(cases)) {
    test(`${name} matches`, () => {
      expect(coreExport(node)).toBe(rendererExportLeaf(node));
    });
  }
});
