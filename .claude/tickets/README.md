# Rime Tickets

Agent-ready implementation tickets, derived from [`PRD.md`](../../PRD.md) and the
spike findings under [`.claude/spikes/`](../spikes/). Each ticket is **self-contained**:
an LLM/agent should be able to open one file, read it, and implement it without
needing to reconstruct context from elsewhere.

## Numbering & layout
Tickets are numbered **contiguously**, `ENV-01` … `ENV-52`, in dependency /
milestone order, and grouped into one subfolder per milestone:

```
00-foundations/        ENV-01 … ENV-04
01-doc-model/          ENV-05 … ENV-09
02-renderer-mjml/      ENV-10 … ENV-13
03-canvas-shell/       ENV-14 … ENV-18
04-drag-drop/          ENV-19 … ENV-26
05-rich-text/          ENV-27 … ENV-32
06-blocks-properties/  ENV-33 … ENV-38
07-tokens/             ENV-39 … ENV-41
08-persistence-images/ ENV-42 … ENV-43
09-wrappers-demo/      ENV-44 … ENV-47
10-release/            ENV-48 … ENV-52
```

The number is a stable ID; the subfolder is just organisation. There are **no
gaps** — every `ENV-NN` between 01 and 52 is a real ticket. (Earlier drafts had
gaps because resolved spikes occupied ID slots; spikes are now referred to by
their **OD-N** decision id + their `.claude/spikes/` path, not an ENV id — see
"Already-resolved" below.)

## How to pick up a ticket
1. Read this README, then [`_conventions.md`](./_conventions.md) (repo-wide rules
   that apply to every ticket — do not restate them per ticket).
2. Open the ticket file `NN-milestone/ENV-NN-slug.md`.
3. Confirm every ID in **depends_on** is `done`. If not, stop.
4. Implement against the **Acceptance criteria** and **Definition of done**.
5. Run the **Verification** commands. All must pass.
6. Update the ticket's `status:` frontmatter to `done`, commit per
   `_conventions.md`. (Review is done in one pass at the end against a POC, so
   tickets go straight to `done`, not `review`.)

## Status
Status lives in each ticket's frontmatter (`status: backlog|ready|in-progress|review|done`).
The board file [`board.md`](../../board.md) is the human-facing rollup; ticket
frontmatter is the source of truth for agents.

## Already-resolved (do NOT re-do — context only)
These were spikes; their decisions are baked into the tickets below and are
referenced by **OD-N** + their finding path (they have no ENV id).
- **OD-2** → toolchain = **rolldown-vite** + oxlint + oxfmt + tsc. `.claude/spikes/od2-toolchain/FINDINGS.md`
- **OD-1** → rich-text engine. **Superseded by OD-4:** final choice is **Lexical**. `.claude/spikes/od1-richtext/FINDINGS.md`
- **OD-4** → curating Tiptap can't beat ~108 kB; gap to Lexical is structural. `.claude/spikes/od1-richtext/ENV-56-FINDINGS.md`
- **OD-4** → core budget = **~100 kB gzip** → engine = **Lexical**. (in PRD §6.7, OD-4)

> Note: `ENV-56-FINDINGS.md` is the on-disk filename of an OD-4 spike finding —
> a historical artifact, intentionally **not** renamed.

## Critical path to a usable demo
`ENV-01 → ENV-05/06 → ENV-14/15/16 → ENV-19/20 → ENV-27 → ENV-33/34 → ENV-11 → ENV-46`
