import type { BaseNode } from "@nord-forge/rime-model";
import type { BlockSchema } from "./schema";

export interface PaletteEntry {
  label: string;
  // Emoji or inline SVG string.
  icon: string;
  // Palette grouping, e.g. "Layout" or "Content".
  category: string;
  // Initial node props a freshly-dropped block gets (without id/type).
  defaults: Record<string, unknown>;
}

export interface CanvasRenderContext {
  // The iframe document the element is created in.
  doc: Document;
  renderChild(child: BaseNode): HTMLElement;
}

// Returns a fresh detached element carrying data-node-id.
export type RenderCanvas<N extends BaseNode = BaseNode> = (
  node: N,
  ctx: CanvasRenderContext,
) => HTMLElement;

// MJML element string, or a raw email-table HTML string for blocks MJML can't
// express (the raw-table fallback path).
export type ExportOutput = { mjml: string } | { raw: string };

export interface ExportRenderContext {
  renderChild(child: BaseNode): string;
  escape(s: string): string;
}

export type RenderExport<N extends BaseNode = BaseNode> = (
  node: N,
  ctx: ExportRenderContext,
) => ExportOutput;

// Where a block lives in the document tree. "leaf" (default) blocks sit inside a
// column; "section" blocks are full-bleed bands that sit at the document level,
// beside sections (e.g. a hero — MJML's <mj-hero> is a body-level sibling of
// sections, never nested in a column).
export type BlockPlacement = "leaf" | "section";

export interface BlockDefinition<N extends BaseNode = BaseNode> {
  // The node `type` this handles, e.g. "text".
  type: string;
  // Defaults to "leaf" when omitted.
  placement?: BlockPlacement;
  schema: BlockSchema;
  palette: PaletteEntry;
  renderCanvas: RenderCanvas<N>;
  renderExport: RenderExport<N>;
}
