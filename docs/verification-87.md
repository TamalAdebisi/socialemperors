# Verification and delivery of #87 — 16 October 2026

The building card, Upgrade and site Menu were verified together with both
agents' work and the tournament slice that reached main during testing.
Main was merged, never rebased; no branch history was rewritten.

## Final integrated checks

Code commit: `d760f3a318571b07ccbae8d51004efa0b0bf98f4`.
It contains main `36b2f277` (#89), #90's art investigation and #86's
unchanged market/survival waits. Only delivery documentation follows it.

| Check | Result | Elapsed, including startup/build |
| --- | --- | --- |
| `.venv/bin/python -m unittest discover tests` | 429 run: 420 passed, 9 existing skips | 34.33 seconds |
| `cd client && npm run check && npm test` | Types and all 348 tests passed | 14.10 seconds |
| `PYTHON=.venv/bin/python node e2e/run.mjs` with every test named | 67 passed, 0 failed | 80m 30.65s |

The browser run began with `siege sound walk tournaments menus card
site-menu`, then the remaining 60 tests alphabetically. Every file in
`e2e/tests/` ran exactly once. No test was skipped or assertion weakened.
The added tournament test makes 67, up from the requested branch's 66.

Environment: 2 CPUs, 8 GiB memory, Python 3.13.5, Node 24.19.0,
Playwright 1.56.1 / Chromium 141, software rendering. One browser runner
at a time. All game accounts and writes were on throwaway local servers;
public art was read through the environment's proxy, without local sheet
overrides. The server log has no HTTP 5xx responses or Python tracebacks.

## Regressions and repairs

- The phone card now fits above the pointer tools. A real two-tap upgrade
  checks both the price preview and the saved purchase/refund.
- Tutorial progress stays inside its instruction bubble, clear of the
  card. Its progress screenshot was inspected after the final pass.
- Late image/news responses no longer renew a login cookie after logout.
  A server regression test failed before this fix and passes afterward.
  The existing 30-day expiry now runs from login or a session change.
- Map tests click visible parts of units and open ground with the card
  present. Selection-ring and saved-position assertions remain intact.
- Construction checks its current seconds display and performs the
  time-sensitive inputs before taking the screenshot. The nine-second
  interaction bound and prohibition on worker entry during construction
  remain checked.
- Completed independent scripted-battle towns close after every assertion
  and a screenshot. The old failure had no attackers and only 124 of the
  required 150 quiet frames after 30 seconds; software drawing in earlier
  tabs starved the final town. The original deadline is retained.
- Siege waits for a minute on the game clock, bounded at 30 seconds;
  walking waits for arrival, bounded at 15 seconds per destination. The
  engine-target, audio, path and server-save checks remain unchanged.

An earlier complete run at `b412f28a` ran all 66 tests in **75m 14.75s**:
63 passed; siege, sound and walk failed. Those failures prompted the last
repairs above. #89's independent unchanged-main run also reproduced the
construction, scripted-battle, siege and walking timing failures.
The final integrated results below supersede that run for delivery.

## Visual review

Screenshots were inspected throughout both full runs, including desktop
and phone card/upgrade, Menu, tournament list/team, tutorial, pointer
tools, construction, storage/training, selection rings, walking, battles
and saved outcomes. Passing screenshots exposed the tutorial overlap;
that was repaired and rechecked. Final integration screenshots confirm
the card and tournament controls coexist, with reachable phone controls.

## Separate art follow-up remains open

In the final integrated run, `team` passed in **121 seconds**. Its sampled
cgroup peak was **8.00 GiB**, with **886,334 memory-limit events**, **0
OOM events** and **0 OOM kills**.

The earlier 66-test run's `team` passed in 70 seconds while reaching the 8
GiB limit, with 166,030 memory-limit events and no OOM kill. At that time
the ordinary public `2075_elemental_red_god.json` still served 76 sheets
(SHA-256
`3ab6d6c20d4123adc94ca47def1e20b8d7c664c69af23c4f10e3a87df3893ab2`). At
12:07 UTC, all nine ordinary public manifests show the expected 20 pages
in total after the owner-operated [export
run](https://github.com/TamalAdebisi/socialemperors/actions/runs/38885093455)
completed at 10:41 UTC. The main bundle is now two pages, scale 0.25, step
2, SHA-256
`c458f0dfdf33870dbf49f04f33891024e1fab14c061bf57c9dda8ae799fad28c`. This
run's cached main manifest remains the old 76-page one; the other eight
cached manifests match the new public files. No cache was changed during
verification. A variable pass with the stale cached bundle does not verify
the repaired public art. Consistent images, cache refresh and subsequent
`team`/full-suite verification remain a separate follow-up; see [the
repair notes](art-loading-repair.md). #87 did not operate the live
workflow or bucket.

## Browser results

Durations below are the runner's rounded seconds per test; total elapsed
above also includes build, startup and cleanup.

| Test | Result | Seconds |
| --- | --- | ---: |
| `siege` | Pass | 37 |
| `sound` | Pass | 30 |
| `walk` | Pass | 48 |
| `tournaments` | Pass | 121 |
| `menus` | Pass | 123 |
| `card` | Pass | 111 |
| `site-menu` | Pass | 64 |
| `animals` | Pass | 32 |
| `attack` | Pass | 141 |
| `bonus` | Pass | 34 |
| `bosses` | Pass | 69 |
| `bubble` | Pass | 66 |
| `camp` | Pass | 46 |
| `camp-again` | Pass | 25 |
| `cash` | Pass | 45 |
| `classic` | Pass | 62 |
| `collect` | Pass | 104 |
| `collections` | Pass | 35 |
| `construction` | Pass | 60 |
| `defence` | Pass | 28 |
| `dock` | Pass | 56 |
| `dragons` | Pass | 91 |
| `edit` | Pass | 48 |
| `friends-help` | Pass | 62 |
| `gifts` | Pass | 46 |
| `goal-window` | Pass | 52 |
| `graveyard` | Pass | 30 |
| `group` | Pass | 96 |
| `heroes` | Pass | 66 |
| `hover` | Pass | 49 |
| `keys` | Pass | 40 |
| `lessons` | Pass | 182 |
| `levelup` | Pass | 56 |
| `look` | Pass | 63 |
| `looks` | Pass | 115 |
| `market` | Pass | 71 |
| `messages` | Pass | 21 |
| `monks` | Pass | 21 |
| `nature` | Pass | 24 |
| `neighbours` | Pass | 112 |
| `nests` | Pass | 60 |
| `phone-place` | Pass | 58 |
| `pointers` | Pass | 73 |
| `quest` | Pass | 126 |
| `raids` | Pass | 156 |
| `rename` | Pass | 33 |
| `scripted` | Pass | 122 |
| `scripted-bosses` | Pass | 160 |
| `scripted-stories` | Pass | 263 |
| `selected` | Pass | 98 |
| `shop` | Pass | 51 |
| `specials` | Pass | 51 |
| `speed` | Pass | 18 |
| `spells` | Pass | 52 |
| `spy` | Pass | 82 |
| `storage` | Pass | 43 |
| `stuck` | Pass | 50 |
| `survival` | Pass | 59 |
| `team` | Pass | 121 |
| `tidy` | Pass | 42 |
| `tools` | Pass | 75 |
| `town-rules` | Pass | 39 |
| `train` | Pass | 40 |
| `troll-town` | Pass | 39 |
| `villagers` | Pass | 76 |
| `work` | Pass | 54 |
| `world` | Pass | 146 |
