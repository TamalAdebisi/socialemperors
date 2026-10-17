# Menus and progression delivery record

This record covers the six feature slices in #99 and #105–109. Required verification is complete. Merges are still pending; this is not
yet a release claim.
The collections-only record is `docs/verification-99.md` in #99.

## Scope

Collections, the units book, darts, the six repeatable social buildings,
shop details, profiles, the missing-town-hall notice and matching mission
credit use the existing game commands and saves. Source reading and
judgment calls are in DECISIONS.md and the corresponding notes under
`docs/original/rules/`. No decompiled source is distributed.

Combat/click controls and kill-drop triggers remain combat-owned; the
shared `Piece`/`addPiece` exports were preserved. The handoff comments on
#98 are 6231063195 and 6231478779. No reply or completed combat-drop
integration is claimed. Other special buildings belong to the other chat.

## Revisions and completed checks

- Collections runtime/fixture: `b1adddcd`, based on main `dcd72818`.
  Server: 449 run, 440 passed, nine existing PostgreSQL skips (35.980s).
  Types and 407 client tests passed. Full Chromium **80/80 in
  1h 50m 17.994s**; all 468 captures reviewed at contact scale.
  Corrected browser focus: 2/2,
  collection-book 69s and harvest collections 31s; all seven images reviewed.
- Combined menus at `95e1007c`: types and 431 client tests passed
  (23.490s); server 449 run, 440 passed, nine existing skips (52.542s).
- Narrow-layout preview correction: types passed on `863b03aa` (shop)
  and `9f03a31f` (combined branch). It changes automatic preview opening,
  not purchase, placement or saved economy rules.
- Corrected focus: 9/9 at `248db71e` (11m 51.945s), recorded below.
- Latest-main combined checks at `76b1663f`: types and 436 client tests
  passed (22.091s together); server 449 run, 440 passed, nine existing
  PostgreSQL skips (59.125s test time, 59.929s total).
- Full Chromium: 88/89 in 1h 59m 26.250s at `76b1663f`; final corrected
  villager fixture: 1/1 in 1m 24.643s at `6fcf0646`. All 89 have passing
  results across runs, not one final-head 89/89 run.

Checks use local throwaway accounts and server data, with read-only public
art. Chromium draws in software on the two-CPU, 8 GiB environment. No live
game account or save was used. Browser runs are sequential on this machine.
No full-run peak-memory measurement is claimed; observed OOM/kill counters
were zero. The memory-limit counter was first recorded partway through the
collections run, so it cannot establish a full-run baseline.

## Original art availability

cURL HEAD requests passed for all 491 checked URLs in 14.19s: 476 distinct
unit-book/reward thumbnails and 15 honour badges. This proves availability,
not decoded appearance; browser screenshots provide the visual check.
A preceding Python urllib attempt returned 403 for the same URLs. Retrying
with cURL returned 200 for every one; no missing art is inferred from the
rejected Python requests. Local logs retain both attempts.

## Corrections retained in the record

The first collections focus was 1/2 because its cash fixture lacked funds.
Normal level rewards fund the corrected fixture; no assertion or timeout
was weakened. The units-book fixture initially confused town storage with
Gifts; source/server review corrected its expected storage counts before
browser verification (`8b3c2300`). Two early social rule tests failed:
the paid-helper fixture and an expected progress value of four out of
three. The corrected fixture and existing capped progress rule pass.

Review corrected Round Table invitation keys to use empire IDs rather
than account IDs (`144c021f`), and a dated darts rollover reopens the board
instead of leaving an armed stale board (`e390e6b6`). Static review also
restricted automatic shop previews to wide layouts; narrow layouts use
Details so entering a card cannot cover its purchase target. The nine-case focus and full run below verify these changes; implementation
alone was not counted as a pass.

The served unit-book configuration includes patches: 120 categories,
481 entries and 475 distinct units. The UI calculates from that served
configuration. Notes now describe its six repeated entries, rather than
an earlier count taken from the unpatched file. No runtime counting rule
changed in that documentation correction.

## Decisions and holds

The original final darts pool is empty, so darts stays inactive today;
active tests use local dates and original prizes. Ordinary social buildings
keep server automatic opening; repeatable buildings retain the original
staff, reward, timing and placement rules. New menu spending credits the
ordinary cash mission once, with social costs kept on their existing path.

Shop purchases remain separate from Details, and early unlocking stays
disabled. Profiles use original badges, initials where photos are absent,
and accurate browser-local last-seen dates; no country is invented and no
Facebook messaging is added. A missing-hall notice does not buy a hall.

Offer/mystery packs, the owner's manual Beta 1 run-through, Daily News,
classic-client retirement and all standing feature holds remain unchanged.

## Initial combined browser check and review corrections

Exact `746476373826f3df43fb9c17a7b77d4ffe8c7d5d` ran 12 cases:
**7/12 passed in 13m 40.338s**. Units book (73s), darts (105s), missing-hall
notices (70s), menus (119s), world (133s), friends-help (60s) and shop (50s)
passed. All 38 PNGs, including failed-case captures, were reviewed at contact
scale; social and shop failures were additionally viewed at native size.
Archive: `work/menu-focus-initial/`; original log and timing remain local.

- Both social cases placed their first building across the town hall.
  Cleanup correctly sent it to Storage. Fixtures now use disjoint lots,
  assert saved placements, and leave cleanup and selection unchanged.
- Shop Details failed at a real click: full-height cards covered the next
  row's Details button. Card/action wrappers now reserve the button's
  space. The original click assertions remain. Tall bubbles also use their
  actual height to remain in the viewport; automatic previews stay wide-only.
- Profiles matched the primary badge and 15 hidden rank-list badges in a
  single-element selector. The selector now targets the primary badge;
  loaded profile checks and stale/retry scenarios remain required.
- Menu progression used an async `waitForFunction` predicate. Inspection
  of installed Playwright 1.56.1 shows that its poller treats the Promise
  as truthy and adopts its first result without polling again. Node now
  polls the actual saved completion **and** reward flags, with the original
  30-second bound and all persistence assertions retained.

Review also found that the existing cash-balance poll would count explicit
payment events again. It now fills only the unrecorded balance decrease;
a model test covers duplicate events, partial fallback and a payment with
a matching cash reward. The browser asserts exactly five cash recorded
for its five-cash purchase. Types and all 432 rule tests pass on the corrected
candidate before the corrected focus. The later results are recorded
separately; no failed check is relabelled as a pass by these corrections.

Large unit values use two stat pairs per row, with a local layout fixture
checking all six numbers remain inside the card. That fixture restores
ordinary stats before purchases and never alters server item data.

## Corrected focus and latest-main integration

Exact `248db71e15714d386f78c686ccb3a5537df81a13` passed all nine focused
Chromium cases in **11m 51.945s**: social-market 121s, social-friends 117s,
shop-details 103s, profiles 72s, menu-progress 51s, units-book 91s,
phone-place 65s, storage 38s and cash 44s. All 45 screenshots were reviewed
at contact scale, with native additional views of social, shop and profile
panels. No new layout defect was identified. Some New-shop thumbnails were
not loaded at capture, and a scrolled phone panel can show only part of its
contents. This is not a claim to inspect fine text or every animated frame.
The complete local server log has no tracebacks, HTTP 5xx or unhandled commands.
Archive: `work/menu-focus-review/`, including results, image hashes and review ledger.

Main `aee3b7b2` brings the separately owned combat controls from #98. It is
merged through every slice, preserving both decision records and all game
changes; final combined verification follows this integration. No combat
kill-drop completion is inferred from the controls merge.

## Complete combined verification

Exact clean, pushed `76b1663f3928e44dfaf72bccbfc7a49ad192afdd` includes main
`aee3b7b2` and every menu/progression slice. All 89 cases ran: **88 passed
in 1h 59m 26.250s** (user 5m 42.588s, system 1m 14.620s). Every new menu
case passed, as did the combat controls, complete building gallery and all
five tournament cases. The full local server log has no Python tracebacks,
HTTP 5xx or unhandled commands. All **516 full-run PNGs** were reviewed at
contact scale, including all 203 gallery captures reviewed incrementally
and hash-matched to the completed archive. The failed villager capture was
also inspected at native size.

`villagers` alone failed after 26s: its no-hall fixture tried to select a
worker behind the new, expected Missing Townhall notice. A read-only local
SQLite check confirmed the worker and all four test trees were present.
The fixture now waits for that warning and clicks OK before continuing.
Every original queue-limit, glow, tree-save and upgraded-villager assertion
remains, with no deadline, game rule or input-control change.

Exact clean, pushed `6fcf064658f2f4508d4201e0153457e774e0bb15` changes only
that eight-line fixture acknowledgement from the full-run head. Its
**villagers focus passed 1/1 in 1m 24.643s** (scenario 77s). Both fresh
captures were reviewed; its complete server log is clean by the same scan.
Game code, rules and artwork are identical to `76b1663f`. All 89 cases have
passing results across these runs; **there is no claim of a single 89/89
run on the final fixture commit**. This is a required user-flow adjustment
to a test, not an unexplained gameplay failure or a hidden retry.

Archives: `work/menus-full-evidence/` and `work/villagers-focus-final/`,
with exact timings, results, image hashes, complete local logs and review
ledgers. The full archive retains the failed result and saved-fixture
diagnosis. The earlier 7/12 focus and every correction above remain
historical evidence.

Visual limits remain explicit: contact review does not inspect every
animation frame or fine text. Classic retains the existing software-
acceleration/mute overlay. Some shop/world thumbnails, one Bull card
portrait and a desktop units-book reload were not loaded in their sampled
captures; other corresponding views show loaded artwork. Large armies can
extend beyond the sampled camera crop. These captures are not claimed as
new art repairs or proof of readiness of every thumbnail. No new menu
layout defect remains identified after the corrected focus and full run.

This combined verification covers the six interacting slices together; it
is not six independent complete runs at their individual branch heads.
The collections-only 80/80 and corrected nine-case focus remain additional
separate checks. No required GitHub check may be bypassed for delivery.

### Full-run case timings

| Case | Result | Seconds |
| --- | --- | ---: |
| animals | passed | 44 |
| attack | passed | 149 |
| basic-notices | passed | 67 |
| battle-selection | passed | 50 |
| bonus | passed | 33 |
| bosses | passed | 41 |
| bubble | passed | 63 |
| building-overlay | passed | 84 |
| camp | passed | 51 |
| camp-again | passed | 25 |
| card | passed | 110 |
| cash | passed | 41 |
| classic | passed | 53 |
| collect | passed | 103 |
| collection-book | passed | 73 |
| collections | passed | 30 |
| combat-controls | passed | 45 |
| construction | passed | 56 |
| contact | passed | 126 |
| darts | passed | 99 |
| defence | passed | 26 |
| dock | passed | 49 |
| dragons | passed | 92 |
| edit | passed | 44 |
| friends-help | passed | 63 |
| gifts | passed | 44 |
| goal-window | passed | 43 |
| graveyard | passed | 28 |
| group | passed | 94 |
| heroes | passed | 41 |
| hover | passed | 48 |
| keys | passed | 39 |
| lessons | passed | 184 |
| lessons-phone | passed | 232 |
| lessons-recovery | passed | 88 |
| levelup | passed | 53 |
| look | passed | 66 |
| looks | passed | 119 |
| market | passed | 66 |
| menu-progress | passed | 53 |
| menus | passed | 117 |
| messages | passed | 20 |
| monks | passed | 21 |
| nature | passed | 24 |
| neighbours | passed | 114 |
| nests | passed | 62 |
| phone-place | passed | 60 |
| playthrough-controls | passed | 36 |
| pointers | passed | 73 |
| profiles | passed | 69 |
| quest | passed | 134 |
| raids | passed | 70 |
| recurring-raids | passed | 29 |
| rename | passed | 33 |
| scripted | passed | 79 |
| scripted-bosses | passed | 156 |
| scripted-stories | passed | 101 |
| selected | passed | 72 |
| shop | passed | 51 |
| shop-details | passed | 113 |
| siege | passed | 41 |
| site-menu | passed | 66 |
| social-friends | passed | 133 |
| social-market | passed | 119 |
| sound | passed | 31 |
| specials | passed | 25 |
| speed | passed | 20 |
| spells | passed | 52 |
| spy | passed | 39 |
| storage | passed | 37 |
| structure-idle | passed | 605 |
| stuck | passed | 47 |
| survival | passed | 60 |
| team | passed | 46 |
| tidy | passed | 36 |
| tools | passed | 74 |
| tournament-battle | passed | 295 |
| tournament-results | passed | 158 |
| tournament-rooms | passed | 240 |
| tournament-weekly | passed | 134 |
| tournaments | passed | 129 |
| town-rules | passed | 38 |
| train | passed | 40 |
| troll-town | passed | 38 |
| units-book | passed | 89 |
| villagers | failed; corrected focus above | 26 |
| walk | passed | 44 |
| work | passed | 52 |
| world | passed | 125 |
