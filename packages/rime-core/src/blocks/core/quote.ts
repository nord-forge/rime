import type { BaseNode, BlockStyle } from "@nord-forge/rime-model";
import type { BlockDefinition } from "../types";
import { ICON_QUOTE } from "../../palette/icons";
import { applyStyle, el } from "../../canvas/render-node/render-node";
import { attrsToString, escapeAttr, escapeHtml, styleToMjmlAttrs } from "./mjml-attrs";

export interface QuoteBlock extends BaseNode {
  type: "quote";
  text: string;
  citation?: string;
  accentColor?: string;
  style: BlockStyle;
}

const DEFAULT_ACCENT = "#cccccc";

function quoteStyle(accentColor: string): string {
  return `border-left:4px solid ${accentColor};padding-left:16px;margin:0`;
}

export const quoteBlock: BlockDefinition<QuoteBlock> = {
  type: "quote",
  palette: {
    label: "Quote",
    icon: ICON_QUOTE,
    category: "Content",
    defaults: { text: "A memorable quote.", accentColor: DEFAULT_ACCENT, style: {} },
  },
  schema: {
    fields: [
      { key: "text", label: "Quote", type: "text", group: "Content" },
      { key: "citation", label: "Citation", type: "text", group: "Content" },
      { key: "accentColor", label: "Accent", type: "color", group: "Colors" },
      { key: "style.align", label: "Align", type: "align", group: "Layout" },
      { key: "style.paddingTop", label: "Padding", type: "spacing", group: "Spacing" },
    ],
  },
  renderCanvas: (node, ctx) => {
    const e = el(ctx.doc, node);
    applyStyle(e, node.style);
    const accent = node.accentColor ?? DEFAULT_ACCENT;
    const quote = ctx.doc.createElement("blockquote");
    quote.style.borderLeft = `4px solid ${accent}`;
    quote.style.paddingLeft = "16px";
    quote.style.margin = "0";
    quote.textContent = node.text;
    if (node.citation !== undefined && node.citation !== "") {
      const cite = ctx.doc.createElement("cite");
      cite.textContent = node.citation;
      cite.style.display = "block";
      quote.append(cite);
    }
    e.append(quote);
    return e;
  },
  renderExport: (node) => {
    const accent = escapeAttr(node.accentColor ?? DEFAULT_ACCENT);
    const cite =
      node.citation !== undefined && node.citation !== ""
        ? `<cite style="display:block">${escapeHtml(node.citation)}</cite>`
        : "";
    const inner = `<blockquote style="${quoteStyle(accent)}">${escapeHtml(node.text)}${cite}</blockquote>`;
    return { mjml: `<mj-text${attrsToString(styleToMjmlAttrs(node.style))}>${inner}</mj-text>` };
  },
};
