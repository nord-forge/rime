// The token registry — the personalization parallel to the block registry
// (registerBlock). Merge tags reach it two ways, matching the hybrid extensibility
// model: declaratively via `config.tokenSources` (merged at editor init) and
// programmatically via `registerToken`/`registerTokenSource`. The token picker
// (eb-token-picker) reads it. Pure + DOM-free (no Lit, no Lexical), so it lives on
// the pure "@nord-forge/rime-core" barrel alongside registerBlock.

/** A single merge tag. `key` is the substring that ends up inside {{ }} on export. */
export interface TokenItem {
  key: string;
  label: string;
  /** Grouping label (e.g. "Contact", "Order"); set from the source when grouped. */
  source?: string;
}

/** A named, labeled group of tokens. Mirrors RimeConfig.tokenSources (one type). */
export interface TokenSource {
  id: string;
  label: string;
  tokens: { key: string; label: string }[];
}

function assertSafeKey(key: string): void {
  if (typeof key !== "string" || key.trim() === "") {
    throw new Error("token key must be a non-empty string");
  }
}

export class TokenRegistry {
  // Insertion order preserved (Map) so the picker groups sources first-seen.
  #sources = new Map<string, { label: string }>();
  // key -> item. A duplicate key is rejected (integrators notice clashes).
  #byKey = new Map<string, TokenItem>();

  registerSource(src: TokenSource): void {
    if (this.#sources.has(src.id)) {
      throw new Error(`token source "${src.id}" is already registered`);
    }
    this.#sources.set(src.id, { label: src.label });
    for (const t of src.tokens) {
      assertSafeKey(t.key);
      if (this.#byKey.has(t.key)) {
        throw new Error(`token key "${t.key}" is already registered`);
      }
      this.#byKey.set(t.key, { key: t.key, label: t.label, source: src.label });
    }
  }

  register(item: TokenItem): void {
    assertSafeKey(item.key);
    if (this.#byKey.has(item.key)) {
      throw new Error(`token key "${item.key}" is already registered`);
    }
    this.#byKey.set(item.key, { ...item });
  }

  /** Flattened tokens (with `source` set), in registration order — for search. */
  all(): TokenItem[] {
    return [...this.#byKey.values()];
  }

  /** Grouped by source label (ungrouped tokens under ""), for the picker. */
  bySource(): Map<string, TokenItem[]> {
    const out = new Map<string, TokenItem[]>();
    for (const item of this.#byKey.values()) {
      const group = item.source ?? "";
      const list = out.get(group) ?? [];
      list.push(item);
      out.set(group, list);
    }
    return out;
  }

  /** Test/teardown helper — drop everything. */
  clear(): void {
    this.#sources.clear();
    this.#byKey.clear();
  }
}

// The single source of truth used by the editor + the public registerToken API.
export const tokenRegistry = new TokenRegistry();

export function registerToken(item: TokenItem): void {
  tokenRegistry.register(item);
}

export function registerTokenSource(src: TokenSource): void {
  tokenRegistry.registerSource(src);
}
