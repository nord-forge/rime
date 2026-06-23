// High-level, ergonomic mutation operations the editor calls. Each is pure
// (input doc never mutated) and returns { doc, patch, inverse }. The inverse
// patch, applied to the new doc, restores the original — this pair is what
// undo/redo stores.

import type { AnyNode, ColumnNode, EnveloppeDoc, LeafBlock, NodeId, SectionNode } from "./types";
import type { RichTextJSON } from "./rich-text";
import { applyPatch, invertPatch, type Patch, type Path } from "./patch";
import { validateDoc } from "./validate";

/** Result of any operation: the new doc plus the forward and inverse patches. */
export interface OpResult {
  doc: EnveloppeDoc;
  patch: Patch;
  inverse: Patch;
}

/** Thrown when an operation's target can't be found or the result is invalid. */
export class OperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationError";
  }
}

/** Locate a node by id; returns its path and the node, or null. */
function findNode(
  doc: EnveloppeDoc,
  id: NodeId,
): { path: Path; node: AnyNode; parentPath: Path; index: number } | null {
  if (doc.id === id) return { path: [], node: doc, parentPath: [], index: -1 };

  type Frame = { node: AnyNode; path: Path };
  const stack: Frame[] = [{ node: doc, path: [] }];
  while (stack.length > 0) {
    const { node, path } = stack.pop()!;
    const children = (node as { children?: AnyNode[] }).children;
    if (!children) continue;
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i]!;
      const childPath: Path = [...path, "children", i];
      if (child.id === id) {
        return { path: childPath, node: child, parentPath: [...path, "children"], index: i };
      }
      stack.push({ node: child, path: childPath });
    }
  }
  return null;
}

function requireNode(doc: EnveloppeDoc, id: NodeId) {
  const found = findNode(doc, id);
  if (!found) throw new OperationError(`node "${id}" not found`);
  return found;
}

/** Build the result from a forward patch, validating the outcome. */
function commit(doc: EnveloppeDoc, patch: Patch): OpResult {
  const inverse = invertPatch(doc, patch);
  const next = applyPatch(doc, patch);
  const check = validateDoc(next);
  if (!check.ok) {
    throw new OperationError(
      `operation would produce an invalid document: ${check.errors[0]?.message ?? "unknown"}`,
    );
  }
  return { doc: next, patch, inverse };
}

/** Shallow-merge `partial` into the node's own fields (e.g. style, label, src). */
export function updateNode(
  doc: EnveloppeDoc,
  id: NodeId,
  partial: Record<string, unknown>,
): OpResult {
  const { path, node } = requireNode(doc, id);
  const fields = node as unknown as Record<string, unknown>;
  const patch: Patch = Object.entries(partial).map(([key, value]) => ({
    op: "set",
    path: [...path, key],
    value: mergeField(fields[key], value),
  }));
  return commit(doc, patch);
}

// Style merges shallowly; everything else is replaced.
function mergeField(current: unknown, incoming: unknown): unknown {
  if (
    current != null &&
    typeof current === "object" &&
    !Array.isArray(current) &&
    incoming != null &&
    typeof incoming === "object" &&
    !Array.isArray(incoming)
  ) {
    return { ...(current as object), ...(incoming as object) };
  }
  return incoming;
}

/** Insert `node` as a child of `parentId` at `index`. */
export function insertNode(
  doc: EnveloppeDoc,
  parentId: NodeId,
  index: number,
  node: SectionNode | ColumnNode | LeafBlock,
): OpResult {
  const { path } = requireNode(doc, parentId);
  const patch: Patch = [{ op: "insert", path: [...path, "children"], index, value: node }];
  return commit(doc, patch);
}

/** Remove the node identified by `id`. */
export function removeNode(doc: EnveloppeDoc, id: NodeId): OpResult {
  const found = requireNode(doc, id);
  if (found.index < 0) throw new OperationError("cannot remove the document root");
  const patch: Patch = [{ op: "remove", path: found.parentPath, index: found.index }];
  return commit(doc, patch);
}

/** Move `id` to be the child at `newIndex` of `newParentId`. */
export function moveNode(
  doc: EnveloppeDoc,
  id: NodeId,
  newParentId: NodeId,
  newIndex: number,
): OpResult {
  const node = requireNode(doc, id);
  if (node.index < 0) throw new OperationError("cannot move the document root");
  const parent = requireNode(doc, newParentId);
  const toPath: Path = [...parent.path, "children"];

  // When moving within the same array to a later position, the removal shifts
  // earlier elements down by one — account for it so the node lands where asked.
  const sameArray = pathsEqual(node.parentPath, toPath);
  const adjustedIndex = sameArray && newIndex > node.index ? newIndex - 1 : newIndex;

  const patch: Patch = [
    {
      op: "move",
      from: node.parentPath,
      fromIndex: node.index,
      to: toPath,
      toIndex: adjustedIndex,
    },
  ];
  return commit(doc, patch);
}

function pathsEqual(a: Path, b: Path): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Replace the rich-text content of a text block. */
export function setRichText(
  doc: EnveloppeDoc,
  textBlockId: NodeId,
  content: RichTextJSON,
): OpResult {
  const { path, node } = requireNode(doc, textBlockId);
  if (node.type !== "text") {
    throw new OperationError(`node "${textBlockId}" is not a text block`);
  }
  const patch: Patch = [{ op: "set", path: [...path, "content"], value: content }];
  return commit(doc, patch);
}
