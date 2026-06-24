import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createEditor, type LexicalEditor } from "lexical";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import type { RichTextJSON } from "@nord-forge/rime-model";
import { $applyRichTextJSON, $readRichTextJSON, canonicalize } from "./serialize";

// The converters run inside Lexical update/read callbacks, which read global DOM.
const saved: Record<string, unknown> = {};
const GLOBALS = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Node",
  "Text",
  "Event",
] as const;
let win: Window;
let editor: LexicalEditor;

beforeEach(() => {
  win = new Window();
  for (const key of GLOBALS) {
    saved[key] = (globalThis as Record<string, unknown>)[key];
    (globalThis as Record<string, unknown>)[key] = (win as unknown as Record<string, unknown>)[key];
  }
  editor = createEditor({
    namespace: "test",
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode],
    onError: (e) => {
      throw e;
    },
  });
});

afterEach(() => {
  for (const key of GLOBALS) (globalThis as Record<string, unknown>)[key] = saved[key];
});

/** Round-trip a doc through the editor and return what was read back. */
function roundTrip(json: RichTextJSON): RichTextJSON {
  editor.update(() => $applyRichTextJSON(json), { discrete: true });
  let out: RichTextJSON = { type: "doc", content: [] };
  editor.getEditorState().read(() => {
    out = $readRichTextJSON();
  });
  return out;
}

describe("canonicalize", () => {
  test("drops empty runs, orders marks, merges adjacent equal runs", () => {
    const input: RichTextJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "" },
            { type: "text", text: "a", marks: ["italic", "bold"] },
            { type: "text", text: "b", marks: ["bold", "italic"] },
          ],
        },
      ],
    };
    expect(canonicalize(input)).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "ab", marks: ["bold", "italic"] }] },
      ],
    });
  });

  test("is idempotent", () => {
    const json: RichTextJSON = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: ["bold"] }] }],
    };
    expect(canonicalize(canonicalize(json))).toEqual(canonicalize(json));
  });
});

describe("lossless law: read(apply(json)) == canonicalize(json)", () => {
  const corpus: Record<string, RichTextJSON> = {
    "plain paragraph": {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hello world" }] }],
    },
    "all marks": {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "b", marks: ["bold"] },
            { type: "text", text: "i", marks: ["italic"] },
            { type: "text", text: "u", marks: ["underline"] },
            { type: "text", text: "all", marks: ["bold", "italic", "underline"] },
          ],
        },
      ],
    },
    headings: {
      type: "doc",
      content: [
        { type: "heading", level: 1, content: [{ type: "text", text: "H1" }] },
        { type: "heading", level: 2, content: [{ type: "text", text: "H2", marks: ["bold"] }] },
        { type: "heading", level: 3, content: [{ type: "text", text: "H3" }] },
      ],
    },
    links: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "see " },
            { type: "text", text: "here", link: "https://x.test" },
            { type: "text", text: " now" },
          ],
        },
      ],
    },
    "bullet list": {
      type: "doc",
      content: [
        {
          type: "list",
          ordered: false,
          items: [
            { type: "listitem", content: [{ type: "text", text: "one" }] },
            { type: "listitem", content: [{ type: "text", text: "two", marks: ["bold"] }] },
          ],
        },
      ],
    },
    "ordered list with link": {
      type: "doc",
      content: [
        {
          type: "list",
          ordered: true,
          items: [
            { type: "listitem", content: [{ type: "text", text: "go", link: "https://y.test" }] },
          ],
        },
      ],
    },
    "mixed blocks": {
      type: "doc",
      content: [
        { type: "heading", level: 2, content: [{ type: "text", text: "Title" }] },
        { type: "paragraph", content: [{ type: "text", text: "body", marks: ["italic"] }] },
        {
          type: "list",
          ordered: false,
          items: [{ type: "listitem", content: [{ type: "text", text: "item" }] }],
        },
      ],
    },
  };

  for (const [name, json] of Object.entries(corpus)) {
    test(name, () => {
      expect(roundTrip(json)).toEqual(canonicalize(json));
    });
  }

  test("a non-canonical input round-trips to its canonical form", () => {
    const messy: RichTextJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "x", marks: ["italic", "bold"] },
            { type: "text", text: "y", marks: ["bold", "italic"] }, // merges with prev
          ],
        },
      ],
    };
    expect(roundTrip(messy)).toEqual(canonicalize(messy));
  });
});
