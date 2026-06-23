# Repo-wide conventions (apply to EVERY ticket — not restated per ticket)

An agent implementing any ticket MUST follow these. They are the implicit
"Definition of done" appended to every ticket.

## Stack (decided — do not re-litigate)
- **Runtime / package manager / test runner:** Bun (`bun`, `bun test`).
- **Language:** TypeScript, `strict: true`. ESM only (`"type": "module"`).
- **UI components:** Lit web components. Decorators ON → every tsconfig that
  compiles components sets `"useDefineForClassFields": false` and
  `"experimentalDecorators": true`.
- **Bundler:** rolldown-vite (library mode), stock Vite is the drop-in fallback.
  Externalize `lit` in library builds.
- **Lint:** `oxlint`. **Format:** `oxfmt` (it owns style — double quotes, expands
  CSS rules inside `css\`\``; never hand-fight it). Run `oxfmt` before committing.
- **Types:** `tsc` for `.d.ts` emit (`emitDeclarationOnly`); bundler emits JS.
- **Cross-browser tests:** Playwright, projects `chromium` + `webkit` (Safari
  engine). WebKit is mandatory — most quirks live there.

## Monorepo layout (Bun workspaces)
```
packages/doc-model      @enveloppe/doc-model     (headless JSON model)
packages/core           @enveloppe/core          (<enveloppe-editor> Lit WC)
packages/renderer-mjml  @enveloppe/renderer-mjml (doc → MJML → HTML)
packages/react          @enveloppe/react
packages/vue            @enveloppe/vue
apps/demo               @enveloppe/demo
.claude/spikes/*                throwaway proofs — DO NOT import from production code
```
Cross-package deps use `workspace:*`.

## Hard product constraints (from PRD — every ticket inherits these)
- **`@enveloppe/core` ≤ ~100 kB gzip** (editor only; MJML renderer is a separate
  package and excluded). CI fails over budget. If a change pushes core over,
  that's a blocker, not a warning.
- **One document model** = source of truth. Immutable JSON tree; undo via patch
  diffs (never full snapshots). Memory-bounded (potato-PC target).
- **Rich-text engine = Lexical**, used headless, **one live instance at a time**
  (create on focus / destroy on blur). 100% custom UI (no library toolbar).
- **Canvas = same-origin `srcdoc` iframe.** Host app CSS must never reach it.
- **Chrome theming = `--eb-*` CSS custom properties** only.
- **DnD = Pragmatic drag-and-drop** (`@atlaskit/pragmatic-drag-and-drop`) + our
  own keyboard-reorder + ARIA-live layer (a11y is ours regardless of engine).
- **Export = MJML** behind a swappable `Renderer` interface.
- **Headless persistence:** JSON in/out; images via host `onImageUpload` callback;
  no backend in any published package.

## Coding rules
- Match surrounding code style; let `oxfmt` normalize.
- Public APIs are typed and exported from the package's `src/index.ts`.
- No `any` in public signatures. Internal `any` only with a `// reason:` note.
- Every new module ships unit tests (`*.test.ts`, run by `bun test`) covering the
  acceptance criteria. Browser-observable behaviour ships a Playwright test.
- No new runtime dependency without noting its gzip cost in the PR (budget!).

## Git / commits
- Branch off the default branch; never commit straight to it for feature work.
- **Do NOT add `Co-Authored-By` or any AI attribution** to commits or PRs.
- Commit message: `type(ENV-NN): summary`, body explains what + why.
- Sign commits if the machine is configured for it; otherwise normal commit.

## Ticket frontmatter schema
```yaml
---
id: ENV-NN
title: <short title>
status: backlog | ready | in-progress | review | done
priority: P0 | P1 | P2
milestone: <n> — <name>
depends_on: [ENV-XX, ...]   # must all be `done` before starting
blocks: [ENV-YY, ...]       # informational
package: <which workspace package(s)>
prd: [§x.y, ...]
estimate: S | M | L          # rough size
---
```

## "Done" gate appended to every ticket
A ticket is done only when: acceptance criteria met · unit tests pass
(`bun test`) · cross-browser test passes where applicable (`chromium`+`webkit`) ·
`oxlint` clean · `oxfmt` applied · `tsc` clean · core bundle still ≤ budget ·
status set to `review`.
