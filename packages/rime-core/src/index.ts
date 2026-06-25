// The PURE Rime SDK surface: types, the block registry + registerBlock, the core
// blocks, render helpers, and DOM-free logic. It pulls in NO Lit custom elements,
// so importing `registerBlock` (etc.) stays light and tree-shakeable. The editor
// element and its chrome UI live on the side-effectful "@nord-forge/rime-core/register"
// entry instead (see register.ts).

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
export { destinationsFor, type MoveDestination } from "./dnd/move-to-menu/move-destinations";
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
  heroBlock,
  htmlBlock,
  imageBlock,
  menuBlock,
  quoteBlock,
  registerCoreBlocks,
  sectionBlock,
  socialBlock,
  spacerBlock,
  tableBlock,
  textBlock,
  videoBlock,
} from "./blocks/core/index";
export type { HeadingBlock, HeadingLevel } from "./blocks/core/heading";
export type { QuoteBlock } from "./blocks/core/quote";
export type { HeroBlock, HeroButton } from "./blocks/core/hero";
export type { SocialBlock, SocialLink, SocialNetwork } from "./blocks/core/social";
export type { MenuBlock, MenuItem } from "./blocks/core/menu";
export type { HtmlBlock } from "./blocks/core/html";
export type { VideoBlock } from "./blocks/core/video";
export type { TableBlock, TableBorder } from "./blocks/core/table";
export { getByPath, nestedPartial } from "./properties/field-path";
export { columnsForCount } from "./properties/columns-op";
export {
  type PaletteGroup,
  type PaletteItem,
  type PaletteSource,
  paletteEntries,
} from "./palette/palette-entries";
export {
  type LayoutPreset,
  LAYOUT_PRESETS,
  PresetRegistry,
  presetRegistry,
  registerCorePresets,
  registerLayoutPreset,
} from "./blocks/column-presets";
// `normalizeHref` (URL sanitizer) is exported from the standalone, Lexical-free
// helper in mjml-attrs — NOT from rich-text-commands, which drags in Lexical. The
// Lexical-coupled rich-text surface (mountLexical, serialize, lifecycle, commands,
// selection-format) lives on the deep entry "@nord-forge/rime-core/richtext" so this
// barrel stays Lexical-free. See ENV-66.
export { normalizeHref } from "./blocks/core/mjml-attrs";
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
