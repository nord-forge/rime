---
id: ENV-67
title: Sanitize hrefs/tokens on the MJML export boundary + harden the parity test
status: done
priority: P0
milestone: 10 — Release readiness
depends_on: [ENV-39]
blocks: [ENV-50, ENV-52]
package: core, mjml, model
prd: [§6.3, §6.9, §11]
estimate: M
---

# ENV-67 — Sanitize hrefs/tokens on the MJML export boundary + harden the parity test

## Context
A multi-dimension audit (adversarially verified) found a **security inconsistency at
the export boundary**: the original built-in blocks (button, image) and the rich-text
link/token paths emit `href`/`link` values verbatim into exported email HTML, while
every *newer* block routes hrefs through `normalizeHref` (which drops `javascript:` /
`data:` schemes). A `javascript:`/`data:` URL in an attacker-controlled or
externally-loaded doc therefore survives into the sent email. The parity test masks
this because it only proves the two duplicated MJML copies (rime-mjml + core
`mjml-attrs`) are byte-identical — a hole present in *both* passes.

This is the highest-severity audit finding. It blocks the output-correctness sign-off
(ENV-50) and publish (ENV-52).

## Findings being fixed
- **High** — built-in `button`/`image`/rich-text-link hrefs are not scheme-sanitized:
  `blocks/core/button.ts:26`, `blocks/core/image.ts:28`,
  `rime-mjml/src/to-mjml.ts:57,67`, `rime-mjml/src/rich-text-to-html.ts:39`,
  `blocks/core/mjml-attrs.ts:60`.
- **Medium** — parity test only asserts incidental `registry === mjml` equality with
  benign fixtures; never feeds hostile hrefs / brace-laden tokens
  (`blocks/core/core-blocks.test.ts:110-193`).
- **Low** — token braces are emitted literally and `validateRuns` enforces no charset,
  so a token key like `a}} {{evil` injects extra merge tags
  (`rich-text-to-html.ts:24-26`, `mjml-attrs.ts:55`, `rime-model/validate.ts`).

## Goal
Every `href`/`link` value in BOTH export paths (registry export + standalone
renderer) is run through `normalizeHref` (dropped on null); token keys are constrained
to a safe charset in `validateRuns`; the parity test asserts the expected *sanitized*
output for hostile inputs, not incidental equality.

## Implementation notes
1. `normalizeHref` already exists Lexical-free in `blocks/core/mjml-attrs.ts` and is
   duplicated in rime-mjml. Apply it in `button`/`image` `renderExport` and the
   rich-text link branch in BOTH copies; keep the two copies in parity.
2. In `rime-model` `validateRuns`, constrain a token `token` key to a safe charset
   (e.g. `/^[A-Za-z0-9_.-]+$/`) so braces/spaces can't smuggle extra `{{ }}` on export.
3. Replace the parity test's benign fixtures with **hostile-input** fixtures:
   `javascript:`/`data:`/empty/scheme-less hrefs, mark+link runs, and brace-laden
   token keys — assert the expected sanitized output, then ALSO assert core == mjml.
4. Add unit tests in rime-mjml + rime-model for the new sanitization.

## Acceptance criteria
- [ ] `javascript:`/`data:` hrefs on button/image/rich-text links are dropped (or
      neutralized) in exported HTML, in both the registry path and the standalone
      renderer.
- [ ] Token keys with unsafe characters are rejected by `validateDoc`.
- [ ] The parity test feeds hostile inputs and asserts sanitized output (not just
      copy-equality); it would fail if either copy regressed.
- [ ] Unit tests cover each sanitized path; all existing tests pass; size within budget.

## Out of scope
- Broader CSP/email-client hardening beyond href scheme sanitization.

## Verification
```bash
bun run test && bun run typecheck && bun run lint && bun run build && bun run size
```

## Definition of done
See `_conventions.md`. Export boundary sanitizes hrefs + token keys; parity test
catches the hole; status → `review`.
