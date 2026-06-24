import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import {
  $createParagraphNode,
  $getRoot,
  $isElementNode,
  createEditor,
  type LexicalEditor,
} from "lexical";
import { HeadingNode, QuoteNode, registerRichText } from "@lexical/rich-text";
import { ListItemNode, ListNode, registerList } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import { $generateNodesFromDOM } from "@lexical/html";
import { mergeRegister } from "@lexical/utils";
import { normalizeHref } from "./ui/rich-text-commands";
import { $readRichTextJSON } from "./serialize/serialize";
import { ALL_FIXTURES, MALICIOUS, WORD_OUTLOOK } from "./paste-fixtures";

// The mount's link sanitizer lives in lexical-editor; replicate its transform
// here so the headless paste exercises the same boundary (mount needs a real
// iframe; this test drives the paste pipeline directly).
function registerLinkSanitizer(editor: LexicalEditor) {
  return editor.registerNodeTransform(LinkNode, (link) => {
    if (normalizeHref(link.getURL()) === null) {
      for (const child of link.getChildren()) link.insertBefore(child);
      link.remove();
    }
  });
}

const saved: Record<string, unknown> = {};
const GLOBALS = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Node",
  "Text",
  "Event",
  "MutationObserver",
  "getComputedStyle",
  "DocumentFragment",
  "DOMParser",
] as const;
let win: Window;
let editor: LexicalEditor;
let cleanup: () => void;

beforeEach(() => {
  win = new Window();
  for (const key of GLOBALS) {
    saved[key] = (globalThis as Record<string, unknown>)[key];
    (globalThis as Record<string, unknown>)[key] = (win as unknown as Record<string, unknown>)[key];
  }
  const el = win.document.createElement("div") as unknown as HTMLElement;
  el.contentEditable = "true";
  win.document.body.append(el as unknown as Node);
  editor = createEditor({
    namespace: "test",
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode],
    onError: (e) => {
      throw e;
    },
  });
  editor.setRootElement(el);
  cleanup = mergeRegister(
    registerRichText(editor),
    registerList(editor),
    registerLinkSanitizer(editor),
  );
});

afterEach(() => {
  cleanup();
  editor.setRootElement(null);
  for (const key of GLOBALS) (globalThis as Record<string, unknown>)[key] = saved[key];
});

// Simulate the paste pipeline: parse the clipboard HTML and import via the curated
// node set (exactly what $insertDataTransferForRichText does on PASTE_COMMAND).
function pasteHtml(html: string) {
  editor.update(
    () => {
      const dom = new (globalThis as { DOMParser: typeof DOMParser }).DOMParser().parseFromString(
        html,
        "text/html",
      );
      const nodes = $generateNodesFromDOM(editor, dom);
      const root = $getRoot();
      root.clear();
      // The real paste inserts at a selection inside a paragraph; here we append
      // block nodes directly and collect stray inline nodes into a paragraph (what
      // $insertDataTransferForRichText does), so Google-Docs-style inline output
      // isn't dropped.
      let para = $createParagraphNode();
      for (const node of nodes) {
        if ($isElementNode(node) && node.isInline() === false) {
          if (para.getChildrenSize() > 0) {
            root.append(para);
            para = $createParagraphNode();
          }
          root.append(node);
        } else {
          para.append(node);
        }
      }
      if (para.getChildrenSize() > 0) root.append(para);
      if (root.getChildrenSize() === 0) root.append($createParagraphNode());
    },
    { discrete: true },
  );
}

function readJSON() {
  let out = { type: "doc", content: [] as unknown[] };
  editor.getEditorState().read(() => {
    out = $readRichTextJSON() as never;
  });
  return JSON.stringify(out);
}

describe("paste sanitization", () => {
  for (const fixture of ALL_FIXTURES) {
    test(`${fixture.name}: forbidden tokens never reach the doc`, () => {
      pasteHtml(fixture.html);
      const json = readJSON();
      for (const banned of fixture.forbidden) {
        expect(json).not.toContain(banned);
      }
      expect(json).toContain(fixture.expectText);
    });
  }

  test("never produces a <table> from nested mso tables", () => {
    pasteHtml(ALL_FIXTURES.find((f) => f.name === "nested-mso-table")!.html);
    const json = readJSON();
    expect(json).not.toContain("table");
    // collapses to paragraph/list blocks only.
    expect(json).not.toContain('"type":"cell"');
  });

  test("a safe http link survives, a javascript link is unwrapped", () => {
    pasteHtml(MALICIOUS.html);
    const json = readJSON();
    expect(json).toContain("https://ok.test");
    expect(json).not.toContain("javascript:");
    // the js link's text is kept (unlinked), merged into the surrounding run.
    expect(json).toContain("js");
  });

  test("bold survives word/outlook paste as a mark", () => {
    pasteHtml(WORD_OUTLOOK.html);
    const json = readJSON();
    expect(json).toContain('"bold"');
  });
});
