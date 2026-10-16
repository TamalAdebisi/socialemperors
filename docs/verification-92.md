# Verification and delivery of #92 — 16 October 2026

The remaining tournament stages are implemented together: entry and
waiting rooms, three independent battles, results/rankings/prizes, and
friends' creation and cancellation. They build on #89's list and team
editor. Other chats delivered #87's building card/Menu, #93's mandatory
tutorial, #91's art audit, #94's playthrough controls, #95's selection,
recurring threats and Everybody, and #97's contact links and Menu stacking;
their work is preserved without rebasing.
Classic choices remain hidden as the owner requested in #93, while the
original routes and shared saves remain supported.

## Full integrated verification at 47db7f44

Exact tested code: `47db7f4446e957ab8d65ef8892799649abedf9a6`.
The checkout was clean and pushed before checks. A fresh fetch confirmed
main `8f8c57abe132c5b0ff805159e276e668403fb5ef` (#97) as an ancestor;
main remained at that commit when the run finished. The merged code
preserves #97's Menu stacking and contact links, #95's Everybody and
inspection controls, and all earlier integrations. The redundant
countdown-hiding rule is removed; the hit-target regression checks all
four configured Menu links. Tournament rules and command formats remain
as documented, with the owner's community policy preserved.

The final documentation update changes only AGENTS.md, CLIENT.md,
DECISIONS.md, HANDOFF.md, PARITY.md, ROADMAP.md, this record and the
Everybody wording in `docs/original/index/windows.md`: eight Markdown
files relative to `47db7f44`. Client/server code, configuration, artwork, tools and tests
remain identical to that tested commit. This identity covers the
documentation update, not any unrecorded later change.

| Check | Result | Elapsed, including startup/build |
| --- | --- | --- |
| `.venv/bin/python -m unittest discover tests` | 448 run: 439 passed, 9 existing PostgreSQL skips | 30.81 seconds |
| `cd client && npm run check` | Types passed | 1.97 seconds |
| `cd client && npm test` | All 388 tests passed | 7.49 seconds |
| Full Chromium browser suite | 78 run: 77 passed, 1 failed | 90m 46.59s |

Every scenario ran once. All five tournament cases, shared spells, the
Menu/contact/raid integrations and `team` passed; `team` took 41s. The
sole failure was `scripted-bosses`, whose mummy-gem reload assertion
found three remaining gems instead of two. Ordinary reruns passed; the
controlled diagnostic and its limits are recorded below. The full result
remains **77/78**. Implementation and verification are complete, with
this unresolved quest issue retained as a follow-up; #92 is ready for
review and merge, not yet recorded as merged or deployed.

The run started with site-menu, contact and recurring-raids, then the
five tournament cases, shared spells, building-overlay,
playthrough-controls and battle-selection, followed by the other 66
alphabetically. The local archive `tournament-evidence-full-47db7f44`
contains **256 screenshots across 73 populated folders**, with 78
directories created by the runner. The full local server log has zero
Python tracebacks, HTTP 5xx replies or unhandled commands.

The focused Menu/contact/raid check at the same commit passed **3/3 in
3m 30.75s** (57s, 115s and 27s). Its separate archive contains 14 images,
all reviewed, and its local server log also has zero tracebacks, HTTP
5xx replies or unhandled commands. The focus verified the saved raid
fixture move, retained movement deadline and all four Menu destinations.

Accounts and game writes were local and disposable; remote access read
public artwork through the environment proxy. The existing nine optional
PostgreSQL tests require their separate database. Environment: 2-CPU
quota, 8 GiB memory, Python 3.13.5, Node 24.19.0, Playwright 1.56.1 and
Chromium with software rendering; one browser runner at a time.

### Quest failure: unresolved intermittent reload, separate follow-up

`scripted-bosses` failed in 91s at its immediate mummy-gem reload check:
the assertion expected two gems and found three. It remains a failed
case. An ordinary unchanged-main run and two additional traced baseline
runs passed; the exact failure has not been reproduced naturally on
main. An ordinary repeat on the tested tournament code passed too.
No assertion, deadline, quest runtime or test has been changed to get
these passes. They do not change the full-run result.

The first unchanged-main attempt ended when the execution-service
transport disconnected and its processes vanished. It produced no
assertion or completed-case outcome, so it is recorded as interrupted,
not as a gameplay failure. Its log, screenshots and status were archived
under `tournament-main-8f8c57ab-scripted-bosses-interrupted`. The ordinary
retry passed. The completed 47 run and its archive predate this
disconnect and are unaffected.

| Follow-up | Result | Timing |
| --- | --- | --- |
| Ordinary unchanged main `8f8c57ab` | 1/1 passed, all camp scenarios | Scenario 148s; total 153.1088s |
| Natural baseline trace 1, intercepted art without a gate | Passed | Harness start to test pass 149.163s; including cleanup 150.607s |
| Natural baseline trace 2, intercepted art without a gate | Passed | Harness start to test pass 147.182s; including cleanup 148.480s |
| Ordinary tested code `47db7f44` | 1/1 passed, all camp scenarios | Scenario 147s; total 152.2461s |

Trace-harness times include setup and are not pure scenario times. The
ordinary 47 repeat had only seven documentation files dirty; runtime,
art and tests matched the exact full-run commit. Its server log had zero
tracebacks, HTTP 5xx replies or unhandled commands. Its four fresh
1280×800 captures were reviewed: completion dialogs, text and OK buttons
fit, with original town art, HUD and dock intact. These desktop stills
do not establish reward storage, gem persistence, reload behavior or
phone layout; the ordinary test assertions supply the behavioral evidence.

Fourteen relevant camp, command, mission, helper and test files have
identical git blobs on main and tested code. The immediate tap/reload
assertion and command-sender behavior predate this tournament work.
This narrows the investigation but does not prove the exact failure's
cause or exclude every timing interaction. The failed full-run map
retains three gems, and its server log has no gem-collection commands.
The tap result and network events were not recorded during that run,
so an accepted tap followed by lost saving remains a hypothesis.

Both successful natural traces show a valid tap with two gems locally,
an in-flight save, a browser-reported aborted request at pagehide and an
immediate retry. Both original and retry command sequences reached the
server. A browser abort therefore does not establish lost server delivery;
these traces show successful recovery, not the original failure.

A one-request diagnostic gate also passed because the retry bypassed it;
its 145.587s start-to-pass and 147.268s including cleanup are diagnostic
timings, not another ordinary baseline result. The corrected cohort gate
held the original request and its retries until the reload's info reply,
releasing them after 1.400s rather than its 10-second cap. On unchanged
main it forced the same three-versus-two assertion: the accepted tap had
two gems and activator 1 locally, but the reload read old progress and
restored three guarded gems. Late commands then reached the server,
leaving activator 1 alongside three physical gems. That differs from the
full-run failure, which had no gem commands or saved activator update.
The diagnostic took 94.376s from harness start to assertion failure and
98.270s including cleanup; these are not pure scenario timings.

This forced diagnostic establishes an existing save/read ordering
weakness, not natural baseline reproduction or the exact full-run cause.
No tournament regression was identified. Keep the unresolved intermittent
quest reload failure as a separate follow-up: capture the accepted tap,
request/retry delivery, reload snapshot and final saved gem/activator state
before choosing a repair. Preserve the immediate-reload assertion and
original quest rules. No quest runtime, deadline or assertion was changed;
trace/interception/replay code remains outside the repository. Artifacts
remain local under `tournament-mummy-investigation` and associated records.

### Screenshot review at 47db7f44

Screenshot review covered **79 fresh full-run images**: all 50
tournament/shared-spell captures, contact 8, raids 2, Menu 4, building
previews 8, playthrough controls 2, shared selection 2 and three captures
from the failed quest. These are separate from the focused run's 14.
The 76 tournament/integration images showed original art and reachable
desktop/phone/720px controls, saved room and result states, unobstructed
Menu destinations, readable inspection and raid recovery. No new
persistent layout defect was observed.

Troops can overlap or move outside the camera; the weekly advance image
is mostly empty terrain with a sprite edge, so assertions establish
motion. The golem capture shows its glow only. Academy rows, room/team
content and weekly ranks 9–10 need scrolling. Ten of twenty result slots
are fully visible on desktop, with all twenty loads asserted; the phone
heading is visible while one desktop heading is above its retained
scroll offset. The phone Everybody Discord footer is below the image.
Temporary Draggy/raid toasts cover some chrome; stills do not establish
duration. Shared-spell images are desktop views; classic images show
only the bar. Links, timing, recurrence, fees, saves, frozen/idempotent
prizes and Done behavior are established by assertions.

The three quest captures show completion notices from preceding
scenarios and the reloaded mummy town. Its corner gems are offscreen,
so the images cannot establish gem count or tap/save timing. The failing
assertion supplies that evidence; screenshot review does not make it pass.
This Chromium run does not establish Safari on a Mac GPU or a repair of
the unreproduced wide terrain streak.

Together with the 14 Menu/contact/raid focus images and four quest-focus
images reviewed above, **97 images from three runs at the same tested
runtime were reviewed**. Their separate archives and outcomes remain
distinct; the focused passes do not relabel the full-run failure.

### Full browser results at 47db7f44

| Test | Result | Time |
| --- | --- | ---: |
| `site-menu` | Passed | 57s |
| `contact` | Passed | 108s |
| `recurring-raids` | Passed | 26s |
| `tournament-weekly` | Passed | 128s |
| `tournament-rooms` | Passed | 204s |
| `tournaments` | Passed | 107s |
| `tournament-battle` | Passed | 268s |
| `tournament-results` | Passed | 144s |
| `spells` | Passed | 43s |
| `building-overlay` | Passed | 81s |
| `playthrough-controls` | Passed | 35s |
| `battle-selection` | Passed | 45s |
| `animals` | Passed | 26s |
| `attack` | Passed | 134s |
| `bonus` | Passed | 30s |
| `bosses` | Passed | 34s |
| `bubble` | Passed | 62s |
| `camp` | Passed | 48s |
| `camp-again` | Passed | 26s |
| `card` | Passed | 113s |
| `cash` | Passed | 40s |
| `classic` | Passed | 48s |
| `collect` | Passed | 103s |
| `collections` | Passed | 31s |
| `construction` | Passed | 55s |
| `defence` | Passed | 25s |
| `dock` | Passed | 48s |
| `dragons` | Passed | 84s |
| `edit` | Passed | 44s |
| `friends-help` | Passed | 57s |
| `gifts` | Passed | 42s |
| `goal-window` | Passed | 49s |
| `graveyard` | Passed | 26s |
| `group` | Passed | 84s |
| `heroes` | Passed | 35s |
| `hover` | Passed | 47s |
| `keys` | Passed | 37s |
| `lessons` | Passed | 180s |
| `lessons-phone` | Passed | 210s |
| `lessons-recovery` | Passed | 82s |
| `levelup` | Passed | 51s |
| `look` | Passed | 61s |
| `looks` | Passed | 105s |
| `market` | Passed | 62s |
| `menus` | Passed | 103s |
| `messages` | Passed | 19s |
| `monks` | Passed | 18s |
| `nature` | Passed | 22s |
| `neighbours` | Passed | 99s |
| `nests` | Passed | 62s |
| `phone-place` | Passed | 55s |
| `pointers` | Passed | 69s |
| `quest` | Passed | 120s |
| `raids` | Passed | 50s |
| `rename` | Passed | 29s |
| `scripted` | Passed | 114s |
| `scripted-bosses` | Failed | 91s |
| `scripted-stories` | Passed | 240s |
| `selected` | Passed | 92s |
| `shop` | Passed | 42s |
| `siege` | Passed | 36s |
| `sound` | Passed | 27s |
| `specials` | Passed | 25s |
| `speed` | Passed | 16s |
| `spy` | Passed | 40s |
| `storage` | Passed | 37s |
| `stuck` | Passed | 45s |
| `survival` | Passed | 50s |
| `team` | Passed | 41s |
| `tidy` | Passed | 35s |
| `tools` | Passed | 65s |
| `town-rules` | Passed | 37s |
| `train` | Passed | 38s |
| `troll-town` | Passed | 37s |
| `villagers` | Passed | 75s |
| `walk` | Passed | 42s |
| `work` | Passed | 52s |
| `world` | Passed | 125s |

Individual times are rounded scenario seconds; the total also includes
build, startup and cleanup. #95's original full and later focused results
remain in [its delivery record](verification-95.md), and #94's history
in [its own record](verification-94.md), attached to their original code.

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

Screenshot review covered all seven room captures and nine battle captures. Desktop
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

Screenshot review covered **68 fresh captures**: 50 tournament/shared-spell
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

## Menu obstruction reproduced at 28f0fa42

Commit `28f0fa42961e3cba33bccb47522166d03d92aef0` adds the real
hit-target regression and documentation only; its runtime is unchanged
from `3b5da9e9`. The focused `site-menu` run passed **0/1 in 53.96s**
(42s inside the scenario). The assertion expected the desktop Empires
row to receive clicks, but its target was the `home-threats` button.
This reproduces the persistent screenshot defect. Its local archive is
`tournament-evidence-review-focus-28f0fa42`.

The CSS correction at `cc218b7e9c046d83d915d5bd43a5048168356450` hid
the home countdown while Menu was open, without changing its clock.
The retained regression and recurring-raids passed **2/2 in 1m 35.91s**
(58s and 30s). All four fresh Menu captures showed Empires accessible on
desktop and phone. Its local archive is
`tournament-evidence-review-focus-cc218b7e`. #97 subsequently supplied
its own stacking correction; the merge retains that solution and removes
the redundant hiding rule. This focus predates that integration.

## Interrupted full integration check at cc218b7e

Exact tested code: `cc218b7e9c046d83d915d5bd43a5048168356450`, clean
and pushed before checks, including fetched main `a3328da6` as an
ancestor. The required unit checks passed:

| Check | Result | Elapsed, including startup/build |
| --- | --- | --- |
| `.venv/bin/python -m unittest discover tests` | 442 run: 433 passed, 9 existing PostgreSQL skips | 31.05 seconds |
| `cd client && npm run check` | Types passed | 2.31 seconds |
| `cd client && npm test` | All 388 tests passed | 8.06 seconds |

The 77-case browser run was deliberately stopped after **19 passes and
one actual failure** to merge newly landed #97 and correct the raid
fixture described below. `classic` was incomplete; its shutdown output
is an interruption, not another completed failure. All five tournament
scenarios and shared spells passed. No full-suite result is claimed.

| Completed test | Result | Time |
| --- | --- | ---: |
| `site-menu` | Passed | 61s |
| `tournament-weekly` | Passed | 127s |
| `tournament-rooms` | Passed | 208s |
| `tournaments` | Passed | 117s |
| `tournament-battle` | Passed | 277s |
| `tournament-results` | Passed | 143s |
| `spells` | Passed | 46s |
| `building-overlay` | Passed | 82s |
| `playthrough-controls` | Passed | 44s |
| `battle-selection` | Passed | 42s |
| `recurring-raids` | Failed | 33s |
| `animals` | Passed | 29s |
| `attack` | Passed | 127s |
| `bonus` | Passed | 32s |
| `bosses` | Passed | 35s |
| `bubble` | Passed | 67s |
| `camp` | Passed | 49s |
| `camp-again` | Passed | 26s |
| `card` | Passed | 112s |
| `cash` | Passed | 40s |

The local archive `tournament-evidence-partial-cc218b7e` contains
**101 screenshots across 20 populated folders**. The runner created 77
scenario directories, most empty; that total does not mean 77 scenarios
ran. The separately saved pre-interruption server log contains zero Python tracebacks,
HTTP 5xx replies or unhandled commands.

Screenshot review covered **68 captures**: 50 tournament/shared-spell images,
14 building/control/Menu images and four selection/raid images. Menu
targets and the tournament art/controls passed review. Army viewport
edges and overlapping troops limit what
individual frames show; the weekly advance capture shows empty terrain,
with advancement checked by assertion. The golem capture shows its glow
only. Scrollable team/ranking views do not display every entry together;
the six shared-spell captures are desktop views. A temporary phone toast
and an edge capture during dismissal do not establish persistent Menu
obstruction. Selection's portrait, ring, statistics and Deselect are
readable on desktop and phone. The raid incoming/failure captures show
two attackers and defense/build-block notices; there is no recovery
capture or visual proof of the obstruction's cause. The replay below
establishes that cause. These limits do not imply the failed raid worked.

### Raid failure and unchanged-main replay

`recurring-raids` exhausted its unchanged 15-second movement wait. At
frame 419, two attackers were stationary at `(92, 1)` and `(91, 1)` with
no path: the test's packed resource rows enclosed a 16-tile edge pocket.
An exact replay of the saved map and wave reproduced that state on both
main `a3328da6c1e9e18a68636ab18d49098786f13c01` and `cc218b7e`.
The raid, home-defense, walking, geometry, config, camp and shared fixture
files used for this comparison were identical. This establishes a
pre-existing fixture obstruction, not a tournament runtime regression or
a timeout-only problem.

Moving one fixture stone from `(99, 2)` to `(99, 4)` opened the exit.
The replay then gave both attackers targets by frame 30 on both commits,
with all 24 stone and 24 gold resources retained. The browser fixture
uses the ordinary saved move, asserts the counts and exit, and makes its
first scheduled wave use the previously trapped edge. Later waves remain
random. The four-wave, recovery, reward and movement assertions and
15-second movement deadline remain intact; runtime raid/pathfinding rules
are unchanged. Local proof is retained in `tournament-raid-pocket-replay`
artifacts. The modified fixture and combined #97 runtime passed the
47db7f44 focus and full-run raid scenario recorded above. The replay
remains separate evidence, not a browser pass by itself.

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

Screenshot review covered **61 captures**: all 47 fresh tournament/spell images
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

Screenshot review covered all **47 tournament/spell screenshots**: weekly 6,
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
latest-main results and the quest-failure investigation are recorded above.

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
The later #94 integration passed separately at `5d220abf`. Combined
#95/#97 checks at `47db7f44` and their sole quest failure are recorded above.

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
every remaining tournament stage. Integrated code at `47db7f44` passed
all tournament checks and 77/78 cases overall. The sole quest failure did
not recur in ordinary main/tested-code repeats. A forced baseline
diagnostic establishes an existing save/read weakness but does not prove
the full-run cause; that quest issue remains a separate follow-up.
Implementation and verification are complete, and #92 is ready for
review and merge. This record does not yet claim merge or deployment.
The earlier #94 integration passed all 75 cases at
`5d220abf` and remains a separate historical result.
The other chats' #87, #91, #93, #94, #95 and #97 work is preserved. Merging #92
uses the owner's
standing authorization for automatic deployment after the required checks.

All five tournament parts are implemented; no tournament slice remains
in this scope. After delivery, the next queued project task is shop
details, with the owner's Beta 1 run-through hold preserved.
