// The no-Lexical fallback richtext provider. Editing a text block opens a plain
// <textarea> over it (inside the canvas iframe); on blur the text is committed back
// to the doc as plain RichTextJSON paragraphs. No toolbar, no marks/links — a
// "pure HTML textual" editor. Pulls NO Lexical, so a build that uses only this
// provider drops the Lexical chunk entirely.

import type { NodeId } from "@nord-forge/rime-model";
import type { RichTextHost, RichTextProvider } from "./richtext-provider";
import { findNodeById } from "../../a11y/announce-messages/announce-messages";
import { plainToRichText, richTextToPlain } from "./plain-text";

interface Active {
  nodeId: NodeId;
  el: HTMLElement;
  textarea: HTMLTextAreaElement;
}

export class PlainTextRichTextProvider implements RichTextProvider {
  readonly #host: RichTextHost;
  #active: Active | null = null;
  #destroyed = false;

  constructor(host: RichTextHost) {
    this.#host = host;
  }

  get activeNodeId(): NodeId | null {
    return this.#active?.nodeId ?? null;
  }

  focus(nodeId: NodeId): void {
    if (this.#destroyed || this.#active?.nodeId === nodeId) return;
    if (this.#active) this.blur();

    const el = this.#host.elementForNode(nodeId);
    const doc = this.#host.getDoc();
    const node = doc ? findNodeById(doc, nodeId) : null;
    if (!el || !node || node.type !== "text") return;

    const canvasDoc = el.ownerDocument;
    const textarea = canvasDoc.createElement("textarea");
    textarea.value = richTextToPlain(node.content);
    // Fill the block's box so editing feels in-place; inherit type styles.
    textarea.style.cssText =
      "inline-size:100%;box-sizing:border-box;border:0;outline:0;resize:none;" +
      "background:transparent;font:inherit;color:inherit;padding:0;margin:0";
    textarea.rows = Math.max(1, node.content.content.length);
    // Replace the static view with the editor; restored by repaint() on blur.
    el.replaceChildren(textarea);
    textarea.addEventListener("blur", () => this.blur());
    textarea.focus();

    this.#active = { nodeId, el, textarea };
  }

  blur(): void {
    const active = this.#active;
    if (!active) return;
    this.#active = null;
    this.#host.commit(active.nodeId, plainToRichText(active.textarea.value));
    // Rebuild the static WYSIWYG view (the textarea is discarded).
    this.#host.repaint(active.nodeId);
  }

  // The plain textarea handles IME natively; nothing to defer.
  setComposing(): void {}

  // No inline chrome to reposition.
  reposition(): void {}

  destroy(): void {
    this.blur();
    this.#destroyed = true;
  }
}

export function createPlainTextProvider(host: RichTextHost): RichTextProvider {
  return new PlainTextRichTextProvider(host);
}
