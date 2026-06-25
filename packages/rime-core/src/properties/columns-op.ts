// The Section column-count control is not a flat prop edit: it adds/removes
// ColumnNode children and re-distributes widthPercent to sum to 100 (the ENV-05
// invariant). This builds the new children array; the panel writes it via
// updateNode (which replaces the `children` array wholesale), so undo/redo and
// validation flow through the normal op path.

import { createColumn, type ColumnNode, type IdFactory } from "@nord-forge/rime-model";

/**
 * Return a `children` array of exactly `count` columns with evenly-distributed
 * widths summing to 100 (remainder folded into the last). Existing columns are
 * reused in order (preserving their content); extra columns beyond `count` are
 * dropped; new columns are created with fresh ids.
 */
export function columnsForCount(
  existing: ColumnNode[],
  count: number,
  newId: IdFactory,
): ColumnNode[] {
  const n = Math.max(1, Math.floor(count));
  const base = Math.floor(100 / n);
  const result: ColumnNode[] = [];
  for (let i = 0; i < n; i += 1) {
    const width = i === n - 1 ? 100 - base * (n - 1) : base;
    const reused = existing[i];
    result.push(reused ? { ...reused, widthPercent: width } : createColumn(newId, width));
  }
  return result;
}
