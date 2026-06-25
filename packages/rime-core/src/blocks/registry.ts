import type { BaseNode } from "@nord-forge/rime-model";
import type {
  BlockDefinition,
  BlockPlacement,
  CanvasRenderContext,
  ExportRenderContext,
  ExportOutput,
} from "./types";

export function placementOf(def: BlockDefinition): BlockPlacement {
  return def.placement ?? "leaf";
}

export class BlockRegistry {
  #byType = new Map<string, BlockDefinition>();

  register(def: BlockDefinition): void {
    if (this.#byType.has(def.type)) {
      throw new Error(`block type "${def.type}" is already registered`);
    }
    this.#byType.set(def.type, def);
  }

  get(type: string): BlockDefinition | undefined {
    return this.#byType.get(type);
  }

  all(): BlockDefinition[] {
    return [...this.#byType.values()];
  }

  byCategory(): Map<string, BlockDefinition[]> {
    const out = new Map<string, BlockDefinition[]>();
    for (const def of this.#byType.values()) {
      const list = out.get(def.palette.category) ?? [];
      list.push(def);
      out.set(def.palette.category, list);
    }
    return out;
  }

  /** Registered types that live inside a column (placement "leaf"). */
  leafTypes(): string[] {
    return this.all()
      .filter((def) => placementOf(def) === "leaf")
      .map((def) => def.type);
  }

  /** Registered types that live at the document level (placement "section"). */
  sectionTypes(): string[] {
    return this.all()
      .filter((def) => placementOf(def) === "section")
      .map((def) => def.type);
  }
}

// The single source of truth used by the editor and the public registerBlock API.
export const blockRegistry = new BlockRegistry();

export function registerBlock(def: BlockDefinition): void {
  blockRegistry.register(def);
}

// Resolve a node to its canvas element via the registry. Unknown types get an
// inert, hidden placeholder so an unregistered block never blanks the canvas.
export function renderNodeViaRegistry(
  node: BaseNode,
  ctx: CanvasRenderContext,
  registry: BlockRegistry = blockRegistry,
): HTMLElement {
  const def = registry.get(node.type);
  if (!def) {
    const el = ctx.doc.createElement("div");
    el.dataset["nodeId"] = node.id;
    el.dataset["nodeType"] = node.type;
    el.dataset["nodeUnknown"] = "1";
    el.style.display = "none";
    return el;
  }
  return def.renderCanvas(node, ctx);
}

// The MJML BlockRenderer seam, declared structurally so core doesn't import
// renderer-mjml (the editor passes these adapters INTO the renderer).
interface MjmlRenderContext {
  renderChild(node: BaseNode): string;
  escape?(s: string): string;
}
export interface MjmlBlockRenderer {
  readonly type: string;
  renderExport(node: BaseNode, ctx: MjmlRenderContext): string;
}

function defaultEscape(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// Adapt a registry block's renderExport into the MJML BlockRenderer shape:
// { mjml } passes through as the element string; { raw } is the raw-table HTML.
export function toMjmlBlockRenderer(def: BlockDefinition): MjmlBlockRenderer {
  return {
    type: def.type,
    renderExport(node, ctx) {
      const exportCtx: ExportRenderContext = {
        renderChild: (child) => ctx.renderChild(child),
        escape: ctx.escape ?? defaultEscape,
      };
      const out: ExportOutput = def.renderExport(node, exportCtx);
      return "mjml" in out ? out.mjml : out.raw;
    },
  };
}

// Adapt every registered block into MJML BlockRenderers for the renderer.
export function registryToMjmlRenderers(
  registry: BlockRegistry = blockRegistry,
): MjmlBlockRenderer[] {
  return registry.all().map(toMjmlBlockRenderer);
}
