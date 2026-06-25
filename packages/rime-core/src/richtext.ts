// Lexical-coupled public surface, split OUT of the pure "@nord-forge/rime-core" barrel
// so importing the SDK (types, registerBlock, blocks, render helpers) never pulls
// Lexical. Anything here transitively imports `lexical`/`@lexical/*`; reach for it
// only when you are deliberately driving the rich-text engine directly
// (`@nord-forge/rime-core/richtext`). The editor itself loads its Lexical provider via a
// dynamic import() — it does NOT import this entry statically.

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
export { makeCommands, type RichTextCommands } from "./richtext/ui/rich-text-commands";
export {
  EMPTY_FORMAT,
  type FormatState,
  registerSelectionFormat,
} from "./richtext/ui/selection-format";

// The custom rich-text chrome (Lit elements). Lexical-coupled, so they live here
// rather than on /register — the editor mounts them via the dynamic Lexical
// provider; this entry is for consumers who want the classes directly.
export { RichTextToolbar } from "./richtext/ui/rich-text-toolbar";
export { type LinkApplyDetail, LinkPopover } from "./richtext/ui/link-popover";
export {
  RimeTokenPicker,
  type TokenItem,
  type TokenSelectDetail,
} from "./richtext/token-picker/token-picker";
