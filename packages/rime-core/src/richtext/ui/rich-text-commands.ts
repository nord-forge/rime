import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  type LexicalEditor,
} from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode } from "@lexical/rich-text";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { $getNearestNodeOfType } from "@lexical/utils";
import { $toggleLink } from "@lexical/link";
import type { HeadingLevel } from "@nord-forge/rime-model";

export interface RichTextCommands {
  toggleBold(): void;
  toggleItalic(): void;
  toggleUnderline(): void;
  toggleBulletList(): void;
  toggleOrderedList(): void;
  setHeading(level: HeadingLevel | null): void;
  setLink(href: string | null): void;
}

// Allow only http(s) and mailto; reject javascript:/data: and anything unparseable.
// Returns the normalized href, or null to indicate "do not apply".
export function normalizeHref(raw: string): string | null {
  const value = raw.trim();
  if (value === "") return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  const scheme = url.protocol.toLowerCase();
  if (scheme !== "http:" && scheme !== "https:" && scheme !== "mailto:") return null;
  return url.href;
}

function listKind(editor: LexicalEditor): "bullet" | "ordered" | null {
  let kind: "bullet" | "ordered" | null = null;
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const node = selection.anchor.getNode();
    const list = $getNearestNodeOfType(node, ListNode);
    if (list) kind = list.getListType() === "number" ? "ordered" : "bullet";
  });
  return kind;
}

export function makeCommands(editor: LexicalEditor): RichTextCommands {
  return {
    toggleBold: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"),
    toggleItalic: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic"),
    toggleUnderline: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline"),

    toggleBulletList: () => {
      const cmd =
        listKind(editor) === "bullet" ? REMOVE_LIST_COMMAND : INSERT_UNORDERED_LIST_COMMAND;
      editor.dispatchCommand(cmd, undefined);
    },
    toggleOrderedList: () => {
      const cmd =
        listKind(editor) === "ordered" ? REMOVE_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND;
      editor.dispatchCommand(cmd, undefined);
    },

    setHeading: (level) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        $setBlocksType(selection, () =>
          level === null ? $createParagraphNode() : $createHeadingNode(`h${level}`),
        );
      });
    },

    setLink: (href) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) $toggleLink(href);
      });
    },
  };
}

export function isListSelected(editor: LexicalEditor): "bullet" | "ordered" | null {
  return listKind(editor);
}
