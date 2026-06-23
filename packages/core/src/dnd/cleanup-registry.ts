// A countable, disposable registry for every listener / rAF / node-removal a
// drag operation sets up (PRD §10: no leaked listeners/observers across drags).
// Routing all transient registrations through one place lets a test assert the
// live count returns to baseline after each drag and that destroy() reaches zero.

export class CleanupRegistry {
  readonly #fns = new Set<() => void>();

  /**
   * Register a cleanup fn. Returns a disposer that runs it AND removes it from
   * the set (so calling the disposer is idempotent and keeps `size` accurate).
   */
  add(fn: () => void): () => void {
    this.#fns.add(fn);
    return () => {
      if (this.#fns.delete(fn)) fn();
    };
  }

  /** Number of live (undisposed) cleanups. */
  get size(): number {
    return this.#fns.size;
  }

  /** Run and clear every registered cleanup. */
  disposeAll(): void {
    for (const fn of this.#fns) fn();
    this.#fns.clear();
  }
}
