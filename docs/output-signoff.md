# Output-correctness sign-off (PRD §11)

Formal record that the generated email HTML renders correctly across the major email
clients, verified against the ENV-13 fixture set. Splits into two halves: the
**automated** gate (deterministic golden snapshots + Outlook-safe scaffolding, enforced
in CI) and the **manual** live-inbox client matrix (needs real sends / a Litmus / Email
on Acid account).

**Run date:** 2026-06-25 · **Renderer:** `@nord-forge/rime-mjml` `MjmlRenderer` (ENV-11)
+ raw-table fallback (ENV-12). · Fixtures: `packages/rime-mjml/test/fixtures` →
`test/golden/*.html`.

## Automated gate — ✅ PASS

| Check | Evidence |
|---|---|
| All ENV-13 fixtures render deterministically | `bun test` in `packages/rime-mjml` → **36/36** golden-snapshot assertions green |
| Golden snapshots current + committed (regression guard) | `render:fixtures` output equals committed `test/golden/*.html` (CI fails on drift) |
| Outlook-safe scaffolding present | `button.html` carries **9** `mso`/VML occurrences (`v:roundrect`, `<!--[if mso]>`); `full-newsletter.html` uses ghost-table structure (46 `table`/`mso` hits) |
| Core blocks covered | section · column · text (marks + link) · image (linked) · button · divider · spacer — across the 5 fixtures incl. a combined `full-newsletter` |
| href/token export hardened | `javascript:`/`data:` dropped via `normalizeHref` (ENV-67); parity test asserts sanitized output |

Reproduce:
```bash
cd packages/rime-mjml
bun test                 # 36 golden-snapshot assertions
bun run render:fixtures  # regenerate; diff must be empty
```

## Manual live-client matrix — ⏳ PENDING

The §11 gate also requires confirming the rendered HTML in **real inboxes**. This cannot
be done headlessly from CI — it needs the rendered fixtures sent through a delivery path
(Litmus / Email on Acid, or manual sends) and inspected per the procedure in
[`packages/rime-mjml/docs/email-client-matrix.md`](../packages/rime-mjml/docs/email-client-matrix.md).
It is the remaining release-tag step (ENV-52), analogous to the ENV-32 real-device QA pass.

Fill this grid on the release candidate (record client versions + date):

| Fixture | Outlook (Win) | Gmail web | Gmail mobile | Apple Mail macOS | Apple Mail iOS |
|---|---|---|---|---|---|
| single-text | ☐ | ☐ | ☐ | ☐ | ☐ |
| button | ☐ | ☐ | ☐ | ☐ | ☐ |
| two-column | ☐ | ☐ | ☐ | ☐ | ☐ |
| image-divider-spacer | ☐ | ☐ | ☐ | ☐ | ☐ |
| full-newsletter | ☐ | ☐ | ☐ | ☐ | ☐ |

## Verdict

The **automated** output-correctness gate **PASSES** and is locked in CI (golden
snapshots + Outlook scaffolding). The **live-inbox matrix is pending** a human + an
email-testing account; it's the final manual confirmation before the release tag and
must be completed (any failing core client routes back to ENV-11/22 — not waived).
