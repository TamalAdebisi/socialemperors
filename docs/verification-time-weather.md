# Time/weather machine verification, 17 October 2026

This slice uses local throwaway empires and read-only original art. No live
account or production game-state action was used. The combined special-building
delivery still requires its own final integration checks; these records do not
claim a merge or deployment.

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
