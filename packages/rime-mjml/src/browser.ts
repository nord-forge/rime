// Browser-safe subset of @nord-forge/rime-mjml: the doc→MJML mapping + escape helpers
// + render contract types. EXCLUDES MjmlRenderer, whose mjml2html step is Node-only
// (fs/path) and must run server-side. Import "@nord-forge/rime-mjml/browser" when you
// need the portable MJML markup in a browser (e.g. a live preview) without pulling
// the Node `mjml` library into the bundle.

export { docToMjml, styleToMjmlAttrs } from "./to-mjml";
export { escapeAttr, escapeHtml, normalizeHref, richTextToInlineHtml } from "./rich-text-to-html";
export { createRawBlockRenderer, rawTableFallback } from "./raw-fallback";
export type { BlockRenderer, Renderer, RenderContext, RenderOptions } from "./renderer";
