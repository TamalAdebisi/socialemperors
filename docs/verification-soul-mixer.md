# Soul Mixer support verification

17 October 2026. This slice adds the later original Soul Mixer window,
generic rules and queue commands. **Playable new mixing remains blocked
by missing original content.** The data search, exact missing fields and
source coverage are in [the rule book](original/rules/soul-mixer.md).

The unavailable state requires no user approval: it prevents invented
rules, unit admission and cash spending. Known completed legacy work can
be collected without spending; missing or malformed time is never guessed.

## Completed local checks

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
and server tests above. Only delivery documentation follows this tested
source in the slice. The root integration's complete browser-suite result
is recorded separately; no combined full-suite pass is claimed here.

No live game account or production game-state traffic was used. Research
made read-only requests to the preservation upstream and public search;
decompiled source was read only locally and is not in this slice.
