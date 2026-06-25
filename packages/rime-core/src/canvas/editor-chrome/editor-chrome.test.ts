import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import type { BaseNode, RichTextJSON } from "@nord-forge/rime-model";
import {
  applyPlaceholder,
  DEFAULT_PLACEHOLDER_LABELS,
  editorChromeCss,
  isRichTextEmpty,
  placeholderFor,
  PLACEHOLDER_TOKENS,
} from "./editor-chrome";

const para = (text: string): RichTextJSON => ({
  type: "doc",
  content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
});

describe("isRichTextEmpty", () => {
  test("undefined is empty", () => {
    expect(isRichTextEmpty(undefined)).toBe(true);
  });

  test("a single empty paragraph is empty", () => {
    expect(isRichTextEmpty(para(""))).toBe(true);
  });

  test("any text run makes it non-empty", () => {
    expect(isRichTextEmpty(para("hi"))).toBe(false);
  });

  test("a list with no item content is empty", () => {
    const rt: RichTextJSON = {
      type: "doc",
      content: [{ type: "list", ordered: false, items: [{ content: [] }] }],
    };
    expect(isRichTextEmpty(rt)).toBe(true);
  });

  test("a list with item content is non-empty", () => {
    const rt: RichTextJSON = {
      type: "doc",
      content: [
        { type: "list", ordered: false, items: [{ content: [{ type: "text", text: "x" }] }] },
      ],
    };
    expect(isRichTextEmpty(rt)).toBe(false);
  });
});

describe("placeholderFor", () => {
  test("empty text gets the text label", () => {
    const node = { id: "a", type: "text", content: para("") } as unknown as BaseNode;
    expect(placeholderFor(node)).toBe(DEFAULT_PLACEHOLDER_LABELS["text"]);
  });

  test("filled text gets no placeholder", () => {
    const node = { id: "a", type: "text", content: para("hi") } as unknown as BaseNode;
    expect(placeholderFor(node)).toBeNull();
  });

  test("image with no src gets the image label", () => {
    const node = { id: "a", type: "image", src: "" } as unknown as BaseNode;
    expect(placeholderFor(node)).toBe(DEFAULT_PLACEHOLDER_LABELS["image"]);
  });

  test("image with a src gets no placeholder", () => {
    const node = { id: "a", type: "image", src: "x.png" } as unknown as BaseNode;
    expect(placeholderFor(node)).toBeNull();
  });

  test("spacer is always ghosted", () => {
    const node = { id: "a", type: "spacer", height: 24 } as unknown as BaseNode;
    expect(placeholderFor(node)).toBe(DEFAULT_PLACEHOLDER_LABELS["spacer"]);
  });

  test("blocks with their own content (button) are never ghosted", () => {
    const node = { id: "a", type: "button", label: "Go" } as unknown as BaseNode;
    expect(placeholderFor(node)).toBeNull();
  });

  test("custom labels override the defaults", () => {
    const node = { id: "a", type: "text", content: para("") } as unknown as BaseNode;
    expect(placeholderFor(node, { text: "Type here" })).toBe("Type here");
  });
});

describe("applyPlaceholder", () => {
  const doc = new Window().document as unknown as Document;

  test("sets data hooks when given a label", () => {
    const el = doc.createElement("div");
    applyPlaceholder(el, "Empty");
    expect(el.dataset["empty"]).toBe("1");
    expect(el.dataset["placeholder"]).toBe("Empty");
  });

  test("clears data hooks when given null", () => {
    const el = doc.createElement("div");
    applyPlaceholder(el, "Empty");
    applyPlaceholder(el, null);
    expect(el.dataset["empty"]).toBeUndefined();
    expect(el.dataset["placeholder"]).toBeUndefined();
  });
});

describe("editorChromeCss", () => {
  test("includes the default placeholder palette", () => {
    const css = editorChromeCss();
    for (const token of Object.keys(PLACEHOLDER_TOKENS)) {
      expect(css).toContain(token);
    }
  });

  test("forwards theme overrides into the :root block", () => {
    const css = editorChromeCss({ "--rime-selected-outline": "#ff0000" });
    expect(css).toContain("--rime-selected-outline:#ff0000");
  });

  test("scopes outlines to rendered nodes only", () => {
    const css = editorChromeCss();
    expect(css).toContain("[data-node-id]:hover");
    expect(css).toContain("[data-node-id][data-selected]");
    expect(css).toContain("[data-empty]");
  });
});
