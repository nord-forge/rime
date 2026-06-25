// DOM-free filter/group logic for the token picker, so it's unit-testable without
// a custom element. A token's identity is its key; `source` is an optional grouping
// label (e.g. "Contact", "Order"). ENV-41's registry produces TokenItem[]; until
// then the picker accepts them as a property.

export interface TokenItem {
  key: string;
  label: string;
  source?: string;
}

export interface TokenGroup {
  /** The source label, or "" for ungrouped tokens. */
  source: string;
  items: TokenItem[];
}

/** Case-insensitive substring match across label, key, and source. */
export function matchesQuery(item: TokenItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return (
    item.label.toLowerCase().includes(q) ||
    item.key.toLowerCase().includes(q) ||
    (item.source ?? "").toLowerCase().includes(q)
  );
}

/** Filter by query, then group by source preserving first-seen order. Ungrouped
 *  tokens (no `source`) collect under the "" group, emitted last. */
export function filterAndGroup(tokens: TokenItem[], query: string): TokenGroup[] {
  const groups: TokenGroup[] = [];
  const bySource = new Map<string, TokenGroup>();
  for (const item of tokens) {
    if (!matchesQuery(item, query)) continue;
    const source = item.source ?? "";
    let group = bySource.get(source);
    if (!group) {
      group = { source, items: [] };
      bySource.set(source, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  // Emit the ungrouped bucket last (named sources read as headings first).
  groups.sort((a, b) => (a.source === "" ? 1 : 0) - (b.source === "" ? 1 : 0));
  return groups;
}

/** The flat, in-display-order list of items across all groups — what ↑/↓ navigate. */
export function flatten(groups: TokenGroup[]): TokenItem[] {
  return groups.flatMap((g) => g.items);
}
