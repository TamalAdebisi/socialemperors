# Time/weather machine verification, 17 October 2026

This slice uses local throwaway empires and read-only original art. No live
account or production game-state action was used. Initial slice results below
precede the final combined checks recorded at the end. Merge and deployment
are not claimed.

## Exact checks

- `8ac4debd`: client types passed and **408/408 client tests** passed in
  11.918 seconds. Server **451 run: 442 passed, nine existing PostgreSQL
  skips** in 47.792 seconds. The 22 focused warehouse/time/pastimes checks
  also passed.
- `2f1dfbaa`: the cross-slice generic training-queue timestamp correction
  passed all **11 warehouse/time tests**, including waiting, ready, claimed
  and very early positive queue starts. No browser was used for that edit.
- First browser focus on `2f1dfbaa`: **1/2 passed**. Weather passed in
  123 seconds; time failed in 42 seconds after its purchase, panel-switch,
  cash/stock and saved mine-timer assertions passed. The first travel made
  the normal ten-minute camp due. The failure screenshot shows its chapter
  notice covering the machine; the local saved empire retained machine
  1463 at (54, 52), none in storage, with stock `[1, 0, 0, 0, 0, 0]`.
  The fixture now checks and acknowledges the ordinary dialog rather than
  changing a timer, suppressing the camp or weakening an assertion.
- Exact `4a81d5ae`, built and run with
  `PYTHON=.venv/bin/python node e2e/run.mjs time-machine weather-machine --keep`:
  **2/2 passed**, time in **136 seconds**, weather in **99 seconds**.
  The run also covers delayed purchase followed by switching machines,
  unaffordable purchase, failed acknowledgement through the normal sender's
  retries, unchanged server cash/stock on refusal, and the actual recovery
  reload. No page error was suppressed. The completed server log has no
  tracebacks, HTTP 5xx responses or unhandled commands.

The failed first attempt's seven screenshots and log are archived locally
under `work/checks/machines-first-2f1dfbaa/`. The successful attempt's ten
screenshots, complete server log and output are under
`work/checks/machines-repeat-4a81d5ae/`; its retained throwaway database is
`/tmp/se-e2e-UUySRR`.

## Screen review and later correction

All seven first-attempt captures and all ten successful-attempt captures
were reviewed. They cover original card actions, first-use/reopened help,
packet pictures and stock, desktop/phone rows, the due camp notice,
failed-save recovery, six terrain previews, snow ground/tree skins,
current selection and free reuse of an owned look. The packet label that
was truncated in the first attempt wraps fully in the successful run;
phone sheets leave the dock usable.

The successful recovery screenshot exposed one remaining presentation
issue: the generic central save warning overlapped part of the phone
panel's own recovery message. The reload action still passed. Commit
`04101ab4` raises only a machine panel containing its recovery button and
adds hit-visibility checks across that button before the actual reload.
This CSS/assertion follow-up passed syntax and diff checks and needs the
combined delivery's subsequent browser verification. Do not attribute the
`4a81d5ae` browser pass to this later change.

Original-source notes and the judgments on save acknowledgement, travel
presentation and unavailable original server behavior are in
`docs/original/rules/machines.md` and DECISIONS.md. No progression hook or
unfinished-goal count changed; weather goal 220 already uses the ordinary
build requirement.

## Generic-queue validation correction

Final integration review reproduced a malformed boolean queue start becoming
an explicit ready marker during time travel. The correction validates only
generic-queue timestamps before shifting and preserves unreadable payloads;
other timers retain their existing behavior. All **25 focused warehouse,
time and pastimes server tests passed**, including malformed payloads,
whole numeric/text starts and exact zero markers.

A separate process imported the real combined server/Soul handlers from
`4874ffb6` and injected this branch's candidate time-machine module, without
editing that integration worktree. Its actual `pop_queue_unit` → `time_ff`
→ `pop_queue_unit` checks passed for 14 malformed starts; five valid whole
wire formats advanced normally and an explicit zero still claimed through
the real handler. Repeating the identical check with the pre-correction time
module failed on `False`: the first claim was refused and the second granted
a unit after the jump. The expected failing and candidate traces are kept
locally in `work/integrated-queue-old-*` and
`work/integrated-queue-validation.log`. The combined delivery keeps its
permanent cross-command regression in the Soul Mixer tests; this leaf
branch's tests remain independently runnable.

The final parser aligns with the Soul Mixer's bounded ASCII decimal-digit
text grammar (1–16 digits, no sign/space/decimal/exponent/underscore/Unicode
forms, at most JavaScript's largest safe integer). Numeric values still
must be finite nonnegative safe whole numbers. This stricter text boundary
keeps any value rejected by the Soul reader rejected after time travel;
all 25 leaf warehouse/time/pastimes tests passed again with the expanded
malformed-text cases. The earlier five-format integrated diagnostic above
belongs to the intermediate decimal parser; its decimal/exponent text
forms are intentionally refused by the final shared wire contract.

## Combined verification after integration

These results belong to the combined special-building integration, not a
standalone run of this leaf branch. Exact clean `22f5fd02` passed both
WebKit machine cases: **time-machine in 123 seconds** and **weather-machine
in 46 seconds**. All **ten fresh captures** were reviewed individually
(six time, four weather), with no material visual issue. The final recovery
stacking fix and the hit checks across the reload button passed; the phone
failure message and complete Reload saved town button are visible above
the generic warning. Packet names remain complete, snow ground/tree skins
match the selected look, owned looks remain free, and phone docks stay
clear. Per-file SHA-256 hashes and review notes are retained in the
integration workspace's ignored `work/review-webkit-machines.json`.

Combined post-focus checks at `db5d614d` also passed: **467 server tests
run, 458 passed, nine existing skips**, in **34.338 seconds** of test time
(**34.938 seconds** for the command); client types and **447 client tests**
passed, with **13.265896 seconds** of test time (**16.711 seconds** for the
command). At that revision, the planned **85-case browser run was still
pending**. The later complete 86-case run includes main #98 and is recorded
below. These earlier results do not themselves claim every selected WebKit
case passed; its rider follow-up remains in the integration history.
Screenshot review covers visible viewport areas and normal panel
scrolling; Linux WebKit does not reproduce Safari on a Mac GPU.

## Combined verification before the menus merge

Exact clean `56d1bdbeb895b9eaed1b1a1804bea19a8a2cca78`, including main #98,
passed **86/86 Chromium cases in 8305.262s**. Time Machine passed in
**134s** and Weather Machine in **101s**. All 507 fresh run captures were
reviewed and matched the archived filename/hash manifest; the full
78,774-line server log has no recorded server error. These are combined
results, not a separate full run on the machine leaf.

Product source for that 86-case run matches clean `b6ed5175`: **467 server tests run, 458 passed,
nine existing PostgreSQL skips**, types and **451 client tests passed**.
Earlier `db5d614d` retains its own 447-test result above. Linux WebKit's
initial 5/6 and affected 2/2 repeat give all six selected cases passing
results across runs, not a single final-revision 6/6. The later test-only
`a75d1e05` legacy Soul follow-up and remaining merge status are tracked in
[the integration record](verification-special-buildings.md). No Mac GPU,
merge or deployment claim is added.

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
