// Orchestrates doc → preview DOM with INCREMENTAL updates: re-rendering
// the whole tree on every keystroke/drag would blow the perf budget. We keep a
// Map<NodeId, element> and the previous doc; on update we reuse element identity
// for unchanged subtrees (structural sharing makes them referentially
// equal, so we can skip them entirely) and only touch what changed. Preserving
// element identity also keeps an in-progress editor/drag state alive across a
// sibling change.

import type {
  AnyNode,
  BandBlock,
  ColumnNode,
  DocumentNode,
  RimeDoc,
  NodeId,
  SectionNode,
} from "@nord-forge/rime-model";
import {
  applyStyle,
  renderButton,
  renderColumn,
  renderDivider,
  renderDocument,
  renderImage,
  renderSection,
  renderSpacer,
  renderText,
  renderUnknown,
} from "../render-node/render-node";
import { type BlockRegistry, renderNodeViaRegistry } from "../../blocks/registry";

// Any node the canvas may render: the built-in tree nodes plus section-level
// band blocks (e.g. a hero). Kept local since AnyNode is intentionally closed
// (a discriminated union) while bands carry an open `type`.
type CanvasNode = AnyNode | BandBlock;

/** Depth-first lookup of a node by id within a doc subtree. */
function findNode(root: CanvasNode, id: NodeId): CanvasNode | null {
  if (root.id === id) return root;
  if ("children" in root) {
    for (const child of root.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Render a single node (no children) to a fresh element. Built-in container/leaf
 * types take the fast hardcoded path; any other type (a registered block — custom
 * leaf or section-level band like a hero) is rendered through the block registry,
 * falling back to an inert placeholder when no registry / no match.
 */
const BUILT_IN_TYPES = new Set<string>([
  "document",
  "section",
  "column",
  "text",
  "image",
  "button",
  "divider",
  "spacer",
]);

function createElementFor(node: CanvasNode, doc: Document, registry?: BlockRegistry): HTMLElement {
  // A registered block whose type isn't a built-in (custom leaf or section-level
  // band, e.g. a hero) renders through the registry; fall back to an inert
  // placeholder for anything unknown.
  if (!BUILT_IN_TYPES.has(node.type)) {
    if (registry?.get(node.type)) {
      return renderNodeViaRegistry(
        node,
        { doc, renderChild: () => doc.createElement("div") },
        registry,
      );
    }
    return renderUnknown(node, doc);
  }
  // A built-in node: AnyNode's discriminated union narrows each case cleanly.
  const builtIn = node as AnyNode;
  switch (builtIn.type) {
    case "document":
      return renderDocument(builtIn, doc);
    case "section":
      return renderSection(builtIn, doc);
    case "column":
      return renderColumn(builtIn, doc);
    case "text":
      return renderText(builtIn, doc);
    case "image":
      return renderImage(builtIn, doc);
    case "button":
      return renderButton(builtIn, doc);
    case "divider":
      return renderDivider(builtIn, doc);
    case "spacer":
      return renderSpacer(builtIn, doc);
    default:
      return renderUnknown(builtIn, doc);
  }
}

/** The child container of a node's element (sections nest columns under a flex row). */
function childContainer(element: HTMLElement): HTMLElement {
  const row = element.querySelector<HTMLElement>(':scope > [data-node-role="column-row"]');
  return row ?? element;
}

/** Does this node type carry rendered children we manage? */
function hasManagedChildren(node: CanvasNode): node is DocumentNode | SectionNode | ColumnNode {
  return node.type === "document" || node.type === "section" || node.type === "column";
}

export class CanvasRenderer {
  readonly #mount: HTMLElement;
  readonly #doc: Document;
  readonly #registry?: BlockRegistry;
  #current: RimeDoc | null = null;
  #elements = new Map<NodeId, HTMLElement>();

  constructor(mount: HTMLElement, doc: Document, registry?: BlockRegistry) {
    this.#mount = mount;
    this.#doc = doc;
    this.#registry = registry;
  }

  /** First paint. */
  render(doc: RimeDoc): void {
    this.#mount.replaceChildren();
    this.#elements.clear();
    const root = this.#renderTree(doc);
    this.#mount.append(root);
    this.#current = doc;
  }

  /** Incremental update against the current doc. */
  update(next: RimeDoc): void {
    if (!this.#current) {
      this.render(next);
      return;
    }
    if (next === this.#current) return; // whole doc unchanged (structural sharing)
    const root = this.#reconcile(this.#current, next, this.#mount);
    this.#current = next;
    void root;
  }

  elementForNode(id: NodeId): HTMLElement | null {
    return this.#elements.get(id) ?? null;
  }

  /**
   * Repaint a single leaf block's static content from the current doc, in place.
   * Used to restore a TextBlock after a live editor detaches from it (the editor
   * leaves the element empty / annotated; this rebuilds the WYSIWYG view). No-op
   * if the node is missing or not a managed leaf.
   */
  repaintNode(id: NodeId): void {
    const element = this.#elements.get(id);
    if (!element || !this.#current) return;
    const node = findNode(this.#current, id);
    if (!node) return;
    const fresh = createElementFor(node, this.#doc, this.#registry);
    element.replaceChildren(...Array.from(fresh.childNodes));
    element.setAttribute("style", fresh.getAttribute("style") ?? "");
  }

  /** Resolve a canvas-local point to the nearest node id. */
  nodeIdAt(x: number, y: number): NodeId | null {
    const hit = this.#doc.elementFromPoint(x, y) as HTMLElement | null;
    const owner = hit?.closest<HTMLElement>("[data-node-id]");
    return owner?.dataset["nodeId"] ?? null;
  }

  // ---- internal ----

  /** Build an element (and its subtree) for a node, recording identity. */
  #renderTree(node: CanvasNode): HTMLElement {
    const element = createElementFor(node, this.#doc, this.#registry);
    this.#elements.set(node.id, element);
    if (hasManagedChildren(node)) {
      const container = childContainer(element);
      for (const child of node.children) {
        container.append(this.#renderTree(child));
      }
    }
    return element;
  }

  /**
   * Reconcile a node from `prev` → `next`, reusing its existing element. Returns
   * the (possibly reused) element for the next node. `parentForReplace` is where a
   * full replacement would be inserted if identity can't be reused.
   */
  #reconcile(prev: CanvasNode, next: CanvasNode, _parent: HTMLElement): HTMLElement {
    if (prev === next) {
      // Referentially identical subtree — nothing changed, keep DOM as-is.
      return this.#elements.get(next.id)!;
    }

    // Different node id OR different type → fresh element (can't reuse).
    if (prev.id !== next.id || prev.type !== next.type) {
      const fresh = this.#renderTree(next);
      return fresh;
    }

    // Same id + type → reuse the element, re-apply props in place.
    const element = this.#elements.get(prev.id);
    if (!element) return this.#renderTree(next);

    this.#updateProps(next, element);

    if (hasManagedChildren(next) && hasManagedChildren(prev)) {
      this.#reconcileChildren(prev, next, childContainer(element));
    }
    return element;
  }

  /** Re-apply a node's own props (style/content) to its existing element. */
  #updateProps(node: CanvasNode, element: HTMLElement): void {
    if (!BUILT_IN_TYPES.has(node.type)) {
      // A registered block (custom leaf or section-level band, e.g. a hero):
      // rebuild it in place from its registry renderer, same as a built-in leaf.
      if (this.#registry?.get(node.type)) this.#rebuildLeafInPlace(node, element);
      return;
    }
    const builtIn = node as AnyNode;
    switch (builtIn.type) {
      case "document":
        element.style.maxWidth = `${builtIn.settings.contentWidth}px`;
        element.style.backgroundColor = builtIn.settings.backgroundColor;
        element.style.fontFamily = builtIn.settings.fontFamily;
        break;
      case "column":
        element.style.flexBasis = `${builtIn.widthPercent}%`;
        element.style.maxWidth = `${builtIn.widthPercent}%`;
        applyStyle(element, builtIn.style);
        break;
      case "spacer":
        element.style.height = `${builtIn.height}px`;
        break;
      case "text":
      case "image":
      case "button":
      case "divider":
        this.#rebuildLeafInPlace(builtIn, element);
        break;
      case "section":
        applyStyle(element, builtIn.style);
        break;
    }
  }

  /** Swap an element's children + style for a freshly rendered node's. Cheap for leaves. */
  #rebuildLeafInPlace(node: CanvasNode, element: HTMLElement): void {
    const fresh = createElementFor(node, this.#doc, this.#registry);
    element.replaceChildren(...Array.from(fresh.childNodes));
    element.setAttribute("style", fresh.getAttribute("style") ?? "");
  }

  /** Reconcile a container's children by id, reusing/moving existing elements. */
  #reconcileChildren(
    prev: DocumentNode | SectionNode | ColumnNode,
    next: DocumentNode | SectionNode | ColumnNode,
    container: HTMLElement,
  ): void {
    const prevById = new Map(prev.children.map((c) => [c.id, c as CanvasNode]));
    const nextChildren = next.children as CanvasNode[];

    // Remove elements whose ids are gone.
    const nextIds = new Set(nextChildren.map((c) => c.id));
    for (const child of prev.children) {
      if (!nextIds.has(child.id)) {
        this.#elements.get(child.id)?.remove();
        this.#forget(child as CanvasNode);
      }
    }

    // Resolve each next child to its (reused or fresh) element, in order.
    const ordered = nextChildren.map((nextChild) => {
      const prevChild = prevById.get(nextChild.id);
      return prevChild
        ? this.#reconcile(prevChild, nextChild, container)
        : this.#renderTree(nextChild);
    });

    // Reposition to match `ordered`. insertBefore moves an already-attached node,
    // so this both inserts new elements and reorders moved ones. Walking from the
    // end with a "next expected sibling" pointer avoids stale-cursor bugs.
    let nextSibling: ChildNode | null = null;
    for (let i = ordered.length - 1; i >= 0; i -= 1) {
      const element = ordered[i]!;
      if (element.nextSibling !== nextSibling || element.parentNode !== container) {
        container.insertBefore(element, nextSibling);
      }
      nextSibling = element;
    }
  }

  /** Drop an id (and descendants) from the identity map. */
  #forget(node: CanvasNode): void {
    this.#elements.delete(node.id);
    if (hasManagedChildren(node)) {
      for (const child of node.children) this.#forget(child);
    }
  }
}
