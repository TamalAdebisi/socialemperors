# Verification and delivery of #92 — 16 October 2026

The remaining tournament stages are implemented together: entry and
waiting rooms, three independent battles, results/rankings/prizes, and
friends' creation and cancellation. They build on #89's list and team
editor. Other chats delivered #87's building card/Menu and #93's mandatory
tutorial; both were merged into this branch without rebasing. Classic
choices remain hidden as the owner requested in #93, while the original
routes and shared saves remain supported.

## Final review-fix checks

Pending. The review corrections change runtime and tests after the
passing run below: Engineer targeting, original LIMIT accounting from
attempted healing, zero-effect healing popups, friends-room reply
validation, ordinary welcome ordering, the exact 720px layout boundary
and the weekly warning test. Original weekly
saved-team eligibility and abandoned-score ordering are retained.
Fresh server, client and full browser results will be recorded against
the new exact code before merge; no final commit or result is claimed yet.

## Pre-review full checks at 49b5685e

Code commit: `49b5685e368efd6efeecdc348a2202a710715b2f`.
It includes main `73998ffc` (#93), #87 and the complete tournament work.

#91 subsequently merged to main as
`d4bc1a72f4884037d3b15c9c0cb66548a8fb5dfd` at 14:43:55 UTC. Its changes
from `73998ffc` are documentation and recorded audit data only. The
tournament checkout stayed at the tested commit for the entire full run.
That main was merged afterward at `8dccab0d`, preserving the completed
art audit. A path-by-path diff from `49b5685e` to `8dccab0d` confirmed
that client, server, configuration, artwork, tools and tests were
unchanged; that merge contained documentation and audit records only.
This identity claim ends at `8dccab0d`. Subsequent review fixes change
the runtime and tests and need the fresh verification recorded above.

| Check | Result | Elapsed, including startup/build |
| --- | --- | --- |
| `.venv/bin/python -m unittest discover tests` | 440 run: 431 passed, 9 existing skips | 31.48 seconds |
| `cd client && npm run check` | Types passed | 2.33 seconds |
| `cd client && npm test` | All 373 tests passed | 7.43 seconds |
| `PYTHON=.venv/bin/python node e2e/run.mjs` with every test named | 73 run: 73 passed, 0 failed | 93m 28.38s |

The nine existing skips are the optional PostgreSQL group, which needs a
separate test database. Pillow is installed and the art tests ran.

The run schedules all **73** browser files once: `tournament-weekly`,
`tournament-rooms`, `tournaments`, `tournament-battle`,
`tournament-results`, `spells`, then the other 67 alphabetically.
The recorded test names were checked against every file in `e2e/tests/`;
all 73 ran once and passed. No check was omitted or weakened.

Environment: 2-CPU quota, 8 GiB memory, Python 3.13.5, Node 24.19.0,
Playwright 1.56.1 and Chromium with software rendering. One browser
runner at a time. All game
accounts and writes use throwaway local servers. Public artwork is read
through the environment's proxy; no production game accounts, game
writes, deployment credentials or live art changes are used for testing.

The complete browser server log contains **zero Python tracebacks, zero
HTTP 5xx replies and zero unhandled commands**. The run preserved 229
screenshots across all 73 scenario folders for local review. Browser
console errors remain assertions in the runner; only deliberately
simulated lost-reply errors are handled by their specific recovery tests.

## Pre-review tournament coverage

- `tournaments`: desktop and phone list/help/team controls, real saved
  ownership and team state, server-room reopening, weekly reuse, and a
  tournament return URL held until mandatory lessons and welcome dialogs
  finish. The focused tutorial-return integration check passed in 109s
  before this pre-review full run.
- `tournament-rooms`: original entry payloads and fee bookkeeping,
  short-team confirmation, four seats, immutable enrolled teams,
  refresh/reload recovery, public readiness, friends' creation and Invite
  notice, and authoritative leave/cancel refunds.
- `tournament-battle`: copied armies, actual combat and surrender,
  tournament spell restrictions, desktop/phone controls, unfinished-match
  restart, lost-result replies and reload/retry, recorded scores and no
  changes to the home army or attack reports.
- `tournament-results`: matches/results views and saved scores, prizes
  already paid by the server, acknowledgement, Storage delivery and
  repeated requests without duplicate rewards.
- `tournament-weekly`: weekly entry rules, configured opponents, rank
  prizes and the server's saved weekly state. Shared `spells` coverage
  checks that tournament restrictions do not disable ordinary battles.

Rule and protocol tests also cover team/category/complex-unit rules,
damage scoring and opponent behavior, exact request formats, authoritative
winner ties, frozen weekly rank, stale leave/cancel ids and prize
idempotency. No dedicated tournament mission exists in the shipped goal
table; ordinary spending progress remains separate from player attacks.

## Earlier failure and repair

The full run at `47471ff44126cad5707a601365beb904d70d23ad`, before #93
landed, ran **71 tests in 91m 52.03s: 70 passed, one failed**. All five
tournament checks passed; `team` passed in 42s. Only `keys` failed its
movement check after holding the arrow for a fixed 400ms. At that commit,
the server ran 434 tests (425 passed, 9 existing skips), and client types
and all 371 tests passed.

The unchanged keyboard check failed twice in three repeated runs on main
`6c2fa146`, after an initial pass there. Its repair holds Right until the
camera moves the intended 360 screen pixels, bounded by 30 seconds. The
original click-at-the-old-position assertion and both saved building
rotation checks remain. Extra checks require no zoom or vertical motion.
The repaired test passed three focused repeats in **38s, 41s and 39s**.
No game keyboard behavior or assertion was weakened.

An earlier partial run at `164e4f21` was stopped after 14 passes when
its inherited Python 3.12 environment was noticed. It is not counted as
a full pass; the completed 49b5685e checks used the separate Python 3.13
environment.

Main #93 then landed during verification. Integration preserved its
mandatory tutorial, recovery, final reward and hidden-classic decisions.
A saved tournament return now waits for those lessons and welcome dialogs
before opening the panel once. The 49b5685e full run above tested this
combined code; it does not cover the subsequent ordinary-welcome fix.

## Pre-review visual inspection at 49b5685e

Reviewed the desktop and phone tournament list, help and team screens;
waiting, ready and friends' rooms; the return after mandatory lessons;
battle controls, victory and surrender; all three weekly armies; match
rows, public and weekly results, prize lists, rankings and Storage. All
12 results screenshots and all five weekly phone screenshots were
checked, together with the shared spell book, academy and casting views.
Original art loads, labels remain readable, and controls fit without
sideways clipping or overlap with the Menu or dock. The advance screenshot
shows grass after units leave its fixed camera; the three army screenshots
show those units clearly. It is not used as evidence of unit appearance.

Earlier reviews found and fixed phone touch targets, duplicate headings,
stale ownership from another tab, screenshot art waits and purchase
windows left open after combat. Those reviewed screens showed no
regression from the integrated building-card or tutorial work.

## Public-art audit completed separately in #91

The other chat completed and merged #91. It verified all 20 image files
against the manifests and fresh exports, both with and without the
game's Origin header, then checked refreshed-cache play and the #93
integration. The art follow-up is closed; no further export, purge or
owner-operated step remains. Its pre-#93 full run was **66/67**, with a
separate historical tutorial-arrow observation, followed by the recorded
#93 integration checks. Those exact results remain in
[the art repair notes](art-loading-repair.md), separate from this run.
The tournament checks did not operate an export workflow, alter the live
bucket or repeat that audit.

## Pre-review browser results at 49b5685e

| Test | Result | Time |
| --- | --- | ---: |
| `tournament-weekly` | Passed | 130s |
| `tournament-rooms` | Passed | 218s |
| `tournaments` | Passed | 112s |
| `tournament-battle` | Passed | 271s |
| `tournament-results` | Passed | 154s |
| `spells` | Passed | 47s |
| `animals` | Passed | 30s |
| `attack` | Passed | 136s |
| `bonus` | Passed | 37s |
| `bosses` | Passed | 37s |
| `bubble` | Passed | 64s |
| `camp` | Passed | 48s |
| `camp-again` | Passed | 24s |
| `card` | Passed | 117s |
| `cash` | Passed | 40s |
| `classic` | Passed | 51s |
| `collect` | Passed | 103s |
| `collections` | Passed | 34s |
| `construction` | Passed | 62s |
| `defence` | Passed | 29s |
| `dock` | Passed | 54s |
| `dragons` | Passed | 87s |
| `edit` | Passed | 44s |
| `friends-help` | Passed | 60s |
| `gifts` | Passed | 44s |
| `goal-window` | Passed | 52s |
| `graveyard` | Passed | 30s |
| `group` | Passed | 93s |
| `heroes` | Passed | 40s |
| `hover` | Passed | 50s |
| `keys` | Passed | 38s |
| `lessons` | Passed | 192s |
| `lessons-phone` | Passed | 218s |
| `lessons-recovery` | Passed | 88s |
| `levelup` | Passed | 51s |
| `look` | Passed | 61s |
| `looks` | Passed | 115s |
| `market` | Passed | 67s |
| `menus` | Passed | 114s |
| `messages` | Passed | 19s |
| `monks` | Passed | 19s |
| `nature` | Passed | 23s |
| `neighbours` | Passed | 113s |
| `nests` | Passed | 55s |
| `phone-place` | Passed | 62s |
| `pointers` | Passed | 80s |
| `quest` | Passed | 130s |
| `raids` | Passed | 148s |
| `rename` | Passed | 36s |
| `scripted` | Passed | 128s |
| `scripted-bosses` | Passed | 157s |
| `scripted-stories` | Passed | 254s |
| `selected` | Passed | 97s |
| `shop` | Passed | 46s |
| `siege` | Passed | 39s |
| `site-menu` | Passed | 57s |
| `sound` | Passed | 30s |
| `specials` | Passed | 23s |
| `speed` | Passed | 15s |
| `spy` | Passed | 61s |
| `storage` | Passed | 38s |
| `stuck` | Passed | 48s |
| `survival` | Passed | 51s |
| `team` | Passed | 39s |
| `tidy` | Passed | 38s |
| `tools` | Passed | 74s |
| `town-rules` | Passed | 38s |
| `train` | Passed | 37s |
| `troll-town` | Passed | 39s |
| `villagers` | Passed | 75s |
| `walk` | Passed | 44s |
| `work` | Passed | 54s |
| `world` | Passed | 128s |

Individual times are the runner's rounded seconds. Total elapsed also
includes build, startup and cleanup. This pre-review run had no failures.

## Delivery

The list/team slice is in [#89](https://github.com/TamalAdebisi/socialemperors/pull/89);
[#92](https://github.com/TamalAdebisi/socialemperors/pull/92) implements
every remaining tournament stage. Final verification of its review fixes
is pending. Main through `d4bc1a72` is merged without rebasing, including
the other chats' #87, #91 and #93 work. Merging #92 uses the owner's
standing authorization for automatic deployment after the required checks.

All five tournament parts are implemented; no tournament slice remains
in this scope. After delivery, the next queued project task is shop
details, with the owner's Beta 1 run-through hold preserved.
