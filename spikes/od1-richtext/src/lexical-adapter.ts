import {
  createEditor,
  type LexicalEditor,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $createTextNode,
  TextNode,
} from 'lexical';
import { HeadingNode, QuoteNode, registerRichText } from '@lexical/rich-text';
import { mergeRegister } from '@lexical/utils';
import type { EngineAdapter, RichTextJSON } from './adapter';

// v2 adapter: wires registerRichText so the paste/clipboard command pipeline
// exists (PASTE_COMMAND → $insertDataTransferForRichText → @lexical/html
// $generateNodesFromDOM). Sanitization comes from the CURATED node set: only
// para/text/heading/quote are registered, so unknown DOM (mso, <font>, <script>)
// is dropped on import — Lexical's analogue of ProseMirror's strict schema.

export class LexicalAdapter implements EngineAdapter {
  readonly name = 'lexical';
  private editor: LexicalEditor | null = null;
  private rootEl: HTMLElement | null = null;
  private cleanup: (() => void) | null = null;

  create(mount: HTMLElement, initial: RichTextJSON): void {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    editable.setAttribute('role', 'textbox');
    editable.style.outline = 'none';
    mount.appendChild(editable);
    this.rootEl = editable;

    const editor = createEditor({
      namespace: 'enveloppe-spike',
      // Curated node set = the sanitization boundary.
      nodes: [HeadingNode, QuoteNode],
      onError: (e) => {
        throw e;
      },
    });
    editor.setRootElement(editable);

    // THE FIX: install rich-text command handlers, incl. PASTE_COMMAND.
    this.cleanup = mergeRegister(registerRichText(editor));

    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        for (const p of initial.content) {
          const para = $createParagraphNode();
          for (const t of p.content ?? []) {
            const node = $createTextNode(t.text);
            for (const m of t.marks ?? []) node.toggleFormat(m);
            para.append(node);
          }
          root.append(para);
        }
      },
      { discrete: true },
    );

    this.editor = editor;
  }

  exec(cmd: 'bold' | 'italic' | 'underline'): void {
    this.editor?.update(
      () => {
        const sel = $getSelection();
        if ($isRangeSelection(sel)) sel.formatText(cmd);
        else $getRoot().getAllTextNodes().forEach((n) => n.toggleFormat(cmd));
      },
      { discrete: true },
    );
  }

  toJSON(): RichTextJSON {
    if (!this.editor) return { type: 'doc', content: [] };
    let out: RichTextJSON = { type: 'doc', content: [] };
    this.editor.getEditorState().read(() => {
      const root = $getRoot();
      out = {
        type: 'doc',
        content: root.getChildren().map((para) => ({
          type: 'paragraph' as const,
          content: (para as unknown as { getChildren?: () => TextNode[] })
            .getChildren?.()
            ?.filter((c) => c instanceof TextNode)
            .map((c) => {
              const marks: Array<'bold' | 'italic' | 'underline'> = [];
              if (c.hasFormat('bold')) marks.push('bold');
              if (c.hasFormat('italic')) marks.push('italic');
              if (c.hasFormat('underline')) marks.push('underline');
              return { type: 'text' as const, text: c.getTextContent(), marks };
            }) ?? [],
        })),
      };
    });
    return out;
  }

  destroy(): void {
    this.cleanup?.();
    this.editor?.setRootElement(null);
    this.rootEl?.remove();
    this.cleanup = null;
    this.editor = null;
    this.rootEl = null;
  }
}
