// <eb-move-to-menu> — a keyboard-operable popover listing valid destinations for
// the selected block (the non-pointer way to reorder). Themed via
// --eb-* tokens. Emits an `eb-move-select` event with the chosen DropTarget; the
// editor applies it through the same moveNode op as keyboard/pointer moves.

import { type CSSResultGroup, LitElement, css, html } from "lit";
import { property, state } from "lit/decorators.js";
import { isSection } from "@nord-forge/rime-model";
import type { DropTarget } from "../dnd-types/dnd-types";

/** A selectable destination shown in the menu. */
export interface MoveDestination {
  label: string;
  target: DropTarget;
}

export class MoveToMenu extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      display: block;
      background: var(--eb-color-bg, #fff);
      color: var(--eb-color-fg, #18181b);
      border: 1px solid var(--eb-color-border, #e4e4e7);
      border-radius: var(--eb-radius, 8px);
      box-shadow: var(--eb-shadow-1, 0 2px 8px rgba(0, 0, 0, 0.18));
      font: var(--eb-font-ui, 14px system-ui);
      padding: 4px;
      min-inline-size: 180px;
    }
    button {
      display: block;
      inline-size: 100%;
      text-align: start;
      padding: 6px 10px;
      border: 0;
      border-radius: var(--eb-radius, 6px);
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    button:hover,
    button:focus-visible {
      background: var(--eb-color-accent, #5b5bd6);
      color: #fff;
      outline: none;
    }
    .empty {
      padding: 6px 10px;
      opacity: 0.6;
    }
  `;

  @property({ attribute: false }) destinations: MoveDestination[] = [];
  @state() private activeIndex = 0;

  override render() {
    if (this.destinations.length === 0) {
      return html`<div class="empty">No destinations</div>`;
    }
    return html`
      <div role="menu" @keydown=${this.#onKeydown}>
        ${this.destinations.map(
          (dest, i) => html`
            <button
              role="menuitem"
              tabindex=${i === this.activeIndex ? "0" : "-1"}
              @click=${() => this.#choose(i)}
            >
              ${dest.label}
            </button>
          `,
        )}
      </div>
    `;
  }

  override updated(): void {
    // Keep DOM focus on the active item for roving-tabindex keyboard operation.
    const items = this.renderRoot.querySelectorAll<HTMLButtonElement>("button[role=menuitem]");
    items[this.activeIndex]?.focus();
  }

  #onKeydown(e: KeyboardEvent): void {
    const last = this.destinations.length - 1;
    if (e.key === "ArrowDown") {
      this.activeIndex = Math.min(last, this.activeIndex + 1);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      this.activeIndex = Math.max(0, this.activeIndex - 1);
      e.preventDefault();
    } else if (e.key === "Enter" || e.key === " ") {
      this.#choose(this.activeIndex);
      e.preventDefault();
    } else if (e.key === "Escape") {
      this.dispatchEvent(new CustomEvent("eb-move-cancel", { bubbles: true, composed: true }));
      e.preventDefault();
    }
  }

  #choose(index: number): void {
    const dest = this.destinations[index];
    if (!dest) return;
    this.dispatchEvent(
      new CustomEvent<DropTarget>("eb-move-select", {
        detail: dest.target,
        bubbles: true,
        composed: true,
      }),
    );
  }
}

if (!customElements.get("eb-move-to-menu")) {
  customElements.define("eb-move-to-menu", MoveToMenu);
}

declare global {
  interface HTMLElementTagNameMap {
    "eb-move-to-menu": MoveToMenu;
  }
}

/** Build the destination list for a leaf block from the current doc. */
export function destinationsFor(
  doc: import("@nord-forge/rime-model").RimeDoc,
  id: string,
): MoveDestination[] {
  const out: MoveDestination[] = [];
  let sectionNumber = 0;
  doc.children.forEach((section) => {
    // Section-level band blocks (e.g. a hero) hold no columns — skip them.
    if (!isSection(section)) return;
    sectionNumber += 1;
    section.children.forEach((column, c) => {
      const hasNode = column.children.some((leaf) => leaf.id === id);
      const isOnlyHere = hasNode && column.children.length === 1;
      // Offer "end of column X" for every column except where it already solely is.
      if (!isOnlyHere) {
        out.push({
          label: `Section ${sectionNumber}, Column ${c + 1} (end)`,
          target: { parentId: column.id, index: column.children.length },
        });
      }
    });
  });
  return out;
}
