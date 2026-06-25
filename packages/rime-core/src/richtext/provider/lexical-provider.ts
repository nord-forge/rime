// The full-featured richtext provider: headless Lexical + the inline toolbar and
// link popover. This module is the ONLY static entry to Lexical from the editor's
// runtime — the editor loads it via dynamic import() (a code-split boundary), so
// Lexical lands in a lazy chunk that is never fetched when richtext is disabled.

import type { NodeId } from "@nord-forge/rime-model";
import type { RichTextHost, RichTextProvider } from "./richtext-provider";
import { RichTextLifecycle } from "../richtext-lifecycle/richtext-lifecycle";
import { canonicalize, richTextEqual } from "../serialize/serialize";
import { RichTextToolbar } from "../ui/rich-text-toolbar";
import { type LinkApplyDetail, LinkPopover } from "../ui/link-popover";
import { makeCommands } from "../ui/rich-text-commands";
import { findNodeById } from "../../a11y/announce-messages/announce-messages";
import type { LexicalMount } from "../lexical-editor/lexical-editor";

export class LexicalRichTextProvider implements RichTextProvider {
  readonly #host: RichTextHost;
  readonly #lifecycle: RichTextLifecycle;
  readonly #toolbar: RichTextToolbar;
  readonly #popover: LinkPopover;
  readonly #onSelectionChange: () => void;

  constructor(host: RichTextHost) {
    this.#host = host;
    const root = host.overlayHost();
    this.#toolbar = new RichTextToolbar();
    this.#popover = new LinkPopover();
    root.append(this.#toolbar, this.#popover);

    this.#toolbar.addEventListener("eb-request-link", () => {
      this.#positionPopover();
      this.#popover.show(this.#currentLinkHref());
    });
    this.#popover.addEventListener("eb-link-apply", (e: Event) => {
      const detail = (e as CustomEvent<LinkApplyDetail>).detail;
      const mount = this.#lifecycle.activeMount;
      if (mount) makeCommands(mount.editor).setLink(detail.href);
      mount?.editor.focus();
    });
    this.#popover.addEventListener("eb-link-cancel", () =>
      this.#lifecycle.activeMount?.editor.focus(),
    );

    this.#lifecycle = new RichTextLifecycle({
      getDoc: () => host.getDoc(),
      elementForNode: (id) => host.elementForNode(id),
      onCommit: (nodeId, json) => {
        const doc = host.getDoc();
        if (!doc) return;
        const node = findNodeById(doc, nodeId);
        // Skip the commit when nothing changed, so focus/blur alone adds no undo entry.
        if (node?.type === "text" && richTextEqual(canonicalize(node.content), json)) return;
        host.commit(nodeId, json);
      },
      repaint: (nodeId) => host.repaint(nodeId),
      onActiveChange: (mount: LexicalMount | null) => {
        this.#toolbar.bind(mount?.editor ?? null);
        if (!mount) this.#popover.hide();
        this.reposition();
      },
    });

    this.#onSelectionChange = () => this.reposition();
    host.canvasDocument()?.addEventListener("selectionchange", this.#onSelectionChange);
  }

  get activeNodeId(): NodeId | null {
    return this.#lifecycle.activeNodeId;
  }

  focus(nodeId: NodeId): void {
    this.#lifecycle.focus(nodeId);
  }

  blur(): void {
    this.#lifecycle.blur();
  }

  setComposing(composing: boolean): void {
    this.#lifecycle.setComposing(composing);
  }

  reposition(): void {
    const canvasDoc = this.#host.canvasDocument();
    if (!canvasDoc) return;
    if (!this.#lifecycle.activeNodeId) {
      this.#toolbar.open = false;
      return;
    }
    const sel = canvasDoc.getSelection();
    if (!sel || sel.rangeCount === 0) {
      this.#toolbar.open = false;
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    // A collapsed caret has a zero-width rect; still show the bar above the line.
    const host = this.#host.canvasClientToHost({ x: rect.left, y: rect.top });
    const hostRect = this.#host.hostRect();
    this.#toolbar.style.left = `${host.x - hostRect.left}px`;
    this.#toolbar.style.top = `${host.y - hostRect.top - 40}px`;
    this.#toolbar.open = true;
  }

  destroy(): void {
    this.#host.canvasDocument()?.removeEventListener("selectionchange", this.#onSelectionChange);
    this.#lifecycle.destroy();
    this.#toolbar.remove();
    this.#popover.remove();
  }

  #positionPopover(): void {
    this.#popover.style.left = this.#toolbar.style.left;
    this.#popover.style.top = `${parseFloat(this.#toolbar.style.top || "0") + 36}px`;
  }

  #currentLinkHref(): string | null {
    const el = this.#lifecycle.activeNodeId
      ? this.#host.elementForNode(this.#lifecycle.activeNodeId)
      : null;
    const sel = this.#host.canvasDocument()?.getSelection();
    if (!sel || sel.rangeCount === 0 || !el) return null;
    let node: Node | null = sel.getRangeAt(0).startContainer;
    while (node && node !== el) {
      if (node instanceof HTMLAnchorElement) return node.getAttribute("href");
      node = node.parentNode;
    }
    return null;
  }
}

// The dynamic-import entry the editor calls. Returning a factory keeps the editor's
// await-import site tiny and gives it the host-injection point.
export function createLexicalProvider(host: RichTextHost): RichTextProvider {
  return new LexicalRichTextProvider(host);
}
