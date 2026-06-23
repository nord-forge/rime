import { CanvasHost } from './canvas-host';
import { LexicalAdapter } from './lexical-adapter';

// Bundle-isolated entry: ONLY Lexical is imported.
class LexicalHost extends CanvasHost {
  constructor() {
    super(() => new LexicalAdapter());
  }
}
customElements.define('spike-lexical', LexicalHost);
