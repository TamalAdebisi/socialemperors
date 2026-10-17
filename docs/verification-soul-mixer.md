# Soul Mixer support verification

Delivered in [#104](https://github.com/TamalAdebisi/socialemperors/pull/104) through [#110](https://github.com/TamalAdebisi/socialemperors/pull/110), merged at `064dd7bd961e554a5325906dc1c4276d1a1388ab`. Earlier no-merge notes below describe the state at those historical checks. The final integration receipt records delivery; Soul new recipes remain gated.

17 October 2026. This slice adds the later original Soul Mixer window,
generic rules and queue commands. **Playable new mixing remains blocked
by missing original content.** The data search, exact missing fields and
source coverage are in [the rule book](original/rules/soul-mixer.md).

The unavailable state requires no user approval: it prevents invented
rules, unit admission and cash spending. Known completed legacy work can
be collected without spending; missing or malformed time is never guessed.

## Completed local checks

These full-suite results apply to `c944e853`, before the final parser
correction below.

- Server: **459 run, 450 passed, 9 existing PostgreSQL skips**, 40.591s.
- Client types passed; **420/420 client tests passed**, 11.413s.
- Soul-specific coverage: 13 rule tests, three execution-time stale editor
  callback tests and ten server protocol tests. Synthetic content stays
  in tests and is never shipped as original config.
- An independent read-only source review found partial-data entry/spending,
  stale edit/preview/window and malformed timestamp issues. They were
  corrected, with regression checks. Re-review found no unresolved material
  source issue. Turning remains allowed as in the original.
- Root review found that claimed queues in another town still reserve
  their original identifier. Restoring only active work could reuse that
  identifier and make the server reject a new building's start. The
  client now reserves all valid global saved IDs separately from active
  work. Client and real server regressions preserve the other town's bq.
- The earlier stabilized `f0c88b2b` passed 458 server tests (nine existing
  skips) and all 419 client tests. The results above include the later
  queue-reservation correction. The browser fixture now places its knight
  clear of the town hall and flushes initial commands before its baseline,
  retaining every cash/unit/queue assertion.

## Exact saved-integer correction

Final review reproduced legacy collection with timestamp `"1e-400"`:
floating-point conversion reduced malformed fractional text to zero.
Other fractional strings could round into apparently integral fields.
Both readers now require 1–16 ASCII decimal digits within the safe integer
range for text and finite nonnegative safe integers for numeric values.
No signs, trimming, decimal points, exponents or non-ASCII digits are
accepted. Explicit numeric/text zero still permits known legacy collection.

Types, **17/17 focused client tests** and **11/11 Soul Mixer server tests**
passed after this correction. The regressions exercise actual collection
commands with missing original content, restored durations, malformed
timestamp/amount/unit fields and excessive text, alongside valid zero.
The independent Time Machine parser follows the same grammar; root owns
its cross-feature collection regression and combined verification.
No browser was rerun for this source-only parser change; the original
artwork and window behaviour below are unchanged.

## Legacy output type correction

Final source review also reproduced a malformed completed queue granting
item 1345, whose original config type is a building. Both collection paths
now require actual unit metadata. The new real-command regression failed
before the guard, then passed with the entire save unchanged on refusal;
cash and parents stay intact, and valid legacy unit 533 still collects.
Types, **18/18 focused client tests** and **12/12 Soul Mixer server tests**
passed after this narrow guard. Artwork and window behaviour are unchanged;
no browser rerun was needed for this collection validation.

## Browser verification

Exact clean source `c944e853927ee4e0e13ce4320107cc565718d58f` passed the
focused Chromium case **1/1 in 67 seconds** with:

`PYTHON=.venv/bin/python node e2e/run.mjs soul-mixer --keep`

All three fresh captures were reviewed: desktop unavailable state, the
four original help images and the phone sheet. The original art, disabled
actions and layout are correct; the phone body scrolls within its sheet.
The case checks ordinary saved cash, the mixer, the knight and queue data
before/after help, reload and opening on the phone. They remain unchanged.
The full local server log has no Python traceback, HTTP 5xx response or
unhandled command. Evidence is archived locally in
`work/verification-soul-mixer-c944e853/`; the throwaway data is retained at
`/tmp/se-e2e-MBsqiL`.

This verifies the current unavailable state, not playable new mixing.
Recovered generic behaviour is covered separately by the synthetic rule
and server tests above. The exact saved-integer correction follows this
tested source with the focused checks recorded above. The root integration's
complete browser-suite result is recorded separately; no combined full-suite
pass is claimed here.

No live game account or production game-state traffic was used. Research
made read-only requests to the preservation upstream and public search;
decompiled source was read only locally and is not in this slice.

## Integrated WebKit and later combined checks

The Soul Mixer case passed **1/1 in 30 seconds** in Linux WebKit at exact
clean combined source `22f5fd02bc900ba9ca674da7a591a9c79b0197c4`.
All **three fresh PNGs** were reviewed: desktop unavailable state,
original help and phone unavailable state. The unavailable-data message
is readable, all four original help images decode, desktop actions are
visibly disabled and the phone sheet fits its width. No material visual
issue was found. The phone capture shows only the visible fold: lower
disabled actions extend below it, so that image alone does not demonstrate
scrolling. Linux WebKit does not establish native Apple GPU behaviour.

Evidence is retained under
`work/checks/integrated-webkit-six-initial/evidence/soul-mixer/`, with
hashes, dimensions and review notes in ignored `work/review-webkit-soul.json`.
The initial combined run was **5/6**, with a separate rider phone-focus
assertion failing after its actual adventure callbacks; the Soul pass
does not turn that wider run into a full pass.

At later combined `db5d614dff4ba271466718c8bd5df2e40935e6e6`, including
the narrow focus follow-up, server checks ran **467 tests: 458 passed and
nine existing PostgreSQL skips** (34.338s test time, 34.938s command time).
Types passed and **447/447 client tests passed** (13.265896s test time,
16.711s command time). These are combined integration results, not a new
leaf-only run. At that stage, the planned **85-case Chromium** run and
final review were still pending. The later complete 86-case result includes
main #98, as recorded below and in
[the integration record](verification-special-buildings.md).

The original-data blocker persists: genuine later ranks, mixing times,
power-up levels and passive-grant level are still missing. These checks
verify supported rules and the safe unavailable state; they do not claim
playable new mixing.

## Historical-save browser follow-up

The complete combined Chromium run at clean `56d1bdbe` passes 86/86 in
8305.262 seconds. Its Soul case passes in 61 seconds and verifies only
the unavailable/help state. The game source matches unit-tested
`b6ed5175`: 467 server tests run (458 passed, nine existing skips), types
and all 451 client tests passed. All **507 fresh PNGs** were reviewed
and matched the archived filename/hash manifest. The complete 78,774-line
server log has no traceback, HTTP 5xx, unhandled command or server/command
exception. These combined results do not upgrade the earlier `db5d614d`
447-test count or claim enabled new mixing.

A stronger test-only extension now restores an explicit-ready historical
queue in the isolated runner's SQLite save while its server is stopped,
then restarts normally and uses the real window/commands. It checks phone
collection, both surviving parents, zero cash/XP, the retained claimed
marker, reload/retry and malformed building-output refusal. The existing
unavailable/help/phone assertions remain. All four original tables stay
absent; the fixture is protocol coverage, not a recovered combination.
The optional test harness also awaits clean shutdown before editing or
deleting temporary data. No game source or production hook changes.
Independent review and static syntax checks pass. The extension and
shutdown harness are test-only `a75d1e0529e59b72c4491751d1d757713dda75bf`;
product source is identical to the full-run source. Focused Chromium/WebKit
and fresh capture/log result: **Chromium 1/1 in 342.443s and Linux WebKit 1/1 in 128.023s** at clean `a75d1e05`, with all 14 fresh captures and complete logs reviewed.
All six original selected WebKit cases already have passing results across
the initial 5/6 and affected 2/2 repeat, not one final-revision 6/6.
Linux WebKit does not establish native Mac/iPhone GPU behavior. New mixing
still requires all four genuine original fields/tables; no merge or
deployment is claimed. Exact evidence belongs in
[the integration record](verification-special-buildings.md).

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
