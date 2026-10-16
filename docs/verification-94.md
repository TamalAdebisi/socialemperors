# Verification and delivery of #94 — 16 October 2026

The owner's playthrough changes repair nested Friends form asset paths,
expand unit targets, show ground-click feedback and keep simulation running
on tab switches. Shared building previews retain their drawing origin
while art loads, and entering placement or Move clears stale hover state.
Auto-collect was explicitly withdrawn and is not included.

## Verified code and scope

Full browser suite runtime: `01ddd0cde6a80dce52fce7af3ce46dba7987fe78`.
Includes main `d4bc1a72` and its public-art verification record.
Test and runner refinements: `b4fcecb0`; frame-aware preview captures
follow at `aa8a9a8b`, with the phone capture wait at `8fb0b4f8`. There are
no runtime changes after the full-suite runtime commit; only checks and
documentation follow.
The runner also gains `--webkit`, keeping that engine's screenshots and
server log under `work/e2e-webkit/`, separate from the Chromium run.

Environment: 2 CPUs, 8 GiB, Python 3.13.5, Node 24.19.0,
Playwright 1.56.1 / Chromium, software rendering. One browser runner at a
time. All players and game writes are on throwaway local servers; only
public art is read remotely.

For the Safari follow-up, WebKit 26.0 (Playwright build 2215) and missing
Debian libraries were installed locally under `work/`. Every missing
library was loaded independently with `ctypes.CDLL`. Playwright's host
validator checks only the system `ldconfig` cache for dynamically loaded
GLES, so it cannot see this local install; the follow-up uses
`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` with the verified local
library path. Its downloaded MiniBrowser wrapper initially discarded
that path, so the first launch stopped before any game test. The local
wrapper now appends it to its bundled library paths. This changes only
the downloaded test browser under `work/`, not the game or repository.
No game assertion or browser check is skipped.

## Check results

| Check | Result | Elapsed |
| --- | --- | --- |
| Server unit suite | 435 run: 426 passed, 9 existing skips | 37.582 seconds |
| Client types and unit suite | Types passed; 354/354 passed | Unit tests: 22.214 seconds |
| Full Chromium suite, build included | 67/71; four failures described below | 1h 52m 56.27s |
| Chromium follow-up: raids, neighbours, spells, spy, expanded buildings | 4/5; raid repair wait described below | 10m 15.30s |
| Final Chromium raid check | 1/1 passed | 1m 57.76s |
| WebKit: buildings, playthrough controls, hover, site Menu/Friends | 4/4 passed | 3m 50.48s |
| Final building capture, Chromium | 1/1 passed | 2m 37.41s |
| Final building capture, WebKit | 1/1 passed | 30.56 seconds |
| Final phone/control capture, WebKit | 1/1 passed | 27.65 seconds |

All 71 Chromium cases have passing results across the full run and the
focused corrections; the original 67/71 result is retained accurately.
No runtime changes followed the full suite. The local WebKit checks cover
Safari's engine, not Safari running on a Mac's GPU.

## Regression coverage

- Friends: actual form submit to `/friends/ask`, root stylesheet paths,
  loaded images, fitting layout at 1280 and 390 pixels, desktop and phone
  screenshots, existing saved friendship/menu badge/logout checks.
- Units: click five pixels outside another villager's art while the first
  walks; check the newly selected unit, first unit's saved destination and
  stationary second unit. Also check zoomed-out and phone targets.
- Ground click: visible original ring, at least 50 pixels wide, no input
  capture, fades away. The feedback sends no game command of its own.
- Hidden tabs: deliberately withhold animation frames while hidden; verify
  walking completes and saves through the independent timer. Explicit
  Pause remains paused through visibility changes, then resumes.
- Clock unit tests: replay throttled elapsed time in bounded steps, exclude
  paused time and avoid replaying the first resumed frame twice.
- Buildings: unchanged distant ground pixels on immediate selection;
  delay art while moving a preview and assert exactly one position offset;
  retain the footprint after refresh, cancel cleanly and keep saved positions.

## Visual review and limits

Reviewed Friends at desktop/phone widths, phone unit selection, returned
background tab, editing, desktop/phone tutorial, Town Hall selection,
farm/mine previews and the failed raid repair. The previews align with
their footprints; the villager in the repair failure was still en route.

WebKit's first immediate captures sometimes contained the preceding
canvas frame; the newly shown phone card could also precede decoding its
parchment. The tests now wait for real animation frames and, for that
card, its decoded border image before taking the review screenshot.
The final building captures show the current ranch/tower aligned with
its footprint. Friends on a 390-pixel phone is styled and fits the viewport.
The final WebKit phone selection has its original ring, health bar and
parchment card, with reachable controls. All WebKit server logs were also
reviewed: no HTTP 5xx, Python tracebacks or unhandled commands.

The two preview faults are reproducible and repaired. The original wide
terrain streak was not reproduced by the immediate on-map selection check;
this record does not claim a separate terrain-rendering fix.
The terrain already uses brighter art for bought land and darker art for
for-sale/wild blocks (`rules/geometry.ts`, `groundBlocks`), independently
of selection. Those ordinary diagonal boundaries remain visible in the
unselected town screenshots.

## Full-suite result and follow-up

The complete Chromium run finished **67/71 in 1h 52m 56.27s**, including
build/startup/cleanup. Failures: neighbours, raids, spells and spy. Every
test ran once. Full server log: no HTTP 5xx, tracebacks or unhandled
commands. Final desktop and phone tutorial screenshots were also reviewed.

`neighbours` missed its existing 20-second delivery deadline: food stayed
at 700 rather than 703. Screenshots show the cart travelled from the
entrance to near the farm, still en route. Both towns were rendering on
the shared software GPU after automatic blur-pausing was removed.
The test now completes all of the helper's assertions, including Arthur's
visit, and closes that page before timing the other town's delivery.
The original deadline, reward, saved-help and visit assertions remain.
Focused rerun: **passed in 187 seconds**, keeping every assertion.

`raids` remained active after its original completion loop. An unaccelerated
rerun completed that fight, then failed its fixed nine-second repair wait:
the screenshot showed the villager still walking to the house. The final
check uses the existing siege check's four-times simulation setting for
the random approach from the map edge, retains the 150-iteration battle
deadline, and waits up to 30 seconds for the first real repair tick.
No kill, reward, population, repair or save assertion was removed.
Frame/raider/knight diagnostics remain on a completion failure. The initial
completion miss was not independently reproduced or attributed to a
runtime defect. Memory was about 2.5 GiB and memory-limit/OOM counters
were zero.

`spells` inspected a summon after a fixed three-second sleep. The screen
showed the cast's name, spent mana and still-playing summoning effect;
the unit arrives after 57 game frames. The test now waits for that unit
with a 30-second limit, retaining its side, life, name and mana assertions.
Focused rerun: **passed in 56 seconds**.

`spy` saw two tiles of movement after a fixed two-second sleep, short of
its existing three-tile assertion. It now closes the unused rival page
and waits for the same movement with a 15-second limit. The distance,
saved visit and remaining-eagle assertions are unchanged. Focused rerun:
**passed in 44 seconds**. The expanded building check also passed, in
**112 seconds**. This five-test follow-up was **4/5 in 10m 15.30s**; only
the repair wait above failed, before its final correction. The final
raid check passed **1/1 in 1m 57.76s** (112 seconds inside the test),
including the saved gold/units and repair/population checks. Its repair
screenshot and all Chromium follow-up server logs were reviewed; no
HTTP 5xx, Python tracebacks or unhandled commands were found.

## Complete Chromium run

Durations are the runner's rounded seconds per test. The full elapsed
time above also includes the build, startup and cleanup. Follow-up passes
are recorded separately; they do not relabel this run.

| Test | Result | Seconds |
| --- | --- | ---: |
| `building-overlay` | Pass | 47 |
| `playthrough-controls` | Pass | 61 |
| `site-menu` | Pass | 105 |
| `dock` | Pass | 63 |
| `animals` | Pass | 37 |
| `attack` | Pass | 220 |
| `bonus` | Pass | 42 |
| `bosses` | Pass | 56 |
| `bubble` | Pass | 72 |
| `camp` | Pass | 57 |
| `camp-again` | Pass | 30 |
| `card` | Pass | 141 |
| `cash` | Pass | 46 |
| `classic` | Pass | 63 |
| `collect` | Pass | 106 |
| `collections` | Pass | 46 |
| `construction` | Pass | 90 |
| `defence` | Pass | 43 |
| `dragons` | Pass | 144 |
| `edit` | Pass | 59 |
| `friends-help` | Pass | 98 |
| `gifts` | Pass | 89 |
| `goal-window` | Pass | 95 |
| `graveyard` | Pass | 35 |
| `group` | Pass | 123 |
| `heroes` | Pass | 50 |
| `hover` | Pass | 52 |
| `keys` | Pass | 45 |
| `lessons` | Pass | 210 |
| `lessons-phone` | Pass | 269 |
| `lessons-recovery` | Pass | 107 |
| `levelup` | Pass | 80 |
| `look` | Pass | 79 |
| `looks` | Pass | 163 |
| `market` | Pass | 105 |
| `menus` | Pass | 243 |
| `messages` | Pass | 26 |
| `monks` | Pass | 34 |
| `nature` | Pass | 34 |
| `neighbours` | Fail | 168 |
| `nests` | Pass | 74 |
| `phone-place` | Pass | 82 |
| `pointers` | Pass | 92 |
| `quest` | Pass | 252 |
| `raids` | Fail | 193 |
| `rename` | Pass | 64 |
| `scripted` | Pass | 165 |
| `scripted-bosses` | Pass | 191 |
| `scripted-stories` | Pass | 340 |
| `selected` | Pass | 128 |
| `shop` | Pass | 62 |
| `siege` | Pass | 52 |
| `sound` | Pass | 36 |
| `specials` | Pass | 34 |
| `speed` | Pass | 26 |
| `spells` | Fail | 66 |
| `spy` | Fail | 79 |
| `storage` | Pass | 46 |
| `stuck` | Pass | 53 |
| `survival` | Pass | 68 |
| `team` | Pass | 53 |
| `tidy` | Pass | 57 |
| `tools` | Pass | 95 |
| `tournaments` | Pass | 119 |
| `town-rules` | Pass | 48 |
| `train` | Pass | 48 |
| `troll-town` | Pass | 53 |
| `villagers` | Pass | 95 |
| `walk` | Pass | 59 |
| `work` | Pass | 57 |
| `world` | Pass | 226 |
