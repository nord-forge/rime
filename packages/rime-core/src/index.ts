// Importing this module defines the <rime-editor> custom element.

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
export type { BlockSchema, FieldDef, FieldType } from "./blocks/schema";
export type {
  BlockDefinition,
  BlockPlacement,
  CanvasRenderContext,
  ExportOutput,
  ExportRenderContext,
  PaletteEntry,
  RenderCanvas,
  RenderExport,
} from "./blocks/types";
export {
  BlockRegistry,
  blockRegistry,
  type MjmlBlockRenderer,
  placementOf,
  registerBlock,
  registryToMjmlRenderers,
  renderNodeViaRegistry,
  toMjmlBlockRenderer,
} from "./blocks/registry";
export {
  buttonBlock,
  columnBlock,
  CORE_BLOCKS,
  dividerBlock,
  headingBlock,
  imageBlock,
  quoteBlock,
  registerCoreBlocks,
  sectionBlock,
  spacerBlock,
  textBlock,
} from "./blocks/core/index";
export type { HeadingBlock, HeadingLevel } from "./blocks/core/heading";
export type { QuoteBlock } from "./blocks/core/quote";
export { type LexicalMount, mountLexical } from "./richtext/lexical-editor/lexical-editor";
export {
  $applyRichTextJSON,
  $readRichTextJSON,
  canonicalize,
  richTextEqual,
} from "./richtext/serialize/serialize";
export {
  type Mounter,
  RichTextLifecycle,
  type RichTextLifecycleDeps,
} from "./richtext/richtext-lifecycle/richtext-lifecycle";
export {
  makeCommands,
  normalizeHref,
  type RichTextCommands,
} from "./richtext/ui/rich-text-commands";
export {
  EMPTY_FORMAT,
  type FormatState,
  registerSelectionFormat,
} from "./richtext/ui/selection-format";
export { RichTextToolbar } from "./richtext/ui/rich-text-toolbar";
export { type LinkApplyDetail, LinkPopover } from "./richtext/ui/link-popover";
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
