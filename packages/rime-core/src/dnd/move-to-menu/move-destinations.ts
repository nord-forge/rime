// Pure move-destination computation (no DOM / no Lit) so it can live on the pure
// SDK barrel. The <rime-move-to-menu> Lit component imports these and renders them.

import { isSection, type RimeDoc } from "@nord-forge/rime-model";
import type { DropTarget } from "../dnd-types/dnd-types";

/** A selectable destination shown in the move-to menu. */
export interface MoveDestination {
  label: string;
  target: DropTarget;
}

/** Build the destination list for a leaf block from the current doc. */
export function destinationsFor(doc: RimeDoc, id: string): MoveDestination[] {
  const out: MoveDestination[] = [];
  let sectionNumber = 0;
  doc.children.forEach((section) => {
    // Section-level band blocks (e.g. a hero) hold no columns — skip them.
    if (!isSection(section)) return;
    sectionNumber += 1;
    section.children.forEach((column, c) => {
      const hasNode = column.children.some((leaf) => leaf.id === id);
      const isOnlyHere = hasNode && column.children.length === 1;
      // Offer "end of column X" for every column except where it already solely is.
      if (!isOnlyHere) {
        out.push({
          label: `Section ${sectionNumber}, Column ${c + 1} (end)`,
          target: { parentId: column.id, index: column.children.length },
        });
      }
    });
  });
  return out;
}
