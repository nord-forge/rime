# Email-client verification matrix (PRD §11)

Automated tests lock the renderer's HTML against regressions (golden snapshots in
`test/output-correctness.test.ts`), but they can't open a real inbox. This doc is
the **manual** procedure that feeds the §11 output-correctness sign-off. The
sign-off run itself happens on the release candidate (ENV-49/ENV-50); this file is
the checklist a reviewer fills in.

## Generate the HTML to send

```bash
bun run --filter='@enveloppe/renderer-mjml' render:fixtures
```

Writes one file per fixture to `packages/renderer-mjml/test/golden/`:

- `single-text.html` — text with bold/underline marks + a link
- `button.html` — a styled CTA button (Outlook VML / ghost-table risk)
- `two-column.html` — two 50% columns (mobile stacking)
- `image-divider-spacer.html` — image w/ link, divider, spacer (spacing fidelity)
- `full-newsletter.html` — realistic multi-section email using all core blocks

Send each through your delivery path (Litmus / Email on Acid, or a manual send)
into each client below.

## Clients (rows) — the §11 gate

| Client | Surface | Gate? |
|---|---|---|
| **Windows Outlook** (Word engine) | Desktop | **Must pass** |
| **Gmail** | Web + Android app + iOS app | **Must pass** |
| **Apple Mail** | macOS + iOS | **Must pass** |

## Per-cell checks

For every (client × fixture) cell, verify:

- **Layout intact** — no collapsed/overflowing columns; two-column stacks cleanly on mobile.
- **Button** — visible, styled, clickable; renders via VML in Outlook (not a broken link).
- **Images** — load, respect width, show `alt` when blocked; linked image is clickable.
- **Spacing** — divider + spacer heights match the design; no collapsed gaps in Outlook.
- **Fonts** — fall back sanely (no serif surprise where sans was intended).
- **Links** — resolve to the right URL; underline mark preserved.
- **Dark mode** — not catastrophically broken (text legible on auto-inverted backgrounds).

## Result grid (fill in per run)

| Fixture | Outlook (Win) | Gmail web | Gmail mobile | Apple Mail macOS | Apple Mail iOS |
|---|---|---|---|---|---|
| single-text | ☐ | ☐ | ☐ | ☐ | ☐ |
| button | ☐ | ☐ | ☐ | ☐ | ☐ |
| two-column | ☐ | ☐ | ☐ | ☐ | ☐ |
| image-divider-spacer | ☐ | ☐ | ☐ | ☐ | ☐ |
| full-newsletter | ☐ | ☐ | ☐ | ☐ | ☐ |

Record client versions and the date. Any ✗ blocks the §11 sign-off until fixed
or explicitly waived.
