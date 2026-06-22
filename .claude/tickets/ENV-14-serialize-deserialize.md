---
id: ENV-14
title: Serialize / deserialize (lossless round-trip)
status: ready
priority: P0
milestone: 1 — Document model
depends_on: [ENV-10]
blocks: [ENV-53, ENV-80]
package: doc-model
prd: [§6.10]
estimate: S
---

# ENV-14 — Serialize / deserialize (lossless round-trip)

## Context
Persistence is headless: the library emits and accepts JSON (PRD §6.10), and the host app owns
storage. This ticket defines the **save/load boundary** — turning an `EnveloppeDoc` into a
stable string and back into a **validated** doc — with a versioned envelope so future schema
migrations are possible without breaking old saves. The core guarantee is a round-trip law:
`deserialize(serialize(doc))` deep-equals the original doc. Pure, headless, framework-free.

## Goal
`@enveloppe/doc-model` exports `serialize(doc) → string` and `deserialize(string) → validated
result`, wrapping the doc in a `{ version, doc }` envelope and validating on load via ENV-10's
`validateDoc`, such that the round-trip is lossless.

## Prerequisites
- ENV-10 done (`EnveloppeDoc` types + `validateDoc()` + its `ValidationError` shape).
- Reuse `validateDoc` for the load path; do NOT re-implement validation here.

## Implementation notes
Create in `packages/doc-model/src/`:

1. **`serialize.ts`** — the envelope + functions:
   ```ts
   import type { EnveloppeDoc } from "./types";
   import type { ValidationError } from "./validate";
   import { validateDoc } from "./validate";

   /** Bump when the on-disk shape changes; deserialize migrates older versions forward. */
   export const SCHEMA_VERSION = 1;

   export interface DocEnvelope {
     version: number;     // === SCHEMA_VERSION at write time
     doc: EnveloppeDoc;
   }

   /** Stable string. JSON.stringify with NO pretty-print by default (compact persistence). */
   export function serialize(doc: EnveloppeDoc): string;

   export type DeserializeResult =
     | { ok: true; doc: EnveloppeDoc; version: number }
     | { ok: false; errors: ValidationError[] };

   /**
    * Parse → migrate → validate. Returns errors instead of throwing for malformed/invalid input
    * (bad JSON, missing envelope, unknown version, or a doc that fails validateDoc).
    */
   export function deserialize(input: string): DeserializeResult;
   ```
2. **`serialize`** wraps the doc: `JSON.stringify({ version: SCHEMA_VERSION, doc })`. Default to
   **compact** output (no indentation) — persistence size matters. Do not reorder or strip keys;
   losslessness comes from the doc being plain serializable data (ENV-10 forbids functions in
   nodes), so a straight stringify suffices. (Optional: accept `serialize(doc, { pretty: true })`
   for human-readable debug dumps — pretty-printing must NOT change the round-trip result.)
3. **`deserialize`** path, in order, each failure → `{ ok: false, errors }` with a precise
   `path`/`message`:
   - `JSON.parse` inside a try/catch → on throw, one error `{ path: "", message: "invalid JSON: …" }`.
   - Shape-check the envelope: must be an object with a numeric `version` and an object `doc`
     (error path `version` / `doc` when missing/wrong type).
   - **Migration hook:** `migrate(version, doc) → doc`. For v1 there are no prior versions, so a
     `version > SCHEMA_VERSION` (a save from the future) is an error, `version === SCHEMA_VERSION`
     passes through, and the function is structured so adding `case 0:`-style steps later is a
     one-line change. Keep a tiny internal `migrations` table or switch — do not over-engineer.
   - Run `validateDoc(envelope.doc)`; on `ok:false`, surface its `errors` directly (don't wrap).
   - On success return `{ ok: true, doc, version }`.
4. **Round-trip law (the core guarantee).** For any `validateDoc`-valid doc,
   `deserialize(serialize(doc))` is `{ ok: true }` and `result.doc` **deep-equals** the input
   `doc`. Test with the ENV-10 factory output and a few hand-built docs (nested sections/columns,
   a text block carrying `RichTextJSON` with marks/links — assert the rich text survives byte-for-byte
   after round-trip).
5. **Purity.** No DOM/Lit/Lexical; no new runtime dependency (native `JSON` only). No top-level
   side effects.
6. Export `serialize`, `deserialize`, `SCHEMA_VERSION`, `DocEnvelope`, `DeserializeResult` from
   `src/index.ts`.

## Acceptance criteria
- [ ] `serialize(doc)` returns a string parseable to `{ version: SCHEMA_VERSION, doc }`.
- [ ] **Round-trip law:** `deserialize(serialize(doc)).doc` deep-equals `doc` for factory docs
      and hand-built nested docs, including rich-text content with marks/links.
- [ ] `deserialize` returns `{ ok: false, errors }` (never throws) for: malformed JSON, a missing
      or wrong-typed envelope, a `version` greater than `SCHEMA_VERSION`, and a doc that fails
      `validateDoc` — each with a meaningful `path`/`message`.
- [ ] `deserialize` re-validates via ENV-10's `validateDoc` (a tampered-but-parseable doc with,
      e.g., duplicate ids is rejected on load).
- [ ] A migration seam exists (`migrate`/version switch) such that adding a future version is a
      localized change; documented in code comments.
- [ ] Optional `pretty` output does not change the round-trip result.
- [ ] No new runtime dependency; no DOM/Lit/Lexical import. Unit tests cover each criterion (`bun test`).

## Out of scope
- Actual schema migrations for versions > 1 (there are none yet — only the seam).
- The editor-facing `load()` / `getDoc()` / change-event API (ENV-80) — this is the pure codec.
- Rich-text engine ↔ doc serialization specifics beyond carrying `RichTextJSON` verbatim (ENV-53).
- Image upload / `onImageUpload` (ENV-81).

## Verification
```bash
cd packages/doc-model
bun test
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. status → `review`.
