import type { ColumnNode } from "@nord-forge/rime-model";
import type { BlockDefinition } from "../types";
import { renderColumn } from "../../canvas/render-node/render-node";
import { attrsToString, styleToMjmlAttrs } from "./mjml-attrs";

export const columnBlock: BlockDefinition<ColumnNode> = {
  type: "column",
  palette: {
    label: "Column",
    icon: "▯",
    category: "Layout",
    defaults: { widthPercent: 100, style: {}, children: [] },
  },
  schema: {
    fields: [
      { key: "widthPercent", label: "Width %", type: "number", min: 1, max: 100, group: "Layout" },
      { key: "style.backgroundColor", label: "Background", type: "color", group: "Colors" },
      { key: "style.paddingTop", label: "Padding", type: "spacing", group: "Spacing" },
    ],
  },
  renderCanvas: (node, ctx) => {
    const el = renderColumn(node, ctx.doc);
    for (const child of node.children) el.append(ctx.renderChild(child));
    return el;
  },
  renderExport: (node, ctx) => {
    const attrs = styleToMjmlAttrs(node.style);
    attrs["width"] = `${node.widthPercent}%`;
    const children = node.children.map((child) => ctx.renderChild(child)).join("");
    return { mjml: `<mj-column${attrsToString(attrs)}>${children}</mj-column>` };
  },
};
