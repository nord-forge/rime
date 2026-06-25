import type { ImageBlock } from "@nord-forge/rime-model";
import type { BlockDefinition } from "../types";
import { renderImage } from "../../canvas/render-node/render-node";
import { attrsToString, normalizeHref, styleToMjmlAttrs } from "./mjml-attrs";

export const imageBlock: BlockDefinition<ImageBlock> = {
  type: "image",
  palette: {
    label: "Image",
    icon: "🖼️",
    category: "Content",
    defaults: { src: "", alt: "", style: {} },
  },
  schema: {
    fields: [
      { key: "src", label: "Source", type: "image", group: "Content" },
      { key: "alt", label: "Alt text", type: "text", group: "Content" },
      { key: "href", label: "Link", type: "url", group: "Content" },
      { key: "style.align", label: "Align", type: "align", group: "Layout" },
      { key: "style.paddingTop", label: "Padding", type: "spacing", group: "Spacing" },
    ],
  },
  renderCanvas: (node, ctx) => renderImage(node, ctx.doc),
  renderExport: (node) => {
    const attrs = styleToMjmlAttrs(node.style);
    attrs["src"] = node.src;
    attrs["alt"] = node.alt;
    if (node.href !== undefined) {
      const href = normalizeHref(node.href);
      if (href !== null) attrs["href"] = href;
    }
    return { mjml: `<mj-image${attrsToString(attrs)} />` };
  },
};
