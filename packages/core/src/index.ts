// @enveloppe/core — the <enveloppe-editor> Lit web component.
// See PRD §6.4–§6.8.
//
// Importing this module defines the <enveloppe-editor> custom element. The canvas
// iframe, drag-and-drop, rich text, palette, and properties panel mount into the
// shell's regions in later milestones.

export {
  EnveloppeEditor,
  type EnveloppeChangeDetail,
  type EnveloppeConfig,
  type TokenSource,
} from "./enveloppe-editor";
export { CanvasController, type CanvasReadyEvent } from "./canvas/iframe-canvas";
export { CanvasRenderer } from "./canvas/canvas-renderer";
export {
  type CanvasFrameLike,
  DragCoordinateController,
  type Point,
} from "./canvas/coordinate-controller";
