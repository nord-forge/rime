import { createEditor, type LexicalEditor, $getRoot, $createParagraphNode } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { $createTextNode, TextNode } from 'lexical';
import type { EngineAdapter, RichTextJSON } from './adapter';

// Lexical: build editor manually (no React), register nodes, mount on a
// contenteditable child we create inside `mount`.

const FORMAT_BIT = { bold: 1, italic: 1 << 1, underline: 1 << 3 } as const;

export class LexicalAdapter implements EngineAdapter {
  readonly name = 'lexical';
  private editor: LexicalEditor | null = null;
  private rootEl: HTMLElement | null = null;

  create(mount: HTMLElement, initial: RichTextJSON): void {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    editable.setAttribute('role', 'textbox');
    editable.style.outline = 'none';
    mount.appendChild(editable);
    this.rootEl = editable;

    const editor = createEditor({
      namespace: 'enveloppe-spike',
      nodes: [HeadingNode, QuoteNode],
      onError: (e) => {
        throw e;
      },
    });
    editor.setRootElement(editable);

    // discrete + no-history tag forces synchronous-ish reconciliation so a
    // read immediately after seeding returns content. This extra ceremony is
    // itself a finding: Lexical's deferred update model needs careful handling.
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
    // Format toggling on selection requires @lexical/selection in real use;
    // for the spike we toggle on all text nodes to keep the contract simple.
    this.editor?.update(() => {
      const root = $getRoot();
      root.getAllTextNodes().forEach((n) => n.toggleFormat(cmd));
    });
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
    this.editor?.setRootElement(null);
    this.rootEl?.remove();
    this.editor = null;
    this.rootEl = null;
  }
}

// Reference the bit map so tree-shaking keeps parity with real usage.
void FORMAT_BIT;
