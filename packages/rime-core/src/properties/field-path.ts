// Dot-path helpers bridging a schema FieldDef.key (e.g. "style.paddingTop") and a
// node's props. The panel reads the current value by path and writes edits back as
// a nested partial that updateNode()'s shallow object-merge folds in.

import type { BaseNode } from "@nord-forge/rime-model";

/** Read the value at a dot-path key, returning undefined (never throwing) if any
 *  segment is missing. */
export function getByPath(node: BaseNode, key: string): unknown {
  let current: unknown = node;
  for (const segment of key.split(".")) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Build the nested partial for an edit at a dot-path key, e.g.
 * `("style.paddingTop", 12)` → `{ style: { paddingTop: 12 } }`. updateNode()
 * shallow-merges the top-level key, so 2-level paths (all current schemas use at
 * most `style.*` / `button.*`) preserve sibling props.
 */
export function nestedPartial(key: string, value: unknown): Record<string, unknown> {
  const segments = key.split(".");
  const result: Record<string, unknown> = {};
  let cursor = result;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const next: Record<string, unknown> = {};
    cursor[segments[i]!] = next;
    cursor = next;
  }
  cursor[segments[segments.length - 1]!] = value;
  return result;
}
