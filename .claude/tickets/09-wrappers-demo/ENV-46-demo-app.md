---
id: ENV-46
title: Demo app (proves end-user UX)
status: done
priority: P1
milestone: 9 — Framework wrappers & demo
depends_on: [ENV-34, ENV-42]
blocks: [ENV-48]
package: demo
prd: [§4, §12]
estimate: M
---

# ENV-46 — Demo app (proves end-user UX)

## Context
v1 ships a runnable demo (§4, §12) that proves the **end-user** experience is excellent
by default — the secondary persona (marketers using the builder inside an integrator's
product). It's also the integration reference: it consumes the public surface only
(`<rime-editor>` + ENV-42 JSON in/out + ENV-43 `onImageUpload` stub + `--rime-*`
theming), uses a trivial **local store** (no backend, per §6.10), and showcases
theming. It registers the example custom block (ENV-37) to prove the SDK in context.

## Goal
`apps/demo` is a runnable app embedding `<rime-editor>`, wired to a local-storage
save/load, a stub `onImageUpload`, a theme switcher, and the example custom block —
demonstrating the full v1 done-bar UX.

## Prerequisites
- ENV-34 done (core blocks render/drag/edit) and ENV-42 done (`loadDoc`/`getDoc`/
  `change`). ENV-43 (`onImageUpload`) and ENV-37 (example block) land here if ready;
  otherwise stub/flag and note.
- `apps/demo` exists in the workspace (ENV-01); `@nord-forge/rime-core` (+ `renderer-mjml` for
  an export preview) are `workspace:*` deps.

## Implementation notes
Build `apps/demo` as a minimal Vite app (Bun). Keep it dependency-light; it's a demo,
not a framework showcase — vanilla/Lit or a tiny shell is fine (no need for React/Vue
here; the wrappers have their own examples).

1. **Embed the editor.** Mount `<rime-editor>` filling the viewport. Set `config`
   with a theme, an `onImageUpload` stub, and the demo's enabled blocks.
2. **Local store (headless persistence demo).**
   - On `change`, `serialize(e.detail.doc)` (ENV-09) → `localStorage`.
   - On load, read `localStorage`, `deserialize` → `el.loadDoc(doc)`; fall back to a
     starter template doc if none/invalid. Add explicit "Save" / "Load" / "Reset"
     buttons too so the round-trip is visible.
3. **`onImageUpload` stub.** A callback that returns an object-URL (`URL.createObjectURL`)
   or a tiny data-URI — proving the host-uploader contract (ENV-43) with **no backend**.
   Document that a real app returns a CDN URL.
4. **Theme showcase.** A switcher that applies different `--rime-*` token sets (e.g.
   "Default", "Brand purple", "Dark") at runtime, proving chrome theming. Show that the
   canvas (email styles) is unaffected by chrome theme (two-surface model, ENV-18).
5. **Export preview.** A "View HTML" panel that runs `new MjmlRenderer().render(getDoc())`
   (ENV-11) and shows the email HTML — closing the loop from edit → bulletproof output.
6. **Custom block.** Register the ENV-37 example ("Coupon") so it appears in the palette
   — proving `registerBlock` end to end in a real app.
7. **Runnable OOTB.** `bun run dev` (in `apps/demo`) starts it with zero config; a root
   script (e.g. `bun run demo`) is convenient. README points here for the <30-min test
   (ENV-48).
8. **Budget note.** The demo is excluded from the core bundle budget (it's an app), but
   it should not pull heavy deps that obscure the "thin integration" story.

## Acceptance criteria
- [ ] `apps/demo` runs via `bun run dev` with no backend/config and shows a working
      `<rime-editor>` with the core blocks (drag, edit, properties).
- [ ] Edits persist to `localStorage` via `serialize`/`change`; reload restores via
      `deserialize`/`loadDoc`; Save/Load/Reset controls work.
- [ ] A stub `onImageUpload` lets the user add an image (object-URL/data-URI), proving
      the uploader contract with no backend.
- [ ] A theme switcher applies different `--rime-*` sets at runtime; the canvas email
      styling is unaffected (two-surface model visible).
- [ ] An "export HTML" view renders the current doc via `MjmlRenderer`.
- [ ] The ENV-37 example custom block appears in the palette and works.
- [ ] Consumes only the public package surfaces (no deep/internal imports).

## Out of scope
- A production backend, auth, or real CDN (headless demo only).
- Polished marketing site (that's docs, ENV-51). React/Vue-specific demos (the
  wrappers carry their own usage examples).

## Verification
```bash
cd apps/demo
bun run dev    # opens; manually: drag blocks, edit text, change theme, save/reload, export HTML
bun run build  # demo builds
bun run lint
# optional Playwright smoke driving the demo (chromium + webkit)
```

## Definition of done
See `_conventions.md`. Runnable demo proves the v1 end-user UX on public APIs only;
status → `review`.
