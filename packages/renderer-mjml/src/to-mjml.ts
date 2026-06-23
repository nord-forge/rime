// doc → MJML-string mapper, built as a registry of BlockRenderers (the ENV-10
// seam) so a raw-table fallback can register per block type later. One handler
// per node type; containers delegate to children through the registry, keeping a
// single dispatch point. Deterministic: same doc → same MJML string.

import type {
  AnyNode,
  BlockStyle,
  ButtonBlock,
  ColumnNode,
  DividerBlock,
  DocumentNode,
  EnveloppeDoc,
  ImageBlock,
  SectionNode,
  SpacerBlock,
  TextBlock,
} from "@enveloppe/doc-model";
import type { BlockRenderer, RenderContext, RenderOptions } from "./renderer";
import { RenderError } from "./renderer";
import { escapeAttr } from "./rich-text-to-html";
import { richTextToInlineHtml } from "./rich-text-to-html";

/** Map a BlockStyle to MJML attribute key/value pairs (deterministic order). */
export function styleToMjmlAttrs(style: BlockStyle | undefined): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (!style) return attrs;
  if (style.paddingTop !== undefined) attrs["padding-top"] = `${style.paddingTop}px`;
  if (style.paddingRight !== undefined) attrs["padding-right"] = `${style.paddingRight}px`;
  if (style.paddingBottom !== undefined) attrs["padding-bottom"] = `${style.paddingBottom}px`;
  if (style.paddingLeft !== undefined) attrs["padding-left"] = `${style.paddingLeft}px`;
  if (style.backgroundColor !== undefined) attrs["background-color"] = style.backgroundColor;
  if (style.align !== undefined) attrs["align"] = style.align;
  return attrs;
}

/** Serialize an attribute map to an escaped ` key="value"` string. */
function attrsToString(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${escapeAttr(value)}"`)
    .join("");
}

const textRenderer: BlockRenderer<TextBlock> = {
  type: "text",
  renderExport(node) {
    const attrs = attrsToString(styleToMjmlAttrs(node.style));
    return `<mj-text${attrs}>${richTextToInlineHtml(node.content)}</mj-text>`;
  },
};

const imageRenderer: BlockRenderer<ImageBlock> = {
  type: "image",
  renderExport(node) {
    const attrs = styleToMjmlAttrs(node.style);
    attrs["src"] = node.src;
    attrs["alt"] = node.alt;
    if (node.href !== undefined) attrs["href"] = node.href;
    return `<mj-image${attrsToString(attrs)} />`;
  },
};

const buttonRenderer: BlockRenderer<ButtonBlock> = {
  type: "button",
  renderExport(node) {
    const attrs = styleToMjmlAttrs(node.style);
    attrs["href"] = node.href;
    return `<mj-button${attrsToString(attrs)}>${escapeAttr(node.label)}</mj-button>`;
  },
};

const dividerRenderer: BlockRenderer<DividerBlock> = {
  type: "divider",
  renderExport(node) {
    return `<mj-divider${attrsToString(styleToMjmlAttrs(node.style))} />`;
  },
};

const spacerRenderer: BlockRenderer<SpacerBlock> = {
  type: "spacer",
  renderExport(node) {
    return `<mj-spacer height="${node.height}px" />`;
  },
};

const columnRenderer: BlockRenderer<ColumnNode> = {
  type: "column",
  renderExport(node, ctx) {
    const attrs = styleToMjmlAttrs(node.style);
    attrs["width"] = `${node.widthPercent}%`;
    const children = node.children.map((child) => ctx.renderChild(child)).join("");
    return `<mj-column${attrsToString(attrs)}>${children}</mj-column>`;
  },
};

const sectionRenderer: BlockRenderer<SectionNode> = {
  type: "section",
  renderExport(node, ctx) {
    const attrs = attrsToString(styleToMjmlAttrs(node.style));
    const children = node.children.map((child) => ctx.renderChild(child)).join("");
    return `<mj-section${attrs}>${children}</mj-section>`;
  },
};

const LEAF_AND_CONTAINER_RENDERERS: BlockRenderer[] = [
  sectionRenderer as BlockRenderer,
  columnRenderer as BlockRenderer,
  textRenderer as BlockRenderer,
  imageRenderer as BlockRenderer,
  buttonRenderer as BlockRenderer,
  dividerRenderer as BlockRenderer,
  spacerRenderer as BlockRenderer,
];

/** Build a dispatch registry keyed by node type. */
function buildRegistry(extra: BlockRenderer[] = []): Map<string, BlockRenderer> {
  const registry = new Map<string, BlockRenderer>();
  for (const renderer of [...LEAF_AND_CONTAINER_RENDERERS, ...extra]) {
    registry.set(renderer.type, renderer);
  }
  return registry;
}

/** Render the document head (fonts / default font-family / width). */
function renderHead(doc: DocumentNode): string {
  const { fontFamily } = doc.settings;
  return `<mj-head><mj-attributes><mj-all font-family="${escapeAttr(fontFamily)}" /></mj-attributes></mj-head>`;
}

/**
 * Convert a doc to an MJML source string. `extra` lets a caller (ENV-12) register
 * raw-table BlockRenderers that override the built-in mapping per node type.
 */
export function docToMjml(
  doc: EnveloppeDoc,
  options: RenderOptions = {},
  extra: BlockRenderer[] = [],
): string {
  const registry = buildRegistry(extra);

  const ctx: RenderContext = {
    options,
    renderChild(node: AnyNode): string {
      const renderer = registry.get(node.type);
      if (!renderer) {
        throw new RenderError(`no renderer for node type "${node.type}" (id "${node.id}")`);
      }
      return renderer.renderExport(node, ctx);
    },
  };

  const sections = doc.children.map((section) => ctx.renderChild(section)).join("");
  const bodyAttrs = attrsToString({
    width: `${doc.settings.contentWidth}px`,
    "background-color": doc.settings.backgroundColor,
  });

  return `<mjml>${renderHead(doc)}<mj-body${bodyAttrs}>${sections}</mj-body></mjml>`;
}
