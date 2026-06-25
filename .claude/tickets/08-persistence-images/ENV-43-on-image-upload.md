---
id: ENV-43
title: onImageUpload host callback (image block)
status: done
priority: P1
milestone: 8 — Persistence & images
depends_on: [ENV-34]
blocks: [ENV-46]
package: core
prd: [§6.10]
estimate: S
---

# ENV-43 — `onImageUpload` host callback (image block)

## Context
The library stores nothing (§6.10): images are uploaded via a host-provided
`onImageUpload(file) → Promise<string>` callback that returns the final URL, and the
image block just stores that URL. No CDN, no storage, no backend in any published
package. This ticket wires the image block (ENV-34) to that callback (already typed on
`RimeConfig`, ENV-14). The demo (ENV-46) provides a stub uploader to be runnable.

## Goal
The image block lets a user pick a file, calls `config.onImageUpload(file)`, and stores
the returned URL into the block's `src` via an ENV-06 op — with no storage logic in the
library and graceful handling when no callback is provided.

## Prerequisites
- ENV-34 done (the `image` block: `ImageBlock { src; alt; href?; style }`).
- ENV-14's `RimeConfig.onImageUpload?: (file: File) => Promise<string>`.
- ENV-06 ops (to write `src` into the doc immutably) and ENV-35 (the image block's
  properties form where the upload control lives).

## Implementation notes
1. **Upload affordance.** In the image block's properties form (ENV-35) and/or an
   on-canvas empty-image placeholder, add a "Choose image" control (`<input type=file
   accept="image/*">`, hidden, triggered by a themed button). Provide a URL text field
   too (paste a URL directly) — upload is one path, not the only one.
2. **Call the host.** On file selection, call `config.onImageUpload(file)`:
   ```ts
   const url = await config.onImageUpload?.(file);
   if (url) setNodeProp(doc, imageId, "src", url); // ENV-06 op → change event
   ```
   - Show a pending state while the promise resolves (themed `--eb-*` spinner/skeleton).
   - On reject, surface a themed inline error and keep the old `src`; never throw into
     the user's face uncaught.
3. **No callback configured.** If `onImageUpload` is undefined, disable the file-upload
   button (keep the URL field usable) and show a hint ("Configure onImageUpload to enable
   uploads"). The library must never attempt its own upload/storage.
4. **No storage in the lib.** The library passes the `File` out and stores only the
   returned string. No base64-inlining by default (that bloats the doc + email); if a
   host wants data-URIs, their callback returns one. Document this.
5. **Validation.** The returned URL is stored as-is into `src`; the block already
   validates as a string. Trim whitespace; reject empty returns (treat as "no change").
6. **Budget** — no new runtime dep; plain `File` + `fetch`-free (the host owns network).

## Acceptance criteria
- [ ] Selecting a file in the image block calls `config.onImageUpload(file)` and stores
      the returned URL into `src` via an ENV-06 op (emitting `change`).
- [ ] A pending state shows during upload; a rejected upload shows a themed error and
      preserves the previous `src` (no uncaught throw).
- [ ] When `onImageUpload` is absent, the upload button is disabled with a hint; the URL
      field still works; the library performs no upload itself.
- [ ] No storage/CDN/backend logic exists in the library; only the returned URL is kept.
- [ ] Controls are themed via `--eb-*`.
- [ ] Unit tests cover the call + store-on-resolve, the reject path, and the
      no-callback path (`bun test`); a Playwright test with a stub uploader sets an
      image `src` (chromium + webkit).

## Out of scope
- Any real upload/storage implementation (that's the host's; the demo ENV-46 supplies a
  stub).
- Image editing/cropping/resizing.

## Verification
```bash
cd packages/core
bun test
bun run build
bun run lint
bun run e2e  # chromium + webkit: stub onImageUpload → image src set from returned URL
```

## Definition of done
See `_conventions.md`. Image block uses the host uploader; no storage in the lib; size
gate green; status → `review`.
