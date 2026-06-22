---
id: ENV-NN
title: <short imperative title>
status: ready
priority: P0
milestone: <n> — <name>
depends_on: []
blocks: []
package: <workspace package>
prd: [§x.y]
estimate: M
---

# ENV-NN — <title>

## Context
<Why this exists, in 2–4 sentences. What problem it solves and how it fits the
whole. Link to any spike finding the agent should read first.>

## Goal
<One sentence: the single outcome that means this ticket is complete.>

## Prerequisites
<What must already be true / which deps are done. Files/APIs this builds on.>

## Implementation notes
<Concrete, ordered guidance. Name the files to create/edit, the exported symbols,
the data shapes. Include code/type sketches where they remove ambiguity. Call out
decided trade-offs so the agent doesn't re-explore them.>

## Acceptance criteria
- [ ] <observable, testable statement>
- [ ] ...

## Out of scope
<Explicitly what NOT to build here (usually = a later ticket). Prevents scope creep.>

## Verification
```bash
# exact commands an agent runs to prove the ticket is done
```

## Definition of done
Acceptance criteria met · tests pass · lint/format/types clean · bundle within
budget · status → `review`. (See `_conventions.md` for the full gate.)
