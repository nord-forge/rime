import { type CSSResultGroup, LitElement, css, html } from "lit";
import { property, query, state } from "lit/decorators.js";
import { normalizeHref } from "./rich-text-commands";

// Emitted on apply/remove. `href: null` removes the link.
export interface LinkApplyDetail {
  href: string | null;
}

export class LinkPopover extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      position: absolute;
      z-index: 31;
      display: none;
    }
    :host([open]) {
      display: block;
    }
    .box {
      display: flex;
      gap: 4px;
      align-items: center;
      padding: 6px;
      background: var(--eb-color-surface, var(--eb-color-bg, #fff));
      border: 1px solid var(--eb-color-border, #e4e4e7);
      border-radius: var(--eb-radius, 8px);
      box-shadow: var(--eb-shadow-1, 0 2px 8px rgba(0, 0, 0, 0.18));
      font: var(--eb-font-ui, 14px system-ui);
    }
    input {
      inline-size: 220px;
      padding: 4px 6px;
      border: 1px solid var(--eb-color-border, #e4e4e7);
      border-radius: var(--eb-radius, 6px);
      font: inherit;
      color: var(--eb-color-fg, #18181b);
      background: var(--eb-color-bg, #fff);
    }
    input[aria-invalid="true"] {
      border-color: #dc2626;
    }
    button {
      block-size: 28px;
      padding: 0 10px;
      border: 0;
      border-radius: var(--eb-radius, 6px);
      font: inherit;
      cursor: pointer;
    }
    .apply {
      background: var(--eb-color-accent, #5b5bd6);
      color: #fff;
    }
    .remove {
      background: transparent;
      color: var(--eb-color-fg, #18181b);
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) href = "";

  @state() private value = "";
  @state() private invalid = false;

  @query("input") private input!: HTMLInputElement;

  /** Open the popover, pre-filled with the current href. */
  show(current: string | null): void {
    this.value = current ?? "";
    this.invalid = false;
    this.open = true;
    void this.updateComplete.then(() => this.input?.focus());
  }

  hide(): void {
    this.open = false;
    this.invalid = false;
  }

  #apply(): void {
    const normalized = normalizeHref(this.value);
    if (normalized === null) {
      this.invalid = true;
      return;
    }
    this.#emit(normalized);
    this.hide();
  }

  #remove(): void {
    this.#emit(null);
    this.hide();
  }

  #emit(href: string | null): void {
    this.dispatchEvent(
      new CustomEvent<LinkApplyDetail>("eb-link-apply", {
        detail: { href },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #onKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      this.#apply();
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.hide();
      this.dispatchEvent(new CustomEvent("eb-link-cancel", { bubbles: true, composed: true }));
    }
  }

  override render() {
    return html`
      <div class="box">
        <input
          type="text"
          inputmode="url"
          placeholder="https://…"
          aria-label="Link URL"
          aria-invalid=${this.invalid}
          .value=${this.value}
          @input=${(e: Event) => {
            this.value = (e.target as HTMLInputElement).value;
            this.invalid = false;
          }}
          @keydown=${(e: KeyboardEvent) => this.#onKeydown(e)}
        />
        <button type="button" class="apply" @click=${() => this.#apply()}>Apply</button>
        <button type="button" class="remove" @click=${() => this.#remove()}>Remove</button>
      </div>
    `;
  }
}

if (!customElements.get("eb-link-popover")) {
  customElements.define("eb-link-popover", LinkPopover);
}
