// Side-effectful entrypoint that defines the <rime-editor> custom element and
// registers blocks. Kept separate from the root barrel so importing types /
// registerBlock / helpers from "@nord-forge/rime-core" stays pure and
// tree-shakeable. Two ways in:
//
//   import "@nord-forge/rime-core/register";              // zero-config quick start
//   import { defineRimeEditor } from "@nord-forge/rime-core/register";
//   defineRimeEditor({ blocks: [myBlock], tagName: "my-editor" });

import { RimeEditor } from "./rime-editor/rime-editor";
import { registerCoreBlocks } from "./blocks/core/index";
import { blockRegistry, registerBlock } from "./blocks/registry";
import type { BlockDefinition } from "./blocks/types";

export interface RimeInitConfig {
  // Register the seven built-in blocks (default true).
  coreBlocks?: boolean;
  // Custom block definitions to register alongside (or instead of) the built-ins.
  blocks?: BlockDefinition[];
  // Custom-element tag name (default "rime-editor"). Lets a host avoid collisions
  // or run more than one editor build on a page.
  tagName?: string;
  // Reserved for future config that already lives on the element's `config`
  // property — theme defaults, token sources, enabled-block filtering. Declared
  // here so adding them later is non-breaking.
  // theme?: Record<`--eb-${string}`, string>;
  // tokenSources?: unknown[];
  // enabledBlocks?: string[];
}

let defined = false;

/**
 * Define the <rime-editor> element and register blocks. Idempotent for the
 * element definition; safe to call once at app start. Returns the resolved tag.
 */
export function defineRimeEditor(config: RimeInitConfig = {}): string {
  const tagName = config.tagName ?? "rime-editor";

  if (config.coreBlocks !== false) registerCoreBlocks();
  for (const block of config.blocks ?? []) {
    if (!blockRegistry.get(block.type)) registerBlock(block);
  }

  if (!customElements.get(tagName)) {
    // A custom tag name needs its own class (one class ↔ one tag in the registry).
    customElements.define(
      tagName,
      tagName === "rime-editor" ? RimeEditor : class extends RimeEditor {},
    );
  }
  defined = true;
  return tagName;
}

// Bare `import "@nord-forge/rime-core/register"` = zero-config quick start.
if (!defined) defineRimeEditor();

export { RimeEditor };
