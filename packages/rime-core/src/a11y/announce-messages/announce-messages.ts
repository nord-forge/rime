// Pure message builders for ARIA live announcements. Kept free of the
// DOM/live-region so the wording — block label, "Column N", "position X of Y" —
// is unit-testable.

import {
  type AnyNode,
  type BaseNode,
  type RimeDoc,
  type NodeId,
  isSection,
} from "@nord-forge/rime-model";

const TYPE_LABELS: Record<string, string> = {
  text: "Text",
  image: "Image",
  button: "Button",
  divider: "Divider",
  spacer: "Spacer",
  column: "Column",
  section: "Section",
  document: "Document",
};

/** Human label for a node, e.g. "Button". */
export function blockLabel(node: BaseNode): string {
  return TYPE_LABELS[node.type] ?? node.type;
}

/** Human, 1-based label for a parent column/section by its position in the tree. */
export function parentLabel(doc: RimeDoc, parentId: NodeId): string {
  if (doc.id === parentId) return "Document";
  let sectionNumber = 0;
  for (const child of doc.children) {
    if (!isSection(child)) continue; // section-level band: not a container
    sectionNumber += 1;
    if (child.id === parentId) return `Section ${sectionNumber}`;
    for (let c = 0; c < child.children.length; c += 1) {
      if (child.children[c]!.id === parentId) return `Column ${c + 1}`;
    }
  }
  return "container";
}

/** Find a node's parent id + index + sibling count in the doc. */
export function locateForAnnounce(
  doc: RimeDoc,
  id: NodeId,
): { parentId: NodeId; index: number; total: number } | null {
  const visit = (node: AnyNode): { parentId: NodeId; index: number; total: number } | null => {
    const children = (node as { children?: AnyNode[] }).children;
    if (!children) return null;
    const index = children.findIndex((c) => c.id === id);
    if (index !== -1) return { parentId: node.id, index, total: children.length };
    for (const child of children) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  return visit(doc);
}

/** "Moved Button to Column 2, position 1 of 3" — computed from the RESULT doc. */
export function moveMessage(doc: RimeDoc, id: NodeId): string {
  const node = findNodeById(doc, id);
  const loc = locateForAnnounce(doc, id);
  if (!node || !loc) return "Moved block";
  return `Moved ${blockLabel(node)} to ${parentLabel(doc, loc.parentId)}, position ${loc.index + 1} of ${loc.total}`;
}

/** "Inserted Image into Column 1, position 2 of 2" — from the RESULT doc. */
export function insertMessage(doc: RimeDoc, id: NodeId): string {
  const node = findNodeById(doc, id);
  const loc = locateForAnnounce(doc, id);
  if (!node || !loc) return "Inserted block";
  return `Inserted ${blockLabel(node)} into ${parentLabel(doc, loc.parentId)}, position ${loc.index + 1} of ${loc.total}`;
}

/** "Removed Divider from Column 3" — parentLabel resolved against the BEFORE doc. */
export function removeMessage(beforeDoc: RimeDoc, node: BaseNode, parentId: NodeId): string {
  return `Removed ${blockLabel(node)} from ${parentLabel(beforeDoc, parentId)}`;
}

export function findNodeById(doc: RimeDoc, id: NodeId): AnyNode | null {
  const visit = (node: AnyNode): AnyNode | null => {
    if (node.id === id) return node;
    for (const child of (node as { children?: AnyNode[] }).children ?? []) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  return visit(doc);
}
