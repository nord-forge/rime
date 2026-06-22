import { Editor } from '@tiptap/core';
// Curated v1 extension set — only what email rich text needs, imported
// individually so the bundle excludes StarterKit's code/codeBlock/strike/
// blockquote/horizontalRule/dropcursor/gapcursor we don't ship.
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Heading from '@tiptap/extension-heading';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import History from '@tiptap/extension-history';
import type { EngineAdapter, RichTextJSON } from './adapter';

type TiptapMark = { type: string };
type TiptapNode = { type: string; text?: string; marks?: TiptapMark[]; content?: TiptapNode[] };
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

export class TiptapCuratedAdapter implements EngineAdapter {
  readonly name = 'tiptap-curated';
  private editor: Editor | null = null;

  create(mount: HTMLElement, initial: RichTextJSON): void {
    this.editor = new Editor({
      element: mount,
      extensions: [
        Document,
        Paragraph,
        Text,
        Bold,
        Italic,
        Underline,
        Link.configure({ openOnClick: false }),
        Heading.configure({ levels: [1, 2, 3] }),
        BulletList,
        OrderedList,
        ListItem,
        History,
      ],
      content: toTiptap(initial) as unknown as Record<string, unknown>,
    });
  }

  exec(cmd: 'bold' | 'italic' | 'underline'): void {
    if (!this.editor) return;
    const chain = this.editor.chain().focus();
    if (cmd === 'bold') chain.toggleBold().run();
    else if (cmd === 'italic') chain.toggleItalic().run();
    else chain.toggleUnderline().run();
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
