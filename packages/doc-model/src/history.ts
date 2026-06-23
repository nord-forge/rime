// Undo/redo as a capped stack of patch/inverse pairs — never full-document
// snapshots (the potato-PC memory constraint). Each editor operation produces a
// { patch, inverse } pair (see the patch engine); History stacks them so undo
// applies an inverse and redo re-applies the patch. Rapid same-target edits
// (e.g. typing into one text block) coalesce into a single history entry.
//
// Pure/headless: holds mutable stacks but never mutates a doc — every doc flows
// through immutable applyPatch. The clock is injectable so tests are
// deterministic without faking timers.

import type { EnveloppeDoc } from "./types";
import { applyPatch, type Patch } from "./patch";

export interface HistoryEntry {
  /** Forward patch (redo). */
  patch: Patch;
  /** Inverse patch (undo). */
  inverse: Patch;
  /** Same key + within the window => merge into the previous entry. */
  coalesceKey?: string;
  /** Wall-clock ms when recorded (from the injectable clock). */
  time: number;
}

export interface HistoryOptions {
  /** Max entries kept; oldest dropped past this. Default 100. */
  maxDepth?: number;
  /** ms window inside which same-key edits coalesce. Default 500. */
  coalesceWindowMs?: number;
  /** Injectable clock for deterministic tests. Defaults to Date.now. */
  now?: () => number;
}

/** An applied operation's result, as produced by the operations layer. */
export interface AppliedOp {
  doc: EnveloppeDoc;
  patch: Patch;
  inverse: Patch;
}

const DEFAULT_MAX_DEPTH = 100;
const DEFAULT_COALESCE_WINDOW_MS = 500;

export class History {
  #doc: EnveloppeDoc;
  readonly #maxDepth: number;
  readonly #coalesceWindowMs: number;
  readonly #now: () => number;
  #undoStack: HistoryEntry[] = [];
  #redoStack: HistoryEntry[] = [];

  constructor(initialDoc: EnveloppeDoc, options: HistoryOptions = {}) {
    this.#doc = initialDoc;
    this.#maxDepth = Math.max(1, options.maxDepth ?? DEFAULT_MAX_DEPTH);
    this.#coalesceWindowMs = options.coalesceWindowMs ?? DEFAULT_COALESCE_WINDOW_MS;
    this.#now = options.now ?? (() => Date.now());
  }

  /** The current document. */
  get doc(): EnveloppeDoc {
    return this.#doc;
  }

  get canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  /** Number of undo entries currently held (after coalescing/capping). */
  get depth(): number {
    return this.#undoStack.length;
  }

  /**
   * Record an applied operation. `next` is the doc AFTER applying `patch`.
   * Any pending redo stack is cleared (standard linear-history model). If
   * `coalesceKey` matches the previous entry within the window (and no redo is
   * pending), the two merge into one entry that a single undo reverts.
   */
  push(next: EnveloppeDoc, patch: Patch, inverse: Patch, coalesceKey?: string): void {
    const time = this.#now();
    const previous = this.#undoStack[this.#undoStack.length - 1];

    const canCoalesce =
      coalesceKey !== undefined &&
      previous !== undefined &&
      previous.coalesceKey === coalesceKey &&
      this.#redoStack.length === 0 &&
      time - previous.time <= this.#coalesceWindowMs;

    // A new edit always invalidates the redo branch.
    this.#redoStack = [];

    if (canCoalesce && previous) {
      // Keep the FIRST entry's inverse (so one undo reverts the whole burst);
      // advance its forward patch and timestamp to the latest edit.
      previous.patch = patch;
      previous.time = time;
    } else {
      this.#undoStack.push({ patch, inverse, coalesceKey, time });
      // Memory cap: drop oldest entries from the front.
      if (this.#undoStack.length > this.#maxDepth) {
        this.#undoStack.splice(0, this.#undoStack.length - this.#maxDepth);
      }
    }

    this.#doc = next;
  }

  /** Convenience: record an operation result without destructuring. */
  record(result: AppliedOp, coalesceKey?: string): void {
    this.push(result.doc, result.patch, result.inverse, coalesceKey);
  }

  /** Step backward: apply the top entry's inverse. Throws if `!canUndo`. */
  undo(): EnveloppeDoc {
    const entry = this.#undoStack.pop();
    if (!entry) throw new Error("nothing to undo");
    this.#doc = applyPatch(this.#doc, entry.inverse);
    this.#redoStack.push(entry);
    return this.#doc;
  }

  /** Step forward: re-apply the top redo entry's patch. Throws if `!canRedo`. */
  redo(): EnveloppeDoc {
    const entry = this.#redoStack.pop();
    if (!entry) throw new Error("nothing to redo");
    this.#doc = applyPatch(this.#doc, entry.patch);
    this.#undoStack.push(entry);
    return this.#doc;
  }

  /** Reset both stacks; keeps the current document. */
  clear(): void {
    this.#undoStack = [];
    this.#redoStack = [];
  }
}
