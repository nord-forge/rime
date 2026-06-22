// Baseline: Lit + the host shell only, NO rich-text engine.
// Subtract this from each engine bundle to get the engine's marginal cost.
import { CanvasHost } from './canvas-host';
import type { EngineAdapter } from './adapter';

const noopAdapter: EngineAdapter = {
  name: 'none',
  create() {},
  exec() {},
  toJSON() {
    return { type: 'doc', content: [] };
  },
  destroy() {},
};

class BaselineHost extends CanvasHost {
  constructor() {
    super(() => noopAdapter);
  }
}
customElements.define('spike-baseline', BaselineHost);
