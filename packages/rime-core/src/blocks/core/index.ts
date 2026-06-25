import { type BlockRegistry, blockRegistry } from "../registry";
import type { BlockDefinition } from "../types";
import { sectionBlock } from "./section";
import { columnBlock } from "./column";
import { textBlock } from "./text";
import { imageBlock } from "./image";
import { buttonBlock } from "./button";
import { dividerBlock } from "./divider";
import { spacerBlock } from "./spacer";
import { headingBlock } from "./heading";
import { quoteBlock } from "./quote";
import { socialBlock } from "./social";

// Each block is typed against its own node; the registry stores them as the base
// BlockDefinition (a node-type → handler map), so widen here at the boundary.
export const CORE_BLOCKS: BlockDefinition[] = [
  sectionBlock,
  columnBlock,
  textBlock,
  imageBlock,
  buttonBlock,
  dividerBlock,
  spacerBlock,
  headingBlock,
  quoteBlock,
  socialBlock,
] as BlockDefinition[];

export {
  sectionBlock,
  columnBlock,
  textBlock,
  imageBlock,
  buttonBlock,
  dividerBlock,
  spacerBlock,
  headingBlock,
  quoteBlock,
  socialBlock,
};

// Register the core blocks. Idempotent — a double import (or a re-call after
// the editor already initialised) is a no-op rather than throwing on duplicates.
export function registerCoreBlocks(registry: BlockRegistry = blockRegistry): void {
  for (const def of CORE_BLOCKS) {
    if (!registry.get(def.type)) registry.register(def);
  }
}
