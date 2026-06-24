import type { DividerBlock } from "@nord-forge/rime-model";
import type { BlockDefinition } from "../types";
import { renderDivider } from "../../canvas/render-node/render-node";
import { attrsToString, styleToMjmlAttrs } from "./mjml-attrs";

export const dividerBlock: BlockDefinition<DividerBlock> = {
  type: "divider",
  palette: {
    label: "Divider",
    icon: "➖",
    category: "Layout",
    defaults: { style: {} },
  },
  schema: {
    fields: [
      { key: "style.backgroundColor", label: "Color", type: "color", group: "Colors" },
      { key: "style.paddingTop", label: "Padding", type: "spacing", group: "Spacing" },
    ],
  },
  renderCanvas: (node, ctx) => renderDivider(node, ctx.doc),
  renderExport: (node) => ({
    mjml: `<mj-divider${attrsToString(styleToMjmlAttrs(node.style))} />`,
  }),
};
