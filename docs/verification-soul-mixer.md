# Soul Mixer support verification

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
leaf-only run. The full **85-case Chromium** run and final integrated
review remain pending in [the integration record](verification-special-buildings.md).

The original-data blocker persists: genuine later ranks, mixing times,
power-up levels and passive-grant level are still missing. These checks
verify supported rules and the safe unavailable state; they do not claim
playable new mixing.
