// <enveloppe-editor> — the single public custom element the product ships as.
// This is the SHELL: the three-region layout (palette / canvas / properties),
// the slots + parts later features mount into, and the typed `config` surface.
// No feature logic lives here yet. Chrome is themed exclusively via --eb-* custom
// properties that pierce the shadow boundary (proven in the OD-2 toolchain spike).

import { type CSSResultGroup, LitElement, css, html } from "lit";
import { property, query } from "lit/decorators.js";
import type { EnveloppeDoc } from "@enveloppe/doc-model";
import { CanvasController, type CanvasReadyEvent } from "./canvas/iframe-canvas";
import { CanvasRenderer } from "./canvas/canvas-renderer";
import { DragCoordinateController, type Point } from "./canvas/coordinate-controller";

/** A declarative merge-token source (consumed by the tokens milestone). */
export interface TokenSource {
  id: string;
  label: string;
  tokens: { key: string; label: string }[];
}

/** The public configuration surface for the editor. */
export interface EnveloppeConfig {
  /** --eb-* token overrides applied to the chrome (host-piercing). */
  theme?: Record<`--eb-${string}`, string>;
  /** Block type ids enabled in the palette; undefined = all built-ins. */
  enabledBlocks?: string[];
  /** Host uploader; returns the final URL for an image block. */
  onImageUpload?: (file: File) => Promise<string>;
  /** Declarative merge-token sources. */
  tokenSources?: TokenSource[];
}

/** Detail payload of the `change` event. */
export interface EnveloppeChangeDetail {
  doc: EnveloppeDoc;
}

export class EnveloppeEditor extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      display: grid;
      grid-template-columns: var(--eb-palette-width, 240px) 1fr var(--eb-properties-width, 300px);
      grid-template-areas: "palette canvas properties";
      block-size: 100%;
      font: var(--eb-font-ui, 14px system-ui);
      color: var(--eb-color-fg, #18181b);
      background: var(--eb-color-bg, #fff);
    }
    [part="palette"] {
      grid-area: palette;
      overflow: auto;
      border-inline-end: 1px solid var(--eb-color-border, #e4e4e7);
    }
    [part="canvas"] {
      grid-area: canvas;
      overflow: auto;
    }
    [part="canvas-frame"] {
      display: block;
      inline-size: 100%;
      block-size: 100%;
      border: 0;
    }
    [part="properties"] {
      grid-area: properties;
      overflow: auto;
      border-inline-start: 1px solid var(--eb-color-border, #e4e4e7);
    }
  `;

  /** Public configuration. Set as a property (not an attribute). */
  @property({ attribute: false }) config: EnveloppeConfig = {};

  @query('[part="canvas"]') private canvasRegion!: HTMLElement;

  // Current document. The real load/get + change-event wiring is ENV-42; this
  // shell only holds it so the public method shapes are stable now.
  #doc: EnveloppeDoc | null = null;

  // The same-origin srcdoc canvas (PRD §6.4). Created once the shell first
  // renders; the doc→DOM renderer awaits whenReady() to draw into #eb-root.
  #canvas: CanvasController | null = null;
  #renderer: CanvasRenderer | null = null;
  #coords: DragCoordinateController | null = null;
  #onViewportChange: (() => void) | null = null;

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has("config")) this.#applyTheme();
  }

  override firstUpdated(): void {
    this.#canvas = new CanvasController();
    this.#canvas.mount(this.canvasRegion);
    void this.#canvas.whenReady().then(({ doc, mount, iframe }) => {
      this.#renderer = new CanvasRenderer(mount, doc);
      this.#coords = new DragCoordinateController(iframe);
      // The cached iframe rect must be refreshed on host scroll/resize.
      this.#onViewportChange = () => this.#coords?.invalidate();
      window.addEventListener("scroll", this.#onViewportChange, true);
      window.addEventListener("resize", this.#onViewportChange);
      if (this.#doc) this.#renderer.render(this.#doc);
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#onViewportChange) {
      window.removeEventListener("scroll", this.#onViewportChange, true);
      window.removeEventListener("resize", this.#onViewportChange);
      this.#onViewportChange = null;
    }
    this.#canvas?.destroy();
    this.#canvas = null;
    this.#coords = null;
  }

  /** Node id under a host pointer (clientX/Y), or null. */
  nodeIdAtHostPoint(point: Point): string | null {
    return this.#coords?.nodeIdAtHostPoint(point) ?? null;
  }

  /** The canvas controller (null before first render). */
  get canvas(): CanvasController | null {
    return this.#canvas;
  }

  /** Resolves when the canvas iframe is loaded and its mount node is ready. */
  whenCanvasReady(): Promise<CanvasReadyEvent> {
    if (!this.#canvas) throw new Error("canvas not initialized yet");
    return this.#canvas.whenReady();
  }

  // Apply --eb-* overrides to the host element — the only theming channel for
  // chrome. We never read host stylesheets.
  #applyTheme(): void {
    const theme = this.config.theme;
    if (!theme) return;
    for (const [key, value] of Object.entries(theme)) {
      this.style.setProperty(key, value);
    }
  }

  /**
   * Load a document into the editor and paint it onto the canvas. (The public
   * change-event side of persistence still lands in ENV-42.)
   */
  loadDoc(doc: EnveloppeDoc): void {
    const isUpdate = this.#doc !== null;
    this.#doc = doc;
    if (!this.#renderer) return; // canvas not ready yet; firstUpdated paints it
    if (isUpdate) this.#renderer.update(doc);
    else this.#renderer.render(doc);
  }

  /** The element rendered for a node id, or null. */
  elementForNode(id: string): HTMLElement | null {
    return this.#renderer?.elementForNode(id) ?? null;
  }

  /** Resolve a canvas-local point to the node id under it. */
  nodeIdAt(x: number, y: number): string | null {
    return this.#renderer?.nodeIdAt(x, y) ?? null;
  }

  /**
   * Read the current document.
   * STUB — full wiring lands in ENV-42.
   */
  getDoc(): EnveloppeDoc {
    if (!this.#doc) throw new Error("no document loaded");
    return this.#doc;
  }

  override render() {
    return html`
      <section part="palette"><slot name="palette"></slot></section>
      <section part="canvas"><slot name="canvas"></slot></section>
      <section part="properties"><slot name="properties"></slot></section>
    `;
  }
}

if (!customElements.get("enveloppe-editor")) {
  customElements.define("enveloppe-editor", EnveloppeEditor);
}

declare global {
  interface HTMLElementTagNameMap {
    "enveloppe-editor": EnveloppeEditor;
  }
}
