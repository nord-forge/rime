// Placeholder <enveloppe-editor> for the E2E harness, used ONLY until ENV-30
// ships the real Lit shell. It establishes the contract the harness fixture
// drives — a same-origin srcdoc iframe exposed as part="canvas", plus
// loadDoc()/getDoc() — so swapping in the real element needs no fixture change.
//
// Kept dependency-free (no Lit) so the harness is unblocked by ENV-30 and stays
// trivially loadable. ENV-30 replaces the import in harness.html with the real
// @enveloppe/core element.

import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("enveloppe-editor")
export class PlaceholderEditor extends LitElement {
  static styles = css`
    :host {
      display: block;
      inline-size: 100%;
      block-size: 100%;
    }
    iframe {
      inline-size: 100%;
      block-size: 100%;
      border: 0;
    }
  `;

  // Mirrors the real shell's persistence contract (ENV-80). Stored verbatim;
  // the placeholder does not render the doc — that is ENV-32.
  #doc: unknown = null;

  loadDoc(doc: unknown): void {
    this.#doc = doc;
  }

  getDoc(): unknown {
    return this.#doc;
  }

  render() {
    // Same-origin srcdoc iframe is the canvas surface (ENV-31). Empty for now.
    return html`<iframe part="canvas" srcdoc="<!doctype html><html><body></body></html>"></iframe>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "enveloppe-editor": PlaceholderEditor;
  }
}
