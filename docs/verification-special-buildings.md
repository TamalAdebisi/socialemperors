# Special-building integration verification

17 October 2026. This delivery combines the five independently scoped
building branches, retaining each branch's history and pull request:
[machines #100](https://github.com/TamalAdebisi/socialemperors/pull/100),
[warehouse #101](https://github.com/TamalAdebisi/socialemperors/pull/101),
[Supreme temple #102](https://github.com/TamalAdebisi/socialemperors/pull/102),
[dragon riders #103](https://github.com/TamalAdebisi/socialemperors/pull/103)
and [Soul Mixer #104](https://github.com/TamalAdebisi/socialemperors/pull/104).
The integration branch contains their shared editor and save contracts.
It is the release candidate for the full required local checks; this
record does not yet claim a merge, deployment or complete browser pass.

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
documentation. The full integrated **86-case Chromium** run, its fresh
screenshot/log review and delivery remain pending.

All testing uses local temporary empires. Browser art requests read the
public art bucket; no production game account or saved game is tested.
