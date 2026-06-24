import { LitElement, html, css } from 'lit';
import type { EngineAdapter } from './adapter';
import { EMPTY_DOC } from './adapter';

// Reproduces the real canvas condition: a Lit web component whose shadow root
// hosts a same-origin srcdoc iframe; the engine mounts on a plain node INSIDE
// the iframe document. Exercises the one-instance lifecycle (mount on focus,
// destroy on blur) that caps memory in @nord-forge/rime-core.

export class CanvasHost extends LitElement {
  static styles = css`
    :host { display: block; font: 14px system-ui; }
    iframe { width: 100%; height: 220px; border: 1px solid var(--eb-border, #d4d4d8); border-radius: var(--eb-radius, 8px); }
    .bar { display: flex; gap: 6px; margin-bottom: 8px; }
    button { font: inherit; padding: 4px 10px; border-radius: 6px; border: 1px solid #d4d4d8; background: #fff; cursor: pointer; }
  `;

  private adapter: EngineAdapter | null = null;
  private makeAdapter: () => EngineAdapter;

  constructor(makeAdapter: () => EngineAdapter) {
    super();
    this.makeAdapter = makeAdapter;
  }

  render() {
    return html`
      <div class="bar">
        <button @click=${() => this.adapter?.exec('bold')} data-cmd="bold"><b>B</b></button>
        <button @click=${() => this.adapter?.exec('italic')} data-cmd="italic"><i>I</i></button>
        <button @click=${() => this.dump()} data-act="dump">Dump JSON</button>
      </div>
      <iframe part="canvas"></iframe>
      <pre data-out style="max-height:120px;overflow:auto;background:#fafafa;padding:8px"></pre>
    `;
  }

  firstUpdated() {
    const iframe = this.renderRoot.querySelector('iframe')!;
    // same-origin srcdoc — the canvas condition.
    iframe.srcdoc = '<!doctype html><html><body style="margin:0;padding:12px;font:15px system-ui"><div id="mount"></div></body></html>';
    iframe.addEventListener('load', () => {
      const doc = iframe.contentDocument!;
      const mount = doc.getElementById('mount') as HTMLElement;
      // create on focus, destroy on blur — single live instance.
      mount.addEventListener('focusin', () => this.ensureMounted(mount), { once: false });
      // seed immediately for the spike so there's content to measure.
      this.ensureMounted(mount);
      // Test bridge for Playwright: drive the engine + read JSON without UI deps.
      (window as unknown as { __spike?: unknown }).__spike = {
        engine: this.adapter!.name,
        mount,
        iframe,
        exec: (c: 'bold' | 'italic' | 'underline') => this.adapter!.exec(c),
        toJSON: () => this.adapter!.toJSON(),
        // Round-trip a known doc through create→toJSON to test fidelity.
        roundTrip: (doc: unknown) => {
          this.adapter!.destroy();
          this.adapter = this.makeAdapter();
          this.adapter.create(mount, doc as never);
          (window as unknown as { __spike: { exec: unknown; toJSON: unknown } }).__spike.exec =
            (c: 'bold' | 'italic' | 'underline') => this.adapter!.exec(c);
          (window as unknown as { __spike: { toJSON: () => unknown } }).__spike.toJSON = () =>
            this.adapter!.toJSON();
          return this.adapter.toJSON();
        },
        // Simulate paste by writing HTML into the editable + dispatching paste.
        pasteHTML: (htmlStr: string) => {
          const editable = mount.querySelector('[contenteditable], .ProseMirror') as HTMLElement
            ?? (mount.firstElementChild as HTMLElement);
          editable?.focus();
          // Place a collapsed selection at the end so the paste handler has a
          // range selection to insert into (Lexical requires one).
          const doc = editable.ownerDocument;
          const sel = doc.getSelection();
          const range = doc.createRange();
          range.selectNodeContents(editable);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
          const dt = new DataTransfer();
          dt.setData('text/html', htmlStr);
          dt.setData('text/plain', 'Pasted bold junk');
          editable?.dispatchEvent(
            new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
          );
        },
      };
    });
  }

  private ensureMounted(mount: HTMLElement) {
    if (this.adapter) return;
    this.adapter = this.makeAdapter();
    this.adapter.create(mount, EMPTY_DOC);
  }

  private dump() {
    const out = this.renderRoot.querySelector('[data-out]')!;
    out.textContent = JSON.stringify(this.adapter?.toJSON(), null, 2);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.adapter?.destroy();
    this.adapter = null;
  }
}
