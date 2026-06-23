---
id: ENV-41
title: registerToken / token-source config
status: ready
priority: P1
milestone: 7 — Personalization tokens
depends_on: [ENV-39]
blocks: [ENV-51]
package: core
prd: [§6.8, §6.9]
estimate: S
---

# ENV-41 — registerToken / token-source config

## Context
Integrators must declare their own merge-tag set (`{{first_name}}`, `{{order_total}}`,
…) — this is the personalization parallel to `registerBlock` (§6.8/6.9). Tokens come
two ways, matching the hybrid extensibility philosophy: **declarative** via
`config.tokenSources` (JSON at init, already typed on `EnveloppeConfig` in ENV-14) and
**programmatic** via `registerToken`. Both feed one token registry that the picker
(ENV-40) reads. No conditionals/loops — just a named, labeled token set.

## Goal
`@enveloppe/core` exports `registerToken` + a `TokenRegistry`, and the editor merges
`config.tokenSources` into it at init, so the token picker has a single authoritative,
grouped token list.

## Prerequisites
- ENV-39 done (the token node + `insertToken`; tokens are inserted by `key`).
- ENV-14's `EnveloppeConfig.tokenSources` (`TokenSource { id; label; tokens: { key;
  label }[] }`) — the declarative channel already typed there.

## Implementation notes
Create under `packages/core/src/tokens/`:

1. **`registry.ts`** — mirror the block registry’s shape (consistency is the point):
   ```ts
   export interface TokenItem { key: string; label: string; source?: string; }
   export interface TokenSource { id: string; label: string; tokens: { key: string; label: string }[]; }

   export class TokenRegistry {
     registerSource(src: TokenSource): void;     // throws on duplicate source id
     register(item: TokenItem): void;            // ad-hoc single token
     all(): TokenItem[];                          // flattened, with source set from the source label/id
     bySource(): Map<string, TokenItem[]>;        // for the picker's grouping
   }
   export const tokenRegistry: TokenRegistry;
   export function registerToken(item: TokenItem): void;          // → tokenRegistry.register
   export function registerTokenSource(src: TokenSource): void;   // → tokenRegistry.registerSource
   ```
   - Keys should be unique; a duplicate `key` either replaces or is rejected — pick one,
     document it (recommend: reject with a clear error so integrators notice clashes).
   - `bySource()` is what ENV-40 groups by; flat `all()` for search.
2. **Config merge at init.** In the editor (ENV-14 lifecycle), when `config.tokenSources`
   is present, call `registerTokenSource` for each on connect/`willUpdate`. This is the
   declarative JSON path — integrators who prefer config over code use only this.
   Programmatic `registerToken(...)` is the code path; both land in the same registry.
3. **Feed the picker.** Pass `tokenRegistry.all()` (or `bySource()`) into
   `<eb-token-picker>` (ENV-40). The picker stays presentational; the registry is the
   source of truth for "what tokens exist".
4. **Validation.** A token `key` must be a safe identifier-ish string (the substring
   that ends up inside `{{ }}` on export, ENV-39). Reject empty/whitespace keys.
5. **Export** `registerToken`, `registerTokenSource`, `tokenRegistry`, `TokenRegistry`,
   `TokenItem`, `TokenSource` from `packages/core/src/index.ts`. Reconcile the
   `TokenSource` type with ENV-14's identical interface (single definition, re-exported).
6. **Budget** — pure TS + Maps; negligible.

## Acceptance criteria
- [ ] `registerToken({ key, label })` and `registerTokenSource({ id, label, tokens })`
      add to a single `tokenRegistry`; `all()` and `bySource()` expose them.
- [ ] `config.tokenSources` declared at init is merged into the registry automatically.
- [ ] Duplicate source ids (and duplicate keys, per the chosen policy) error clearly.
- [ ] Empty/whitespace token keys are rejected.
- [ ] The token picker (ENV-40) is driven by the registry contents (grouped by source).
- [ ] The public API parallels `registerBlock` in shape/feel (consistency).
- [ ] Unit tests cover register/source/duplicate/merge-from-config (`bun test`). Core
      bundle within budget.

## Out of scope
- The picker UI (ENV-40) and the token node/insert (ENV-39).
- Conditional/dynamic token resolution at send time — tokens export as literal
  `{{key}}`; the ESP/host substitutes values.

## Verification
```bash
cd packages/core
bun test
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. Token registry + `registerToken` + config merge feed the picker;
size gate green; status → `review`.
