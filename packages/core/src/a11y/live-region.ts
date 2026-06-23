// A polite ARIA live region (PRD §6.6). Structural changes (move/insert/delete)
// set its text so screen readers announce them. Lives in the host document/shadow
// root (screen readers track the host, not the iframe canvas), uses the
// visually-hidden CLIP pattern (display:none would suppress announcements), and
// clears-then-sets so an identical consecutive message is re-announced.

export class LiveAnnouncer {
  readonly #el: HTMLElement;
  #clearTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(parent: ParentNode & { ownerDocument: Document }) {
    this.#el = parent.ownerDocument.createElement("div");
    this.#el.setAttribute("aria-live", "polite");
    this.#el.setAttribute("aria-atomic", "true");
    this.#el.setAttribute("role", "status");
    // Visually-hidden clip pattern (NOT display:none — that mutes SR output).
    this.#el.style.cssText = [
      "position:absolute",
      "inline-size:1px",
      "block-size:1px",
      "margin:-1px",
      "padding:0",
      "overflow:hidden",
      "clip:rect(0 0 0 0)",
      "clip-path:inset(50%)",
      "white-space:nowrap",
      "border:0",
    ].join(";");
    parent.append(this.#el);
  }

  /** Announce a message. Clears then sets so identical repeats re-read. */
  announce(message: string): void {
    this.#el.textContent = "";
    if (this.#clearTimer) clearTimeout(this.#clearTimer);
    // Set on a microtask/short delay so the cleared→set transition is observed.
    this.#clearTimer = setTimeout(() => {
      this.#el.textContent = message;
    }, 0);
  }

  /** Current live-region text (for tests). */
  get current(): string {
    return this.#el.textContent ?? "";
  }

  destroy(): void {
    if (this.#clearTimer) clearTimeout(this.#clearTimer);
    this.#clearTimer = null;
    this.#el.remove();
  }
}
