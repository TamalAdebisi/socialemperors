# Unit Warehouse verification, 17 October 2026

Delivered in [#101](https://github.com/TamalAdebisi/socialemperors/pull/101) through [#110](https://github.com/TamalAdebisi/socialemperors/pull/110), merged at `064dd7bd961e554a5325906dc1c4276d1a1388ab`. Earlier no-merge notes below describe the state at those historical checks. The final integration receipt records delivery; Soul new recipes remain gated.

The implementation is on `codex/unit-warehouse`. Research and the original
rules are in [the rule book](original/rules/warehouse.md). Judgment calls
are in DECISIONS.md. Testing uses local throwaway empires and read-only
public art; no production game state is tested or changed.

## Initial leaf verification

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
unhandled commands. These initial leaf results do not themselves claim
a full suite pass, merge or deployment.

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

The focused scenario and its capture/log review completed before the
integrated checks recorded below. The scenario covers
walking admission and its saved tile, box
counts, ordinary occupants remaining empty, 18-slot pages and empty final
pages, one-unit deployment, no deployment experience, bought capacity,
cash, phone layout, storing/resetting, retained capacity and reload.

## WebKit follow-up with loaded Storage portraits

The stronger warehouse fixture passed **1/1 in 65 seconds** in Linux
WebKit at exact clean integrated
`db5d614dff4ba271466718c8bd5df2e40935e6e6`. This is the warehouse case's
result in `work/checks/integrated-webkit-followup/output.log`, not a claim
that the whole combined browser run passed. Its new checks require the
three named Storage cards, their exact counts, and complete images with
positive natural dimensions at the intended original JPG URLs.

All **four fresh screenshots** were inspected. The final reloaded Storage
capture now visibly shows all three original portraits, with eighteen
Light Knights, one Spearman and one Unit Warehouse, total 20. This resolves
the earlier blank-portrait capture limit. Desktop occupied/final pages and
the phone warehouse remain readable, without generic capacity or zero
combat statistics on the warehouse card. No material visual issue was
found. The phone warehouse PNG still captures the upper part of page one;
its lower paging controls are outside that screenshot. Hashes, dimensions
and review notes remain in the ignored
`work/review-webkit-warehouse-followup.json` on the integration worktree.

The same integrated `db5d614d` passed **467 server tests: 458 passed and
nine existing PostgreSQL skips**, in 34.338 seconds of unittest time
(34.938 seconds command duration). Client types and **447/447 tests
passed**, with 13.265896 seconds of test time (16.711 seconds combined
command duration). These are combined-branch results, not standalone
warehouse-leaf checks. The planned 85-case browser run was still pending
at that stage; the later 86-case result including main #98 follows below.
Neither this earlier WebKit run nor the final evidence claims a merge or
deployment.

## Combined verification before the menus merge

Exact clean `56d1bdbeb895b9eaed1b1a1804bea19a8a2cca78`, including main #98,
passed **86/86 Chromium cases in 8305.262s**; warehouse passed in **115s**.
All 507 fresh run captures were reviewed and matched their archived
filename/hash manifest; the full 78,774-line server log has no recorded
server error. These are combined results, not a standalone warehouse full
run. Phone paging/fold limits above remain.

Product source for that 86-case run matches clean `b6ed5175`: **467 server tests run, 458 passed,
nine existing PostgreSQL skips**, types and **451 client tests passed**.
The earlier `db5d614d` result remains 447 client tests. All six selected
WebKit cases have passing results across the initial 5/6 and affected
2/2 repeat, rather than a single final-revision 6/6. The test-only
`a75d1e05` legacy Soul follow-up and remaining delivery checks are tracked
in [the integration record](verification-special-buildings.md). No merge,
deployment or native Apple GPU result is claimed.

Menus/progression main `a0f3ab19` was then integrated at `2f7eb080`, which passes
467 server tests run (458 passed, nine existing PostgreSQL skips), client
types and 479 client tests. The complete Chromium attempt at clean
`f3c55854` was **94/95 in 9197.418s**; `shop-details` failed on the phone
preview after 111s. Its unchanged complete repeat passed **1/1**, 113s
scenario / 119.515s command, at the same clean revision. All 95 have passing
results across these runs, not a single 95/95. All **561 + eight fresh PNGs**
and the complete **90,317 + 875 server-log lines** were reviewed; exact
capture/log/resource results belong to
[the combined integration record](verification-special-buildings.md#latest-main-integration-and-current-release-checks),
not a separate full run of this leaf. The failed attempt stays retained;
the repeat does not establish its cause. Prior results keep their exact
revisions; no merge or deployment is claimed.

Latest privacy/art-setting main `f9946077` was integrated at clean
`3d60b898`. Server **467 run, 458 passed, nine existing PostgreSQL skips**
passed (34.317s tests; 34.947s command); client types and **479 tests**
passed (13.41462159s tests; 16.53s command). The missing-art-setting guard
returned its expected **exit 2 in 0.078s**, before build/server/browser.
The configured positive Shop focus then **failed 0/1** on the desktop
preview (51s scenario; 66.807s command), and its read-only diagnostic also
**failed 0/1** (57s scenario; 68.667s command). These exact-revision failures
are retained separately from the unchanged passing `f3c55854` repeat.
Incoming main `f88ea31f` (#113) owns the preview-clock correction and
click-only Details/short labels. Exact clean `dc920d60` passes server **467 run, 458 passed, nine existing
PostgreSQL skips** (34.438s tests; 35.004s command), client types and
**480/480 client tests** (14.191369192s tests; 17.54s command). The final affected Chromium check passes **9/9 in 1780.184s (29m 40.184s)** at
clean `dc920d60`, including this slice and the changed Shop/Storage/preview
paths. All 74 fresh captures and the complete 10,029-line server log
were reviewed and hash-checked. This is a combined affected check, not a
new full 95-case run or a separate full leaf run. Exact case timings,
resource receipts, archive/audit hashes and visual limits are in
[the integration record](verification-special-buildings.md).
No merge/deployment is claimed.
