import type { SpacerBlock } from "@nord-forge/rime-model";
import type { BlockDefinition } from "../types";
import { renderSpacer } from "../../canvas/render-node/render-node";

export const spacerBlock: BlockDefinition<SpacerBlock> = {
  type: "spacer",
  palette: {
    label: "Spacer",
    icon: "↕️",
    category: "Layout",
    defaults: { height: 24 },
  },
  schema: {
    fields: [{ key: "height", label: "Height", type: "number", min: 0, max: 400, group: "Layout" }],
  },
  renderCanvas: (node, ctx) => renderSpacer(node, ctx.doc),
  renderExport: (node) => ({ mjml: `<mj-spacer height="${node.height}px" />` }),
};
