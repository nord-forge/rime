import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { createEditor, FORMAT_TEXT_COMMAND, type LexicalEditor } from "lexical";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import { makeCommands, normalizeHref } from "./rich-text-commands";

describe("normalizeHref", () => {
  test("keeps http(s) and mailto", () => {
    expect(normalizeHref("https://x.test")).toBe("https://x.test/");
    expect(normalizeHref("http://x.test/path")).toBe("http://x.test/path");
    expect(normalizeHref("mailto:a@b.test")).toBe("mailto:a@b.test");
  });

  test("adds https:// to a bare domain", () => {
    expect(normalizeHref("example.com")).toBe("https://example.com/");
  });

  test("rejects dangerous and unparseable schemes", () => {
    expect(normalizeHref("javascript:alert(1)")).toBeNull();
    expect(normalizeHref("data:text/html,x")).toBeNull();
    expect(normalizeHref("vbscript:msgbox")).toBeNull();
    expect(normalizeHref("  ")).toBeNull();
  });
});

// Selection-dependent effects (heading/list/link rendered output) require a real
// browser selection and are covered by the e2e. Here we assert the facade routes
// bold/italic/underline to FORMAT_TEXT_COMMAND with the right argument.
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

describe("makeCommands format dispatch", () => {
  test("bold/italic/underline dispatch FORMAT_TEXT_COMMAND with the format", () => {
    const calls: Array<[unknown, unknown]> = [];
    editor.dispatchCommand = mock((command: unknown, payload: unknown) => {
      calls.push([command, payload]);
      return true;
    }) as typeof editor.dispatchCommand;

    const cmds = makeCommands(editor);
    cmds.toggleBold();
    cmds.toggleItalic();
    cmds.toggleUnderline();

    expect(calls).toEqual([
      [FORMAT_TEXT_COMMAND, "bold"],
      [FORMAT_TEXT_COMMAND, "italic"],
      [FORMAT_TEXT_COMMAND, "underline"],
    ]);
  });
});
