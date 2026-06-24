// The single owner of host-pointer ↔ canvas-iframe coordinate translation and
// hit-testing. DnD, drop-zone detection, and selection all go through
// here so the math lives in one place — re-deriving it per consumer is how it
// breaks (especially in WebKit, which has diverged on iframe rects under scroll
// and on elementFromPoint's coordinate basis).
//
// Two coordinate spaces matter:
//  - host CLIENT coords (clientX/Y in the host viewport)
//  - canvas DOCUMENT coords (inside the iframe, post-scroll)
// elementFromPoint inside the iframe takes the iframe's CLIENT (viewport,
// pre-scroll) coords — kept as a distinct private helper so the scroll case is
// unambiguous.

export interface Point {
  x: number;
  y: number;
}

/** The iframe surface this controller needs. Narrowed for testability. */
export interface CanvasFrameLike {
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
  readonly contentWindow: { scrollX: number; scrollY: number } | null;
  readonly contentDocument: Document | null;
}

export class DragCoordinateController {
  readonly #iframe: CanvasFrameLike;
  #rect: { left: number; top: number; width: number; height: number } | null = null;

  constructor(iframe: CanvasFrameLike) {
    this.#iframe = iframe;
  }

  /** Cached iframe bounding rect (recomputed after invalidate()). */
  #frameRect(): { left: number; top: number; width: number; height: number } {
    if (!this.#rect) this.#rect = this.#iframe.getBoundingClientRect();
    return this.#rect;
  }

  #scroll(): Point {
    const win = this.#iframe.contentWindow;
    return { x: win?.scrollX ?? 0, y: win?.scrollY ?? 0 };
  }

  /**
   * Host client coords → iframe VIEWPORT (client) coords, pre-scroll. This is the
   * space getBoundingClientRect() and elementFromPoint() use inside the iframe.
   */
  hostToCanvasClient(p: Point): Point {
    const r = this.#frameRect();
    return { x: p.x - r.left, y: p.y - r.top };
  }

  /** Iframe VIEWPORT (client) coords → host client coords. Inverse of hostToCanvasClient. */
  canvasClientToHost(p: Point): Point {
    const r = this.#frameRect();
    return { x: p.x + r.left, y: p.y + r.top };
  }

  /** Host client coords → iframe DOCUMENT coords (post-scroll). */
  hostToCanvas(p: Point): Point {
    const client = this.hostToCanvasClient(p);
    const s = this.#scroll();
    return { x: client.x + s.x, y: client.y + s.y };
  }

  /** Iframe DOCUMENT coords → host client coords. Inverse of hostToCanvas. */
  canvasToHost(p: Point): Point {
    const r = this.#frameRect();
    const s = this.#scroll();
    return { x: p.x - s.x + r.left, y: p.y - s.y + r.top };
  }

  /** Is a host pointer over the canvas viewport? */
  isOverCanvas(p: Point): boolean {
    const r = this.#frameRect();
    return p.x >= r.left && p.x <= r.left + r.width && p.y >= r.top && p.y <= r.top + r.height;
  }

  /** Node id under a HOST pointer (translation + hit-test in one call), or null. */
  nodeIdAtHostPoint(p: Point): string | null {
    const doc = this.#iframe.contentDocument;
    if (!doc) return null;
    // elementFromPoint takes iframe VIEWPORT coords (pre-scroll).
    const client = this.hostToCanvasClient(p);
    const hit = doc.elementFromPoint(client.x, client.y) as HTMLElement | null;
    return hit?.closest<HTMLElement>("[data-node-id]")?.dataset["nodeId"] ?? null;
  }

  /** Invalidate the cached iframe rect (call on host scroll/resize). */
  invalidate(): void {
    this.#rect = null;
  }
}
