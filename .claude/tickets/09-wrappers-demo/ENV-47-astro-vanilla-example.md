---
id: ENV-47
title: Astro / vanilla usage example
status: done
priority: P2
milestone: 9 — Framework wrappers & demo
depends_on: [ENV-14]
blocks: []
package: root
prd: [§7]
estimate: S
---

# ENV-47 — Astro / vanilla usage example

## Context
The README leads with the vanilla/Astro embedding path (§7) — `import '@nord-forge/rime-core'`,
set `config`, listen for `change`, call `loadDoc`. Developers embedding without React/Vue
need a copy-pasteable, verified example proving the web component drops into a plain
page / Astro island. P2 polish that supports the <30-min embed promise (§11).

## Goal
A verified, copy-pasteable Astro/vanilla usage example in the README/docs showing
embedding `<rime-editor>`, theming via `--rime-*`, wiring `onImageUpload`, and
save/load via `change` + `loadDoc`.

## Prerequisites
- ENV-14 done (the element + `config`) and ideally ENV-42 (`loadDoc`/`getDoc`/`change`).
- Match the README vanilla snippet shape; this hardens it into a real, runnable example.

## Implementation notes
1. **Where.** Expand the README's "Vanilla / Astro" section and/or add a small example
   under `examples/astro-vanilla/` (a single HTML page or a minimal Astro component).
   Keep it tiny and dependency-light.
2. **Vanilla HTML/JS example** — make the README snippet actually run:
   ```html
   <rime-editor id="editor" style="height:100vh"></rime-editor>
   <script type="module">
     import "@nord-forge/rime-core";
     const el = document.getElementById("editor");
     el.config = {
       theme: { "--rime-color-accent": "#5b5bd6", "--rime-radius": "10px" },
       onImageUpload: async (file) => URL.createObjectURL(file), // demo: host returns a URL
     };
     el.addEventListener("change", (e) => localStorage.setItem("doc", JSON.stringify(e.detail.doc)));
     const saved = localStorage.getItem("doc");
     if (saved) el.loadDoc(JSON.parse(saved));
   </script>
   ```
3. **Astro note.** Show the same as an Astro component: import `@nord-forge/rime-core` in a
   `<script>` and use `client:only`/`client:load` semantics so the custom element
   registers on the client. Call out that it's a client-side web component (no SSR of the
   editor). Reuse the same `config`/`change`/`loadDoc` wiring.
4. **Theming pointer.** Link to the `--rime-*` token reference (ENV-51) and show one or
   two overrides inline so theming is obviously CSS-custom-property driven.
5. **Verify it runs.** The example must actually load the built `@nord-forge/rime-core` (e.g.
   via the demo dev server or a one-file static page) — not a snippet that was never
   executed. Note the exact steps so a reader reproduces it.

## Acceptance criteria
- [ ] The README/docs contain a runnable vanilla HTML example embedding
      `<rime-editor>`, theming via `--rime-*`, wiring `onImageUpload`, and save/load
      via `change` + `loadDoc`.
- [ ] An Astro usage note shows the client-only registration pattern with the same API.
- [ ] The example matches the actual public API (no stale/aspirational calls) and has
      been executed against the built core, not just written.
- [ ] It links to the theming-token reference.

## Out of scope
- React/Vue examples (ENV-44/91 carry those). The full docs site (ENV-51).
- A heavyweight standalone Astro app (a minimal example/island suffices).

## Verification
```bash
# build core, then serve the example page and confirm the editor mounts + saves/loads
bun run build
# open examples/astro-vanilla (or the README snippet served statically); manual smoke
```

## Definition of done
See `_conventions.md`. A verified vanilla/Astro example exists in README/docs;
status → `review`.
