// The canvas is a same-origin `srcdoc` iframe. Two consequences make
// this the right shape: host-app CSS physically cannot reach the email preview
// (the iframe boundary), and hit-testing has a clean, iframe-local coordinate
// system (elementFromPoint answers about the canvas, not the host).
//
// CanvasController owns one iframe's lifecycle. The shell creates it and mounts
// the iframe into part="canvas"; the doc→DOM renderer draws into #eb-root.

/** Resolved when the canvas document has loaded and its mount node is ready. */
export interface CanvasReadyEvent {
  doc: Document;
  mount: HTMLElement;
  iframe: HTMLIFrameElement;
}

// Minimal, self-contained canvas document — no external requests. `#eb-base` is
// the swappable email stylesheet; `#eb-root` is where the renderer draws.
const SRCDOC = `<!doctype html><html><head><meta charset="utf-8">
<style id="eb-base">*,*::before,*::after{box-sizing:border-box}html,body{margin:0}body{font:15px system-ui;background:#fff}</style>
</head><body><div id="eb-root"></div></body></html>`;

export class CanvasController {
  readonly iframe: HTMLIFrameElement;

  #ready: Promise<CanvasReadyEvent>;
  #resolveReady!: (event: CanvasReadyEvent) => void;
  #onLoad: (() => void) | null = null;
  #mounted = false;

  constructor() {
    this.iframe = document.createElement("iframe");
    this.iframe.setAttribute("part", "canvas-frame");
    this.iframe.setAttribute("title", "Email canvas");
    // Same-origin is required (contentDocument / elementFromPoint / selection).
    // srcdoc is same-origin by default; we do NOT sandbox it away. No script
    // executes inside the canvas in v1 (the host renders into it).
    this.#ready = new Promise<CanvasReadyEvent>((resolve) => {
      this.#resolveReady = resolve;
    });
  }

  /** Append the iframe into `into` and load the canvas document. */
  mount(into: HTMLElement): void {
    if (this.#mounted) return;
    this.#mounted = true;

    this.#onLoad = () => {
      const doc = this.iframe.contentDocument;
      const mount = doc?.getElementById("eb-root");
      if (doc && mount) {
        this.#resolveReady({ doc, mount, iframe: this.iframe });
      }
    };
    this.iframe.addEventListener("load", this.#onLoad);
    into.append(this.iframe);
    this.iframe.srcdoc = SRCDOC;
  }

  /** Resolves once the canvas document has loaded. */
  whenReady(): Promise<CanvasReadyEvent> {
    return this.#ready;
  }

  /** The canvas document, or null before load. */
  get document(): Document | null {
    return this.iframe.contentDocument;
  }

  /** The `#eb-root` render node, or null before load. */
  get mountPoint(): HTMLElement | null {
    return this.iframe.contentDocument?.getElementById("eb-root") ?? null;
  }

  /** Replace the injected email base stylesheet (`#eb-base`). */
  setBaseStyles(css: string): void {
    const style = this.iframe.contentDocument?.getElementById("eb-base");
    if (style) style.textContent = css;
  }

  /** Remove the iframe and its listeners; null internal refs (memory discipline). */
  destroy(): void {
    if (this.#onLoad) {
      this.iframe.removeEventListener("load", this.#onLoad);
      this.#onLoad = null;
    }
    this.iframe.remove();
    this.#mounted = false;
  }
}
