import { LitElement, html, css, type CSSResultGroup } from "lit";
import { property } from "lit/decorators.js";

// Exercises the toolchain's hardest cases for a web-component lib:
//  - static styles = css`...`  (Lit's tagged-template CSS — must survive minify)
//  - CSS custom properties that pierce shadow DOM (the --eb-* theming model)
//  - a same-origin srcdoc iframe (the canvas pattern)
//  - decorators (@property) — needs useDefineForClassFields:false handling
export class ThemedPanel extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      display: block;
      font: 14px var(--eb-font-ui, system-ui);
      color: var(--eb-color-fg, #18181b);
    }
    .panel {
      border: 1px solid var(--eb-color-border, #d4d4d8);
      border-radius: var(--eb-radius, 8px);
      padding: var(--eb-space, 12px);
      background: var(--eb-color-bg, #fff);
    }
    .accent {
      color: var(--eb-color-accent, #5b5bd6);
      font-weight: 600;
    }
    iframe {
      width: 100%;
      height: 80px;
      border: 0;
    }
  `;

  @property({ type: String }) heading = "Enveloppe";

  render() {
    return html`
      <div class="panel">
        <div class="accent">${this.heading}</div>
        <iframe part="canvas"></iframe>
      </div>
    `;
  }

  firstUpdated() {
    const iframe = this.renderRoot.querySelector("iframe");
    if (iframe) {
      iframe.srcdoc =
        '<!doctype html><body style="margin:0;font:13px system-ui;padding:8px">canvas iframe ok</body>';
    }
  }
}

customElements.define("themed-panel", ThemedPanel);
