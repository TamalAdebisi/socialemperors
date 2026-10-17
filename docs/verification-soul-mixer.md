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

`e2e/tests/soul-mixer.mjs` is ready for the coordinated shared-machine
browser slot. At this source stabilization commit it has **not run yet**;
no screenshot pass is claimed. It checks original art/help, desktop/phone
layout, reload and unchanged ordinary saved units, cash and queues for
the current unavailable state. Browser results and screenshot/log review
will follow in this branch before delivery. The root integration's full
browser-suite result is recorded separately.

No live game account or production game-state traffic was used. Research
made read-only requests to the preservation upstream and public search;
decompiled source was read only locally and is not in this slice.
