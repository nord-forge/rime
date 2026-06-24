<div align="center">

# ✉️ Rime

**An open-source, framework-agnostic email template builder.**

The polish of Unlayer · the clean editing of Tiptap · the drag-and-drop power of GrapesJS — without the ugly UI, without the closed source.

`MIT licensed` · `Web Components (Lit)` · `React & Vue wrappers` · `MJML output`

</div>

---

> ⚠️ **Status: pre-implementation.** This repository currently contains the [PRD](./PRD.md) and the [board](./board.md). Code is being scaffolded from the board tickets. APIs below describe the **intended** v1 surface and may change.

## Why

There is no great open-source email template builder. The good ones are closed/commercial (Unlayer, Stripo, Beefree); the open one (GrapesJS) is powerful but unpolished and not email-specific. Rime fills that gap — a beautiful, embeddable, themeable email builder any developer can drop into an Astro/JS, React, or Vue app and extend with custom blocks.

## What it is

- **`<rime-editor>`** — a Lit web component you embed anywhere.
- **One unified canvas** — drag blocks to build, click text to edit inline, tune structure in a properties panel (the Unlayer model, cleaner skin).
- **Bulletproof output** — compiles to Outlook-safe email HTML via **MJML**.
- **Headless & themeable** — JSON in / JSON out, image uploads via your callback, theme via CSS custom properties.
- **Extensible** — register custom blocks and custom merge tokens at init.

## Intended usage (v1)

### Vanilla / Astro
```html
<rime-editor id="editor"></rime-editor>
<script type="module">
  import '@nord-forge/rime-core';
  const el = document.getElementById('editor');
  el.config = {
    theme: { '--eb-color-accent': '#5b5bd6', '--eb-radius': '10px' },
    onImageUpload: async (file) => uploadToMyCdn(file), // returns a URL
  };
  el.addEventListener('change', (e) => save(e.detail.doc)); // JSON doc
  el.loadDoc(savedJson);
</script>
```

### React
```tsx
import { RimeEditor } from '@nord-forge/rime-react';

<RimeEditor
  doc={doc}
  theme={{ '--eb-color-accent': '#5b5bd6' }}
  onImageUpload={uploadToMyCdn}
  onChange={(doc) => save(doc)}
/>
```

### Vue
```vue
<script setup>
import { RimeEditor } from '@nord-forge/rime-vue';
</script>
<template>
  <RimeEditor v-model="doc" :on-image-upload="uploadToMyCdn" />
</template>
```

### Custom block (the extension model)
```ts
import { registerBlock } from '@nord-forge/rime-core';

registerBlock({
  schema: { /* props that drive the properties panel */ },
  palette: { label: 'Coupon', icon: '🎟️', category: 'Marketing' },
  renderCanvas: (props) => /* preview DOM */,
  renderExport: (props) => /* MJML or raw-table HTML */,
});
```

### Export to email HTML
```ts
import { MjmlRenderer } from '@nord-forge/rime-mjml';
const html = await new MjmlRenderer().render(doc); // Outlook-safe HTML
```

## Packages

| Package | Purpose |
|---|---|
| `@nord-forge/rime-model` | Headless JSON document model, patch-based undo, validation |
| `@nord-forge/rime-core` | The `<rime-editor>` Lit web component (canvas, DnD, rich text, chrome) |
| `@nord-forge/rime-mjml` | Default `Renderer` — doc JSON → MJML → email HTML |
| `@nord-forge/rime-react` | Thin React wrapper |
| `@nord-forge/rime-vue` | Thin Vue wrapper |

## Architecture at a glance

- **One immutable JSON doc** is the source of truth; undo/redo via patch diffs (memory-lean); designed CRDT-friendly for future collaboration.
- **Canvas** = same-origin `srcdoc` iframe (clean preview DOM, no host CSS bleed, iframe-local hit-testing).
- **Drag & drop** = [Pragmatic drag-and-drop](https://github.com/atlassian/pragmatic-drag-and-drop) + a custom keyboard/ARIA accessibility layer.
- **Rich text** = [Lexical](https://lexical.dev) used **headless** (see [PRD §6.7](./PRD.md)), one live instance at a time, with 100% custom, themeable UI (no library toolbar).
- **Export** = MJML behind a swappable `Renderer` interface.

See the full [**PRD**](./PRD.md) and [**board**](./board.md).

## Tech stack

Lit · Pragmatic drag-and-drop · Lexical (headless) · MJML · Bun (workspaces, runtime, tests) · rolldown-vite (lib mode; stock Vite as fallback) · oxlint + oxfmt · Playwright (cross-browser, Safari emphasis).

## Develop locally

```bash
bun install
bun run build         # build all packages
bun test              # unit tests
bun run lint          # oxlint
bun run format:check  # oxfmt
bun run typecheck     # tsc
bun run size          # @nord-forge/rime-core bundle-size gate (~100 kB gzip)
bun run e2e           # cross-browser Playwright (chromium + webkit)
```

## Contributing

This is early — the best contribution right now is feedback on the [PRD](./PRD.md). When contributing code, see [CONTRIBUTING.md](./CONTRIBUTING.md) and the ticket plan in [board.md](./board.md). All participants are expected to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE) © Rime contributors
