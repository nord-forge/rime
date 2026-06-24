// @nord-forge/rime-mjml — default Renderer implementation.
// See PRD §6.3.
//
// The swappable Renderer contract + shared seam types. The concrete MjmlRenderer
// and the raw-table fallback BlockRenderer are added next.

export {
  type BlockRenderer,
  type Renderer,
  RenderError,
  type RenderContext,
  type RenderOptions,
} from "./renderer";
export { MjmlRenderer, type MjmlRendererOptions } from "./mjml-renderer";
export { docToMjml, styleToMjmlAttrs } from "./to-mjml";
export { escapeAttr, escapeHtml, richTextToInlineHtml } from "./rich-text-to-html";
export { createRawBlockRenderer, rawTableFallback } from "./raw-fallback";
