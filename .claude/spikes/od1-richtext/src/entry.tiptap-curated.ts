import { CanvasHost } from './canvas-host';
import { TiptapCuratedAdapter } from './tiptap-curated-adapter';

// Bundle-isolated entry: curated Tiptap extension set (no StarterKit).
class TiptapCuratedHost extends CanvasHost {
  constructor() {
    super(() => new TiptapCuratedAdapter());
  }
}
customElements.define('spike-tiptap-curated', TiptapCuratedHost);
