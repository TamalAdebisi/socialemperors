# Playthrough follow-up verification (#95)

All players and game writes use throwaway local accounts and servers. The
ordinary public game art is cached locally. No live game account or save
was accessed.

## Initial complete run

Runtime `1c978b47e7d261bdb0e5d973759c29f7baa1b370`, based on main `d4bc1a72`:
**71/71 Chromium tests passed in 1h 24m 33.56s**, including the build.
Server: **436 run, 427 passed, 9 existing skips**, 50.962 seconds. Client:
types and **352/352 passed**, 18.134 seconds.

This run is retained as an initial result, not relabeled as verification of
the later main merge. Its screenshots and server log were preserved before
starting further runs.

## Main integration and current verification

Main advanced to `1eb2a2e2` (#94) during that run. It was merged without
rebasing at `10507be421042211081161e59766d8d802fe3ff7`. The combined code keeps
#94's enlarged unit targets, ground-click feedback, background simulation,
explicit Pause, placement fixes and root-relative site assets, alongside
#95's recurring threats, battle selection and Everybody.

- Server: **436 run, 427 passed, 9 existing skips**, 32.184 seconds.
- Client: type check and **356/356 passed**, 9.928 seconds.
- Complete integrated Chromium run: **73 cases, in progress**, with the
  overlapping controls and community checks first.

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

## Screenshot and log review

Initial full-run review included desktop/phone battle inspection, raid
recovery and repair, the next-camp countdown, phone building cards, help
recipients, neighbors, phone tutorial guidance, special-move controls and
spell aiming. The selection panel leaves pointer and special-move buttons
clear, and hides while aiming a spell. Integrated review is pending.

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

## Integrated full-run order and timings

Pending.
