import type { ButtonBlock } from "@nord-forge/rime-model";
import type { BlockDefinition } from "../types";
import { ICON_BUTTON } from "../../palette/icons";
import { renderButton } from "../../canvas/render-node/render-node";
import { attrsToString, escapeAttr, normalizeHref, styleToMjmlAttrs } from "./mjml-attrs";

export const buttonBlock: BlockDefinition<ButtonBlock> = {
  type: "button",
  palette: {
    label: "Button",
    icon: ICON_BUTTON,
    category: "Content",
    defaults: { label: "Button", href: "#", style: {} },
  },
  schema: {
    fields: [
      { key: "label", label: "Label", type: "text", group: "Content" },
      { key: "href", label: "Link", type: "url", group: "Content" },
      { key: "style.backgroundColor", label: "Background", type: "color", group: "Colors" },
      { key: "style.align", label: "Align", type: "align", group: "Layout" },
      { key: "style.paddingTop", label: "Padding", type: "spacing", group: "Spacing" },
    ],
  },
  renderCanvas: (node, ctx) => renderButton(node, ctx.doc),
  renderExport: (node) => {
    const attrs = styleToMjmlAttrs(node.style);
    // Drop javascript:/data:/unparseable hrefs so they never reach the sent email.
    const href = normalizeHref(node.href);
    if (href !== null) attrs["href"] = href;
    return { mjml: `<mj-button${attrsToString(attrs)}>${escapeAttr(node.label)}</mj-button>` };
  },
};
