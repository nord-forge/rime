import type { BaseNode, BlockStyle } from "@nord-forge/rime-model";
import type { BlockDefinition } from "../types";
import { ICON_HEADING } from "../../palette/icons";
import { applyStyle, el } from "../../canvas/render-node/render-node";
import { attrsToString, escapeAttr, escapeHtml, styleToMjmlAttrs } from "./mjml-attrs";

export type HeadingLevel = 1 | 2 | 3;

export interface HeadingBlock extends BaseNode {
  type: "heading";
  level: HeadingLevel;
  text: string;
  color?: string;
  style: BlockStyle;
}

function tag(level: HeadingLevel): "h1" | "h2" | "h3" {
  return level === 1 ? "h1" : level === 2 ? "h2" : "h3";
}

export const headingBlock: BlockDefinition<HeadingBlock> = {
  type: "heading",
  palette: {
    label: "Heading",
    icon: ICON_HEADING,
    category: "Content",
    defaults: { level: 2, text: "Heading", style: {} },
  },
  schema: {
    fields: [
      {
        key: "level",
        label: "Level",
        type: "select",
        group: "Layout",
        options: [
          { value: "1", label: "H1" },
          { value: "2", label: "H2" },
          { value: "3", label: "H3" },
        ],
      },
      { key: "text", label: "Text", type: "text", group: "Content" },
      { key: "color", label: "Color", type: "color", group: "Colors" },
      { key: "style.align", label: "Align", type: "align", group: "Layout" },
      { key: "style.paddingTop", label: "Padding", type: "spacing", group: "Spacing" },
    ],
  },
  renderCanvas: (node, ctx) => {
    const e = el(ctx.doc, node);
    applyStyle(e, node.style);
    const h = ctx.doc.createElement(tag(node.level));
    h.textContent = node.text ?? "";
    h.style.margin = "0";
    if (node.color !== undefined) h.style.color = node.color;
    e.append(h);
    return e;
  },
  renderExport: (node) => {
    const colorStyle = node.color !== undefined ? ` style="color:${escapeAttr(node.color)}"` : "";
    const inner = `<${tag(node.level)}${colorStyle}>${escapeHtml(node.text ?? "")}</${tag(node.level)}>`;
    return { mjml: `<mj-text${attrsToString(styleToMjmlAttrs(node.style))}>${inner}</mj-text>` };
  },
};
