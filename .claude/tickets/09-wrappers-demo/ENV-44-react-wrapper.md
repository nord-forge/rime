---
id: ENV-44
title: "@nord-forge/rime-react wrapper"
status: done
priority: P1
milestone: 9 — Framework wrappers & demo
depends_on: [ENV-14]
blocks: [ENV-48, ENV-52]
package: react
prd: [§7]
estimate: M
---

# ENV-44 — `@nord-forge/rime-react` wrapper

## Context
v1 ships the Lit web component plus **thin** React and Vue wrappers (§7) so React devs
get an idiomatic component instead of touching a custom element directly. The wrapper
owns nothing — it maps React props/events/refs onto `<rime-editor>` (config, the
`change` event, `onImageUpload`, `loadDoc`/`getDoc`). It must match the README usage
exactly. Keep it tiny; the editor logic lives in `@nord-forge/rime-core`.

## Goal
`@nord-forge/rime-react` exports `<RimeEditor>` — a thin React component over
`<rime-editor>` taking `doc` as a controlled value plus `theme`, `onImageUpload`,
`onChange`, and a forwarded ref — matching the README React snippet.

## Prerequisites
- ENV-14 done (the element + `RimeConfig`) and ENV-42 (`loadDoc`/`getDoc`/`change`)
  for the controlled-value behavior. If ENV-42 isn't merged, wire props/events against
  ENV-14's stubs and tighten when it lands.
- `@nord-forge/rime-core` is a `workspace:*` dep; `react`/`react-dom` are **peer deps**
  (not bundled).

## Implementation notes
Create under `packages/react/src/`:

1. **`rime-editor.tsx`** — match the README exactly:
   ```tsx
   import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
   import "@nord-forge/rime-core"; // registers <rime-editor>
   import type { RimeDoc, RimeConfig } from "@nord-forge/rime-core";

   export interface RimeEditorProps {
     doc?: RimeDoc;                          // controlled value
     theme?: RimeConfig["theme"];
     enabledBlocks?: string[];
     onImageUpload?: (file: File) => Promise<string>;
     onChange?: (doc: RimeDoc) => void;
     className?: string;
     style?: React.CSSProperties;
   }
   export interface RimeEditorHandle { getDoc(): RimeDoc | undefined; loadDoc(doc: RimeDoc): void; }

   export const RimeEditor = forwardRef<RimeEditorHandle, RimeEditorProps>(...);
   ```
2. **Prop → element mapping.**
   - Build `config` from `theme`/`enabledBlocks`/`onImageUpload` and assign it to the
     element’s `config` **property** (not attribute — it’s an object). Re-assign when
     these props change.
   - **Controlled `doc`:** on mount and when `doc` changes (and differs from the
     element's current `getDoc()`), call `el.loadDoc(doc)`. Guard against the feedback
     loop — don't re-load a doc that originated from the element's own `change`.
3. **Event → callback.** Add a `change` listener that calls `onChange(e.detail.doc)`;
   remove it on cleanup (no leaked listeners — §10 discipline applies to wrappers too).
4. **Ref.** `useImperativeHandle` exposes `getDoc()`/`loadDoc()` so refs work for
   imperative hosts.
5. **TS for the custom element.** Add a JSX intrinsic-element declaration for
   `rime-editor` (or cast) so TSX consumers don’t see type errors; keep it scoped
   to this package.
6. **Build/peer deps.** `react`/`react-dom` are peerDependencies + devDependencies;
   externalize them in the Vite lib build (don’t bundle React). `@nord-forge/rime-core`
   stays external too (consumer dedups). Emit ESM + `.d.ts`.
7. **No re-implementation.** The wrapper holds no doc state of its own beyond the
   controlled-value sync; all logic is in core.

## Acceptance criteria
- [ ] `<RimeEditor>` renders `<rime-editor>` and matches the README React
      snippet (`doc`, `theme`, `onImageUpload`, `onChange`).
- [ ] `theme`/`enabledBlocks`/`onImageUpload` map into the element's `config` property
      and update on prop change.
- [ ] `doc` is a controlled value: changing it calls `loadDoc`; edits surface via
      `onChange(e.detail.doc)`; no load↔change feedback loop.
- [ ] A forwarded ref exposes `getDoc()`/`loadDoc()`.
- [ ] `change` listeners are removed on unmount (no leaks).
- [ ] `react`/`react-dom`/`@nord-forge/rime-core` are peer/external — not bundled.
- [ ] Unit tests (Bun + a React test renderer / jsdom) cover prop mapping, controlled
      `doc`, and `onChange` plumbing; emits ESM + `.d.ts`.

## Out of scope
- Vue wrapper (ENV-45). The demo app (ENV-46). Editor features (all in core).
- A React-specific custom-block API — `registerBlock` is framework-agnostic from core.

## Verification
```bash
cd packages/react
bun test
bun run build   # ESM + .d.ts; react external
bun run lint
```

## Definition of done
See `_conventions.md`. Thin React wrapper matches README; peers external;
status → `review`.
