// Preload: register a happy-dom environment as the GLOBAL document/window BEFORE any
// test module (or Vue) is imported, so Vue's runtime-dom — which captures `document`
// at module-eval time — sees a real DOM. Without this, Vue caches a null document.
import { Window } from "happy-dom";

const win = new Window();
const GLOBALS = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "SVGElement",
  "Element",
  "customElements",
  "Node",
  "Text",
  "Comment",
  "DocumentFragment",
  "Event",
  "CustomEvent",
  "MutationObserver",
  "getComputedStyle",
] as const;
for (const key of GLOBALS) {
  (globalThis as Record<string, unknown>)[key] = (win as unknown as Record<string, unknown>)[key];
}

// Register a STUB <rime-editor> BEFORE the wrapper's `register` import runs, so
// defineRimeEditor()'s `if (!customElements.get(tag))` guard skips the real Lit
// element (which needs a browser). The stub records what the wrapper drives.
class StubRimeEditor extends (win.HTMLElement as unknown as typeof HTMLElement) {
  config: unknown = undefined;
  loaded: unknown[] = [];
  __doc: unknown = undefined;
  loadDoc(d: unknown): void {
    this.loaded.push(d);
    this.__doc = d;
  }
  getDoc(): unknown {
    return this.__doc;
  }
}
win.customElements.define("rime-editor", StubRimeEditor as never);
