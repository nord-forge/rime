// <rime-editor> — the public custom element: the shell hosting the palette,
// canvas, and properties regions. Chrome is themed via --eb-* custom properties.

import { type CSSResultGroup, LitElement, css, html } from "lit";
import { property, query } from "lit/decorators.js";
import {
  createButtonBlock,
  createDividerBlock,
  createIdFactory,
  createImageBlock,
  createSpacerBlock,
  createTextBlock,
  type RimeDoc,
  type IdFactory,
  insertNode,
  type LeafBlock,
  moveNode,
  type OpResult,
  removeNode,
  setRichText,
} from "@nord-forge/rime-model";
import { CanvasController, type CanvasReadyEvent } from "../canvas/iframe-canvas/iframe-canvas";
import { CanvasRenderer } from "../canvas/canvas-renderer/canvas-renderer";
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
import { RichTextLifecycle } from "../richtext/richtext-lifecycle/richtext-lifecycle";
import { canonicalize, richTextEqual } from "../richtext/serialize/serialize";
import { RichTextToolbar } from "../richtext/ui/rich-text-toolbar";
import { type LinkApplyDetail, LinkPopover } from "../richtext/ui/link-popover";
import { makeCommands } from "../richtext/ui/rich-text-commands";

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

  #doc: RimeDoc | null = null;

  #canvas: CanvasController | null = null;
  #renderer: CanvasRenderer | null = null;
  #coords: DragCoordinateController | null = null;
  #dnd: DndController | null = null;
  #keyboard: KeyboardMoveController | null = null;
  #announcer: LiveAnnouncer | null = null;
  #richtext: RichTextLifecycle | null = null;
  #toolbar: RichTextToolbar | null = null;
  #linkPopover: LinkPopover | null = null;
  #selected: string | null = null;
  #onViewportChange: (() => void) | null = null;
  #onKeydown: ((e: KeyboardEvent) => void) | null = null;
  #onCanvasClick: ((e: MouseEvent) => void) | null = null;
  #onCanvasPointerdown: ((e: PointerEvent) => void) | null = null;
  #newId: IdFactory = createIdFactory();

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has("config")) this.#applyTheme();
  }

  override firstUpdated(): void {
    this.#canvas = new CanvasController();
    this.#canvas.mount(this.canvasRegion);
    void this.#canvas.whenReady().then(({ doc, mount, iframe }) => {
      this.#renderer = new CanvasRenderer(mount, doc);
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
        dispatch: (op) => this.#dispatch(op),
        announceDrop: (kind, resultDoc, nodeId) => {
          const msg =
            kind === "insert" ? insertMessage(resultDoc, nodeId) : moveMessage(resultDoc, nodeId);
          this.#announcer?.announce(msg);
        },
        ops: { insertNode, moveNode },
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
        moveNode,
      });

      this.#setupRichTextUi(doc);

      this.#richtext = new RichTextLifecycle({
        getDoc: () => this.#doc,
        elementForNode: (id) => this.#renderer?.elementForNode(id) ?? null,
        onCommit: (nodeId, json) => {
          if (!this.#doc) return;
          const node = findNodeById(this.#doc, nodeId);
          // Skip the commit when nothing changed, so focus/blur alone adds no undo entry.
          if (node?.type === "text" && richTextEqual(canonicalize(node.content), json)) return;
          this.#dispatch(setRichText(this.#doc, nodeId, json));
        },
        repaint: (nodeId) => this.#renderer?.repaintNode(nodeId),
        onActiveChange: (mount) => {
          this.#toolbar?.bind(mount?.editor ?? null);
          if (!mount) this.#linkPopover?.hide();
          this.#repositionToolbar();
        },
      });

      // Entering edit mode is driven by `click` below; blurring here mid-gesture
      // would tear the element down before the browser places the caret.
      this.#onCanvasPointerdown = (e) => {
        const onText = (e.target as HTMLElement | null)?.closest('[data-node-type="text"]');
        if (!onText) this.#richtext?.blur();
      };
      doc.addEventListener("pointerdown", this.#onCanvasPointerdown);

      // The cached iframe rect + any in-drag geometry must refresh on scroll/resize.
      this.#onViewportChange = () => {
        this.#coords?.invalidate();
        this.#dnd?.refreshGeometry();
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
    if (this.#onKeydown) {
      canvasDoc?.removeEventListener("keydown", this.#onKeydown);
      this.removeEventListener("keydown", this.#onKeydown as EventListener);
    }
    this.#onCanvasClick = null;
    this.#onCanvasPointerdown = null;
    this.#onKeydown = null;
    this.#richtext?.destroy();
    this.#richtext = null;
    this.#toolbar?.remove();
    this.#toolbar = null;
    this.#linkPopover?.remove();
    this.#linkPopover = null;
    this.#dnd?.destroy();
    this.#dnd = null;
    this.#keyboard = null;
    this.#announcer?.destroy();
    this.#announcer = null;
    this.#canvas?.destroy();
    this.#canvas = null;
    this.#coords = null;
  }

  /** Register a host palette element as a drag source creating `blockType`. */
  registerPaletteItem(element: HTMLElement, blockType: LeafBlock["type"]): () => void {
    if (!this.#dnd) throw new Error("drag-and-drop not initialized yet");
    return this.#dnd.registerPaletteItem(element, blockType);
  }

  // Apply an immutable op: adopt the new doc, re-render incrementally, re-sync DnD.
  #dispatch(op: OpResult): void {
    this.#doc = op.doc;
    this.#renderer?.update(op.doc);
    this.#dnd?.syncCanvasTargets();
    this.#makeLeavesFocusable();
    this.dispatchEvent(new CustomEvent<RimeChangeDetail>("change", { detail: { doc: op.doc } }));
  }

  #setupRichTextUi(canvasDoc: Document): void {
    const root = this.renderRoot as ShadowRoot;
    const toolbar = new RichTextToolbar();
    const popover = new LinkPopover();
    root.append(toolbar, popover);
    this.#toolbar = toolbar;
    this.#linkPopover = popover;

    toolbar.addEventListener("eb-request-link", () => {
      this.#positionPopover();
      popover.show(this.#currentLinkHref());
    });

    popover.addEventListener("eb-link-apply", (e: Event) => {
      const detail = (e as CustomEvent<LinkApplyDetail>).detail;
      const mount = this.#richtext?.activeMount;
      if (mount) makeCommands(mount.editor).setLink(detail.href);
      mount?.editor.focus();
    });
    popover.addEventListener("eb-link-cancel", () => this.#richtext?.activeMount?.editor.focus());

    // Reposition the toolbar as the in-iframe selection moves.
    canvasDoc.addEventListener("selectionchange", () => this.#repositionToolbar());
  }

  #currentLinkHref(): string | null {
    const el = this.#richtext?.activeNodeId
      ? this.#renderer?.elementForNode(this.#richtext.activeNodeId)
      : null;
    const sel = this.#canvas?.document?.getSelection();
    if (!sel || sel.rangeCount === 0 || !el) return null;
    let node: Node | null = sel.getRangeAt(0).startContainer;
    while (node && node !== el) {
      if (node instanceof HTMLAnchorElement) return node.getAttribute("href");
      node = node.parentNode;
    }
    return null;
  }

  #repositionToolbar(): void {
    const toolbar = this.#toolbar;
    const coords = this.#coords;
    const canvasDoc = this.#canvas?.document;
    if (!toolbar || !coords || !canvasDoc) return;
    if (!this.#richtext?.activeNodeId) {
      toolbar.open = false;
      return;
    }
    const sel = canvasDoc.getSelection();
    if (!sel || sel.rangeCount === 0) {
      toolbar.open = false;
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    // A collapsed caret has a zero-width rect; still show the bar above the line.
    const host = coords.canvasClientToHost({ x: rect.left, y: rect.top });
    const hostRect = this.getBoundingClientRect();
    toolbar.style.left = `${host.x - hostRect.left}px`;
    toolbar.style.top = `${host.y - hostRect.top - 40}px`;
    toolbar.open = true;
  }

  #positionPopover(): void {
    const popover = this.#linkPopover;
    const toolbar = this.#toolbar;
    if (!popover || !toolbar) return;
    popover.style.left = toolbar.style.left;
    popover.style.top = `${parseFloat(toolbar.style.top || "0") + 36}px`;
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
      op = removeNode(before, id);
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

  // Build a fresh leaf block of the given type for palette drops.
  #createBlock(blockType: LeafBlock["type"]): LeafBlock {
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
      default:
        throw new Error(`unknown block type "${blockType}"`);
    }
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
      <section part="palette"><slot name="palette"></slot></section>
      <section part="canvas"><slot name="canvas"></slot></section>
      <section part="properties"><slot name="properties"></slot></section>
    `;
  }
}

if (!customElements.get("rime-editor")) {
  customElements.define("rime-editor", RimeEditor);
}

declare global {
  interface HTMLElementTagNameMap {
    "rime-editor": RimeEditor;
  }
}
