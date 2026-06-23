# Enveloppe Tickets

Agent-ready implementation tickets, derived from [`PRD.md`](../../PRD.md) and the
spike findings under [`.claude/spikes/`](../spikes/). Each ticket is **self-contained**:
an LLM/agent should be able to open one file, read it, and implement it without
needing to reconstruct context from elsewhere.

## How to pick up a ticket
1. Read this README, then [`_conventions.md`](./_conventions.md) (repo-wide rules
   that apply to every ticket — do not restate them per ticket).
2. Open the ticket file `ENV-NN-slug.md`.
3. Confirm every ID in **Depends on** is `Done` (see status below). If not, stop.
4. Implement against the **Acceptance criteria** and **Definition of done**.
5. Run the **Verification** commands. All must pass.
6. Update the ticket's `status:` frontmatter to `review`, commit per
   `_conventions.md`.

## Status
Status lives in each ticket's frontmatter (`status: backlog|ready|in-progress|review|done`).
The board file [`board.md`](../../board.md) is the human-facing rollup; ticket
frontmatter is the source of truth for agents.

## Already-resolved (do NOT re-do — context only)
These were spikes; their decisions are baked into the tickets below. Read the
finding if a ticket references it.
- **ENV-02** → toolchain = **rolldown-vite** + oxlint + oxfmt + tsc. `.claude/spikes/od2-toolchain/FINDINGS.md`
- **ENV-05 / OD-1** → rich-text engine. **Superseded by ENV-57:** final choice is **Lexical**. `.claude/spikes/od1-richtext/FINDINGS.md`
- **ENV-56** → curating Tiptap can't beat ~108 kB; gap to Lexical is structural. `.claude/spikes/od1-richtext/ENV-56-FINDINGS.md`
- **ENV-57 / OD-4** → core budget = **~100 kB gzip** → engine = **Lexical**. (in PRD §6.7, OD-4)

## Ticket index
Generated tickets live alongside this file as `ENV-NN-slug.md`. The board groups
them by milestone; dependency order is the real execution order.

**Critical path to a usable demo:**
`ENV-01 → ENV-10/11 → ENV-30/31/32 → ENV-40/41 → ENV-50 → ENV-60/61 → ENV-21 → ENV-92`
