// @nord-forge/rime-core — the <rime-editor> Lit web component.
// See PRD §6.4–§6.8.
//
// Importing this module defines the <rime-editor> custom element. The canvas
// iframe, drag-and-drop, rich text, palette, and properties panel mount into the
// shell's regions in later milestones.

export {
  RimeEditor,
  type RimeChangeDetail,
  type RimeConfig,
  type TokenSource,
} from "./rime-editor/rime-editor";
export { EB_TOKENS, type EbTheme, type EbToken } from "./theme/tokens/tokens";
export { CanvasController, type CanvasReadyEvent } from "./canvas/iframe-canvas/iframe-canvas";
export { CanvasRenderer } from "./canvas/canvas-renderer/canvas-renderer";
export {
  type CanvasFrameLike,
  DragCoordinateController,
  type Point,
} from "./canvas/coordinate-controller/coordinate-controller";
export { DndController, type DndDeps } from "./dnd/dnd-controller/dnd-controller";
export { type DragData, type DropTarget, isDragData } from "./dnd/dnd-types/dnd-types";
export {
  type ColumnGeometry,
  type Rect,
  resolveDropTarget,
} from "./dnd/resolve-drop-target/resolve-drop-target";
export { CleanupRegistry } from "./dnd/cleanup-registry/cleanup-registry";
export { DropDetector, type Scheduler } from "./dnd/drop-detector/drop-detector";
export {
  indicatorLineFor,
  InsertionIndicator,
} from "./dnd/insertion-indicator/insertion-indicator";
export { DragPreview, renderPreviewCard } from "./dnd/drag-preview/drag-preview";
export {
  KeyboardMoveController,
  type KeyboardMoveDeps,
  type MoveDirection,
  locateLeaf,
  resolveMove,
} from "./dnd/keyboard-move/keyboard-move";
export { destinationsFor, type MoveDestination, MoveToMenu } from "./dnd/move-to-menu/move-to-menu";
export { type LexicalMount, mountLexical } from "./richtext/lexical-editor/lexical-editor";
export { LiveAnnouncer } from "./a11y/live-region/live-region";
export {
  blockLabel,
  findNodeById,
  insertMessage,
  locateForAnnounce,
  moveMessage,
  parentLabel,
  removeMessage,
} from "./a11y/announce-messages/announce-messages";
