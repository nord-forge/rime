# Rich-text QA findings — iOS Safari & IME

Sign-off record for `RICHTEXT-QA-CHECKLIST.md`. Fill in when the manual pass is run
on real hardware. Until then this is a scaffold; the **composition guard** below is
already implemented and covered by automated tests.

## Environments tested

| Environment | Version | Date | Tester |
|-------------|---------|------|--------|
| iOS Safari (iPhone) | _pending_ | | |
| iPadOS Safari | _pending_ | | |
| CJK IME (Pinyin / Japanese) | _pending_ | | |
| Android Chrome | _pending / skipped_ | | |

## Results

Record each checklist item's result (✅/❌/⚠️) with notes. Reference the checklist
numbering (1.1, 2.3, …).

| Item | Result | Notes |
|------|--------|-------|
| 1.x CJK IME composition | _pending_ | 1.3 (no premature blur) is covered by an automated synthetic-composition test; the rest are manual |
| 2.x iOS focus & keyboard | _pending_ | |
| 3.x selection + toolbar | _pending_ | |
| 4.x autocorrect / smart punctuation | _pending_ | |
| 5.x mobile paste | _pending_ | paste sanitization itself is automated; mobile gesture path is manual |
| 6.x undo on iOS | _pending_ | |

## Fixes landed pre-manual-pass

- **IME composition guard** (proactive, automatable): the focus/blur lifecycle does
  not blur, commit, or destroy the editor while an IME composition is in progress.
  `compositionstart`/`compositionend` on the iframe document gate the blur path; a
  blur requested mid-composition is deferred until `compositionend`. Regression:
  unit test on the lifecycle (`blur is suppressed while composing`) + a synthetic
  `compositionstart`/`compositionend` Playwright case (WebKit).

## Issues found (manual pass)

_None recorded yet — populate during the device run; for each: symptom, repro,
fix (commit), and re-test result._

## Sign-off

- [ ] Sections 1–6 of the checklist executed on real iOS Safari + a CJK IME.
- [ ] All failures fixed and re-tested.
- [ ] Versions + results recorded above.
