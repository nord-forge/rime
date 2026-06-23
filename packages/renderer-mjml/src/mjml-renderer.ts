// The v1 default export renderer: doc → MJML → bulletproof, Outlook-safe HTML via
// the `mjml` library (inherits MJML's mso conditionals, VML buttons, ghost
// tables). Runs at export time, Node-side — outside the @enveloppe/core bundle
// budget (separate package). Implements the ENV-10 Renderer contract.

import mjml2html from "mjml";
import type { EnveloppeDoc } from "@enveloppe/doc-model";
import type { BlockRenderer, Renderer, RenderOptions } from "./renderer";
import { RenderError } from "./renderer";
import { docToMjml } from "./to-mjml";

export interface MjmlRendererOptions {
  /**
   * Extra BlockRenderers that override built-in per-type mapping (the raw-table
   * fallback path plugs in here).
   */
  blockRenderers?: BlockRenderer[];
}

export class MjmlRenderer implements Renderer {
  readonly #extra: BlockRenderer[];

  constructor(options: MjmlRendererOptions = {}) {
    this.#extra = options.blockRenderers ?? [];
  }

  async render(doc: EnveloppeDoc, options: RenderOptions = {}): Promise<string> {
    const mjmlSrc = docToMjml(doc, options, this.#extra);

    // Note: mjml-core's own `minify` option is deprecated (CLI-only), so we do
    // NOT forward options.minify to it. The contract option is retained for a
    // future post-process / non-MJML renderer; today it is a no-op here.
    let result: { html: string; errors: { formattedMessage?: string }[] };
    try {
      result = mjml2html(mjmlSrc, { validationLevel: "soft" });
    } catch (cause) {
      throw new RenderError("MJML compilation threw", cause);
    }

    if (result.errors?.length) {
      const detail = result.errors.map((e) => e.formattedMessage ?? String(e)).join("; ");
      throw new RenderError(`MJML compile errors: ${detail}`, result.errors);
    }

    return result.html;
  }
}
