# Menus and progression delivery record

This record covers the six feature slices in #99 and #105–109. Browser
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
  Types and 407 client tests passed. Corrected browser focus: 2/2,
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
