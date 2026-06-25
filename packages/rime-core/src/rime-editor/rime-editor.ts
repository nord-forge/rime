// <rime-editor> — the public custom element: the shell hosting the palette,
// canvas, and properties regions. Chrome is themed via --eb-* custom properties.

import { type CSSResultGroup, LitElement, css, html } from "lit";
import { property, query } from "lit/decorators.js";
import {
  type BaseNode,
  createButtonBlock,
  createDividerBlock,
  createIdFactory,
  createImageBlock,
  createSpacerBlock,
  createTextBlock,
  isSection,
  type RimeDoc,
  type IdFactory,
  insertNode,
  moveNode,
  type OpResult,
  removeNode,
  setRichText,
  type ValidateOptions,
} from "@nord-forge/rime-model";
import { CanvasController, type CanvasReadyEvent } from "../canvas/iframe-canvas/iframe-canvas";
import { CanvasRenderer } from "../canvas/canvas-renderer/canvas-renderer";
import { blockRegistry, placementOf } from "../blocks/registry";
import { presetRegistry } from "../blocks/column-presets";
import {
  DragCoordinateController,
  type Point,
} from "../canvas/coordinate-controller/coordinate-controller";
import { DndController } from "../dnd/dnd-controller/dnd-controller";
import { KeyboardMoveController } from "../dnd/keyboard-move/keyboard-move";
import { LiveAnnouncer } from "../a11y/live-region/live-region";
import {
  findNodeById,
  insertMessage,
  locateForAnnounce,
  moveMessage,
  removeMessage,
} from "../a11y/announce-messages/announce-messages";
import type { RichTextHost, RichTextProvider } from "../richtext/provider/richtext-provider";
import { createPlainTextProvider } from "../richtext/provider/plain-text-provider";
import { type DocChangeDetail, EbPropertiesPanel } from "../properties/properties-panel";
import { EbPalette, type PaletteAddDetail } from "../palette/palette";

/** A declarative merge-token source (consumed by the tokens milestone). */
export interface TokenSource {
  id: string;
  label: string;
  tokens: { key: string; label: string }[];
}

/** The public configuration surface for the editor. */
export interface RimeConfig {
  /** --eb-* token overrides applied to the chrome (host-piercing). */
  theme?: Record<`--eb-${string}`, string>;
  /** Block type ids enabled in the palette; undefined = all built-ins. */
  enabledBlocks?: string[];
  /** Host uploader; returns the final URL for an image block. */
  onImageUpload?: (file: File) => Promise<string>;
  /** Declarative merge-token sources. */
  tokenSources?: TokenSource[];
  /**
   * Use the Lexical rich-text editor (bold/italic/links/lists, inline toolbar).
   * Default `true`. When `false`, text blocks are edited with a plain textarea
   * (plain paragraphs, no formatting) and the Lexical chunk is never loaded — it's
   * dynamic-imported only when enabled, so opting out keeps it out of the bundle.
   */
  lexicalEditor?: boolean;
}

/** Detail payload of the `change` event. */
export interface RimeChangeDetail {
  doc: RimeDoc;
}

export class RimeEditor extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      display: grid;
      grid-template-columns: var(--eb-palette-width, 240px) 1fr var(--eb-properties-width, 300px);
      grid-template-rows: minmax(0, 1fr);
      grid-template-areas: "palette canvas properties";
      /* The embedder sizes the element (e.g. height: 100vh). Default to a usable
         height so it is never zero/collapsed if unsized. */
      min-block-size: 400px;
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
      display: flex;
      flex-direction: column;
      overflow: auto;
      min-block-size: 0;
      block-size: 100%;
    }
    [part="canvas-frame"] {
      flex: 1 1 auto;
      inline-size: 100%;
      min-block-size: 0;
      border: 0;
    }
    /* The slot is not used while the iframe is the canvas; keep it out of flow. */
    [part="canvas"] > slot {
      display: none;
    }
    [part="properties"] {
      grid-area: properties;
      overflow: auto;
      border-inline-start: 1px solid var(--eb-color-border, #e4e4e7);
    }
  `;

  /** Public configuration. Set as a property (not an attribute). */
  @property({ attribute: false }) config: RimeConfig = {};

  @query('[part="canvas"]') private canvasRegion!: HTMLElement;
  @query("eb-properties-panel") private propertiesPanel!: EbPropertiesPanel;
  @query("eb-palette") private palette!: EbPalette;

  #doc: RimeDoc | null = null;

  #canvas: CanvasController | null = null;
  #renderer: CanvasRenderer | null = null;
  #coords: DragCoordinateController | null = null;
  #dnd: DndController | null = null;
  #keyboard: KeyboardMoveController | null = null;
  #announcer: LiveAnnouncer | null = null;
  #richtext: RichTextProvider | null = null;
  #properties: EbPropertiesPanel | null = null;
  #palette: EbPalette | null = null;
  #paletteCleanups: (() => void)[] = [];
  #selected: string | null = null;
  #onViewportChange: (() => void) | null = null;
  #onKeydown: ((e: KeyboardEvent) => void) | null = null;
  #onCanvasClick: ((e: MouseEvent) => void) | null = null;
  #onCanvasPointerdown: ((e: PointerEvent) => void) | null = null;
  #onCompositionStart: (() => void) | null = null;
  #onCompositionEnd: (() => void) | null = null;
  #newId: IdFactory = createIdFactory();

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has("config")) this.#applyTheme();
  }

  override firstUpdated(): void {
    this.#properties = this.propertiesPanel;
    this.#palette = this.palette;
    this.#syncProperties();
    this.#canvas = new CanvasController();
    this.#canvas.mount(this.canvasRegion);
    void this.#canvas.whenReady().then(({ doc, mount, iframe }) => {
      this.#renderer = new CanvasRenderer(mount, doc, blockRegistry);
      this.#coords = new DragCoordinateController(iframe);
      this.#announcer = new LiveAnnouncer(this.renderRoot as ShadowRoot);
      this.#dnd = new DndController({
        canvasDocument: doc,
        hostWindow: window,
        coords: this.#coords,
        renderer: this.#renderer,
        overlayHost: this.renderRoot as ShadowRoot,
        getDoc: () => {
          if (!this.#doc) throw new Error("no document loaded");
          return this.#doc;
        },
        createBlock: (blockType) => this.#createBlock(blockType),
        isSectionLevel: (blockType) => this.#isSectionLevel(blockType),
        dispatch: (op) => this.#dispatch(op),
        announceDrop: (kind, resultDoc, nodeId) => {
          const msg =
            kind === "insert" ? insertMessage(resultDoc, nodeId) : moveMessage(resultDoc, nodeId);
          this.#announcer?.announce(msg);
        },
        ops: {
          insertNode: (d, parentId, index, node) =>
            insertNode(d, parentId, index, node, this.#validateOptions()),
          moveNode: (d, id, parentId, index) =>
            moveNode(d, id, parentId, index, this.#validateOptions()),
        },
      });
      // Keyboard reordering — the parallel a11y input model (same moveNode op).
      this.#keyboard = new KeyboardMoveController({
        getDoc: () => {
          if (!this.#doc) throw new Error("no document loaded");
          return this.#doc;
        },
        dispatch: (op) => this.#dispatch(op),
        getSelected: () => this.#selected,
        setSelected: (id) => this.#setSelected(id),
        focusNode: (id) => this.#focusNode(id),
        announce: () => {
          // The selected block's new position is read from the post-move doc.
          if (this.#doc && this.#selected) {
            this.#announcer?.announce(moveMessage(this.#doc, this.#selected));
          }
        },
        moveNode: (d, id, parentId, index) =>
          moveNode(d, id, parentId, index, this.#validateOptions()),
      });

      // Select the richtext provider. Lexical is loaded via dynamic import() ONLY
      // when enabled (default) — a code-split point that keeps it out of the bundle
      // when `lexicalEditor: false`. The plain-text fallback is static (no Lexical).
      void this.#initRichText();

      // Entering edit mode is driven by `click` below; blurring here mid-gesture
      // would tear the element down before the browser places the caret.
      this.#onCanvasPointerdown = (e) => {
        const onText = (e.target as HTMLElement | null)?.closest('[data-node-type="text"]');
        if (!onText) this.#richtext?.blur();
      };
      doc.addEventListener("pointerdown", this.#onCanvasPointerdown);

      // IME composition guard: a blur requested mid-composition is deferred until
      // the composition ends, so composed (e.g. CJK) text isn't dropped.
      this.#onCompositionStart = () => this.#richtext?.setComposing(true);
      this.#onCompositionEnd = () => this.#richtext?.setComposing(false);
      doc.addEventListener("compositionstart", this.#onCompositionStart);
      doc.addEventListener("compositionend", this.#onCompositionEnd);

      // The cached iframe rect + any in-drag geometry must refresh on scroll/resize.
      this.#onViewportChange = () => {
        this.#coords?.invalidate();
        this.#dnd?.refreshGeometry();
        this.#richtext?.reposition();
      };
      window.addEventListener("scroll", this.#onViewportChange, true);
      window.addEventListener("resize", this.#onViewportChange);

      // First click selects a block; a second click on an already-selected text
      // block enters edit mode, so selection and editing don't share one gesture.
      this.#onCanvasClick = (e) => {
        const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-node-id]");
        const id = el?.dataset["nodeId"];
        const type = el?.dataset["nodeType"];
        if (id && type && type !== "document" && type !== "section" && type !== "column") {
          const wasSelected = this.#selected === id;
          this.#setSelected(id);
          if (type === "text" && wasSelected) this.#richtext?.focus(id);
        }
      };
      doc.addEventListener("click", this.#onCanvasClick);

      // Alt+Arrows move the selected block; Delete/Backspace removes it. While a
      // text editor is live, those keys belong to the editor (typing), so the
      // structural shortcuts are suppressed until the editor blurs.
      this.#onKeydown = (e) => {
        if (this.#richtext?.activeNodeId) return;
        if ((e.key === "Delete" || e.key === "Backspace") && this.#selected) {
          this.#deleteSelected();
          e.preventDefault();
          return;
        }
        this.#keyboard?.handleKeydown(e);
      };
      doc.addEventListener("keydown", this.#onKeydown);
      this.addEventListener("keydown", this.#onKeydown as EventListener);

      if (this.#doc) {
        this.#renderer.render(this.#doc);
        this.#dnd.syncCanvasTargets();
        this.#makeLeavesFocusable();
      }

      // The palette renders its items; register each as a canvas drag source now
      // that DnD is ready. updateComplete waits for the Lit render to flush.
      void this.#palette?.updateComplete.then(() => this.#registerPaletteSources());
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#onViewportChange) {
      window.removeEventListener("scroll", this.#onViewportChange, true);
      window.removeEventListener("resize", this.#onViewportChange);
      this.#onViewportChange = null;
    }
    const canvasDoc = this.#canvas?.document;
    if (this.#onCanvasClick) canvasDoc?.removeEventListener("click", this.#onCanvasClick);
    if (this.#onCanvasPointerdown) {
      canvasDoc?.removeEventListener("pointerdown", this.#onCanvasPointerdown);
    }
    if (this.#onCompositionStart) {
      canvasDoc?.removeEventListener("compositionstart", this.#onCompositionStart);
    }
    if (this.#onCompositionEnd) {
      canvasDoc?.removeEventListener("compositionend", this.#onCompositionEnd);
    }
    if (this.#onKeydown) {
      canvasDoc?.removeEventListener("keydown", this.#onKeydown);
      this.removeEventListener("keydown", this.#onKeydown as EventListener);
    }
    this.#onCanvasClick = null;
    this.#onCanvasPointerdown = null;
    this.#onCompositionStart = null;
    this.#onCompositionEnd = null;
    this.#onKeydown = null;
    for (const dispose of this.#paletteCleanups) dispose();
    this.#paletteCleanups = [];
    this.#richtext?.destroy();
    this.#richtext = null;
    this.#dnd?.destroy();
    this.#dnd = null;
    this.#keyboard = null;
    this.#announcer?.destroy();
    this.#announcer = null;
    this.#canvas?.destroy();
    this.#canvas = null;
    this.#coords = null;
  }

  /** Register a host palette element as a drag source creating `blockType` (a
   *  registered block type or a column-layout preset id). */
  registerPaletteItem(element: HTMLElement, blockType: string): () => void {
    if (!this.#dnd) throw new Error("drag-and-drop not initialized yet");
    return this.#dnd.registerPaletteItem(element, blockType);
  }

  // Apply an immutable op: adopt the new doc, re-render incrementally, re-sync DnD.
  #dispatch(op: OpResult): void {
    this.#doc = op.doc;
    this.#renderer?.update(op.doc);
    this.#dnd?.syncCanvasTargets();
    this.#makeLeavesFocusable();
    this.#syncProperties();
    this.dispatchEvent(new CustomEvent<RimeChangeDetail>("change", { detail: { doc: op.doc } }));
  }

  // Feed the current doc + selection into the properties panel.
  #syncProperties(): void {
    if (!this.#properties) return;
    this.#properties.doc = this.#doc;
    this.#properties.selectedId = this.#selected;
  }

  // Build the host services a richtext provider needs (no Lexical knowledge here).
  #richTextHost(): RichTextHost {
    return {
      getDoc: () => this.#doc,
      elementForNode: (id) => this.#renderer?.elementForNode(id) ?? null,
      canvasDocument: () => this.#canvas?.document ?? null,
      overlayHost: () => this.renderRoot as ShadowRoot,
      canvasClientToHost: (p) => this.#coords?.canvasClientToHost(p) ?? p,
      hostRect: () => this.getBoundingClientRect(),
      commit: (nodeId, json) =>
        this.#dispatch(setRichText(this.#doc!, nodeId, json, this.#validateOptions())),
      repaint: (nodeId) => this.#renderer?.repaintNode(nodeId),
    };
  }

  // Pick + create the richtext provider. Lexical is dynamic-imported (lazy chunk)
  // only when enabled; the plain-text fallback is static.
  async #initRichText(): Promise<void> {
    const host = this.#richTextHost();
    if (this.config.lexicalEditor === false) {
      this.#richtext = createPlainTextProvider(host);
      return;
    }
    const { createLexicalProvider } = await import("../richtext/provider/lexical-provider");
    // Guard against teardown during the await.
    if (!this.isConnected) return;
    this.#richtext = createLexicalProvider(host);
  }

  // A property-panel edit produced a new doc — apply it through the normal op path.
  #onPropertyChange(e: Event): void {
    const detail = (e as CustomEvent<DocChangeDetail>).detail;
    this.#dispatch({ doc: detail.doc, patch: detail.patch, inverse: detail.inverse });
  }

  // Register each palette item as a canvas drag source (pointer DnD). Re-runnable:
  // disposes prior registrations first.
  #registerPaletteSources(): void {
    for (const dispose of this.#paletteCleanups) dispose();
    this.#paletteCleanups = [];
    if (!this.#palette || !this.#dnd) return;
    for (const item of this.#palette.items) {
      const type = item.dataset["blockType"];
      if (type) this.#paletteCleanups.push(this.registerPaletteItem(item, type));
    }
  }

  // Keyboard "add" from the palette (a11y parity with drag): insert at a sensible
  // default location.
  #onPaletteAdd(e: Event): void {
    this.addBlock((e as CustomEvent<PaletteAddDetail>).detail.id);
  }

  /**
   * Insert a new block (or column-layout preset) at a sensible default location:
   * a section-level block/preset appends to the document; a leaf appends to the end
   * of the selected block's column, else the first column found. Selects + announces
   * the new node. The non-drag (keyboard) path; drag insertion goes through DnD.
   */
  addBlock(blockType: string): void {
    if (!this.#doc) return;
    const node = this.#createBlock(blockType);
    const target = this.#defaultInsertTarget(blockType);
    if (!target) return;
    let op: OpResult;
    try {
      op = insertNode(this.#doc, target.parentId, target.index, node, this.#validateOptions());
    } catch {
      return; // an invalid placement (e.g. no column to hold a leaf) is a no-op
    }
    this.#dispatch(op);
    this.#setSelected(node.id);
    this.#announcer?.announce(insertMessage(op.doc, node.id));
  }

  // Resolve the default parent + index for a keyboard-added block.
  #defaultInsertTarget(blockType: string): { parentId: string; index: number } | null {
    const doc = this.#doc;
    if (!doc) return null;
    if (this.#isSectionLevel(blockType)) {
      return { parentId: doc.id, index: doc.children.length };
    }
    // Leaf: prefer the column holding the selection, else the first column found.
    const columnId = this.#selectedColumnId() ?? this.#firstColumnId();
    if (!columnId) return null;
    const column = findNodeById(doc, columnId) as { children?: unknown[] } | null;
    return { parentId: columnId, index: column?.children?.length ?? 0 };
  }

  #selectedColumnId(): string | null {
    if (!this.#doc || !this.#selected) return null;
    for (const section of this.#doc.children) {
      if (!isSection(section)) continue;
      for (const column of section.children) {
        if (column.id === this.#selected) return column.id;
        if (column.children.some((leaf) => leaf.id === this.#selected)) return column.id;
      }
    }
    return null;
  }

  #firstColumnId(): string | null {
    if (!this.#doc) return null;
    for (const section of this.#doc.children) {
      if (isSection(section) && section.children[0]) return section.children[0].id;
    }
    return null;
  }

  // Make leaf blocks keyboard-reachable so a user can select one to move.
  #makeLeavesFocusable(): void {
    const root = this.#canvas?.mountPoint;
    if (!root) return;
    for (const el of root.querySelectorAll<HTMLElement>("[data-node-id]")) {
      const type = el.dataset["nodeType"];
      if (type && type !== "document" && type !== "section" && type !== "column") {
        if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
      }
    }
  }

  #setSelected(id: string | null): void {
    this.#selected = id;
    this.#syncProperties();
    const root = this.#canvas?.mountPoint;
    if (!root) return;
    for (const el of root.querySelectorAll<HTMLElement>("[data-node-id]")) {
      const isSel = el.dataset["nodeId"] === id;
      el.toggleAttribute("data-selected", isSel);
      if (isSel) el.setAttribute("aria-current", "true");
      else el.removeAttribute("aria-current");
    }
  }

  #focusNode(id: string): void {
    this.#renderer?.elementForNode(id)?.focus();
  }

  // Remove the selected leaf block, announcing it (parent label from BEFORE doc).
  #deleteSelected(): void {
    const id = this.#selected;
    if (!id || !this.#doc) return;
    // Commit + tear down any live editor before a structural change.
    this.#richtext?.blur();
    const before = this.#doc;
    const located = locateForAnnounce(before, id);
    const node = located ? findNodeById(before, id) : null;
    let op: OpResult;
    try {
      op = removeNode(before, id, this.#validateOptions());
    } catch {
      return; // e.g. removing would break a column invariant → no-op
    }
    if (node && located) {
      this.#announcer?.announce(removeMessage(before, node, located.parentId));
    }
    this.#setSelected(null);
    this.#dispatch(op);
  }

  /** The currently selected block id, or null. */
  get selectedNodeId(): string | null {
    return this.#selected;
  }

  // Build a fresh node of the given type for palette drops. The core leaves use
  // their canonical factories; any other registered block (custom leaf or
  // section-level band like a hero) is built from its palette `defaults`, with a
  // fresh id stamped on.
  #createBlock(blockType: string): BaseNode {
    switch (blockType) {
      case "text":
        return createTextBlock(this.#newId);
      case "image":
        return createImageBlock(this.#newId);
      case "button":
        return createButtonBlock(this.#newId);
      case "divider":
        return createDividerBlock(this.#newId);
      case "spacer":
        return createSpacerBlock(this.#newId);
      default: {
        // A column-layout preset builds a whole Section subtree with fresh ids.
        const preset = presetRegistry.get(blockType);
        if (preset) return preset.create(this.#newId);
        const def = blockRegistry.get(blockType);
        if (!def) throw new Error(`unknown block type "${blockType}"`);
        return { ...def.palette.defaults, id: this.#newId(blockType), type: blockType };
      }
    }
  }

  // Whether a palette block type / preset id / node type lives at the document
  // level (a band or a preset's Section subtree), so DnD resolves it between
  // sections rather than into a column.
  #isSectionLevel(blockType: string): boolean {
    if (blockType === "section" || presetRegistry.get(blockType)) return true;
    const def = blockRegistry.get(blockType);
    return def ? placementOf(def) === "section" : false;
  }

  // Validate options the operations need to accept registered blocks: every
  // registered leaf type + every section-level band type.
  #validateOptions(): ValidateOptions {
    return {
      extraLeafTypes: blockRegistry.leafTypes(),
      extraSectionTypes: blockRegistry.sectionTypes(),
    };
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

  loadDoc(doc: RimeDoc): void {
    const isUpdate = this.#doc !== null && this.#renderer !== null;
    this.#doc = doc;
    if (!this.#renderer) return; // canvas not ready yet; firstUpdated paints it
    if (isUpdate) this.#renderer.update(doc);
    else this.#renderer.render(doc);
    this.#dnd?.syncCanvasTargets();
    this.#makeLeavesFocusable();
    this.#syncProperties();
  }

  elementForNode(id: string): HTMLElement | null {
    return this.#renderer?.elementForNode(id) ?? null;
  }

  nodeIdAt(x: number, y: number): string | null {
    return this.#renderer?.nodeIdAt(x, y) ?? null;
  }

  getDoc(): RimeDoc {
    if (!this.#doc) throw new Error("no document loaded");
    return this.#doc;
  }

  override render() {
    return html`
      <section part="palette">
        <eb-palette
          .enabledBlocks=${this.config.enabledBlocks}
          @eb-palette-add=${(e: Event) => this.#onPaletteAdd(e)}
        ></eb-palette>
        <slot name="palette"></slot>
      </section>
      <section part="canvas"><slot name="canvas"></slot></section>
      <section part="properties">
        <eb-properties-panel
          @eb-doc-change=${(e: Event) => this.#onPropertyChange(e)}
        ></eb-properties-panel>
        <slot name="properties"></slot>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "rime-editor": RimeEditor;
  }
}
