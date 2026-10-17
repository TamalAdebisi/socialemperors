# Collections delivery record (#99)

## Scope and revisions

Implementation and browser fixtures: `b1adddcd`, based on main
`dcd72818`. Later documentation-only commits do not change the tested
runtime. This slice adds Army → Collections, saved exchanges/cash and
goal 54. Harvest drops feed the same saved rows. Combat kill triggers
remain the combat chat’s responsibility; the shared `Piece`/`addPiece`
contract stays intact. Coordination is recorded on PR #98 in comments
6231063195 and 6231478779.

## Checks

- Server: 449 run, 440 passed, nine existing PostgreSQL skips (35.980s).
- Client types passed; all 407 client tests passed (15.130s).
- Corrected collection-book desktop/phone plus existing harvest browser
  focus: 2/2; scenarios took 69s and 31s respectively.
- Complete Chromium run: **80/80 passed in 1h 50m 17.994s**, including
  the build, on the same runtime and fixtures at `b1adddcd`.
- Delivered in #99 (`4356029d`), followed by #105–109 through
  `a6f24580`. Combined verification is recorded in
  `docs/verification-menus.md`: full 88/89 plus the corrected villager
  focus 1/1, with unchanged game code. All 89 have passing results
  across runs; this is not a single final-head 89/89 claim.

The first focus was 1/2: the collection-book fixture tried to spend cash
it did not have; the unchanged harvest case passed (34s). Normal level
rewards now fund that fixture. No assertion, timeout or runtime economy
rule was weakened. The first shell attempt to use `/usr/bin/time` exited
127 before running the browser; subsequent runs use Bash’s `time` builtin.

## Visual and log review

All seven corrected focus screenshots were reviewed, including native-size
desktop and phone exchanges. All **468 full-run PNGs** from all 80 completed cases were reviewed at
contact-sheet scale. No collection-specific visual regression was found.
This scale does not establish fine text or every animation frame. The
classic capture retains its existing software-acceleration banner, and
one menu/shop capture catches thumbnails before loading; other shop
captures show the loaded art. Neither limitation is claimed fixed here.
Both complete local server logs have no Python traceback, HTTP 5xx or
unhandled command. The full archive is `work/collections-full-final/`,
with results, screenshot SHA-256 manifest, contacts and server log. The
review ledger is `work/collections-review/reviewed.txt`; the focus archive
is `work/collection-focus-final/`. These are local evidence, not game assets.

Public original art was read from the asset bucket; all game accounts,
commands and saves were local throwaway data. Chromium uses software
rendering on this two-CPU, 8 GiB environment. No live game writes occurred.

## Decisions and holds

Collections use an existing Army entry to keep the phone dock manageable.
The original pictures, distinct-piece cash discounts, repeatable/unique
restrictions and separate exchange/cash ownership checks are retained.
Facebook sharing is omitted. Special buildings and combat controls are
owned by the other chats. Offer/mystery packs, the owner’s manual Beta 1
run-through and all existing feature holds remain unchanged.

## Complete browser timings

Scenario times are rounded seconds from the runner; the total above also
includes the build, setup and cleanup.

| Case | Seconds |
|---|---:|
| animals | 33 |
| attack | 159 |
| battle-selection | 49 |
| bonus | 33 |
| bosses | 41 |
| bubble | 65 |
| building-overlay | 91 |
| camp | 58 |
| camp-again | 26 |
| card | 114 |
| cash | 39 |
| classic | 54 |
| collect | 103 |
| collection-book | 80 |
| collections | 32 |
| construction | 61 |
| contact | 134 |
| defence | 28 |
| dock | 52 |
| dragons | 93 |
| edit | 46 |
| friends-help | 72 |
| gifts | 56 |
| goal-window | 60 |
| graveyard | 35 |
| group | 96 |
| heroes | 43 |
| hover | 48 |
| keys | 36 |
| lessons | 200 |
| lessons-phone | 220 |
| lessons-recovery | 99 |
| levelup | 48 |
| look | 66 |
| looks | 123 |
| market | 70 |
| menus | 135 |
| messages | 22 |
| monks | 24 |
| nature | 24 |
| neighbours | 104 |
| nests | 62 |
| phone-place | 60 |
| playthrough-controls | 40 |
| pointers | 72 |
| quest | 128 |
| raids | 51 |
| recurring-raids | 29 |
| rename | 28 |
| scripted | 82 |
| scripted-bosses | 156 |
| scripted-stories | 103 |
| selected | 72 |
| shop | 52 |
| siege | 39 |
| site-menu | 62 |
| sound | 27 |
| specials | 26 |
| speed | 24 |
| spells | 53 |
| spy | 42 |
| storage | 39 |
| structure-idle | 653 |
| stuck | 49 |
| survival | 57 |
| team | 50 |
| tidy | 37 |
| tools | 75 |
| tournament-battle | 300 |
| tournament-results | 169 |
| tournament-rooms | 247 |
| tournament-weekly | 138 |
| tournaments | 117 |
| town-rules | 38 |
| train | 39 |
| troll-town | 44 |
| villagers | 78 |
| walk | 44 |
| work | 52 |
| world | 131 |
