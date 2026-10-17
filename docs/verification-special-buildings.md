# Special-building integration verification

17 October 2026. This delivery combines the five independently scoped
building branches, retaining each branch's history and pull request:
[machines #100](https://github.com/TamalAdebisi/socialemperors/pull/100),
[warehouse #101](https://github.com/TamalAdebisi/socialemperors/pull/101),
[Supreme temple #102](https://github.com/TamalAdebisi/socialemperors/pull/102),
[dragon riders #103](https://github.com/TamalAdebisi/socialemperors/pull/103)
and [Soul Mixer #104](https://github.com/TamalAdebisi/socialemperors/pull/104).
The integration branch contains their shared editor and save contracts.
It retains the earlier complete 86-case run and legacy browser follow-up
below. The menus integration adds nine cases; its complete 94/95 attempt
and unchanged 1/1 follow-up are recorded in the latest-main section.
Privacy/art-setting main `f9946077` was checked at `3d60b898`; incoming
main `f88ea31f` (#113) is locally integrated at `dc920d60`, with its own
combined affected checks recorded below.
No special-building merge or deployment is claimed.

## Scope and original-data limit

Machines, the warehouse, rider training/taming and the Supreme temple use
the original artwork, rules and commands. The original rider adventure
asset is unchanged and runs on demand through the existing pinned Ruffle
runtime and a loader written for this project. No decompiled source is
committed. The other chats retain menus/progression and combat/control
ownership; main's existing behavior is preserved at the integration points.

The Soul Mixer window, help, generic queue contract and readable completed
legacy work are supported. **New mixing remains unavailable:** genuine
later configuration is missing four required original fields/tables.
Neither ranks nor prices nor waits are guessed. See the
[research](original/rules/soul-mixer.md) and
[slice checks](verification-soul-mixer.md).

Integration also prevents a unit walking into a warehouse or taming
building from entering at its old doorway if the building moves while
the unit is travelling. Two tests execute the real editor continuation,
move its target, and check rerouting without an early containment command.

## Completed checks

Exact clean `97b12e13eeacc706d379fe2023e07a4ecb5b5547`:

- Server: **462 run, 453 passed, nine existing PostgreSQL skips**;
  unittest time 48.825s, command duration 50.107s.
- Client types and **445/445 tests passed**; test time 22.024s,
  combined command duration 26.15s.

The local receipts preserve start/end revisions, working-tree state,
commands, timings and full output in `work/checks/integrated-*-initial/`.
The initial receipt predates the final machine/Soul timestamp corrections,
machine recovery stacking and rider claim/fixture follow-ups.

Exact clean `dd14398a464f9b7aec3ed169efe7c987d563319d`, including all those
corrections, passes the complete server and client checks:

- Server: **466 run, 457 passed, nine existing PostgreSQL skips**;
  unittest time 52.973s, command duration 53.746s.
- Client types and **446/446 tests passed**; test time 21.537s,
  combined command duration 25.309s.

Exact clean start/end receipts and full output are retained in
`work/checks/integrated-server-final/` and `integrated-client-final/`.

Final review also reproduced a completed legacy queue describing a building
instead of a unit. Both claim readers now refuse that metadata before any
mutation, while ordinary completed unit collection still works. The real
server regression first failed, then passed; independent review found no
remaining issue. Exact clean `f3529ef24120bec807dd207083529fcf4ad99800`,
including this correction, passes all complete checks again:

- Server: **467 run, 458 passed, nine existing PostgreSQL skips**;
  unittest time 34.760s, command duration 35.337s.
- Client types and **447/447 tests passed**; test time 13.130s,
  combined command duration 16.202s.

Receipts and output: `work/checks/integrated-server-release/` and
`integrated-client-release/`.

Independent integration review reproduced a malformed queue being refused
by Soul Mixer, then converted to a claimable zero by time travel. A new
real-command regression first failed on booleans/fractions and an infinite
timestamp, then passed all 11 Soul command tests at clean `dc2ca014` after
the time-machine correction. The old failure receipts and exact test
snapshot remain in `work/checks/integration-queue-before*/`; the corrected
receipt is `work/checks/integration-queue-after/`. Both readers also reject
rounded decimal/exponent text before conversion, preserving the distinction
between an explicit completed marker and unreadable saved work.

The same review checked shared mana, walking/removal bookkeeping,
containment and command flush/reload. No other material cross-feature issue
was found. The tracked-file audit found no decompiled original source,
temporary probes, logs or generated source dumps. Our authored adventure
loader and its intentional read-only game-state observation are retained.

Focused Chromium evidence is retained in the individual records:
[machines](verification-time-weather.md),
[warehouse](verification-warehouse.md),
[temple](verification-temple.md),
[Soul Mixer](verification-soul-mixer.md).
Warehouse focus passes **1/1 in 106s** at `76a20d73`; all four captures
were reviewed. Soul Mixer focus passes **1/1 in 67s** at `c944e853`; all
three desktop/help/phone captures were reviewed. Both server logs are clean.
Every failed or interrupted attempt remains separate from passing results.
Complete focused Chromium rider training passes **1/1 in 540s** at exact
`54a1ad0a`: the original first-adventure success and eighth-adventure loss
callbacks, ordered reward/reset, ordinary pair admission and phone input/save.
All 15 captures and final logs were reviewed. The phone victory uses the
documented success adapter; this is not an all-eight-adventure playthrough.
The [rider record](verification-dragon-riders.md) retains every earlier
failure and the source-supported fixture corrections.

## First combined WebKit run and follow-ups

Exact clean start/end `22f5fd02bc900ba9ca674da7a591a9c79b0197c4` ran all six
new scenarios in Linux WebKit: **5/6 passed in 858.722s**, including build.

| Case | Result | Case time |
| --- | --- | --- |
| Rider training/taming | Failed: phone button retained focus after a real attack | 422s |
| Time Machine | Passed, including final recovery stacking/hit checks | 123s |
| Weather Machine | Passed | 46s |
| Unit Warehouse | Passed; final Storage portrait capture needed a readiness wait | 73s |
| Supreme temple | Passed | 160s |
| Soul Mixer unavailable state/help | Passed | 30s |

Both original rider end-screen callbacks passed before its final phone
focus assertion failed. An exact-listener probe in both engines reproduced
WebKit emitting a compatibility mousedown after the cancelled pointerdown.
The narrow fix cancels that mouse default on adventure controls; Tab,
Enter and pointer release remain intact. No gameplay, timing limit,
assertion or error check changes. Its complete repeat is recorded below.

All **36 fresh PNGs** were reviewed. The machine recovery control now
remains fully visible above the generic warning. Warehouse Storage's three
ordinary thumbnails were still loading in its final capture: the fixture
now scrolls each card normally into view and checks all three exact
original images before capture. No shared Storage behavior changed; this
stronger fixture's repeat is recorded below. Phone screenshots cover the visible
fold; they do not alone prove scrolling or off-screen controls.

The complete first output, all captures, SHA256 manifest, exact clean
receipt and server log are retained under
`work/checks/integrated-webkit-six-initial/`. The server log has no
traceback, exception, HTTP 5xx or unhandled command. The throwaway save is
`/tmp/se-e2e-7sERsL`. Memory-limit event counts increased during this run;
OOM and OOM-kill counters remained zero. No memory-success claim is inferred
from the host's larger reported RAM.

WebKit 2215 uses locally extracted Debian libraries, as recorded in the
ignored browser-dependency recipe. Only its host-package validator is
bypassed because it cannot see those extracted libraries; browser errors
and tests stay enabled. Linux WebKit does not establish Mac/iPhone GPU
behavior.

## Passing repeat and latest main

The focus fix and stronger Storage fixture are included at exact clean
start/end `db5d614dff4ba271466718c8bd5df2e40935e6e6`. Complete checks pass:

- Server: **467 run, 458 passed, nine existing PostgreSQL skips**;
  unittest 34.338s, command 34.938s.
- Client types and **447/447 tests passed**; tests 13.265896s,
  command 16.711s.

The same clean revision passes the affected WebKit scenarios **2/2 in
488.296s**: warehouse 65s, rider training/taming 419s. The unchanged focus
assertion passes after real touch attack. All three exact original Storage
images load before capture; all **15 fresh PNGs** were reviewed. The server
log has no traceback, exception, HTTP 5xx or unhandled command; the final
output has no captured rider runtime error. Receipts, selected fresh
captures and manifests are retained in
`work/checks/integrated-webkit-followup/`; save `/tmp/se-e2e-dZoW9L`.
Unit/type receipts use `integrated-*-focus-fix/`. All six new scenarios now
have passing WebKit results across the first and repeat runs, not a single
final-revision 6/6 run. Original adventure and phone-adapter coverage limits
remain unchanged.

Main's combat-controls delivery #98 (`aee3b7b2`) then arrived and is merged
without altering its runtime or fixtures. Both documentation conflict sides
are preserved, including the workstream ownership note and controls review.
It adds one browser case, so the full candidate now contains **86 cases**.
Exact clean `b6ed51757115ac0e5c09c0e0cb81f06d355217e8`, including that main,
passes all checks again:

- Server: **467 run, 458 passed, nine existing PostgreSQL skips**;
  unittest 34.075s, command 34.660s.
- Client types and **451/451 tests passed**; tests 13.541746s,
  command 17.134s.

Receipts: `work/checks/integrated-server-main98/` and
`integrated-client-main98/`. Subsequent slice-record merges change only
documentation. The full integrated **86-case Chromium** run is recorded
below, followed by the completed legacy browser follow-up. A subsequent
latest-main integration requires its own 95-case verification.

## Complete integrated Chromium run

Exact clean start/end `56d1bdbeb895b9eaed1b1a1804bea19a8a2cca78`, including
main #98, passes **86/86 cases in 8305.262s (2h 18m 25.262s)**, including a
fresh client build. The command ran from 09:57:42.862 to 12:16:08.123 UTC.
Its server/client source and browser fixtures match unit-tested
`b6ed5175`; only Markdown records changed between those revisions.

| New case | Full-run result | Case time |
| --- | --- | --- |
| Rider training/taming | Passed | 516s |
| Soul Mixer unavailable state/help | Passed | 61s |
| Supreme temple | Passed | 176s |
| Time Machine | Passed | 134s |
| Unit Warehouse | Passed | 115s |
| Weather Machine | Passed | 101s |

The complete output, all **507 fresh PNGs** (including 199 isolated
structure facings and four ordinary structure captures), SHA256 manifest,
exact clean receipt and final server log are archived in
`work/checks/integrated-chromium-full-initial/`. The retained local save is
`/tmp/se-e2e-GBZul8`. Per-image reviews use
`work/review-full-batch-*.json`; final coverage is recorded with the audit.
The final server log has no traceback, HTTP 5xx, unhandled command or
server/command exception. Memory-limit events remained 61985 before/after
this full run; OOM and OOM-kill stayed zero. The historical first WebKit
increase above remains separate. The cgroup permits two CPUs and 8 GiB;
Node 24.19.0, Python 3.13.5 and Playwright 1.56.1 are recorded in the receipt.

Static captures do not establish animation, native cursor behavior, saved
outcomes or every phone scroll position; the separate assertions cover
those actions. Existing notifications/camera crops and the classic
renderer/unmute overlays remain documented. The Golem summon still shows
its point/mana change without a recognizable body; the immediate fighter
assertion does not prove sprite readiness. One earlier tournament prize
portrait is absent but visible in later phone captures; its fixture waits
for rows, not decoded images. A world-prize capture also has blank portrait
positions without an image-ready wait; its cause remains unconfirmed.
Those capture-readiness questions remain with the coordinating stream.

## Stronger legacy Soul Mixer browser follow-up

The full run above verifies the unavailable/help window, not legacy
collection in a browser. Real command/client tests already cover known
completed work and malformed output. A test-only extension now prepares
an explicit-ready historical save, then exercises the real desktop/phone
window, claim commands, returned parents, zero spending/XP, reload/retry
and malformed-building refusal. Both focused engines pass at exact clean
start/end `a75d1e0529e59b72c4491751d1d757713dda75bf`:

| Engine | Result | Case time | Command including build |
| --- | --- | --- | --- |
| Chromium | 1/1 passed | 332s | 342.443s |
| Linux WebKit | 1/1 passed | 123s | 128.023s |

All **14 fresh PNGs** (seven per engine) were reviewed with exact hashes
and dimensions. Each complete server log has three normal starts and no
traceback, exception, HTTP 5xx, unhandled command, command or save failure.
Post-shutdown SQLite checks confirm the valid claimed marker, one output
and both parents returned once; malformed output remains unclaimed with
both parents contained. Cash and XP remain unchanged. Evidence and receipts
are in `work/checks/integrated-soul-legacy-{chromium,webkit}/`; review files
are `work/review-soul-legacy-{chromium,webkit}.json`. Local saves are
`/tmp/se-e2e-8PlcUd` and `/tmp/se-e2e-oD2lkH`. The phone claim control was
normally scrolled fully into view and clicked; stills show their captured
fold. Linux WebKit does not establish native Apple GPU behavior.

Ordinary new-work commands correctly refuse while all four genuine tables
are missing, so they cannot manufacture this historical fixture. The
optional Soul test callback flushes/closes its pages, awaits the owned
temporary server's normal exit, updates one existing player row in that
isolated SQLite database, then restarts with the same directory/port and
authentication. Actual collection still uses the normal server handlers.
The runner also awaits final shutdown before deleting temporary data;
unclean shutdown fails verification and retains the data. No production
server hook, game source or configuration changes. Fixture queues describe
saved protocol shapes, not recovered breeding combinations. Independent
source review found and corrected shutdown/image-readiness issues; static
syntax, both focused engines and fresh evidence review pass. Product
source for these follow-ups remains byte-identical to the 86-case run.

## Latest-main integration and current release checks

Menus/progression main `a0f3ab194875d5d9de7f1efedab23ed68815b618` arrived
after those runs. Reviewed merge
`2f7eb08009294c30b2030deeabd16ddfdfa91729` preserves both histories and
all menu/special-building contracts. Independent source review found no
material issue in the shared window setup, editor, town/staff/queue data,
styles, cash/goal hooks or collection integration. Special-building modules
remain byte-identical to `a75d1e05`.

Exact clean start/end `2f7eb080` passes all complete unit/type checks:

- Server: **467 run, 458 passed, nine existing PostgreSQL skips**;
  unittest 35.032s, command 35.628s.
- Client types and **479/479 tests passed**; tests 14.193763s,
  command 17.592s.

Receipts: `work/checks/integrated-server-main112/` and
`integrated-client-main112/`. The subsequent `f3c55854` changes only these
verification Markdown records; its product source and fixtures match the
unit-tested `2f7eb080` merge.

The complete **95-case Chromium attempt**, at exact clean start
`f3c55854f8c01e91412b4b8f2303eec3e60d7b0a`: **94/95 passed in 9197.418s (2h 33m 17.418s), exit 1**; only `shop-details` failed, at the phone Barracks I preview after 111s.
Exact command, start/end revision and tree state, UTC interval, exit status
and elapsed time: `env PYTHON=.venv/bin/python node e2e/run.mjs --keep`, clean start/end `f3c55854f8c01e91412b4b8f2303eec3e60d7b0a`, 2026-10-17 12:46:54.061827–15:20:11.479928 UTC, exit 1, 9197.418s including build. The six special-case
results and timings: all six passed: rider training 522s, Soul Mixer 336s, Supreme temple 177s, Time Machine 136s, Unit Warehouse 117s and Weather Machine 100s. Earlier 86/86 and
focused results keep their exact revisions and do not establish a browser
pass for this newer merge.

**Retained failure:** `shop-details` failed after **111s** at its unchanged
30-second nonblank-canvas wait (`e2e/tests/shop-details.mjs:27`). Its four
desktop captures and phone House I capture preceded the timeout, placing
it at phone Barracks I. The failure image shows readable stats and a static
Spearman thumbnail but a blank animated-preview area. Its exact cause
was **unproven in that run**; the global canvas lookup alone is not evidence that
the fixture inspected another node. The details window, shop-details
renderer, unit-preview module and fixture are byte-identical to incoming
main `a0f3ab19`. This evidence does not identify a special-building regression. The preserved snapshot is
`work/checks/integrated-chromium-main112/shop-details-failure-snapshot/`;
bounded read-only analysis is in
`work/main112-shop-details-failure-analysis.md`. Retained logs do not capture
art-loader warnings or Playwright-routed atlas responses, so they cannot
establish successful phone atlas loading/decoding.

The complete, unchanged `shop-details` follow-up, retaining both viewport
branches, every assertion and the original timeout:
**1/1 passed unchanged at the same clean `f3c55854`**, 113s for the complete desktop/phone scenario and 119.515s for the command; all 95 cases therefore have passing results across these two runs, not one 95/95 run. Exact command/revision/tree/UTC/exit/elapsed
metadata: `env PYTHON=.venv/bin/python node e2e/run.mjs shop-details --keep`, clean start/end `f3c55854f8c01e91412b4b8f2303eec3e60d7b0a`, 2026-10-17 15:21:22.884778–15:23:22.400083 UTC, exit 0, 119.515s including build. This passing repeat keeps its own receipt and does not turn the original
attempt into a single 95/95 run. It changes no product code, assertion or
timeout and does not itself establish the earlier failure's cause.

Fresh capture coverage and complete browser-run output and server-log review:
**561 full-run PNGs plus eight repeat PNGs (569 total)** were individually reviewed and matched their archived source paths and SHA256; the full 90,317-line and repeat 875-line server logs have zero recorded traceback, HTTP 5xx, unhandled-command or command-exception signatures. The full audit retains the actual failed case; the separate cross-run audit verifies the passing union without erasing that failure. Archive directory, exact source filename
and SHA256 coverage, review/audit receipts and retained save:
full archive `work/checks/integrated-chromium-main112/evidence/` contains 564 files including 561 PNGs; its `evidence-manifest.json`, `release-audit.json` and `cross-run-audit.json` retain exact hashes and results. The unchanged repeat is separately archived in `work/checks/integrated-shop-details-repeat/evidence/` (nine files including eight PNGs), with its own manifest and audit. The full review directory is `work/reviews-main112/`; repeat reviews remain separate. All 39 full review batches, 21 auxiliary contact sheets and five zero-PNG cases are accounted for. Local throwaway saves are retained at `/tmp/se-e2e-bVryzj` (full) and `/tmp/se-e2e-j9hltL` (repeat). Resource-counter start/end and event deltas:
full-run `memory.events max` 61,985→67,125 (+5,140), with OOM and OOM-kill both zero; repeat 67,125→67,125 with OOM/OOM-kill zero. Both use the recorded 2-CPU quota and 8-GiB memory limit (three CPUs visible). The full after-sample was taken at 15:20:58 UTC, after review/archive work; the retained cgroup peak predates the run, so no new run-specific peak is claimed. The interim `memory.events max` count rose
from 61985 at run start to 63146 at 14:48:08 UTC, with OOM/OOM-kill zero;
it was still 61985 at 14:39:27, after the shop failure. That later increase
does not establish the failure's cause. The earlier 86-case no-increment
result remains historical and is not reused for this run. Static capture,
phone-fold, native-adventure and Linux WebKit/Apple GPU limits above still
apply. No completed merge or deployment is claimed by these checks.

All testing uses local temporary empires. Browser art requests read the
public art bucket; no production game account or saved game is tested.

## Evidence-schema normalization

The full-run review records received alias-only schema normalization:
25 `source_commit` aliases and 120 path aliases. Existing fields, notes,
image order and all source PNG bytes/hashes were unchanged. Independent
review rehashed all 561 full PNGs and verified the aliases. The 21 auxiliary
contact sheets are review derivatives, not additional source captures.
The first schema-gap audit remains retained; final full and cross-run
receipts do not erase the original failed browser result. See
`work/main112-review-schema-normalization-review.json` and the separate
full/repeat audit records.

## Privacy/art-setting integration and retained Shop diagnostics

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
**480/480 client tests** (14.191369192s tests; 17.54s command). The final affected-browser result is recorded below.
No merge/deployment is claimed.

The `f3c55854`→`3d60b898` integration of main `f9946077` changes privacy documentation and
14 runner environment-setup lines; all other 5,425 tracked entries,
including game/config/art and case fixtures, match `f3c55854`. It does not
upgrade the older full run into a new-harness full pass. Browser art is
configured privately; no actual game/art/staging/database address or raw
private startup output is copied into these records.

The exact clean `3d60b89876762b607c9c6c581ecdb22c0d3ced14` server/client
receipts are `work/checks/integrated-server-main114/` and
`integrated-client-main114/`. The guard receipt is
`integrated-harness-no-art-main114/`. The positive configured focus ran
2026-10-17 15:29:41.387494–15:30:48.194580 UTC, exit 1, and is archived
under `integrated-shop-details-main114/` (two PNGs plus server log).
The 51s scenario timed out at the original 30-second nonblank-canvas
predicate, now on desktop Barracks I.

The unchanged fixture with a read-only diagnostic preload also failed,
2026-10-17 15:38:29.840012–15:39:38.507374 UTC, exit 1, 68.667s command
and 57s scenario. Its `integrated-shop-details-diagnostic-main114/` archive
contains two fresh PNGs, server log and redacted diagnostic log. This is
not substituted for an uninstrumented pass. The source atlas resolved to a
valid 476×448 ImageBitmap with visible pixels, while the one connected
140×100 preview canvas remained transparent. A page TypeError reading
`length` occurred during the original wait and maps to the preview's
animation-run selection. The first callback/start/elapsed timestamps were
not captured: no numeric skew or cause of the older phone failure is
claimed from this diagnostic alone. Full source and observations are
preserved in `work/main112-shop-details-diagnostic-analysis.md`.

Incoming upstream #113 independently owns the first-frame preview-clock
correction and deterministic regression, plus the owner's explicit
click/tap/keyboard Details controls and short labels. Its own recorded
89/89 and configured 5/5 results keep their upstream revisions; they are
not this combined candidate's tests. No local special-building preview fix
is claimed. The current `dc920d60a505893a1e5fcbb69d7b843be982d527`
integration retains those changes and still has 95 browser cases.
Its server 467 run (458 passed, nine existing skips), client types and
480 client tests have passed with the exact timings above; the final affected-browser result is recorded below.

## Final affected checks after main #113

Exact clean start/end `dc920d60a505893a1e5fcbb69d7b843be982d527`, including main
`f88ea31f`, passes the final affected Chromium set **9/9 in 1780.184s (29m 40.184s)**,
including build. Command: `node e2e/run.mjs shop-details units-book storage
rider-training soul-mixer temple time-machine warehouse weather-machine --keep`,
with the authorized art setting supplied privately and `PYTHON=.venv/bin/python`.
UTC interval: 2026-10-17T15:44:35.813939+00:00 to 2026-10-17T16:14:15.998406+00:00; exit 0.
Case times are runner-rounded: shop-details 216s, units-book 100s, storage 46s, rider-training 559s, soul-mixer 328s, temple 168s, time-machine 132s, warehouse 111s, weather-machine 97s.

All **74 fresh PNGs** were individually reviewed against exact source
paths and SHA256 hashes; the complete **10,029-line server log** has no
traceback, HTTP 5xx, unhandled-command or command-exception signatures.
The selected-only archive is `work/checks/integrated-main113-affected/evidence/`,
with separate manifest and six review batches in `work/reviews-main113-affected/`.
Strict `release-audit.json` reports complete scope, zero missing/changed/
excluded images, no filename/hash gaps, no parse/integrity/server findings;
its SHA256 is `656cce95420bebf2134faf7f187f464904bb7ff133f9362e1f97b5a54c7f37b5`. Before/after receipts are clean at the exact same
revision. The separate `visual-review-summary.json` also rehashes all 76
archive files, including the admission trace and server log, and verifies
that the six owner receipts cover all 74 source PNGs exactly once. Its
SHA256 is `7c6b5286a6d964ed560145875da6391e577328ccbb751492697892d8ca09d035`.

Fresh affected captures show concise Details labels contained at all eight
widths and populated desktop/phone animated previews. Six desktop New-tab
portraits and four Unit Book reload portraits are blank in individual
captures but visible in other fresh views; the cause remains unconfirmed.
Short catalogue views show mainly controls, and tall phone stats/poses may
continue below the fold. Warehouse's three final Storage portraits and
short Details labels are visible. The original-adventure, saved-state and
phone-scroll assertions remain distinct from what still images establish.
The environment/resource receipts remain separate from older runs.
Resource samples 2026-10-17T15:44:45.784058+00:00 and 2026-10-17T16:14:51.031127+00:00: memory-limit events 67,125→73,132 (+6,007); OOM 0→0, OOM-kill 0→0. The samples retain the 2-CPU quota and 8-GiB limit. The cgroup peak predates this run; no new run-specific peak or event-to-case cause is claimed.

Independent source review confirms the merge changes exactly the 17 incoming
paths; all other 5,423 tracked entries retain their prior modes/blobs.
Shop, preview, its real-renderer regression and the strengthened Shop fixture
are identical to incoming main. The CSS keeps the incoming Details rule and
all building rules. The runner preserves the Soul offline-stop/edit/restart
contract and adds only incoming error-stack reporting. Review receipt:
`work/main113-independent-source-review.json`.

This final check exercises the changed shared menus/preview paths and all six
building scenarios after the complete 95-case attempt. The earlier full run
and passing repeat keep their exact revisions; this is **not** a new full
95-case run at `dc920d60`. Incoming #113's own 89/89 and configured 5/5 stay
attributed to their upstream revisions. No test or deadline was relaxed.


No merge/deployment is claimed. Existing source/fixture limits remain:
Soul new mixing still requires four genuine original fields/tables;
legacy protocol claims are not recovered breeding content; native rider
coverage is first-adventure victory/eighth-adventure loss, with a phone
success adapter; selected Linux WebKit coverage is across runs, not one
final-head 6/6 or native Apple GPU proof. Fresh full-run visual limits
include initial Darts art absent then later loaded; blank Shop/New and
Unit Book card art with cause unconfirmed; long Details labels clipped and early
social headers before the upstream follow-up; Golem mana/point without an
identifiable full body; transient HUD/toast and panel-fold occlusion.
Current tournament/world prize portraits are loaded: the older 86-run
blank portrait observation is not carried into this newer run.
