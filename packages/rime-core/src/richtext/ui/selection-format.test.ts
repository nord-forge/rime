import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { $createParagraphNode, $getRoot, createEditor, type LexicalEditor } from "lexical";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import { $readFormatState, EMPTY_FORMAT, registerSelectionFormat } from "./selection-format";

// Live-selection format derivation needs a real browser selection (covered by the
// e2e). Here we verify the no-selection default and that the subscription fires.
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

describe("selection format", () => {
  test("reads the empty format when there is no range selection", () => {
    let state = EMPTY_FORMAT;
    editor.getEditorState().read(() => {
      state = $readFormatState();
    });
    expect(state).toEqual(EMPTY_FORMAT);
  });

  test("registerSelectionFormat notifies on update and unsubscribes", () => {
    const states: number[] = [];
    const unsub = registerSelectionFormat(editor, () => states.push(1));
    editor.update(() => $getRoot().append($createParagraphNode()), { discrete: true });
    const afterFirst = states.length;
    unsub();
    editor.update(() => $getRoot().append($createParagraphNode()), { discrete: true });
    expect(afterFirst).toBeGreaterThan(0);
    expect(states.length).toBe(afterFirst);
  });
});
