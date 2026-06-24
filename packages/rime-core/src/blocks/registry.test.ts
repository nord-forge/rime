import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import type { BaseNode } from "@nord-forge/rime-model";
import type { BlockDefinition } from "./types";
import {
  BlockRegistry,
  renderNodeViaRegistry,
  registryToMjmlRenderers,
  toMjmlBlockRenderer,
} from "./registry";

function makeDef(type: string, category = "Content"): BlockDefinition {
  return {
    type,
    schema: { fields: [{ key: "label", label: "Label", type: "text" }] },
    palette: { label: type, icon: "📦", category, defaults: {} },
    renderCanvas: (node, ctx) => {
      const el = ctx.doc.createElement("div");
      el.dataset["nodeId"] = node.id;
      el.dataset["nodeType"] = node.type;
      el.textContent = type;
      return el;
    },
    renderExport: () => ({ mjml: `<mj-text>${type}</mj-text>` }),
  };
}

let win: Window;
let doc: Document;
beforeEach(() => {
  win = new Window();
  doc = win.document as unknown as Document;
});

describe("BlockRegistry", () => {
  test("register + get + all", () => {
    const r = new BlockRegistry();
    const def = makeDef("text");
    r.register(def);
    expect(r.get("text")).toBe(def);
    expect(r.all()).toEqual([def]);
  });

  test("re-registering a type throws (no silent clobber)", () => {
    const r = new BlockRegistry();
    r.register(makeDef("text"));
    expect(() => r.register(makeDef("text"))).toThrow(/already registered/);
  });

  test("get returns undefined for an unknown type", () => {
    expect(new BlockRegistry().get("nope")).toBeUndefined();
  });

  test("byCategory groups definitions by palette category", () => {
    const r = new BlockRegistry();
    r.register(makeDef("text", "Content"));
    r.register(makeDef("image", "Content"));
    r.register(makeDef("section", "Layout"));
    const map = r.byCategory();
    expect(map.get("Content")!.map((d) => d.type)).toEqual(["text", "image"]);
    expect(map.get("Layout")!.map((d) => d.type)).toEqual(["section"]);
  });
});

describe("renderNodeViaRegistry", () => {
  const node = (type: string): BaseNode => ({ id: "n1", type }) as BaseNode;
  const ctx = () => ({ doc, renderChild: () => doc.createElement("div") });

  test("dispatches to the registered renderCanvas", () => {
    const r = new BlockRegistry();
    r.register(makeDef("text"));
    const el = renderNodeViaRegistry(node("text"), ctx(), r);
    expect(el.dataset["nodeId"]).toBe("n1");
    expect(el.textContent).toBe("text");
  });

  test("unknown type → inert hidden placeholder, never blank", () => {
    const el = renderNodeViaRegistry(node("mystery"), ctx(), new BlockRegistry());
    expect(el.dataset["nodeUnknown"]).toBe("1");
    expect(el.dataset["nodeId"]).toBe("n1");
    expect(el.style.display).toBe("none");
  });
});

describe("MJML export adapter", () => {
  const ctx = { renderChild: () => "", escape: (s: string) => s };

  test("{ mjml } passes through as the element string", () => {
    const renderer = toMjmlBlockRenderer(makeDef("text"));
    expect(renderer.type).toBe("text");
    expect(renderer.renderExport({ id: "x", type: "text" } as BaseNode, ctx)).toBe(
      "<mj-text>text</mj-text>",
    );
  });

  test("{ raw } passes through as raw HTML", () => {
    const def: BlockDefinition = {
      ...makeDef("widget"),
      renderExport: () => ({ raw: "<table><tr><td>raw</td></tr></table>" }),
    };
    expect(
      toMjmlBlockRenderer(def).renderExport({ id: "x", type: "widget" } as BaseNode, ctx),
    ).toBe("<table><tr><td>raw</td></tr></table>");
  });

  test("registryToMjmlRenderers adapts every registered block", () => {
    const r = new BlockRegistry();
    r.register(makeDef("text"));
    r.register(makeDef("image"));
    expect(registryToMjmlRenderers(r).map((b) => b.type)).toEqual(["text", "image"]);
  });
});
