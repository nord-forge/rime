// Placeholder <enveloppe-editor> for the E2E harness, used ONLY until the real
// Lit shell ships. It establishes the contract the harness fixture drives — a
// same-origin srcdoc iframe exposed as part="canvas", plus loadDoc()/getDoc() —
// so swapping in the real element needs no fixture change.
//
// Kept minimal so the harness is unblocked by the real shell's progress. Once
// the shell exists, harness.html imports it instead of this file.

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

  // Mirrors the real shell's persistence contract. Stored verbatim; the
  // placeholder does not render the doc (that is the canvas renderer's job).
  #doc: unknown = null;

  loadDoc(doc: unknown): void {
    this.#doc = doc;
  }

  getDoc(): unknown {
    return this.#doc;
  }

  render() {
    // Same-origin srcdoc iframe is the canvas surface. Empty for now.
    return html`<iframe part="canvas" srcdoc="<!doctype html><html><body></body></html>"></iframe>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "enveloppe-editor": PlaceholderEditor;
  }
}
