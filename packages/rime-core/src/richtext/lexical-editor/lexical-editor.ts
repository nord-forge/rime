// Headless Lexical mounted on a focused TextBlock element. The curated node set
// is the sanitization boundary: unregistered DOM (mso, <font>, <script>) is
// dropped on paste. The doc <-> editor mapping lives in ./serialize.

import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  createEditor,
  type LexicalEditor,
  type TextFormatType,
} from "lexical";
import { HeadingNode, QuoteNode, registerRichText } from "@lexical/rich-text";
import { ListItemNode, ListNode, registerList } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import { mergeRegister } from "@lexical/utils";
import type { Mark, RichTextJSON } from "@nord-forge/rime-model";
import { $applyRichTextJSON, $readRichTextJSON } from "../serialize/serialize";
import { normalizeHref } from "../ui/rich-text-commands";

// Pasted links can carry javascript:/data: hrefs that the curated node set keeps
// (LinkNode.importDOM accepts any href). A node transform validates every link:
// a disallowed href is unwrapped to its plain text, so nothing dangerous can
// reach the doc.
function registerLinkSanitizer(editor: LexicalEditor): () => void {
  return editor.registerNodeTransform(LinkNode, (link) => {
    if (normalizeHref(link.getURL()) === null) {
      for (const child of link.getChildren()) link.insertBefore(child);
      link.remove();
    }
  });
}

export interface LexicalMount {
  readonly editor: LexicalEditor;
  format(mark: Mark): void;
  toJSON(): RichTextJSON;
  destroy(): void;
}

export function mountLexical(blockEl: HTMLElement, initial: RichTextJSON): LexicalMount {
  blockEl.contentEditable = "true";
  blockEl.setAttribute("role", "textbox");
  blockEl.style.outline = "none";

  const editor = createEditor({
    namespace: "rime",
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode],
    onError: (error) => {
      throw error;
    },
  });
  editor.setRootElement(blockEl);

  const cleanup = mergeRegister(
    registerRichText(editor),
    registerList(editor),
    registerLinkSanitizer(editor),
  );

  // Lexical defers updates by default; seed discretely so a sync read isn't empty.
  editor.update(() => $applyRichTextJSON(initial), { discrete: true });

  let live = true;

  return {
    editor,

    format(mark: Mark): void {
      if (!live) return;
      editor.update(
        () => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.formatText(mark as TextFormatType);
          } else {
            for (const node of $getRoot().getAllTextNodes()) node.toggleFormat(mark);
          }
        },
        { discrete: true },
      );
    },

    toJSON(): RichTextJSON {
      let out: RichTextJSON = { type: "doc", content: [] };
      editor.getEditorState().read(() => {
        out = $readRichTextJSON();
      });
      return out;
    },

    destroy(): void {
      if (!live) return;
      live = false;
      cleanup();
      editor.setRootElement(null);
      blockEl.removeAttribute("contenteditable");
      blockEl.removeAttribute("role");
    },
  };
}
