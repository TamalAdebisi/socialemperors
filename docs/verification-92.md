# Verification and delivery of #92 — 16 October 2026

The remaining tournament stages are implemented together: entry and
waiting rooms, three independent battles, results/rankings/prizes, and
friends' creation and cancellation. They build on #89's list and team
editor. Other chats delivered #87's building card/Menu, #93's mandatory
tutorial, #91's art audit, #94's playthrough controls and #95's selection,
recurring threats and Everybody; their work is preserved without rebasing.
Classic choices remain hidden as the owner requested in #93, while the
original routes and shared saves remain supported.

## Final verification after #95

Pending. Main `a3328da6c1e9e18a68636ab18d49098786f13c01` landed during
the completed run below. It changes shared battle selection, recurring
raids/camps and community eligibility, with two new browser scenarios.
The `3b5da9e9` unit checks passed, but screenshot review stopped its full
browser run after twelve completed cases because the new home countdown
covered a desktop Menu row. The layout correction and a fresh full
77-case run are pending. Tournament Invite now points to Everybody at
`/friends`; the three-player-neighbour minimum, owner/room restrictions
and fees remain unchanged.

The next full run puts the five tournament scenarios and shared spells
first, then `building-overlay`, `playthrough-controls`, `site-menu`,
`battle-selection` and `recurring-raids`, followed by the other 66
alphabetically. #95's original full and later focused results remain in
[its delivery record](verification-95.md), and #94's full/focused history
in [its own record](verification-94.md). Neither is relabelled as a test
of the final integrated tournament code.

## Focused #95 integration check at 6f7a5ae6

Exact tested code: `6f7a5ae67035ee2fd93b3a2c0fa9fdad89ec6939`.
The focused browser run passed **1/2 in 7m 34.66s**: `tournament-rooms`
passed in 212s; `tournament-battle` failed in 232s. Its new phone assertion
expected the paused army's three selected units to remain selected after
touching the surrender backdrop and pressing Escape. The selection was
empty instead: body focus bypassed the shared keyboard target guard.
This is an integration regression, not a fixture failure. The local archive
is `tournament-evidence-review-focus-6f7a5ae6`. The 41 focused tournament
server tests passed in 1.493s at the same code.

Owners reviewed all seven room captures and nine battle captures. Desktop
and phone inspection controls, statistics, Deselect and three portraits fit
without overlap. One formed desktop knight is clipped at the right edge.
The failure capture shows the paused desktop home page because the test's
capture helper uses its original page; it does not illustrate the phone
failure itself.

The correction checks for any rendered `dialog` or `alertdialog` before
handling shared battle shortcuts, including when focus has moved to the
body. Hidden mounted panels are ignored; modifier/form guards and dialog
focus behavior remain unchanged. The correction at
`3b5da9e99005c619bdeb31aa22c169482171c9fb` passed the unchanged
tournament-battle assertion and shared battle-selection scenario:
**2/2 in 5m 31.79s** (281s and 44s). Its local archive is
`tournament-evidence-review-focus-3b5da9e9`. This focused pass verifies
the correction; the failed run above does not.

## Interrupted full #95 integration check at 3b5da9e9

Exact tested code: `3b5da9e99005c619bdeb31aa22c169482171c9fb`, clean
and pushed before the checks, with fetched main `a3328da6` confirmed as
an ancestor. All unit checks passed:

| Check | Result | Elapsed, including startup/build |
| --- | --- | --- |
| `.venv/bin/python -m unittest discover tests` | 442 run: 433 passed, 9 existing PostgreSQL skips | 32.12 seconds |
| `cd client && npm run check` | Types passed | 2.33 seconds |
| `cd client && npm test` | All 388 tests passed | 7.36 seconds |

The full browser run completed **12 passing cases** before screenshot
review found the new home raid countdown covering the desktop Menu's
Empires row. This persistent overlap was a real usability defect missed
by the existing Menu assertions. The run was deliberately stopped to add
a hit-target regression and fix the layout. No full 77-case result is
claimed. `attack` was incomplete; its browser-closed output at 135s was
caused by the intentional interrupt, not a completed scenario failure.

| Completed test | Result | Time |
| --- | --- | ---: |
| `tournament-weekly` | Passed | 128s |
| `tournament-rooms` | Passed | 211s |
| `tournaments` | Passed | 108s |
| `tournament-battle` | Passed | 286s |
| `tournament-results` | Passed | 158s |
| `spells` | Passed | 48s |
| `building-overlay` | Passed | 83s |
| `playthrough-controls` | Passed | 40s |
| `site-menu` | Passed | 60s |
| `battle-selection` | Passed | 46s |
| `recurring-raids` | Passed | 33s |
| `animals` | Passed | 31s |

The partial archive `tournament-evidence-partial-3b5da9e9` contains
**75 screenshots across 13 folders**, including the incomplete attack
scenario. Before interruption, the local server log had zero Python
tracebacks, HTTP 5xx replies or unhandled commands.

Owners reviewed **68 fresh captures**: 50 tournament/shared-spell
images (weekly 6, rooms 7, list/help/team 10, battle 9, results 12 and
spells 6), 14 #94 integration images and four #95 integration images.
Tournament art and controls passed review. Review also exposed the
persistent Menu overlap above. A temporary phone toast can cover Menu;
an edge capture after dismissal is not proof of a persistent defect.
Some units meet the army viewport edge or overlap, the weekly advance
capture shows empty terrain with advancement checked by assertion, and
the golem capture shows its glow only. Scrollable team/ranking views
do not display every entry together. The six shared-spell captures are
desktop views. These limits remain separate from the Menu defect that
requires correction.

## Completed pre-#95 checks at 5d220abf

Exact tested code: `5d220abfa562877ca346b205455f9554e15d497e`.
It includes main `1eb2a2e2`, the complete tournament feature, its review
corrections and #94's playthrough changes. The checkout stayed clean and
at that commit throughout the checks. Tournament battles use the same
shared background clock as other battles; explicit Pause stops simulation
and excludes paused time without changing army, score, spell or service
rules. #95 was not part of this tested runtime.

| Check | Result | Elapsed, including startup/build |
| --- | --- | --- |
| `.venv/bin/python -m unittest discover tests` | 440 run: 431 passed, 9 existing PostgreSQL skips | 32.22 seconds |
| `cd client && npm run check` | Types passed | 1.94 seconds |
| `cd client && npm test` | All 385 tests passed | 7.53 seconds |
| Full Chromium browser suite | 75 run: 75 passed, 0 failed | 92m 46.83s |

The prior focused tournament-battle and playthrough-controls checks at
that code passed **2/2 in 5m 14.79s** (268s and 37s inside the scenarios),
covering hidden-time progress, no double counting on return and explicit
Pause/Resume. The full run checked all 75 files once: the five tournament
cases, spells, building-overlay, playthrough-controls and site-menu,
then the other 66 alphabetically. Its archive contains **243 screenshots
across 75 folders**. The complete local server log has **zero Python
tracebacks, zero HTTP 5xx replies and zero unhandled commands**.

Game accounts and writes were local and disposable; only public artwork
was read remotely through the environment proxy. Environment: 2-CPU
quota, 8 GiB memory, Python 3.13.5, Node 24.19.0, Playwright 1.56.1 and
Chromium with software rendering; one browser runner at a time.

## Pre-#95 visual inspection at 5d220abf

Owners reviewed **61 captures**: all 47 fresh tournament/spell images
(weekly 6, rooms 7, list/help/team 10, battle 6, results 12 and spells 6)
and 14 integration images (building previews 8, playthrough controls 2,
site Menu/Friends 4). Original art, layout and reachable controls passed
review, including welcome returns, saved/departed results, configured
armies, desktop/phone controls and the exact 720px layout.

The weekly advance army can be outside the fixed camera; formed desktop
units can sit near the bottom/right; the golem capture shows its glow
only. The scrollable team grid shows part of the twenty asserted entries,
and weekly ranks 9–10 are below the fold. These images do not establish
visibility outside their viewport. The HUD keeps the original unit label's
fixed plural with adapted word order. The results screenshot waits for
all twenty team images to load. This Chromium run does not establish
Safari on a Mac GPU or a repair of the unreproduced wide terrain streak.

## Pre-#95 browser results at 5d220abf

| Test | Result | Time |
| --- | --- | ---: |
| `tournament-weekly` | Passed | 131s |
| `tournament-rooms` | Passed | 219s |
| `tournaments` | Passed | 117s |
| `tournament-battle` | Passed | 280s |
| `tournament-results` | Passed | 151s |
| `spells` | Passed | 47s |
| `building-overlay` | Passed | 92s |
| `playthrough-controls` | Passed | 45s |
| `site-menu` | Passed | 66s |
| `animals` | Passed | 32s |
| `attack` | Passed | 141s |
| `bonus` | Passed | 33s |
| `bosses` | Passed | 37s |
| `bubble` | Passed | 63s |
| `camp` | Passed | 45s |
| `camp-again` | Passed | 24s |
| `card` | Passed | 115s |
| `cash` | Passed | 40s |
| `classic` | Passed | 50s |
| `collect` | Passed | 103s |
| `collections` | Passed | 32s |
| `construction` | Passed | 57s |
| `defence` | Passed | 28s |
| `dock` | Passed | 48s |
| `dragons` | Passed | 87s |
| `edit` | Passed | 46s |
| `friends-help` | Passed | 55s |
| `gifts` | Passed | 41s |
| `goal-window` | Passed | 49s |
| `graveyard` | Passed | 31s |
| `group` | Passed | 94s |
| `heroes` | Passed | 37s |
| `hover` | Passed | 50s |
| `keys` | Passed | 40s |
| `lessons` | Passed | 182s |
| `lessons-phone` | Passed | 220s |
| `lessons-recovery` | Passed | 87s |
| `levelup` | Passed | 51s |
| `look` | Passed | 63s |
| `looks` | Passed | 107s |
| `market` | Passed | 69s |
| `menus` | Passed | 108s |
| `messages` | Passed | 19s |
| `monks` | Passed | 19s |
| `nature` | Passed | 23s |
| `neighbours` | Passed | 102s |
| `nests` | Passed | 54s |
| `phone-place` | Passed | 55s |
| `pointers` | Passed | 72s |
| `quest` | Passed | 126s |
| `raids` | Passed | 63s |
| `rename` | Passed | 31s |
| `scripted` | Passed | 117s |
| `scripted-bosses` | Passed | 150s |
| `scripted-stories` | Passed | 249s |
| `selected` | Passed | 94s |
| `shop` | Passed | 48s |
| `siege` | Passed | 40s |
| `sound` | Passed | 29s |
| `specials` | Passed | 25s |
| `speed` | Passed | 15s |
| `spy` | Passed | 40s |
| `storage` | Passed | 37s |
| `stuck` | Passed | 49s |
| `survival` | Passed | 55s |
| `team` | Passed | 37s |
| `tidy` | Passed | 34s |
| `tools` | Passed | 68s |
| `town-rules` | Passed | 40s |
| `train` | Passed | 40s |
| `troll-town` | Passed | 40s |
| `villagers` | Passed | 76s |
| `walk` | Passed | 43s |
| `work` | Passed | 53s |
| `world` | Passed | 133s |

Individual timings are the runner's rounded seconds. The complete
elapsed time includes build, startup and cleanup. All 75 passed; this
is the completed pre-#95 baseline, not verification of the later merge.

## Completed pre-#94 checks at 67d2e02a

Exact tested code: `67d2e02a563d6a2e4f06376cd5af960a1238fd23`.
The checkout stayed clean and at that commit throughout the checks. It
includes main `d4bc1a72`, preserving #87, #91 and #93, the complete
tournament feature, review corrections and the fixture fixes below.
This is a completed baseline before #94, not the final delivery runtime.

| Check | Result | Elapsed, including startup/build |
| --- | --- | --- |
| `.venv/bin/python -m unittest discover tests` | 440 run: 431 passed, 9 existing PostgreSQL skips | 29.66 seconds |
| `cd client && npm run check` | Types passed | 1.87 seconds |
| `cd client && npm test` | All 381 tests passed | 7.18 seconds |
| Full browser suite | 73 run: 73 passed, 0 failed | 92m 32.50s |

All 73 scenario files ran once: the five tournament cases, shared
spells, then the other 67 alphabetically. The archive contains **231
screenshots across 73 folders**. The full local server log contains
**zero Python tracebacks, zero HTTP 5xx replies and zero unhandled
commands**. All game accounts and writes were local and disposable;
public artwork was read through the environment's proxy. Environment:
2-CPU quota, 8 GiB memory, Python 3.13.5, Node 24.19.0, Playwright 1.56.1
and Chromium with software rendering; one browser runner at a time.

## Review corrections and interrupted checks

Review corrections were committed at
`d3c8d64de70dd76ac265b5647d6a610797c8b600`. They keep Engineer 570 on
its separate friendly siege-repair path, validate healing targets before
the beat, and restore original LIMIT accounting from attempted healing
even when the patient is whole. Actual health remains capped; only a
zero-effect visual healing event is suppressed. They also validate
friends-room cards before rendering, wait for ordinary welcome/gift
dialogs before reopening a tournament, use the shared HUD's inclusive
720px breakpoint, and scope the weekly-entry warning handler to the
expected original confirmation.

Two review suggestions would have changed original rules, so those rules
are retained and explained in DECISIONS.md: weekly entry accepts its saved
team without the public ownership/complex-unit recheck, and the score
table keeps departed entrants in points/time order even though they cannot
win. The server's winner metadata identifies who actually receives the
prize. All eight original review threads were answered and resolved with
the relevant source-supported explanation or correction; no decompiled
source was published.

The first new full attempt at `d3c8d64d` was interrupted after
`tournament-weekly` passed in 131s, `tournament-rooms` passed in 212s,
and `tournaments` failed in 107s. The failure was in setup for the new
ordinary-welcome scenario, before its feature assertions: joining its
room returned `NOK`. The saved local database showed 272 gold for a
500-gold fee; the earlier treasure setup had been capped at 750 and the
weekly entry had already spent its fee. The runner was stopped while
`tournament-battle` was incomplete. Browser-closed errors printed during
shutdown are interruption artifacts, not completed checks or separate
gameplay findings. This was not a full passing run. At that commit,
server 440 run (431 passed, 9 existing skips), types and all 381 client
tests had passed in 30.62s, 2.16s and 7.60s respectively.

Test-only commit `a1f06b48c8af2e5345ec2f65998e1d0773c13bd1` funds the
separate welcome room through a normal treasure command and asserts the
exact increase and first entry fee. Its focused run was **2/3 in 3m
32.26s**: `tournaments` passed in 119s and `spells` in 46s, but
`tournament-results` failed in 37s while seating its players. The preceding
welcome scenario had left a public waiting seat behind on the shared
local server, so the next scenario's entrants joined different rooms.

Test-only commit `77c31ed0b07e5f047b7cbb90f572ab93e251100b` leaves that
waiting room through the normal service after all welcome-return
assertions and its screenshot, then checks that enrollment is cleared
and the exact fee refunded. The repeated focused run passed **3/3 in
5m 19.56s**: `tournaments` 114s, `tournament-results` 153s, `spells` 45s.
No return, fee or saved-state assertion was removed.

Screenshot inspection then found that the initial desktop match screen
was captured before its twenty enrolled-team images had loaded.
Test-only commit `67d2e02a563d6a2e4f06376cd5af960a1238fd23` waits up to
30 seconds for all twenty images to finish loading with nonzero natural
width before taking that screenshot. The focused results check passed
**1/1 in 2m 42.26s** (157s for the scenario). All three commits after
`d3c8d64d` change only the two tournament browser test files; application
rules and server behavior are unchanged. The pre-#94 full run above checks
the resulting integrated test and runtime state.

## Pre-#94 visual inspection at 67d2e02a

Owners reviewed all **47 tournament/spell screenshots**: weekly 6,
rooms 7, list/help/team 10, battle 6, results 12 and spells 6. A separate
review covered **11 shared screenshots**: card 8, dock 1 and site Menu 2.
Original art, layout and control fit passed review. This includes the
ordinary-welcome Gifts/return sequence, departed-score results, all
three configured weekly armies, and controls at exactly 720px landscape.

The advance image has its army outside the camera; formed desktop units
are near the bottom/right; the golem capture shows its glow only. The
team grid shows part of a scrollable viewport while the test asserts all
twenty entries, and weekly ranks 9–10 are below the fold. These captures
are not evidence of content outside their viewport. The army HUD retains
the original label's fixed plural (including "1 units left") with adapted
word order; it is not a verbatim localized HUD. The results capture now
waits for all twenty enrolled-team images to load.

## Pre-#94 browser results at 67d2e02a

| Test | Result | Time |
| --- | --- | ---: |
| `tournament-weekly` | Passed | 130s |
| `tournament-rooms` | Passed | 213s |
| `tournaments` | Passed | 112s |
| `tournament-battle` | Passed | 257s |
| `tournament-results` | Passed | 154s |
| `spells` | Passed | 45s |
| `animals` | Passed | 33s |
| `attack` | Passed | 131s |
| `bonus` | Passed | 32s |
| `bosses` | Passed | 37s |
| `bubble` | Passed | 64s |
| `camp` | Passed | 44s |
| `camp-again` | Passed | 24s |
| `card` | Passed | 117s |
| `cash` | Passed | 41s |
| `classic` | Passed | 50s |
| `collect` | Passed | 103s |
| `collections` | Passed | 34s |
| `construction` | Passed | 58s |
| `defence` | Passed | 28s |
| `dock` | Passed | 48s |
| `dragons` | Passed | 88s |
| `edit` | Passed | 46s |
| `friends-help` | Passed | 53s |
| `gifts` | Passed | 45s |
| `goal-window` | Passed | 57s |
| `graveyard` | Passed | 28s |
| `group` | Passed | 92s |
| `heroes` | Passed | 37s |
| `hover` | Passed | 49s |
| `keys` | Passed | 36s |
| `lessons` | Passed | 190s |
| `lessons-phone` | Passed | 218s |
| `lessons-recovery` | Passed | 87s |
| `levelup` | Passed | 51s |
| `look` | Passed | 58s |
| `looks` | Passed | 112s |
| `market` | Passed | 66s |
| `menus` | Passed | 110s |
| `messages` | Passed | 19s |
| `monks` | Passed | 20s |
| `nature` | Passed | 23s |
| `neighbours` | Passed | 101s |
| `nests` | Passed | 57s |
| `phone-place` | Passed | 67s |
| `pointers` | Passed | 72s |
| `quest` | Passed | 120s |
| `raids` | Passed | 169s |
| `rename` | Passed | 30s |
| `scripted` | Passed | 115s |
| `scripted-bosses` | Passed | 155s |
| `scripted-stories` | Passed | 255s |
| `selected` | Passed | 98s |
| `shop` | Passed | 46s |
| `siege` | Passed | 38s |
| `site-menu` | Passed | 49s |
| `sound` | Passed | 29s |
| `specials` | Passed | 24s |
| `speed` | Passed | 17s |
| `spy` | Passed | 66s |
| `storage` | Passed | 40s |
| `stuck` | Passed | 51s |
| `survival` | Passed | 52s |
| `team` | Passed | 40s |
| `tidy` | Passed | 43s |
| `tools` | Passed | 74s |
| `town-rules` | Passed | 36s |
| `train` | Passed | 38s |
| `troll-town` | Passed | 40s |
| `villagers` | Passed | 81s |
| `walk` | Passed | 45s |
| `work` | Passed | 54s |
| `world` | Passed | 155s |

Individual times are the runner's rounded seconds. Total elapsed also
includes build, startup and cleanup. This completed pre-#94 run has no
failures. The #94 integration was subsequently verified at `5d220abf`;
latest-main verification remains pending above.

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
This identity claim ends at `8dccab0d`. Subsequent review fixes changed
the runtime and tests and were verified separately at `67d2e02a` above.
The later #94 integration passed separately at `5d220abf`; the #95
integration still needs its own complete checks.

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
every remaining tournament stage. The #94 integration passed all 75
cases at `5d220abf`; final verification after merging #95 is pending.
The other chats' #87, #91, #93, #94 and #95 work is preserved. Merging #92
uses the owner's
standing authorization for automatic deployment after the required checks.

All five tournament parts are implemented; no tournament slice remains
in this scope. After delivery, the next queued project task is shop
details, with the owner's Beta 1 run-through hold preserved.
