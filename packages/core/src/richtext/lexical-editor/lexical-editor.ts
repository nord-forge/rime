// Headless Lexical mounted directly on a focused TextBlock element inside the
// iframe canvas (PRD §6.7). The editor is used headless — no Lexical-shipped UI
// or theme CSS is imported; the visible toolbar/bubble menu is 100% custom (a
// later ticket). The doc model stays engine-free: text is stored as the portable
// RichTextJSON; this adapter is the only place that knows about Lexical.
//
// Sanitization boundary = the CURATED node set. Only paragraph/text (built-in)
// plus heading/quote are registered, so unknown imported DOM (mso, <font>,
// <script>) is dropped on paste — Lexical's analogue of a strict schema. The
// paste pipeline is installed by registerRichText (PASTE_COMMAND →
// $insertDataTransferForRichText → $generateNodesFromDOM).

import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  createEditor,
  type LexicalEditor,
  type TextFormatType,
} from "lexical";
import { HeadingNode, QuoteNode, registerRichText } from "@lexical/rich-text";
import { mergeRegister } from "@lexical/utils";
import type { Mark, RichTextJSON } from "@nord-forge/rime-model";

/** The inline marks this engine round-trips. Each is a Lexical text format. */
const MARKS: readonly Mark[] = ["bold", "italic", "underline"] as const;

/** A live headless Lexical editor bound to one TextBlock element. */
export interface LexicalMount {
  /** The underlying Lexical editor (for command dispatch in later tickets). */
  readonly editor: LexicalEditor;
  /** Apply/toggle an inline mark over the current selection (or all text). */
  format(mark: Mark): void;
  /** Read the editor state into the portable, engine-free RichTextJSON shape. */
  toJSON(): RichTextJSON;
  /** Tear down: uninstall handlers, unbind the root element, release refs. */
  destroy(): void;
}

/**
 * Mount a headless Lexical editor onto an existing TextBlock element inside the
 * iframe, seeded synchronously from `initial`. The element is made editable in
 * place — the editor edits the very node the canvas renderer painted.
 *
 * Lexical is deferred by default, so the seed runs as a `{ discrete: true }`
 * update; a naive synchronous read otherwise returns empty.
 */
export function mountLexical(blockEl: HTMLElement, initial: RichTextJSON): LexicalMount {
  blockEl.contentEditable = "true";
  blockEl.setAttribute("role", "textbox");
  blockEl.style.outline = "none";

  const editor = createEditor({
    namespace: "rime",
    // Curated node set = the sanitization boundary. Built-in Paragraph/Text are
    // always available; add nodes only as UI features require them.
    nodes: [HeadingNode, QuoteNode],
    onError: (error) => {
      throw error;
    },
  });
  editor.setRootElement(blockEl);

  // Install the rich-text command handlers, including the paste pipeline.
  const cleanup = mergeRegister(registerRichText(editor));

  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      for (const paragraph of initial.content) {
        const para = $createParagraphNode();
        for (const run of paragraph.content ?? []) {
          const node = $createTextNode(run.text);
          for (const mark of run.marks ?? []) node.toggleFormat(mark);
          para.append(node);
        }
        root.append(para);
      }
    },
    { discrete: true },
  );

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
            // No range selection (e.g. programmatic seed): toggle every run.
            for (const node of $getRoot().getAllTextNodes()) node.toggleFormat(mark);
          }
        },
        { discrete: true },
      );
    },

    toJSON(): RichTextJSON {
      const out: RichTextJSON = { type: "doc", content: [] };
      editor.getEditorState().read(() => {
        for (const block of $getRoot().getChildren()) {
          if (!$isElementNode(block)) continue;
          out.content.push({
            type: "paragraph",
            content: block.getChildren().flatMap((child) => {
              if (!$isTextNode(child)) return [];
              const marks = MARKS.filter((m) => child.hasFormat(m as TextFormatType));
              return [
                marks.length > 0
                  ? { type: "text" as const, text: child.getTextContent(), marks }
                  : { type: "text" as const, text: child.getTextContent() },
              ];
            }),
          });
        }
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
