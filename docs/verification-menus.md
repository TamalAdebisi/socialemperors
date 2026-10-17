# Menus and progression delivery record

This record covers the six feature slices in #99 and #105–109. Full combined browser
verification and merges are still pending; this is not a release claim.
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
- Browser focus and a complete combined Chromium run: pending. Exact
  revisions, timings, failures and review coverage will be added here.

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
Details so entering a card cannot cover its purchase target. Later browser
results must verify these changes; their implementation alone is not a pass.

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
candidate; fresh browser results are still pending. No failed check is
relabelled as a pass by these corrections.

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
