// Orchestrates doc → preview DOM (PRD §6.2) with INCREMENTAL updates: re-rendering
// the whole tree on every keystroke/drag would blow the perf budget. We keep a
// Map<NodeId, element> and the previous doc; on update we reuse element identity
// for unchanged subtrees (ENV-06 structural sharing makes them referentially
// equal, so we can skip them entirely) and only touch what changed. Preserving
// element identity also keeps an in-progress editor/drag state alive across a
// sibling change.

import type {
  AnyNode,
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

/** Render a single node (no children) to a fresh element. */
function createElementFor(node: AnyNode, doc: Document): HTMLElement {
  switch (node.type) {
    case "document":
      return renderDocument(node, doc);
    case "section":
      return renderSection(node, doc);
    case "column":
      return renderColumn(node, doc);
    case "text":
      return renderText(node, doc);
    case "image":
      return renderImage(node, doc);
    case "button":
      return renderButton(node, doc);
    case "divider":
      return renderDivider(node, doc);
    case "spacer":
      return renderSpacer(node, doc);
    default:
      return renderUnknown(node, doc);
  }
}

/** The child container of a node's element (sections nest columns under a flex row). */
function childContainer(element: HTMLElement): HTMLElement {
  const row = element.querySelector<HTMLElement>(':scope > [data-node-role="column-row"]');
  return row ?? element;
}

/** Does this node type carry rendered children we manage? */
function hasManagedChildren(node: AnyNode): node is DocumentNode | SectionNode | ColumnNode {
  return node.type === "document" || node.type === "section" || node.type === "column";
}

export class CanvasRenderer {
  readonly #mount: HTMLElement;
  readonly #doc: Document;
  #current: RimeDoc | null = null;
  #elements = new Map<NodeId, HTMLElement>();

  constructor(mount: HTMLElement, doc: Document) {
    this.#mount = mount;
    this.#doc = doc;
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

  /** Resolve a canvas-local point to the nearest node id. */
  nodeIdAt(x: number, y: number): NodeId | null {
    const hit = this.#doc.elementFromPoint(x, y) as HTMLElement | null;
    const owner = hit?.closest<HTMLElement>("[data-node-id]");
    return owner?.dataset["nodeId"] ?? null;
  }

  // ---- internal ----

  /** Build an element (and its subtree) for a node, recording identity. */
  #renderTree(node: AnyNode): HTMLElement {
    const element = createElementFor(node, this.#doc);
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
  #reconcile(prev: AnyNode, next: AnyNode, _parent: HTMLElement): HTMLElement {
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
  #updateProps(node: AnyNode, element: HTMLElement): void {
    switch (node.type) {
      case "document":
        element.style.maxWidth = `${node.settings.contentWidth}px`;
        element.style.backgroundColor = node.settings.backgroundColor;
        element.style.fontFamily = node.settings.fontFamily;
        break;
      case "column":
        element.style.flexBasis = `${node.widthPercent}%`;
        element.style.maxWidth = `${node.widthPercent}%`;
        applyStyle(element, node.style);
        break;
      case "spacer":
        element.style.height = `${node.height}px`;
        break;
      case "text":
      case "image":
      case "button":
      case "divider": {
        // Content/style may have changed; rebuild this leaf's element in place by
        // swapping a freshly rendered one's children + style. Cheap for leaves.
        const fresh = createElementFor(node, this.#doc);
        element.replaceChildren(...Array.from(fresh.childNodes));
        element.setAttribute("style", fresh.getAttribute("style") ?? "");
        break;
      }
      case "section":
        applyStyle(element, node.style);
        break;
    }
  }

  /** Reconcile a container's children by id, reusing/moving existing elements. */
  #reconcileChildren(
    prev: DocumentNode | SectionNode | ColumnNode,
    next: DocumentNode | SectionNode | ColumnNode,
    container: HTMLElement,
  ): void {
    const prevById = new Map(prev.children.map((c) => [c.id, c as AnyNode]));
    const nextChildren = next.children as AnyNode[];

    // Remove elements whose ids are gone.
    const nextIds = new Set(nextChildren.map((c) => c.id));
    for (const child of prev.children) {
      if (!nextIds.has(child.id)) {
        this.#elements.get(child.id)?.remove();
        this.#forget(child as AnyNode);
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
  #forget(node: AnyNode): void {
    this.#elements.delete(node.id);
    if (hasManagedChildren(node)) {
      for (const child of node.children) this.#forget(child);
    }
  }
}
