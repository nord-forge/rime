import { describe, expect, test } from "bun:test";
import type { RimeDoc } from "@nord-forge/rime-model";
import { type BlockRenderer, type Renderer, RenderError, type RenderContext } from "./index";

const DOC: RimeDoc = {
  id: "d1",
  type: "document",
  settings: { contentWidth: 600, backgroundColor: "#fff", fontFamily: "Arial" },
  children: [],
};

describe("Renderer contract", () => {
  test("a minimal renderer implements the interface and is awaitable", async () => {
    // Proves the contract is implementable and swap-friendly (type-checks here).
    class NoopRenderer implements Renderer {
      async render(): Promise<string> {
        return "";
      }
    }
    const html = await new NoopRenderer().render(DOC);
    expect(html).toBe("");
  });

  test("render receives options", async () => {
    const seen: unknown[] = [];
    const r: Renderer = {
      async render(_doc, options) {
        seen.push(options);
        return "<html></html>";
      },
    };
    expect(await r.render(DOC, { minify: true })).toBe("<html></html>");
    expect(seen[0]).toEqual({ minify: true });
  });
});

describe("BlockRenderer seam", () => {
  test("a BlockRenderer can render a node and delegate children via ctx", () => {
    const buttonRenderer: BlockRenderer = {
      type: "button",
      renderExport(node) {
        return `[${(node as { type: string }).type}]`;
      },
    };
    const ctx: RenderContext = {
      renderChild: () => "",
      options: {},
    };
    const out = buttonRenderer.renderExport(
      { id: "b1", type: "button", label: "Go", href: "#", style: {} },
      ctx,
    );
    expect(out).toBe("[button]");
  });
});

describe("RenderError", () => {
  test("carries a message and optional cause", () => {
    const cause = new Error("boom");
    const err = new RenderError("cannot render", cause);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("RenderError");
    expect(err.message).toBe("cannot render");
    expect(err.cause).toBe(cause);
  });
});
