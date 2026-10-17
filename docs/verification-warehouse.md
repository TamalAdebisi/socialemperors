# Unit Warehouse verification, 17 October 2026

The implementation is on `codex/unit-warehouse`. Research and the original
rules are in [the rule book](original/rules/warehouse.md). Judgment calls
are in DECISIONS.md. Testing uses local throwaway empires and read-only
public art; no production game state is tested or changed.

## Latest state

Game code is unchanged after `d9765e1a`; later commits change the browser
fixture only. At `6af50f26`, client types and all **412 client tests
passed**, with the rule run taking **20.72 seconds**. The existing server
warehouse/time command suite passed **8/8** in **0.066 seconds** during
implementation; no server runtime behavior changed.

Focused Chromium passed **1/1 in 106 seconds** on exact clean
`76a20d73a463873d0b0542f0d538fadae124dce0`, with the local save retained.
All four fresh captures were reviewed: the occupied and empty desktop
pages, the phone warehouse and the phone storage after reload. The phone
sheet fits without horizontal overflow; the final storage shows the exact
saved contents. The server log has no tracebacks, HTTP 5xx replies or
unhandled commands. This record does not claim a full suite pass, merge,
or deployment.

## Integrated WebKit capture review

At clean `22f5fd02bc900ba9ca674da7a591a9c79b0197c4`, the integrated
warehouse scenario passed **1/1 in 73 seconds** in Linux WebKit. All four
fresh PNGs were inspected. The original warehouse portraits, slot/button
art, desktop final-page controls and phone sheet render correctly. The
building card has neither ordinary capacity nor zero combat statistics.
Reloaded Storage shows the expected total of 20: eighteen Light Knights,
one Spearman and the warehouse. The phone warehouse capture shows the
upper part of its first page; it does not expose the lower paging controls.

The final Storage capture has blank portrait areas on its three cards.
Source inspection finds that Storage uses an IntersectionObserver to start
loading portraits only as cards become visible; the old fixture captured
immediately after opening it. This capture therefore does not establish
loaded Storage art. All three intended original JPGs exist locally. The
fixture now scrolls each card into view, checks the exact three names and
counts, and waits at most 30 seconds for complete, nonempty images at the
intended original URLs before capturing. It returns to the first card for
the shot. No product or shared Storage code changes; the follow-up browser
run and screenshot review remain pending.

## Browser attempts retained

| Revision | Result | Finding |
| --- | --- | --- |
| `8ace4b60` | 0/1, 32 seconds | The deployment assertion found an initial knight instead of the added one. The server correctly placed the new knight beside the warehouse. The fixture now checks the added count and identifies the new unit. Screenshot review also found a real card defect: the configured warehouse displayed ordinary occupants and zero combat numbers. `d9765e1a` corrects this, with a rule assertion for its actual subcategory. |
| `d9765e1a` | 0/1, 30 seconds | The walking fixture's unit started behind the warehouse's large foreground artwork, so the native selection helper found the building. The fixture start moved into clear view; controls were unchanged. |
| `30c990d3` | 0/1, 106 seconds | Desktop admission, paging, deployment, cash and capacity checks passed. The phone's selection helper picked the newly deployed unit and then legitimately ordered it back into the warehouse. The later storage assertion found one extra knight. The verified deployment is now moved to a clear fixture tile before the phone opens; all deployment and storage assertions remain. |
| `6a6196c8` | 0/1, 47 seconds | The 30-second local arrival wait expired. At teardown the server had accepted the entry, with its command request about 35 seconds after the last pre-action read. No local transition trace was available, so this does not establish the exact cause. |
| `76a20d73` | **1/1, 106 seconds** | The final fixture passes every desktop, phone and saved-state assertion. The read-only trace records five ordinary steps, no warehouse movement, stock changing from zero to one at 14.824 seconds, and no page errors. |

All four runner logs remain in the local work folder. The second, third
and fourth failures retain their screenshots and server logs there. The
first screenshots were inspected but overwritten before archiving; the
first runner log is retained. The third run's four captures include a
readable phone sheet with no horizontal overflow; its phone capture also
shows the extra unit that explains the subsequent failed assertion.

The fifth fixture, introduced at `6af50f26`, keeps the same **30-second deadline** and
every admission/save assertion. A static path replay finds five steps
from its clear start rather than nine. It records bounded, read-only
samples of the unit's tile, walk state, next tile, warehouse tile, local
stock, selection and elapsed time, plus page errors, in
`admission-trace.json`. Its passing archive retains all four screenshots,
the trace, server log and runner log. The retained local save is
`/tmp/se-e2e-17Pi8T`. The passing trace does not establish the exact cause
of the earlier untraced timeout. No assertion, error or test is disabled;
no movement speed, drawing clock or game rule changed.

## Integrated checks before delivery

The focused scenario and its capture/log review are complete. Run the
integrated required checks on the delivery branch. The scenario covers
walking admission and its saved tile, box
counts, ordinary occupants remaining empty, 18-slot pages and empty final
pages, one-unit deployment, no deployment experience, bought capacity,
cash, phone layout, storing/resetting, retained capacity and reload.
