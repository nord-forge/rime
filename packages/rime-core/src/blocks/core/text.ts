import type { TextBlock } from "@nord-forge/rime-model";
import { emptyRichText } from "@nord-forge/rime-model";
import type { BlockDefinition } from "../types";
import { renderText } from "../../canvas/render-node/render-node";
import { attrsToString, richTextToInlineHtml, styleToMjmlAttrs } from "./mjml-attrs";

export const textBlock: BlockDefinition<TextBlock> = {
  type: "text",
  palette: {
    label: "Text",
    icon: "🅣",
    category: "Content",
    defaults: { content: emptyRichText(), style: {} },
  },
  schema: {
    fields: [
      { key: "style.align", label: "Align", type: "align", group: "Layout" },
      { key: "style.paddingTop", label: "Padding", type: "spacing", group: "Spacing" },
      { key: "style.backgroundColor", label: "Background", type: "color", group: "Colors" },
    ],
  },
  renderCanvas: (node, ctx) => renderText(node, ctx.doc),
  renderExport: (node) => ({
    mjml: `<mj-text${attrsToString(styleToMjmlAttrs(node.style))}>${richTextToInlineHtml(node.content)}</mj-text>`,
  }),
};
