// Per-block escape hatch: a block that can't be expressed as MJML supplies
// hand-authored, Outlook-safe table HTML instead. MJML's <mj-raw> passes its inner
// HTML through to the compiled output verbatim — that is the splice point.
//
// This is a bounded, per-block seam, NOT a second renderer: a raw block is just a
// BlockRenderer (the renderer seam) whose renderExport returns <mj-raw>…</mj-raw>,
// registered through the same path as the built-in MJML handlers.

import type { AnyNode } from "@nord-forge/rime-model";
import type { BlockRenderer, RenderContext } from "./renderer";
import { RenderError } from "./renderer";

// Structural container types own their MJML wrappers (mj-section/mj-column) and
// their children depend on those wrappers existing — replacing them with raw HTML
// would break layout. Raw fallback is therefore allowed for LEAF blocks only.
const NON_RAW_TYPES = new Set(["document", "section", "column"]);

/**
 * Wrap hand-authored table HTML so MJML passes it through verbatim. The author
 * owns Outlook-safety of this markup (tables, inline styles, mso conditionals).
 */
export function rawTableFallback(html: string): string {
  return `<mj-raw>${html}</mj-raw>`;
}

/**
 * Build a BlockRenderer that bypasses MJML mapping for one leaf block type,
 * emitting the author's raw table HTML wrapped in <mj-raw>.
 *
 * Throws if `type` is a structural container (document/section/column), which
 * cannot be raw — fail loudly here rather than emit MJML that breaks layout.
 */
export function createRawBlockRenderer<TNode extends AnyNode = AnyNode>(
  type: string,
  toTableHtml: (node: TNode, ctx: RenderContext) => string,
): BlockRenderer<TNode> {
  if (NON_RAW_TYPES.has(type)) {
    throw new RenderError(
      `raw fallback is not allowed for structural type "${type}" (only leaf blocks)`,
    );
  }
  return {
    type,
    renderExport: (node, ctx) => rawTableFallback(toTableHtml(node, ctx)),
  };
}
