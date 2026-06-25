// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE CUSTOM BLOCK — the Rime SDK proof.
//
// This file shows how a third-party developer adds a brand-new block to the editor
// using ONLY the public `registerBlock` API. There are no imports from Rime
// internals — everything comes from the package's public entry point:
//
//     import { registerBlock, type BlockDefinition, ... } from "@nord-forge/rime-core";
//
// A "coupon" is a marketing block (a discount ticket with a code). It's a good
// example because MJML has no native coupon component, so its export uses the
// raw-table fallback ({ raw }) — demonstrating BOTH export modes a block can use.
//
// Copy this file as the starting point for your own block. Everything you need is
// the four fields of a BlockDefinition: `type`, `palette`, `schema`, and the two
// render functions (`renderCanvas` for the in-editor preview, `renderExport` for
// the final email HTML).
// ─────────────────────────────────────────────────────────────────────────────

import {
  type BlockDefinition,
  type CanvasRenderContext,
  type ExportRenderContext,
  registerBlock,
} from "@nord-forge/rime-core";

// The node shape for a coupon. A block's node is plain serializable JSON — it
// lives in the document model alongside the built-in blocks. `id` + `type` are the
// common fields every node has; the rest are this block's own props.
export interface CouponNode {
  id: string;
  type: "coupon";
  // The headline shown above the code, e.g. "10% off your order".
  label: string;
  // The discount code itself, shown in a dashed "chip", e.g. "SAVE10".
  code: string;
  // BlockStyle: padding / backgroundColor / align. The properties panel edits these
  // via the `style.*` schema fields below; renderCanvas/renderExport read them.
  style: {
    backgroundColor?: string;
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
  };
}

// A small, email-safe inline style for the dashed coupon card. Kept identical
// between the canvas preview and the exported HTML so what the author sees matches
// what recipients get.
const CARD_STYLE = "border:2px dashed #888888;border-radius:8px;padding:16px;text-align:center";
const CHIP_STYLE =
  "display:inline-block;margin-top:8px;padding:6px 12px;border:1px dashed #888888;" +
  "border-radius:6px;font-family:monospace;font-weight:bold;letter-spacing:1px";

// `BlockDefinition<CouponNode>` ties the render functions to the node shape so they
// are fully type-checked against the props above.
export const couponBlock: BlockDefinition<CouponNode> = {
  // The discriminator. Must be unique across all registered blocks; it's how the
  // editor routes a node to this definition.
  type: "coupon",

  // PALETTE: how the block appears in the left-hand palette, and the props a freshly
  // dropped instance starts with (the editor stamps a fresh `id` + `type` on top of
  // `defaults`). `category` groups it; `icon` is any emoji or inline-SVG string.
  palette: {
    label: "Coupon",
    icon: "🎟️",
    category: "Marketing",
    defaults: { label: "10% off", code: "SAVE10", style: {} },
  },

  // SCHEMA: drives the properties panel. Each field maps a control type to a prop
  // `key` (dot-paths address nested props like `style.backgroundColor`). The panel
  // renders the matching control and writes edits back through the immutable doc
  // ops — you write zero form code.
  schema: {
    fields: [
      { key: "label", label: "Headline", type: "text", group: "Content" },
      { key: "code", label: "Coupon code", type: "text", group: "Content" },
      { key: "style.backgroundColor", label: "Background", type: "color", group: "Colors" },
      { key: "style.paddingTop", label: "Padding", type: "spacing", group: "Spacing" },
    ],
  },

  // renderCanvas: build the in-editor PREVIEW as a detached DOM element. Use the
  // provided `ctx.doc` (the canvas lives in an iframe, so create nodes from ITS
  // document). You MUST stamp `data-node-id` (and conventionally `data-node-type`)
  // so the editor can map clicks/selection/DnD back to this node.
  renderCanvas: (node: CouponNode, ctx: CanvasRenderContext): HTMLElement => {
    const el = ctx.doc.createElement("div");
    el.dataset["nodeId"] = node.id;
    el.dataset["nodeType"] = node.type;
    // Apply the editable BlockStyle (the same props the schema exposes).
    if (node.style.backgroundColor) el.style.backgroundColor = node.style.backgroundColor;
    if (node.style.paddingTop !== undefined) el.style.paddingTop = `${node.style.paddingTop}px`;

    const card = ctx.doc.createElement("div");
    card.setAttribute("style", CARD_STYLE);

    const headline = ctx.doc.createElement("div");
    headline.textContent = node.label;
    headline.style.fontWeight = "bold";

    const chip = ctx.doc.createElement("div");
    chip.setAttribute("style", CHIP_STYLE);
    chip.textContent = node.code;

    card.append(headline, chip);
    el.append(card);
    return el;
  },

  // renderExport: produce the final email markup. Two modes:
  //   - `{ mjml }`  — an MJML element string (for blocks that map to MJML natively).
  //   - `{ raw }`   — raw, email-safe HTML wrapped in <mj-raw>, passed through
  //                   verbatim. Use this when MJML has no fitting component (a coupon
  //                   ticket). This is the ENV-12 raw-table fallback path.
  // ALWAYS escape interpolated text with `ctx.escape` to avoid breaking the markup.
  renderExport: (node: CouponNode, ctx: ExportRenderContext): { raw: string } => {
    const bg = node.style.backgroundColor
      ? `background:${ctx.escape(node.style.backgroundColor)};`
      : "";
    const pad =
      node.style.paddingTop !== undefined ? `padding-top:${node.style.paddingTop}px;` : "";
    // An email-safe table: role=presentation, inline styles, no external CSS.
    const html =
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
      `style="${bg}${pad}border-collapse:collapse">` +
      `<tr><td align="center" style="${CARD_STYLE}">` +
      `<div style="font-weight:bold">${ctx.escape(node.label)}</div>` +
      `<div style="${CHIP_STYLE}">${ctx.escape(node.code)}</div>` +
      `</td></tr></table>`;
    return { raw: `<mj-raw>${html}</mj-raw>` };
  },
};

// Registering is one call. Do this once at app start (before the editor renders).
// `defineRimeEditor({ blocks: [couponBlock] })` is the other way — either path uses
// the same public surface. After this, the coupon appears in the palette, gets a
// properties form from its schema, previews on canvas, and exports — with no
// changes to @nord-forge/rime-core.
export function registerCouponBlock(): void {
  registerBlock(couponBlock);
}
