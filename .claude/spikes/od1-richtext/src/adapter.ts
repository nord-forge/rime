// Shared contract both engines must satisfy, mirroring how @nord-forge/rime-core
// will use the engine: mount on a plain node inside the iframe canvas,
// edit one block, serialize to/from the doc-model JSON, then destroy.
//
// The doc-model text representation we round-trip against is a minimal
// portable JSON shape (a stand-in for ENV-10's TextBlock content).

export interface RichTextJSON {
  // A normalized, engine-independent representation of inline rich text.
  // Marks limited to the v1 set we care about.
  type: 'doc';
  content: Array<{
    type: 'paragraph';
    content?: Array<{
      type: 'text';
      text: string;
      marks?: Array<'bold' | 'italic' | 'underline'>;
    }>;
  }>;
}

export interface EngineAdapter {
  readonly name: string;
  /** Mount an editor on `mount`, seeded from `initial`. */
  create(mount: HTMLElement, initial: RichTextJSON): void;
  /** Apply a formatting command (used by Playwright + manual tests). */
  exec(cmd: 'bold' | 'italic' | 'underline'): void;
  /** Serialize current content to the portable JSON shape. */
  toJSON(): RichTextJSON;
  /** Destroy + release all resources (one-instance lifecycle). */
  destroy(): void;
}

export const EMPTY_DOC: RichTextJSON = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Edit me' }] }],
};
