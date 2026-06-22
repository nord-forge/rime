import { CanvasHost } from './canvas-host';
import { TiptapAdapter } from './tiptap-adapter';

// Bundle-isolated entry: ONLY Tiptap is imported, so the built chunk reflects
// Tiptap's true marginal cost on top of Lit.
class TiptapHost extends CanvasHost {
  constructor() {
    super(() => new TiptapAdapter());
  }
}
customElements.define('spike-tiptap', TiptapHost);
