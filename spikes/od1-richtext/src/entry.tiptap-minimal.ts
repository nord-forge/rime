import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import { CanvasHost } from './canvas-host';
import type { EngineAdapter, RichTextJSON } from './adapter';

// Absolute floor: the minimum extensions a Tiptap editor can run with + 2 marks.
// Isolates the ProseMirror (@tiptap/pm) base cost that no trimming removes.
class MinimalAdapter implements EngineAdapter {
  readonly name = 'tiptap-minimal';
  private editor: Editor | null = null;
  create(mount: HTMLElement, initial: RichTextJSON): void {
    this.editor = new Editor({
      element: mount,
      extensions: [Document, Paragraph, Text, Bold, Italic],
      content: {
        type: 'doc',
        content: initial.content.map((p) => ({
          type: 'paragraph',
          content: (p.content ?? []).map((t) => ({ type: 'text', text: t.text })),
        })),
      } as unknown as Record<string, unknown>,
    });
  }
  exec(cmd: 'bold' | 'italic' | 'underline'): void {
    if (cmd === 'underline') return;
    this.editor?.chain().focus()[cmd === 'bold' ? 'toggleBold' : 'toggleItalic']().run();
  }
  toJSON(): RichTextJSON {
    return (this.editor?.getJSON() as unknown as RichTextJSON) ?? { type: 'doc', content: [] };
  }
  destroy(): void {
    this.editor?.destroy();
    this.editor = null;
  }
}

class MinimalHost extends CanvasHost {
  constructor() {
    super(() => new MinimalAdapter());
  }
}
customElements.define('spike-tiptap-minimal', MinimalHost);
