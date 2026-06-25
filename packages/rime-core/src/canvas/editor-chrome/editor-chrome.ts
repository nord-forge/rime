// Editor-only chrome for the canvas iframe: hover/selection outlines and
// empty-block "ghost" placeholders. This styling is for the BUILDER surface only
// and is injected into a dedicated <style id="rime-chrome"> element — it never
// touches the swappable email base stylesheet (#rime-base), so it cannot leak
// into the exported email or the preview look.
//
// The canvas iframe is walled off from the host's --rime-* chrome theme (see
// theme/tokens). So the placeholder palette is forwarded explicitly: the editor
// resolves PLACEHOLDER_TOKENS (defaults below, overridable via config) and writes
// them as the chrome stylesheet's leading :root block.

import type { BaseNode, RichTextJSON } from "@nord-forge/rime-model";

export const PLACEHOLDER_TOKENS = {
  "--rime-placeholder-bg": "rgba(91, 91, 214, 0.04)",
  "--rime-placeholder-border": "#c7c7d9",
  "--rime-placeholder-fg": "#71717a",
  "--rime-hover-outline": "#a5a5e6",
  "--rime-selected-outline": "#5b5bd6",
} as const;

export type PlaceholderToken = keyof typeof PLACEHOLDER_TOKENS;

/** A placeholder palette override (subset of the catalogue). */
export type PlaceholderTheme = Partial<Record<PlaceholderToken, string>>;

/** Per-block-type ghost copy shown when a block is empty. Host-overridable. */
export const DEFAULT_PLACEHOLDER_LABELS: Record<string, string> = {
  text: "Empty text — click to edit",
  image: "Image — set a source",
  spacer: "Spacer",
  hero: "Hero — add a background and content",
  button: "Button",
  video: "Video",
  html: "Custom HTML",
};

/** Is this rich-text value visually empty (no runs across all blocks)? */
export function isRichTextEmpty(content: RichTextJSON | undefined): boolean {
  if (!content) return true;
  return content.content.every((block) => {
    if (block.type === "list") {
      return block.items.every((item) => (item.content?.length ?? 0) === 0);
    }
    return (block.content?.length ?? 0) === 0;
  });
}

/**
 * Decide whether a node should render a ghost placeholder, and with what copy.
 * Conservative: only flags the blocks that are genuinely invisible when empty so
 * blocks with their own content/fallback (button, divider, table…) are left alone.
 */
export function placeholderFor(
  node: BaseNode,
  labels: Record<string, string> = DEFAULT_PLACEHOLDER_LABELS,
): string | null {
  const n = node as BaseNode & {
    content?: RichTextJSON;
    src?: string;
    heading?: string;
    backgroundUrl?: string;
  };
  switch (node.type) {
    case "text":
      return isRichTextEmpty(n.content) ? (labels["text"] ?? null) : null;
    case "image":
      return !n.src ? (labels["image"] ?? null) : null;
    case "spacer":
      // A spacer is height-only; it has no content to ever fill, but it's
      // invisible/unclickable without an affordance. Always ghost it.
      return labels["spacer"] ?? null;
    default:
      return null;
  }
}

/**
 * Stamp (or clear) the ghost-placeholder hooks on an element. The chrome
 * stylesheet keys off [data-empty] + the ::after label from data-placeholder.
 */
export function applyPlaceholder(element: HTMLElement, label: string | null): void {
  if (label === null) {
    delete element.dataset["empty"];
    delete element.dataset["placeholder"];
    return;
  }
  element.dataset["empty"] = "1";
  element.dataset["placeholder"] = label;
}

/** Build the :root token block forwarded into the iframe chrome stylesheet. */
function tokenBlock(theme: PlaceholderTheme): string {
  const merged = { ...PLACEHOLDER_TOKENS, ...theme };
  const decls = Object.entries(merged)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return `:root{${decls}}`;
}

/**
 * The full editor chrome stylesheet for the canvas iframe. `theme` overrides the
 * placeholder palette (forwarded from host config). Selectors are scoped to
 * [data-node-id] so they only touch rendered blocks, never the iframe shell.
 */
export function editorChromeCss(theme: PlaceholderTheme = {}): string {
  return `${tokenBlock(theme)}
[data-node-id]{transition:outline-color .1s ease,box-shadow .1s ease}
[data-node-id]:hover{outline:1px solid var(--rime-hover-outline,#a5a5e6);outline-offset:-1px}
[data-node-id][data-selected]{outline:2px solid var(--rime-selected-outline,#5b5bd6);outline-offset:-2px}
[data-empty]{
  position:relative;
  min-height:40px;
  background:var(--rime-placeholder-bg,rgba(91,91,214,0.04));
  outline:1px dashed var(--rime-placeholder-border,#c7c7d9);
  outline-offset:-1px;
}
[data-empty][data-placeholder]::after{
  content:attr(data-placeholder);
  position:absolute;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  padding:8px;
  font:12px/1.3 system-ui,sans-serif;
  color:var(--rime-placeholder-fg,#71717a);
  text-align:center;
  pointer-events:none;
}
/* While a block is being edited (live rich-text mount), drop the ghost so the
   dashed box and label don't fight the editing surface. */
[data-empty]:focus-within,[data-empty][contenteditable="true"]{
  background:none;
  outline:none;
}
[data-empty]:focus-within::after,[data-empty][contenteditable="true"]::after{
  content:none;
}`;
}
