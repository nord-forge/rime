// <rime-palette> — the left-hand chrome region (§6.5). Data-driven from the block +
// preset registries: every registered block/preset contributes an entry, so custom
// blocks appear automatically. Each item is BOTH a pointer-drag source (the editor
// registers it via registerPaletteItem → the canvas DnD) AND keyboard-operable
// (Enter/Space emits rime-palette-add for a11y parity — drag is not the only way to
// add). Chrome: Shadow DOM, themed by --rime-*.

import { type CSSResultGroup, LitElement, css, html } from "lit";
import { property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { type PaletteGroup, paletteEntries } from "./palette-entries";

export interface PaletteAddDetail {
  // Block type or preset id — the editor's createBlock resolves either.
  id: string;
}

export class RimePalette extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      display: block;
      block-size: 100%;
      overflow-y: auto;
      background: var(--rime-color-surface, var(--rime-color-bg, #fff));
      color: var(--rime-color-fg, #18181b);
      font: var(--rime-font-ui, 14px system-ui);
    }
    .group {
      border-block-end: 1px solid var(--rime-color-border, #e4e4e7);
      padding: 12px;
    }
    .group > h3 {
      margin: 0 0 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.6;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
    }
    .item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 10px 6px;
      border: 1px solid var(--rime-color-border, #e4e4e7);
      border-radius: var(--rime-radius, 8px);
      background: var(--rime-color-bg, #fff);
      color: inherit;
      font: inherit;
      cursor: grab;
      text-align: center;
      touch-action: none;
    }
    .item:hover,
    .item:focus-visible {
      border-color: var(--rime-color-accent, #5b5bd6);
      outline: none;
    }
    .item .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      block-size: 22px;
      color: var(--rime-color-fg, #18181b);
    }
    .item .icon svg {
      display: block;
    }
    .item .label {
      font-size: 12px;
    }
  `;

  @property({ attribute: false }) enabledBlocks?: string[];

  /** The rendered item elements, keyed by block-type / preset id. The editor reads
   *  these after each render to register them as canvas drag sources. */
  get items(): HTMLElement[] {
    return Array.from(this.renderRoot.querySelectorAll<HTMLElement>(".item"));
  }

  #groups(): PaletteGroup[] {
    return paletteEntries({ enabledBlocks: this.enabledBlocks });
  }

  #add(id: string): void {
    this.dispatchEvent(
      new CustomEvent<PaletteAddDetail>("rime-palette-add", {
        detail: { id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render() {
    return html`
      ${this.#groups().map(
        (group) => html`
          <div class="group">
            <h3>${group.category}</h3>
            <div class="grid">
              ${group.items.map(
                (item) => html`
                  <button
                    type="button"
                    class="item"
                    data-block-type=${item.id}
                    title=${item.label}
                    @keydown=${(e: KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        this.#add(item.id);
                      }
                    }}
                  >
                    <span class="icon" aria-hidden="true">${unsafeHTML(item.icon)}</span>
                    <span class="label">${item.label}</span>
                  </button>
                `,
              )}
            </div>
          </div>
        `,
      )}
    `;
  }
}

if (!customElements.get("rime-palette")) {
  customElements.define("rime-palette", RimePalette);
}

declare global {
  interface HTMLElementTagNameMap {
    "rime-palette": RimePalette;
  }
}
