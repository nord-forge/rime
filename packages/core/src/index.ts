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
export { EB_TOKENS, type EbTheme, type EbToken } from "./theme/tokens";
export { CanvasController, type CanvasReadyEvent } from "./canvas/iframe-canvas";
export { CanvasRenderer } from "./canvas/canvas-renderer";
export {
  type CanvasFrameLike,
  DragCoordinateController,
  type Point,
} from "./canvas/coordinate-controller";
export { DndController, type DndDeps } from "./dnd/dnd-controller";
export { type DragData, type DropTarget, isDragData } from "./dnd/dnd-types";
export { type ColumnGeometry, type Rect, resolveDropTarget } from "./dnd/resolve-drop-target";
export { DropDetector, type Scheduler } from "./dnd/drop-detector";
export { indicatorLineFor, InsertionIndicator } from "./dnd/insertion-indicator";
export { DragPreview, renderPreviewCard } from "./dnd/drag-preview";
