import type { BaseNode, BlockStyle } from "@nord-forge/rime-model";
import type { BlockDefinition } from "../types";
import { applyStyle, el } from "../../canvas/render-node/render-node";

export interface HtmlBlock extends BaseNode {
  type: "html";
  html: string;
  style: BlockStyle;
}

// TRUST BOUNDARY: the `html` here is HOST-AUTHORED content typed into the editor
// (a trusted authoring surface) — it is an intentional escape hatch and is NOT
// sanitized, unlike pasted clipboard HTML (which the rich-text paste path curates).
// On export it is emitted verbatim inside <mj-raw>; on canvas it is rendered into a
// bordered, contained wrapper inside the already-isolated srcdoc iframe so it can't
// bleed into editor chrome. Do not add escaping here — passthrough is the point.
export const htmlBlock: BlockDefinition<HtmlBlock> = {
  type: "html",
  palette: {
    label: "HTML",
    icon: "</>",
    category: "Advanced",
    defaults: { html: "<!-- your HTML -->", style: {} },
  },
  schema: {
    fields: [
      { key: "html", label: "HTML", type: "code", group: "Content" },
      { key: "style.paddingTop", label: "Padding", type: "spacing", group: "Spacing" },
    ],
  },
  renderCanvas: (node, ctx) => {
    const e = el(ctx.doc, node);
    applyStyle(e, node.style);
    // Contained preview: a bordered wrapper holding the trusted host HTML.
    const wrapper = ctx.doc.createElement("div");
    wrapper.dataset["htmlPreview"] = "1";
    wrapper.style.border = "1px dashed #cccccc";
    wrapper.style.padding = "8px";
    wrapper.innerHTML = node.html;
    e.append(wrapper);
    return e;
  },
  // Verbatim passthrough on the raw-table fallback path: the HTML is emitted
  // un-escaped inside <mj-raw>.
  renderExport: (node) => ({ raw: `<mj-raw>${node.html}</mj-raw>` }),
};
