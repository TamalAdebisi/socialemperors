# Playthrough follow-up verification (#95)

All players and game writes use throwaway local accounts and servers. The
ordinary public game art is cached locally. No live game account or save
was accessed.

## Final review follow-up

Runtime `ad9adfd7` addresses the automated review after the complete run.
Server: **436 run, 427 passed, 9 existing skips**, 32.335 seconds. Client:
types and **357/357 passed**, 8.238 seconds. Eight affected Chromium checks
are running: battle selection, recurring raids, raids, siege, friends-help,
spells, spy and site-menu. Focused WebKit follow-up is pending.

The added dense-town rule test initially failed: the battle rule could
choose a reachable waiting spot outside weapon range, leaving a raider
with a target it could not hit. Bands now reject that spot, retry idle
unreachable targets, and continue their defense search beyond the first
20 buildings in bounded batches. The new test and all client rules pass.
Every automatically rolled first raid type also receives the five-minute
preparation period; forced test arrivals still explicitly override it.

The other fixes keep Shift groups free of inspected buildings/enemies,
refresh portraits when a selected fighter changes form, make the threat
button locate active attackers, and keep error-only help replies distinct
from an empty directory. Browser tests cover those state changes. The
existing gift test now verifies the daily cap for an account with no
friendship record, and Escape checks the actual selection as well as its
panel. The invite copy and stale trailing verification placeholder are fixed.

### Automated review disposition

| Finding | Result |
| --- | --- |
| Group portraits stale after transformation | Fixed; browser check calls the real form-change behavior. |
| Shift retains inspected objects | Fixed; groups start from commandable units. |
| Own eagle no longer invokes destination callback | Intentional inspection, consistent with the owner's selection request; browser check inspects the eagle then flies it with a destination tap. |
| Defense search limited to twenty buildings | Fixed; bounded batches continue across the full candidate list. |
| Gift cap missing a stranger assertion | Added the second-send rejection assertion. |
| Threat button misses active raiders | Fixed and checked through the actual button. |
| Escape test checks only panel visibility | Added an assertion that the selected-unit list is empty. |
| Tournament eligibility includes every account | Intentional all-community behavior; the old helper already included recent non-friend neighbors. Owner/room/fee restrictions remain, while the owner explicitly removed friendship gates. |
| Spell selection allegedly loses its preview | No preview exists at spell choice: SpellBook sets its aiming state, and pointer movement/touch builds the new marker. Clearing the previous marker is intentional; spell checks verify aiming and casting. |
| Error-only help response claims no accounts exist | Fixed and checked with an error response fixture. |
| New camp sentence is English | Consistent with this client's English UI and new labels; no new language-selection/translation system is introduced. Existing original localized story text remains. |
| Higher-level first raids bypass preparation | Fixed for every automatically rolled raid kind; unit checks cover all kinds. |
| Invite copy implies own/unclaimed empires appear | Corrected to other players' empires. |
| Duplicate pending verification section | Removed. |

## Initial complete run

Runtime `1c978b47e7d261bdb0e5d973759c29f7baa1b370`, based on main `d4bc1a72`:
**71/71 Chromium tests passed in 1h 24m 33.56s**, including the build.
Server: **436 run, 427 passed, 9 existing skips**, 50.962 seconds. Client:
types and **352/352 passed**, 18.134 seconds.

This run is retained as an initial result, not relabeled as verification of
the later main merge. Its screenshots and server log were preserved before
starting further runs.

## Complete integrated run before review

Main advanced to `1eb2a2e2` (#94) during that run. It was merged without
rebasing at `10507be421042211081161e59766d8d802fe3ff7`. The combined code keeps
#94's enlarged unit targets, ground-click feedback, background simulation,
explicit Pause, placement fixes and root-relative site assets, alongside
#95's recurring threats, battle selection and Everybody.

- Server: **436 run, 427 passed, 9 existing skips**, 32.184 seconds.
- Client: type check and **356/356 passed**, 9.928 seconds.
- Complete integrated Chromium run: **73/73 passed in 1h 23m 18.88s**,
  including the build, with the overlapping controls and community checks first.
- Focused WebKit: **4/4 passed in 2m 37.96s** on test revision `4f049001`,
  covering battle selection, recurring raids, object cards and Everybody/Menu.

Game code stayed at `10507be4` through browser-test waits/diagnostics at
`4f049001` and the central click target at `20ba5058`. The later review
corrections at `ad9adfd7` receive separate checks below; the full 73-case
result remains attributed to its actual commit.

Environment: 3 CPUs, 8 GiB memory limit, Python 3.13.5, Node 24.19.0,
Playwright 1.56.1, Chromium with software WebGL. Browser suites run one
at a time.

## Focused findings and corrections

- The new recurrence fixture initially marked the rescue complete while
  leaving its tutorial trolls alive. It now clears them through saved
  game commands before testing four automatically scheduled waves,
  recovery and saved rewards.
- Combat's A shortcut conflicted with the town's Army shortcut. Combat now
  takes priority, and browser checks use the actual key before single-unit
  inspection, Shift selection, Deselect and Escape.
- Phone screenshots exposed overlapping instructions and pointer buttons.
  The selection panel now leaves those controls clear; its bounds are checked.
- The raid test still saw zero restored health after a fixed nine-second
  repair wait. It now waits for at least 25 restored health (30-second
  deadline), preserving repair, population and saved-reward assertions.
  `raids` and `card` passed together in 161 and 120 seconds.
- An earlier randomized raid exceeded its existing completion deadline.
  Diagnostics were retained; following focused and initial full-run checks
  completed without extending that deadline. The initial full-run raid
  passed in 132 seconds. Integration retains #94's four-times simulation
  setting for this test and all its gameplay/save assertions.
- Review identified Escape being captured before the naming dialog could
  close during a raid. A new real-dialog regression check reproduced it on
  `1c978b47` (1 failed in 12 seconds). The fix at `018e76a9` lets inputs and
  dialogs handle their own keys, and is included in the integrated run.
- Everybody removes the Add Friend form. The nested legacy POST styling
  check now submits a fixture form, retaining all CSS, image, width and
  badge assertions without bringing that form back into the user interface.
- Earlier focused failures remain historical failures; they are not counted
  as passes. #94's separate results and limitations remain in its own record.

## WebKit setup and focused follow-up

The first actual four-case WebKit run was **2/4 in 2m 47.16s**: recurring
raids (20s) and Everybody/Menu (29s) passed; battle selection (12s) and the
phone card upgrade (102s) failed. These remain recorded failures.

A diagnostic selection rerun reproduced the failure. The intended unit was
under both pointer events, but pointerdown to pointerup took 1,104 ms while
the software renderer drew the first hover. That exceeded the existing
500 ms tap limit. The test now waits for battle art and the hover frames
before clicking; no game input rule or selection assertion changes. The
focused follow-up passed **1/1 in 29.07s** (28s for the case).

The upgrade failure occurred after a fixed four-second save wait; the local
server log confirms the House III purchase arrived. Its test now waits for
the upgraded house and an empty command queue (30-second limit), then checks
the same saved replacement and exact resource cost. The combined four-case
WebKit rerun passed **4/4 in 2m 37.96s** on `4f049001`, with unchanged game
code at `10507be4`.

The first Chromium follow-up on `4f049001` was **1/2 in 2m 33.60s**: card
passed (111s), while the phone selection failed (33s). Its pointer events
were a short tap, but the scanned point on the animated edge no longer hit
the unit. At `20ba5058` the test chooses the visible body center and checks
that the canvas owns that point. Selection assertions are unchanged. Final
selection checks on `20ba5058` passed in Chromium **1/1 in 50.22s** (45s
case time) and WebKit **1/1 in 21.77s** (21s case time). Together with the
111s card pass, both revised Chromium checks have passing follow-ups.

Final commands: `PYTHON=.venv/bin/python node e2e/run.mjs --no-build
battle-selection` and the same command with `--webkit`. These follow-ups
retain the complete 73/73 integrated game-code result above; they do not
relabel earlier failing runs as passes.

| WebKit check | Seconds | Result |
| --- | ---: | --- |
| battle-selection | 26 | Passed |
| recurring-raids | 17 | Passed |
| card | 89 | Passed |
| site-menu | 24 | Passed |

Command: `PYTHON=.venv/bin/python node e2e/run.mjs --webkit --no-build
battle-selection recurring-raids card site-menu`, with the local browser
cache and dependency setup below. The existing bundle is from the complete
integrated run; no game source changed afterward.

Before those actual cases, two local browser launches aborted before running
any tests: first a dependency-cache check, then the bundle wrapper replacing
`LD_LIBRARY_PATH`. Debian graphics/font/input libraries are unpacked under
`work/` and linked into the browser bundle's local library directories.
Both browser variants have no missing `ldd` dependencies; an actual loader
probe confirms `libGLESv2.so.2` loads. Playwright's system `ldconfig`-cache
preflight cannot see this local library, so that host-only preflight is
bypassed after those checks. No browser test or gameplay assertion is skipped.
This is Linux WebKit engine coverage, not a reproduction of a Mac's GPU.

## Screenshot and log review

Initial full-run review included desktop/phone battle inspection, raid
recovery and repair, the next-camp countdown, phone building cards, help
recipients, neighbors, phone tutorial guidance, special-move controls and
spell aiming. The selection panel leaves pointer and special-move buttons
clear, and hides while aiming a spell.

Integrated review covers desktop/phone unit inspection, the Everybody page
after its legacy nested POST, recurring-raid recovery, repair, tower preview
and selection, gift/help lists, phone town cards and tutorial guidance,
special-move buttons and spell aiming. The new controls fit and leave the
existing actions accessible. Both the initial and integrated server logs
have zero HTTP 5xx responses, Python tracebacks or unhandled commands; the
integrated log contains 60,263 lines.

At completion, the environment memory high-water mark is 5.70 GiB including
file cache (6,120,783,872 bytes), below the 8 GiB limit. Memory-limit and OOM
event counters are all zero. This is the environment high-water mark, not
a browser-only memory measurement.

Final WebKit phone screenshots were inspected for unit selection, the saved
upgrade and Everybody styling. All fit their screens. Its server log also
has zero HTTP 5xx responses, Python tracebacks or unhandled commands.

## Integrated full-run order and timings

Command: `PYTHON=.venv/bin/python node e2e/run.mjs` with all 73 names
in the order below, using the browser cache specified for the initial run.

| Check | Seconds | Result |
| --- | ---: | --- |
| battle-selection | 43 | Passed |
| site-menu | 76 | Passed |
| recurring-raids | 32 | Passed |
| playthrough-controls | 40 | Passed |
| building-overlay | 88 | Passed |
| raids | 77 | Passed |
| card | 121 | Passed |
| camp | 48 | Passed |
| quest | 140 | Passed |
| friends-help | 57 | Passed |
| gifts | 53 | Passed |
| nests | 66 | Passed |
| neighbours | 109 | Passed |
| lessons | 185 | Passed |
| lessons-phone | 233 | Passed |
| lessons-recovery | 90 | Passed |
| siege | 40 | Passed |
| animals | 32 | Passed |
| attack | 139 | Passed |
| bonus | 34 | Passed |
| bosses | 37 | Passed |
| bubble | 64 | Passed |
| camp-again | 28 | Passed |
| cash | 44 | Passed |
| classic | 50 | Passed |
| collect | 103 | Passed |
| collections | 32 | Passed |
| construction | 59 | Passed |
| defence | 28 | Passed |
| dock | 51 | Passed |
| dragons | 92 | Passed |
| edit | 45 | Passed |
| goal-window | 52 | Passed |
| graveyard | 31 | Passed |
| group | 97 | Passed |
| heroes | 42 | Passed |
| hover | 49 | Passed |
| keys | 38 | Passed |
| levelup | 52 | Passed |
| look | 66 | Passed |
| looks | 118 | Passed |
| market | 71 | Passed |
| menus | 112 | Passed |
| messages | 20 | Passed |
| monks | 19 | Passed |
| nature | 23 | Passed |
| phone-place | 59 | Passed |
| pointers | 71 | Passed |
| rename | 32 | Passed |
| scripted | 114 | Passed |
| scripted-bosses | 156 | Passed |
| scripted-stories | 259 | Passed |
| selected | 95 | Passed |
| shop | 47 | Passed |
| sound | 33 | Passed |
| specials | 26 | Passed |
| speed | 17 | Passed |
| spells | 51 | Passed |
| spy | 37 | Passed |
| storage | 37 | Passed |
| stuck | 47 | Passed |
| survival | 54 | Passed |
| team | 36 | Passed |
| tidy | 37 | Passed |
| tools | 76 | Passed |
| tournaments | 90 | Passed |
| town-rules | 39 | Passed |
| train | 40 | Passed |
| troll-town | 40 | Passed |
| villagers | 77 | Passed |
| walk | 47 | Passed |
| work | 52 | Passed |
| world | 134 | Passed |

## Initial full-run order and timings

Command: `PYTHON=.venv/bin/python node e2e/run.mjs` with every test named in
the order below. Chromium was selected through
`PLAYWRIGHT_BROWSERS_PATH=/workspace/socialemperors/work/browsers`.

| Check | Seconds | Result |
| --- | ---: | --- |
| battle-selection | 46 | Passed |
| recurring-raids | 34 | Passed |
| raids | 132 | Passed |
| card | 114 | Passed |
| camp | 45 | Passed |
| quest | 134 | Passed |
| friends-help | 57 | Passed |
| gifts | 54 | Passed |
| nests | 67 | Passed |
| site-menu | 69 | Passed |
| neighbours | 98 | Passed |
| lessons | 186 | Passed |
| lessons-phone | 223 | Passed |
| lessons-recovery | 90 | Passed |
| siege | 38 | Passed |
| animals | 33 | Passed |
| attack | 161 | Passed |
| bonus | 33 | Passed |
| bosses | 46 | Passed |
| bubble | 64 | Passed |
| camp-again | 28 | Passed |
| cash | 43 | Passed |
| classic | 68 | Passed |
| collect | 103 | Passed |
| collections | 32 | Passed |
| construction | 59 | Passed |
| defence | 27 | Passed |
| dock | 48 | Passed |
| dragons | 100 | Passed |
| edit | 44 | Passed |
| goal-window | 63 | Passed |
| graveyard | 32 | Passed |
| group | 110 | Passed |
| heroes | 41 | Passed |
| hover | 50 | Passed |
| keys | 38 | Passed |
| levelup | 53 | Passed |
| look | 58 | Passed |
| looks | 117 | Passed |
| market | 72 | Passed |
| menus | 113 | Passed |
| messages | 21 | Passed |
| monks | 20 | Passed |
| nature | 23 | Passed |
| phone-place | 60 | Passed |
| pointers | 74 | Passed |
| rename | 39 | Passed |
| scripted | 116 | Passed |
| scripted-bosses | 159 | Passed |
| scripted-stories | 254 | Passed |
| selected | 105 | Passed |
| shop | 51 | Passed |
| sound | 37 | Passed |
| specials | 26 | Passed |
| speed | 27 | Passed |
| spells | 54 | Passed |
| spy | 69 | Passed |
| storage | 40 | Passed |
| stuck | 53 | Passed |
| survival | 57 | Passed |
| team | 40 | Passed |
| tidy | 42 | Passed |
| tools | 79 | Passed |
| tournaments | 90 | Passed |
| town-rules | 37 | Passed |
| train | 42 | Passed |
| troll-town | 43 | Passed |
| villagers | 81 | Passed |
| walk | 48 | Passed |
| work | 56 | Passed |
| world | 138 | Passed |
