<div align="center">

# ✉️ Enveloppe

**An open-source, framework-agnostic email template builder.**

The polish of Unlayer · the clean editing of Tiptap · the drag-and-drop power of GrapesJS — without the ugly UI, without the closed source.

`MIT licensed` · `Web Components (Lit)` · `React & Vue wrappers` · `MJML output`

</div>

---

> ⚠️ **Status: pre-implementation.** This repository currently contains the [PRD](./PRD.md) and the [board](./board.md). Code is being scaffolded from the board tickets. APIs below describe the **intended** v1 surface and may change.

## Why

There is no great open-source email template builder. The good ones are closed/commercial (Unlayer, Stripo, Beefree); the open one (GrapesJS) is powerful but unpolished and not email-specific. Enveloppe fills that gap — a beautiful, embeddable, themeable email builder any developer can drop into an Astro/JS, React, or Vue app and extend with custom blocks.

## What it is

- **`<enveloppe-editor>`** — a Lit web component you embed anywhere.
- **One unified canvas** — drag blocks to build, click text to edit inline, tune structure in a properties panel (the Unlayer model, cleaner skin).
- **Bulletproof output** — compiles to Outlook-safe email HTML via **MJML**.
- **Headless & themeable** — JSON in / JSON out, image uploads via your callback, theme via CSS custom properties.
- **Extensible** — register custom blocks and custom merge tokens at init.

## Intended usage (v1)

### Vanilla / Astro
```html
<enveloppe-editor id="editor"></enveloppe-editor>
<script type="module">
  import '@enveloppe/core';
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
import { EnveloppeEditor } from '@enveloppe/react';

<EnveloppeEditor
  doc={doc}
  theme={{ '--eb-color-accent': '#5b5bd6' }}
  onImageUpload={uploadToMyCdn}
  onChange={(doc) => save(doc)}
/>
```

### Vue
```vue
<script setup>
import { EnveloppeEditor } from '@enveloppe/vue';
</script>
<template>
  <EnveloppeEditor v-model="doc" :on-image-upload="uploadToMyCdn" />
</template>
```

### Custom block (the extension model)
```ts
import { registerBlock } from '@enveloppe/core';

registerBlock({
  schema: { /* props that drive the properties panel */ },
  palette: { label: 'Coupon', icon: '🎟️', category: 'Marketing' },
  renderCanvas: (props) => /* preview DOM */,
  renderExport: (props) => /* MJML or raw-table HTML */,
});
```

### Export to email HTML
```ts
import { MjmlRenderer } from '@enveloppe/renderer-mjml';
const html = await new MjmlRenderer().render(doc); // Outlook-safe HTML
```

## Packages

| Package | Purpose |
|---|---|
| `@enveloppe/doc-model` | Headless JSON document model, patch-based undo, validation |
| `@enveloppe/core` | The `<enveloppe-editor>` Lit web component (canvas, DnD, rich text, chrome) |
| `@enveloppe/renderer-mjml` | Default `Renderer` — doc JSON → MJML → email HTML |
| `@enveloppe/react` | Thin React wrapper |
| `@enveloppe/vue` | Thin Vue wrapper |

## Architecture at a glance

- **One immutable JSON doc** is the source of truth; undo/redo via patch diffs (memory-lean); designed CRDT-friendly for future collaboration.
- **Canvas** = same-origin `srcdoc` iframe (clean preview DOM, no host CSS bleed, iframe-local hit-testing).
- **Drag & drop** = [Pragmatic drag-and-drop](https://github.com/atlassian/pragmatic-drag-and-drop) + a custom keyboard/ARIA accessibility layer.
- **Rich text** = a headless engine (Tiptap-core or Lexical — see [PRD §6.7](./PRD.md)) with 100% custom, themeable UI.
- **Export** = MJML behind a swappable `Renderer` interface.

See the full [**PRD**](./PRD.md) and [**board**](./board.md).

## Tech stack

Lit · Pragmatic drag-and-drop · MJML · Bun (workspaces, runtime, tests) · Vite (lib mode, optionally rolldown-vite) · oxlint + oxfmt · Playwright (cross-browser, Safari emphasis).

## Contributing

This is early. The best contribution right now is feedback on the [PRD](./PRD.md). See [board.md](./board.md) for the ticket plan.

## License

[MIT](./LICENSE) © Enveloppe contributors
