# Performance sign-off (PRD §10)

Formal record that the §10 performance budgets are met. Most gates are enforced by
upstream tickets (ENV-21 perf pass, ENV-26 leak guard, ENV-28 one-instance lifecycle)
and run in CI; this collects the evidence and the measured numbers.

**Run date:** 2026-06-25 · **Tooling:** Bun 1.3.14, Playwright 1.61.1
(Chromium + WebKit).

## Reference machines

| Class | Spec | Status |
|---|---|---|
| High-end (dev) | Apple M1 Pro, 8 cores, 32 GB — macOS | ✅ measured below |
| Low-end ("potato PC") | — | ⏳ **pending** — see note |

> **Low-end note.** The DnD perf bench runs under a **4× CPU throttle** (Playwright
> CDP), which simulates low-end hardware on the dev machine and is the gate CI
> enforces. A run on dedicated low-end physical hardware (e.g. a low-power laptop /
> Chromebook-class device) is the remaining manual confirmation before the v1 release
> tag; it does not block development. The throttled bench passing is strong evidence
> the budget holds there.

## Budgets × measurements

| §10 budget | Gate | Measured | Result |
|---|---|---|---|
| Drag frame cadence | ≥ 95% frames ≤ 16.6 ms (4× CPU throttle) | **99.3%** (134 frames sampled) | ✅ |
| Drop-detection latency | p95 ≤ 8 ms (OD-3) | **p50 0.000 ms / p95 0.000 ms** | ✅ |
| One live rich-text instance | exactly 1 across focus cycling | 6/6 lifecycle e2e (chromium + webkit) | ✅ |
| No leaked listeners/observers/rAF | counts return to baseline across drag/edit cycles | 4/4 leak-guard assertions | ✅ |
| `@nord-forge/rime-core` bundle | ≤ ~100 kB gzip (renderer-mjml excluded) | **88.25 kB gzip** (348.14 kB raw / 72.87 kB brotli) | ✅ |
| Eager-load closures (ENV-66) | Lexical stays lazy; per-entry budgets | index 17.05 kB / register 25.17 kB — Lexical lazy | ✅ |

## How to reproduce

```bash
cd packages/rime-core && bun run bench:dnd   # frame cadence + detection latency (4× throttle)
bun run size                                 # @nord-forge/rime-core gzip + eager budgets
cd packages/rime-core && bunx playwright test richtext-lifecycle   # one live instance
bun test --conditions=development packages/rime-core/src/dnd/leak-guard/leak-guard.test.ts
```

## Verdict

All automated §10 budgets **PASS** on the dev machine and under 4× CPU throttle, and
are green in CI. The only open item is the optional confirmation run on dedicated
low-end physical hardware before the release tag (ENV-52). No budget was waived; any
future regression fails the corresponding CI gate (`bench:dnd`, `size`, the lifecycle
+ leak tests).
