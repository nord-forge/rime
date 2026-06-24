// Single-instance rich-text lifecycle. The hard memory constraint
// is: **exactly one Lexical editor alive at a time**, no matter how many TextBlocks
// the email has. N live contenteditable editors would wreck a low-end machine. The
// controller mounts one editor on focus and destroys it on blur, and guarantees
// destroy-precedes-create so there is never a window with two live mounts.
//
// It owns no DOM knowledge of its own — focus wiring and the iframe document are
// injected — so it is pure-unit-testable with a fake mounter.

import type { NodeId, RichTextJSON, RimeDoc } from "@nord-forge/rime-model";
import { type LexicalMount, mountLexical } from "../lexical-editor/lexical-editor";
import { findNodeById } from "../../a11y/announce-messages/announce-messages";

/** Mounts a Lexical editor on an element — injectable so tests can fake it. */
export type Mounter = (blockEl: HTMLElement, initial: RichTextJSON) => LexicalMount;

export interface RichTextLifecycleDeps {
  /** Current document — the source of truth a focused block is seeded from. */
  getDoc(): RimeDoc | null;
  /** The TextBlock element inside the iframe for a node id, or null if absent. */
  elementForNode(id: NodeId): HTMLElement | null;
  /** Blur write-back: called with the editor's JSON before it is destroyed. */
  onCommit(nodeId: NodeId, json: RichTextJSON): void;
  /**
   * Restore the block's static WYSIWYG view after the editor detaches (the editor
   * leaves its element empty/annotated). Called after `destroy()`, before re-focus.
   */
  repaint?(nodeId: NodeId): void;
  /** Notified whenever the active mount changes (mount on focus, null on blur). */
  onActiveChange?(active: LexicalMount | null): void;
  /** Mount implementation; defaults to the real headless Lexical mounter. */
  mount?: Mounter;
}

interface Active {
  nodeId: NodeId;
  mount: LexicalMount;
  el: HTMLElement;
}

/**
 * Owner of the (at most one) live rich-text editor. Drive it with `focus(nodeId)`
 * / `blur()`; it enforces the single-instance invariant across focus changes.
 */
export class RichTextLifecycle {
  #active: Active | null = null;
  #mount: Mounter;
  #destroyed = false;
  #composing = false;
  #blurPending = false;

  constructor(private readonly deps: RichTextLifecycleDeps) {
    this.#mount = deps.mount ?? mountLexical;
  }

  /**
   * Mark whether an IME composition is in progress. While composing, a blur is
   * deferred (committing/destroying mid-composition corrupts composed text); when
   * composition ends, any pending blur is flushed.
   */
  setComposing(composing: boolean): void {
    this.#composing = composing;
    if (!composing && this.#blurPending) {
      this.#blurPending = false;
      this.blur();
    }
  }

  /** Whether an IME composition is currently in progress. */
  get composing(): boolean {
    return this.#composing;
  }

  /** The node currently being edited, or null. */
  get activeNodeId(): NodeId | null {
    return this.#active?.nodeId ?? null;
  }

  /** The live mount currently being edited, or null. */
  get activeMount(): LexicalMount | null {
    return this.#active?.mount ?? null;
  }

  /**
   * Focus a TextBlock: tear down any active editor (committing it first), then
   * mount exactly one editor on the target. Re-focusing the active block is a
   * no-op — internal selection changes must not churn the editor.
   */
  focus(nodeId: NodeId): void {
    if (this.#destroyed) return;
    if (this.#active?.nodeId === nodeId) return; // already editing it

    // Destroy precedes create: never two live mounts at once.
    if (this.#active) this.blur();

    const el = this.deps.elementForNode(nodeId);
    if (!el) return;

    const doc = this.deps.getDoc();
    const node = doc ? findNodeById(doc, nodeId) : null;
    if (!node || node.type !== "text") return;

    const mount = this.#mount(el, node.content);
    this.#active = { nodeId, mount, el };
    this.deps.onActiveChange?.(mount);
  }

  /**
   * Blur the active editor: serialize + fire `onCommit` (write-back), then
   * destroy it and release all references. No-op when nothing is active.
   */
  blur(): void {
    const active = this.#active;
    if (!active) return;
    // Defer blur until the IME composition finishes — committing or destroying the
    // editor mid-composition drops/corrupts the composed text.
    if (this.#composing) {
      this.#blurPending = true;
      return;
    }
    // Null the ref BEFORE destroy so a re-entrant focus during onCommit can't see
    // a half-destroyed mount.
    this.#active = null;
    this.deps.onActiveChange?.(null);
    try {
      this.deps.onCommit(active.nodeId, active.mount.toJSON());
    } finally {
      active.mount.destroy();
      // The editor left the element empty; restore its static WYSIWYG view.
      this.deps.repaint?.(active.nodeId);
    }
  }

  /** Blur (committing) and refuse further focus/blur. Idempotent. */
  destroy(): void {
    this.#composing = false; // teardown is not deferred for composition
    this.blur();
    this.#destroyed = true;
  }
}
