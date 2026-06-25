// The richtext seam. The editor depends ONLY on this interface — never on Lexical
// directly — so the Lexical implementation can be loaded via a dynamic import()
// (a code-split point that keeps Lexical out of the main chunk) and swapped for a
// plain-text fallback when `defineRimeEditor({ lexicalEditor: false })` is set.
//
// A provider owns everything richtext: the edit lifecycle (one editor at a time),
// any inline UI (toolbar / link popover) it needs, and re-positioning that UI as the
// selection moves. It mounts its own UI into the host's shadow root.

import type { NodeId, RichTextJSON, RimeDoc } from "@nord-forge/rime-model";
import type { TokenItem } from "../token-picker/token-filter";

/** Services the host editor exposes to a provider (no Lexical knowledge here). */
export interface RichTextHost {
  /** Current document (source of truth a focused block is seeded from). */
  getDoc(): RimeDoc | null;
  /** The merge tags available to the token picker (flattened from the host's
   *  token sources / registry). Empty when none are configured. */
  tokens(): TokenItem[];
  /** The TextBlock element inside the canvas iframe for a node id, or null. */
  elementForNode(id: NodeId): HTMLElement | null;
  /** The canvas iframe document (selection lives here). */
  canvasDocument(): Document | null;
  /** Where inline chrome (toolbar/popover) is appended — the shadow root. */
  overlayHost(): ParentNode & { ownerDocument: Document };
  /** Map a canvas-iframe client point to host space (for positioning chrome). */
  canvasClientToHost(p: { x: number; y: number }): { x: number; y: number };
  /** The host element's bounding rect (chrome is positioned relative to it). */
  hostRect(): DOMRect;
  /** Commit edited content back to the doc (skip-if-unchanged handled by host). */
  commit(nodeId: NodeId, json: RichTextJSON): void;
  /** Restore a block's static WYSIWYG view after an editor detaches. */
  repaint(nodeId: NodeId): void;
}

/** The richtext editing surface the host drives. Both Lexical + plain-text impls
 *  satisfy this. */
export interface RichTextProvider {
  /** The node currently being edited, or null. */
  readonly activeNodeId: NodeId | null;
  /** Optional one-time warm-up after init: pay the editor's cold-start cost (engine
   *  class init + first mount) on a throwaway instance during idle init time, so the
   *  user's FIRST real focus is warm — no first-edit stutter. No-op when there's
   *  nothing to warm (the plain-text fallback). Must leave zero live editors. */
  prewarm?(): void;
  /** Begin editing a TextBlock (mounts the editor / opens the fallback field). */
  focus(nodeId: NodeId): void;
  /** Commit + end editing. No-op when nothing is active. */
  blur(): void;
  /** IME composition guard: defer blur while composing (Lexical impl uses it;
   *  the plain textarea is naturally composition-safe but implements it as a no-op). */
  setComposing(composing: boolean): void;
  /** Insert a merge tag at the current selection in the active editor. No-op when
   *  nothing is focused. The token picker (chrome UI) drives this. */
  insertToken(token: string, label?: string): void;
  /** Re-position any inline chrome (called on selectionchange / scroll / resize). */
  reposition(): void;
  /** Commit + tear down; refuse further focus. Removes any chrome it created. */
  destroy(): void;
}
