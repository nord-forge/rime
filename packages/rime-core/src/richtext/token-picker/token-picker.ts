import { type CSSResultGroup, LitElement, css, html, nothing } from "lit";
import { property, query, state } from "lit/decorators.js";
import { type TokenGroup, type TokenItem, filterAndGroup, flatten } from "./token-filter";

// Emitted when the user picks a token. The provider calls insertToken(key, label).
export interface TokenSelectDetail {
  key: string;
  label: string;
}

export type { TokenItem } from "./token-filter";

export class EbTokenPicker extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      position: absolute;
      z-index: 32;
      display: none;
    }
    :host([open]) {
      display: block;
    }
    .box {
      inline-size: 240px;
      max-block-size: 280px;
      display: flex;
      flex-direction: column;
      background: var(--eb-color-surface, var(--eb-color-bg, #fff));
      border: 1px solid var(--eb-color-border, #e4e4e7);
      border-radius: var(--eb-radius, 8px);
      box-shadow: var(--eb-shadow-1, 0 2px 8px rgba(0, 0, 0, 0.18));
      font: var(--eb-font-ui, 14px system-ui);
      overflow: hidden;
    }
    input {
      margin: 6px;
      padding: 4px 6px;
      border: 1px solid var(--eb-color-border, #e4e4e7);
      border-radius: var(--eb-radius, 6px);
      font: inherit;
      color: var(--eb-color-fg, #18181b);
      background: var(--eb-color-bg, #fff);
    }
    .list {
      overflow-y: auto;
      padding: 0 4px 4px;
    }
    .group-label {
      padding: 4px 6px 2px;
      font-size: 0.8em;
      font-weight: 600;
      color: color-mix(in srgb, var(--eb-color-fg, #18181b) 55%, transparent);
    }
    .item {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 5px 6px;
      border-radius: var(--eb-radius, 6px);
      color: var(--eb-color-fg, #18181b);
      cursor: pointer;
    }
    .item .key {
      color: color-mix(in srgb, var(--eb-color-fg, #18181b) 50%, transparent);
      font-size: 0.85em;
    }
    .item:hover,
    .item[aria-selected="true"] {
      background: color-mix(in srgb, var(--eb-color-accent, #5b5bd6) 12%, transparent);
    }
    .empty {
      padding: 10px;
      color: color-mix(in srgb, var(--eb-color-fg, #18181b) 55%, transparent);
      text-align: center;
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ attribute: false }) tokens: TokenItem[] = [];

  @state() private query = "";
  @state() private active = 0;

  @query("input") private input!: HTMLInputElement;

  /** Open the picker and focus the search field. */
  show(): void {
    this.query = "";
    this.active = 0;
    this.open = true;
    void this.updateComplete.then(() => this.input?.focus());
  }

  hide(): void {
    this.open = false;
  }

  #groups(): TokenGroup[] {
    return filterAndGroup(this.tokens, this.query);
  }

  #select(item: TokenItem): void {
    this.dispatchEvent(
      new CustomEvent<TokenSelectDetail>("eb-token-select", {
        detail: { key: item.key, label: item.label },
        bubbles: true,
        composed: true,
      }),
    );
    this.hide();
  }

  #cancel(): void {
    this.hide();
    this.dispatchEvent(new CustomEvent("eb-token-cancel", { bubbles: true, composed: true }));
  }

  #onKeydown(e: KeyboardEvent): void {
    const flat = flatten(this.#groups());
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.active = flat.length === 0 ? 0 : (this.active + 1) % flat.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.active = flat.length === 0 ? 0 : (this.active - 1 + flat.length) % flat.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[this.active];
      if (item) this.#select(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.#cancel();
    }
  }

  override render() {
    const groups = this.#groups();
    const flat = flatten(groups);
    if (this.active >= flat.length) this.active = Math.max(0, flat.length - 1);
    let index = -1;
    return html`
      <div class="box" role="dialog" aria-label="Insert merge tag">
        <input
          type="text"
          placeholder="Search tokens…"
          aria-label="Search tokens"
          role="combobox"
          aria-expanded="true"
          .value=${this.query}
          @input=${(e: Event) => {
            this.query = (e.target as HTMLInputElement).value;
            this.active = 0;
          }}
          @keydown=${(e: KeyboardEvent) => this.#onKeydown(e)}
        />
        <div class="list" role="listbox">
          ${this.tokens.length === 0
            ? html`<div class="empty">No tokens available</div>`
            : flat.length === 0
              ? html`<div class="empty">No matches</div>`
              : groups.map(
                  (group) => html`
                    ${group.source !== ""
                      ? html`<div class="group-label">${group.source}</div>`
                      : nothing}
                    ${group.items.map((item) => {
                      index += 1;
                      const i = index;
                      return html`
                        <div
                          class="item"
                          role="option"
                          aria-selected=${i === this.active}
                          @mousedown=${(e: Event) => {
                            // mousedown (not click) so the editor's blur doesn't fire first.
                            e.preventDefault();
                            this.#select(item);
                          }}
                          @mousemove=${() => {
                            this.active = i;
                          }}
                        >
                          <span>${item.label}</span>
                          <span class="key">${item.key}</span>
                        </div>
                      `;
                    })}
                  `,
                )}
        </div>
      </div>
    `;
  }
}

if (!customElements.get("eb-token-picker")) {
  customElements.define("eb-token-picker", EbTokenPicker);
}
