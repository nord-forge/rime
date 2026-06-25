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
  import '@nord-forge/rime-core/register'; // defines <rime-editor> + core blocks
  const el = document.getElementById('editor');
  el.config = {
    theme: { '--rime-color-accent': '#5b5bd6', '--rime-radius': '10px' },
    onImageUpload: async (file) => uploadToMyCdn(file), // returns a URL
  };
  el.addEventListener('change', (e) => save(e.detail.doc)); // JSON doc
  el.loadDoc(savedJson);
</script>
```
A complete, runnable version of this (theming, `onImageUpload`, save/load via
`localStorage`) lives in [`examples/astro-vanilla`](./examples/astro-vanilla) — run it
with `bun run --filter='@nord-forge/rime-example-astro-vanilla' dev`.

**Astro.** `<rime-editor>` is a client-side web component (the editor is not
server-rendered). Register it on the client only — e.g. a `<script>` in an `.astro`
file, or a small island loaded with `client:only` / `client:load`:
```astro
---
// MyEditor.astro
---
<rime-editor id="editor" style="block-size: 100vh"></rime-editor>
<script>
  import '@nord-forge/rime-core/register'; // runs in the browser; defines the element
  const el = document.getElementById('editor');
  el.config = { theme: { '--rime-color-accent': '#5b5bd6' } };
  el.addEventListener('change', (e) => localStorage.setItem('doc', JSON.stringify(e.detail.doc)));
</script>
```
Theming is entirely [`--rime-*` CSS custom properties](#importing-the-editor) on the
element (or any ancestor) — no host stylesheet ever reaches the email canvas.

### React
```tsx
import { RimeEditor } from '@nord-forge/rime-react';

<RimeEditor
  doc={doc}
  theme={{ '--rime-color-accent': '#5b5bd6' }}
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
  <RimeEditor v-model="doc" :on-image-upload="uploadToMyCdn" :theme="theme" />
</template>
```
If you also use the `<rime-editor>` tag directly in a template (the wrapper itself
doesn't need this), tell Vue it's a custom element so it doesn't try to resolve it:
```ts
// vite.config — @vitejs/plugin-vue
vue({ template: { compilerOptions: { isCustomElement: (t) => t === 'rime-editor' } } });
```

### Custom block (the extension model)
```ts
import { defineRimeEditor } from '@nord-forge/rime-core/register';
import type { BlockDefinition } from '@nord-forge/rime-core';

const couponBlock: BlockDefinition = {
  type: 'coupon',
  schema: { fields: [/* props that drive the properties panel */] },
  palette: { label: 'Coupon', icon: '🎟️', category: 'Marketing', defaults: {} },
  renderCanvas: (node, ctx) => /* preview DOM */,
  renderExport: (node, ctx) => /* { mjml } or { raw } */,
};

// Config-driven init: define the element, include the built-ins, add your blocks.
defineRimeEditor({ blocks: [couponBlock] });
```

## Importing the editor

`@nord-forge/rime-core` ships **three entry points** so you pull in only what you
use. The rich-text engine (Lexical, ~60 kB gzip) is **code-split** — it loads on
demand, never up front.

| Import | What it gives you | Pulls in Lexical? |
|---|---|---|
| `@nord-forge/rime-core` | The pure, tree-shakeable SDK: types, `registerBlock`, the block registry, `registerToken`, render helpers. **No custom elements, no side effects.** | No |
| `@nord-forge/rime-core/register` | Defines the `<rime-editor>` element + the built-in blocks (side-effecting). This is what you import to actually render an editor. | Lazily, at editor init when rich text is enabled (see below) |
| `@nord-forge/rime-core/richtext` | The Lexical-coupled surface for advanced/direct use (`mountLexical`, the rich-text toolbar/popover/token-picker classes). Most apps never need this. | Yes (statically) |

### Editor **with** the Lexical rich-text editor (default)

This is the normal path: bold/italic/links/lists, the inline toolbar, and the merge-tag
chip UI. Lexical lives in a **separate chunk** that the editor **dynamic-imports as it
initializes** (not in your app's initial bundle), then **warms up on idle** — so the
user's first click into a text block is instant, with no first-edit stutter. With
`lexicalEditor: false` (below) the chunk is never requested at all.

```html
<rime-editor id="editor"></rime-editor>
<script type="module">
  import '@nord-forge/rime-core/register'; // defines <rime-editor> + core blocks
  const el = document.getElementById('editor');
  // lexicalEditor defaults to true — nothing to set.
  el.config = { theme: { '--rime-color-accent': '#5b5bd6' } };
</script>
```

Or via the config-driven initializer:

```ts
import { defineRimeEditor } from '@nord-forge/rime-core/register';
defineRimeEditor(); // rich text on by default
```

### Editor **without** Lexical (plain-text fallback)

Set `config.lexicalEditor = false`. Text blocks are then edited with a plain
`<textarea>` (plain paragraphs, no inline formatting), and **the Lexical chunk is
never loaded** — opting out keeps it entirely out of the bundle. Use this when you want
the smallest possible editor and don't need rich text.

```html
<rime-editor id="editor"></rime-editor>
<script type="module">
  import '@nord-forge/rime-core/register';
  const el = document.getElementById('editor');
  el.config = { lexicalEditor: false }; // plain-text editing; Lexical never fetched
</script>
```

> **Bundle impact.** Importing only `@nord-forge/rime-core` (the SDK barrel) pulls
> **no** Lexical. Importing `/register` keeps Lexical in a separate chunk that the
> editor loads (and warms) at init rather than shipping in your initial bundle — and
> with `lexicalEditor: false` it's never fetched at all. The size gate enforces these
> per-entry budgets so the split can't regress.

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
bun run demo          # runnable vanilla demo (apps/rime-demo)
bun run demo:react    # runnable React demo using @nord-forge/rime-react (apps/rime-react-demo)
```

## Contributing

This is early — the best contribution right now is feedback on the [PRD](./PRD.md). When contributing code, see [CONTRIBUTING.md](./CONTRIBUTING.md) and the ticket plan in [board.md](./board.md). All participants are expected to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE) © Rime contributors
