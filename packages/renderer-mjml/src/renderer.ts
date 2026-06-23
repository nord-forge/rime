// The swappable export contract (PRD §6.3). Export is decoupled from MJML: the
// v1 default is MjmlRenderer, but a future hand-rolled renderer must be a
// non-breaking swap. This module is therefore renderer-NEUTRAL — it must never
// import the `mjml` library or any MJML type, so a non-MJML renderer can
// implement `Renderer` without touching MJML.

import type { AnyNode, EnveloppeDoc } from "@enveloppe/doc-model";

/** Options common to any renderer; concrete renderers may extend with their own. */
export interface RenderOptions {
  /** Inline-CSS / minify toggle a renderer may honor. */
  minify?: boolean;
}

/**
 * Turns the immutable doc into a final email-HTML string. Async because the
 * default (MJML) compiles asynchronously and runs at export time, NOT on the
 * in-browser canvas hot path.
 */
export interface Renderer {
  render(doc: EnveloppeDoc, options?: RenderOptions): Promise<string>;
}

/** Thrown by a renderer for a doc it cannot turn into HTML (vs. emitting junk). */
export class RenderError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "RenderError";
    this.cause = cause;
  }
}

/**
 * Context handed to each BlockRenderer: lets a container delegate its children
 * back to the registry, and carries the active options.
 */
export interface RenderContext {
  /** Render a child node by delegating back to the renderer's block registry. */
  renderChild(node: AnyNode): string;
  options: RenderOptions;
}

/**
 * Maps one block node-type to a fragment of the renderer's target markup
 * (an MJML string for MjmlRenderer; a raw email table for the fallback). ENV-11
 * wires a registry of these; ENV-12 registers a raw-table fallback. This module
 * only declares the seam — no concrete block logic lives here.
 */
export interface BlockRenderer<TNode extends AnyNode = AnyNode> {
  /** The `node.type` this handles, e.g. "button". */
  readonly type: string;
  /** Produce the renderer-native fragment for this node. */
  renderExport(node: TNode, ctx: RenderContext): string;
}
