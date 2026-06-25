import type { SectionNode } from "@nord-forge/rime-model";
import type { BlockDefinition } from "../types";
import { ICON_SECTION } from "../../palette/icons";
import { renderSection } from "../../canvas/render-node/render-node";
import { attrsToString, styleToMjmlAttrs } from "./mjml-attrs";

// A Section is a styled container: a full-width band whose backgroundColor +
// padding wrap its column(s) and their blocks. renderSection paints the band and
// a flex "column-row"; children (columns) are appended into that row, so the
// background sits behind the whole row — preview mirrors mj-section's full-bleed
// background while content stays within the body width. A fresh Section defaults
// to one 100% column so blocks can be dropped straight in.
export const sectionBlock: BlockDefinition<SectionNode> = {
  type: "section",
  palette: {
    label: "Section",
    icon: ICON_SECTION,
    category: "Layout",
    defaults: {
      style: {},
      children: [{ type: "column", widthPercent: 100, style: {}, children: [] }],
    },
  },
  schema: {
    fields: [
      { key: "style.backgroundColor", label: "Background", type: "color", group: "Colors" },
      { key: "style.paddingTop", label: "Padding", type: "spacing", group: "Spacing" },
    ],
  },
  renderCanvas: (node, ctx) => {
    const el = renderSection(node, ctx.doc);
    const row = el.querySelector<HTMLElement>(':scope > [data-node-role="column-row"]') ?? el;
    for (const child of node.children) row.append(ctx.renderChild(child));
    return el;
  },
  renderExport: (node, ctx) => {
    const attrs = attrsToString(styleToMjmlAttrs(node.style));
    const children = node.children.map((child) => ctx.renderChild(child)).join("");
    return { mjml: `<mj-section${attrs}>${children}</mj-section>` };
  },
};
