import { $getSelection, $isRangeSelection, type LexicalEditor, type TextFormatType } from "lexical";
import { $isHeadingNode } from "@lexical/rich-text";
import { $isListNode, ListNode } from "@lexical/list";
import { $isLinkNode, LinkNode } from "@lexical/link";
import { $getNearestNodeOfType } from "@lexical/utils";
import type { HeadingLevel } from "@nord-forge/rime-model";

export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  list: "bullet" | "ordered" | null;
  heading: HeadingLevel | null;
  link: string | null;
}

export const EMPTY_FORMAT: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  list: null,
  heading: null,
  link: null,
};

export function $readFormatState(): FormatState {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return EMPTY_FORMAT;

  const node = selection.anchor.getNode();
  const block = node.getTopLevelElementOrThrow();

  let heading: HeadingLevel | null = null;
  if ($isHeadingNode(block)) {
    const level = Number(block.getTag().slice(1));
    heading = (level <= 3 ? level : 3) as HeadingLevel;
  }

  let list: "bullet" | "ordered" | null = null;
  const listNode = $getNearestNodeOfType(node, ListNode);
  if (listNode && $isListNode(listNode)) {
    list = listNode.getListType() === "number" ? "ordered" : "bullet";
  }

  const linkNode = $getNearestNodeOfType(node, LinkNode);
  const link = linkNode && $isLinkNode(linkNode) ? linkNode.getURL() : null;

  return {
    bold: selection.hasFormat("bold" as TextFormatType),
    italic: selection.hasFormat("italic" as TextFormatType),
    underline: selection.hasFormat("underline" as TextFormatType),
    list,
    heading,
    link,
  };
}

// Recompute the FormatState on every editor update and notify. Returns an
// unsubscribe function.
export function registerSelectionFormat(
  editor: LexicalEditor,
  onChange: (state: FormatState) => void,
): () => void {
  return editor.registerUpdateListener(({ editorState }) => {
    editorState.read(() => onChange($readFormatState()));
  });
}
