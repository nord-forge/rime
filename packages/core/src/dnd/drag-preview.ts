// Branded drag preview (PRD §6.6). Because canvas DnD is pointer-event based
// (OD-6) there is NO native HTML5 drag image to replace — instead we render a
// small themed card and move it to follow the pointer during the drag, then
// remove it on drag end. Styled exclusively from --eb-* tokens.

import type { DragData } from "./dnd-types";

const POINTER_OFFSET = 12; // px below-right of the pointer

/** Human label + icon for a block type (placeholder until palette metadata, ENV-36). */
const BLOCK_META: Record<string, { icon: string; label: string }> = {
  text: { icon: "T", label: "Text" },
  image: { icon: "▦", label: "Image" },
  button: { icon: "▭", label: "Button" },
  divider: { icon: "—", label: "Divider" },
  spacer: { icon: "↕", label: "Spacer" },
};

function metaFor(data: DragData): { icon: string; label: string } {
  if (data.source === "palette") {
    return BLOCK_META[data.blockType] ?? { icon: "▢", label: data.blockType };
  }
  return { icon: "⠿", label: "Moving block" };
}

/** Build the themed preview card element (pure: caller owns insertion + removal). */
export function renderPreviewCard(doc: Document, data: DragData): HTMLElement {
  const { icon, label } = metaFor(data);
  const card = doc.createElement("div");
  card.dataset["ebOverlay"] = "drag-preview";
  // Longhand properties (not `background`/`border`/`font` shorthands) so the
  // --eb-* var() fallbacks survive CSSOM round-tripping.
  const s = card.style;
  s.position = "fixed";
  s.insetBlockStart = "0";
  s.insetInlineStart = "0";
  s.display = "inline-flex";
  s.alignItems = "center";
  s.gap = "8px";
  s.paddingBlock = "6px";
  s.paddingInline = "10px";
  s.backgroundColor = "var(--eb-color-bg, #fff)";
  s.color = "var(--eb-color-fg, #18181b)";
  s.borderWidth = "1px";
  s.borderStyle = "solid";
  s.borderColor = "var(--eb-color-border, #e4e4e7)";
  s.borderRadius = "var(--eb-radius, 8px)";
  s.boxShadow = "var(--eb-shadow-1, 0 2px 8px rgba(0, 0, 0, 0.18))";
  s.fontFamily = "var(--eb-font-ui, system-ui)";
  s.pointerEvents = "none";
  s.zIndex = "2147483647";
  s.willChange = "transform";

  const iconEl = doc.createElement("span");
  iconEl.textContent = icon;
  iconEl.style.fontWeight = "600";
  iconEl.style.color = "var(--eb-color-accent, #5b5bd6)";
  const labelEl = doc.createElement("span");
  labelEl.textContent = label;
  card.append(iconEl, labelEl);
  return card;
}

/** A drag preview that follows the host pointer until destroyed. */
export class DragPreview {
  readonly #el: HTMLElement;

  constructor(parent: ParentNode & { ownerDocument: Document }, data: DragData) {
    this.#el = renderPreviewCard(parent.ownerDocument, data);
    parent.append(this.#el);
  }

  /** Move the preview to follow a host-space pointer point. */
  move(hostX: number, hostY: number): void {
    this.#el.style.transform = `translate(${hostX + POINTER_OFFSET}px, ${hostY + POINTER_OFFSET}px)`;
  }

  destroy(): void {
    this.#el.remove();
  }
}
