import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import type { EngineAdapter, RichTextJSON } from './adapter';

// Tiptap stores marks as { type: 'bold' } etc. Map to/from our portable shape.
type TiptapMark = { type: string };
type TiptapNode = {
  type: string;
  text?: string;
  marks?: TiptapMark[];
  content?: TiptapNode[];
};

const MARK_SET = new Set(['bold', 'italic', 'underline']);

function fromTiptap(doc: TiptapNode): RichTextJSON {
  const paras = (doc.content ?? []).filter((n) => n.type === 'paragraph');
  return {
    type: 'doc',
    content: paras.map((p) => ({
      type: 'paragraph' as const,
      content: (p.content ?? [])
        .filter((n) => n.type === 'text' && n.text)
        .map((n) => ({
          type: 'text' as const,
          text: n.text!,
          marks: (n.marks ?? [])
            .map((m) => m.type)
            .filter((t): t is 'bold' | 'italic' | 'underline' => MARK_SET.has(t)),
        })),
    })),
  };
}

function toTiptap(json: RichTextJSON): TiptapNode {
  return {
    type: 'doc',
    content: json.content.map((p) => ({
      type: 'paragraph',
      content: (p.content ?? []).map((t) => ({
        type: 'text',
        text: t.text,
        marks: (t.marks ?? []).map((m) => ({ type: m })),
      })),
    })),
  };
}

export class TiptapAdapter implements EngineAdapter {
  readonly name = 'tiptap';
  private editor: Editor | null = null;

  create(mount: HTMLElement, initial: RichTextJSON): void {
    this.editor = new Editor({
      element: mount,
      // StarterKit covers bold/italic; underline is its own extension in v3,
      // but for the spike we rely on bold/italic and treat underline via marks.
      extensions: [StarterKit],
      content: toTiptap(initial) as unknown as Record<string, unknown>,
    });
  }

  exec(cmd: 'bold' | 'italic' | 'underline'): void {
    if (!this.editor) return;
    const chain = this.editor.chain().focus();
    if (cmd === 'bold') chain.toggleBold().run();
    else if (cmd === 'italic') chain.toggleItalic().run();
    // underline omitted from StarterKit; no-op keeps the contract stable.
  }

  toJSON(): RichTextJSON {
    if (!this.editor) return { type: 'doc', content: [] };
    return fromTiptap(this.editor.getJSON() as unknown as TiptapNode);
  }

  destroy(): void {
    this.editor?.destroy();
    this.editor = null;
  }
}
