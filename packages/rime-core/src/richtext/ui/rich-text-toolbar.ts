import { type CSSResultGroup, LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import type { LexicalEditor } from "lexical";
import type { HeadingLevel } from "@nord-forge/rime-model";
import { makeCommands, type RichTextCommands } from "./rich-text-commands";
import { EMPTY_FORMAT, type FormatState, registerSelectionFormat } from "./selection-format";

export class RichTextToolbar extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      position: absolute;
      z-index: 30;
      display: none;
    }
    :host([open]) {
      display: block;
    }
    .bar {
      display: flex;
      gap: 2px;
      padding: 4px;
      background: var(--eb-color-surface, var(--eb-color-bg, #fff));
      border: 1px solid var(--eb-color-border, #e4e4e7);
      border-radius: var(--eb-radius, 8px);
      box-shadow: var(--eb-shadow-1, 0 2px 8px rgba(0, 0, 0, 0.18));
      font: var(--eb-font-ui, 14px system-ui);
    }
    button {
      min-inline-size: 28px;
      block-size: 28px;
      padding: 0 6px;
      border: 0;
      border-radius: var(--eb-radius, 6px);
      background: transparent;
      color: var(--eb-color-fg, #18181b);
      font: inherit;
      cursor: pointer;
    }
    button:hover {
      background: color-mix(in srgb, var(--eb-color-accent, #5b5bd6) 12%, transparent);
    }
    button[aria-pressed="true"] {
      background: var(--eb-color-accent, #5b5bd6);
      color: #fff;
    }
    .sep {
      inline-size: 1px;
      background: var(--eb-color-border, #e4e4e7);
      margin: 2px 2px;
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;

  @state() private format: FormatState = EMPTY_FORMAT;

  #editor: LexicalEditor | null = null;
  #commands: RichTextCommands | null = null;
  #unsub: (() => void) | null = null;

  /** Bind the toolbar to a live editor (or null to detach + hide). */
  bind(editor: LexicalEditor | null): void {
    this.#unsub?.();
    this.#unsub = null;
    this.#editor = editor;
    this.#commands = editor ? makeCommands(editor) : null;
    if (editor) {
      this.#unsub = registerSelectionFormat(editor, (state) => {
        this.format = state;
      });
    } else {
      this.format = EMPTY_FORMAT;
      this.open = false;
    }
  }

  /** Request the link popover for the current selection (host wires this up). */
  requestLink(): void {
    this.dispatchEvent(
      new CustomEvent<{ href: string | null }>("eb-request-link", {
        detail: { href: this.format.link },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** Request the token picker for the current caret (host wires this up). */
  requestToken(): void {
    this.dispatchEvent(new CustomEvent("eb-request-token", { bubbles: true, composed: true }));
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsub?.();
    this.#unsub = null;
  }

  #run(fn: (c: RichTextCommands) => void): void {
    if (this.#commands) fn(this.#commands);
    this.#editor?.focus();
  }

  #heading(level: HeadingLevel): void {
    this.#run((c) => c.setHeading(this.format.heading === level ? null : level));
  }

  override render() {
    if (!this.#editor) return nothing;
    const f = this.format;
    return html`
      <div class="bar" role="toolbar" aria-label="Text formatting">
        <button
          type="button"
          aria-label="Bold"
          aria-pressed=${f.bold}
          @click=${() => this.#run((c) => c.toggleBold())}
        >
          <b>B</b>
        </button>
        <button
          type="button"
          aria-label="Italic"
          aria-pressed=${f.italic}
          @click=${() => this.#run((c) => c.toggleItalic())}
        >
          <i>I</i>
        </button>
        <button
          type="button"
          aria-label="Underline"
          aria-pressed=${f.underline}
          @click=${() => this.#run((c) => c.toggleUnderline())}
        >
          <u>U</u>
        </button>
        <span class="sep"></span>
        <button
          type="button"
          aria-label="Heading 1"
          aria-pressed=${f.heading === 1}
          @click=${() => this.#heading(1)}
        >
          H1
        </button>
        <button
          type="button"
          aria-label="Heading 2"
          aria-pressed=${f.heading === 2}
          @click=${() => this.#heading(2)}
        >
          H2
        </button>
        <button
          type="button"
          aria-label="Heading 3"
          aria-pressed=${f.heading === 3}
          @click=${() => this.#heading(3)}
        >
          H3
        </button>
        <span class="sep"></span>
        <button
          type="button"
          aria-label="Bulleted list"
          aria-pressed=${f.list === "bullet"}
          @click=${() => this.#run((c) => c.toggleBulletList())}
        >
          •
        </button>
        <button
          type="button"
          aria-label="Numbered list"
          aria-pressed=${f.list === "ordered"}
          @click=${() => this.#run((c) => c.toggleOrderedList())}
        >
          1.
        </button>
        <span class="sep"></span>
        <button
          type="button"
          aria-label="Link"
          aria-pressed=${f.link !== null}
          @click=${() => this.requestLink()}
        >
          🔗
        </button>
        <button type="button" aria-label="Insert merge tag" @click=${() => this.requestToken()}>
          {&nbsp;}
        </button>
      </div>
    `;
  }
}

if (!customElements.get("eb-rich-text-toolbar")) {
  customElements.define("eb-rich-text-toolbar", RichTextToolbar);
}
