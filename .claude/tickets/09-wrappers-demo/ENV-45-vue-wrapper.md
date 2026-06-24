---
id: ENV-45
title: "@nord-forge/rime-vue wrapper"
status: ready
priority: P1
milestone: 9 — Framework wrappers & demo
depends_on: [ENV-14]
blocks: [ENV-52]
package: vue
prd: [§7]
estimate: M
---

# ENV-45 — `@nord-forge/rime-vue` wrapper

## Context
The Vue counterpart to ENV-44: a **thin** wrapper over `<rime-editor>` (§7) giving
Vue devs an idiomatic component with `v-model` for the doc, plus `theme` and
`onImageUpload`. It owns no editor logic — it maps Vue props/events/`v-model` onto the
custom element and matches the README Vue snippet exactly.

## Goal
`@nord-forge/rime-vue` exports `<RimeEditor>` supporting `v-model` for the doc,
`:on-image-upload`, and `:theme`, matching the README Vue snippet, with all editor
logic delegated to `@nord-forge/rime-core`.

## Prerequisites
- ENV-14 done (the element + `RimeConfig`) and ENV-42 (`loadDoc`/`getDoc`/`change`)
  for `v-model`. Wire against ENV-14 stubs and tighten when ENV-42 lands.
- `@nord-forge/rime-core` is `workspace:*`; `vue` is a **peer dep** (not bundled).

## Implementation notes
Create under `packages/vue/src/`:

1. **`RimeEditor.ts`** (SFC or `defineComponent`) — match the README:
   ```ts
   // <RimeEditor v-model="doc" :on-image-upload="uploadToMyCdn" :theme="..." />
   import { defineComponent, h, ref, watch, onMounted, onBeforeUnmount } from "vue";
   import "@nord-forge/rime-core";
   import type { RimeDoc, RimeConfig } from "@nord-forge/rime-core";

   export default defineComponent({
     props: {
       modelValue: { type: Object as () => RimeDoc, default: undefined }, // v-model
       theme: { type: Object as () => RimeConfig["theme"], default: undefined },
       enabledBlocks: { type: Array as () => string[], default: undefined },
       onImageUpload: { type: Function as unknown as () => (f: File) => Promise<string>, default: undefined },
     },
     emits: ["update:modelValue", "change"],
     ...
   });
   ```
2. **`v-model`.** `modelValue` → on mount/change call `el.loadDoc(modelValue)` (when it
   differs from `el.getDoc()`); on the element's `change` event emit
   `update:modelValue` with `e.detail.doc` **and** a `change` event. Guard the
   load↔change feedback loop (don't re-load a doc that came from the element).
3. **Config mapping.** Build `config` from `theme`/`enabledBlocks`/`onImageUpload` and
   assign to the element's `config` **property** via a template ref
   (`.value.config = ...`), re-assigning on prop change (`watch`).
4. **Custom-element handling.** Tell Vue the tag is a custom element so it doesn't warn
   /try to resolve it — document the `compilerOptions.isCustomElement` (or
   `app.config.compilerOptions.isCustomElement`) requirement for consumers, and ensure
   the wrapper renders the element via `h("rime-editor", ...)` so prop binding is
   explicit.
5. **Cleanup.** Remove the `change` listener `onBeforeUnmount` (no leaks).
6. **Build/peer deps.** `vue` is a peer + dev dependency, externalized in the Vite lib
   build; `@nord-forge/rime-core` external too. Emit ESM + `.d.ts`.
7. **No re-implementation.** Wrapper holds no doc state beyond the `v-model` sync.

## Acceptance criteria
- [ ] `<RimeEditor v-model="doc" :on-image-upload :theme>` matches the README Vue
      snippet.
- [ ] `v-model` works both ways: external `doc` change → `loadDoc`; an edit →
      `update:modelValue` with the new doc; no feedback loop.
- [ ] `theme`/`enabledBlocks`/`onImageUpload` map into the element's `config` property
      and update on prop change.
- [ ] The `change` listener is removed on unmount (no leaks).
- [ ] `vue`/`@nord-forge/rime-core` are peer/external — not bundled; ESM + `.d.ts` emitted.
- [ ] Consumer guidance for `isCustomElement` is documented.
- [ ] Unit tests (Bun + `@vue/test-utils` or equivalent) cover `v-model` both ways and
      config mapping.

## Out of scope
- React wrapper (ENV-44). Demo app (ENV-46). Editor features (all in core).

## Verification
```bash
cd packages/vue
bun test
bun run build   # ESM + .d.ts; vue external
bun run lint
```

## Definition of done
See `_conventions.md`. Thin Vue wrapper matches README; peers external;
status → `review`.
