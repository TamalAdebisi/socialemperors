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
Later machine recovery stacking and the rider fixture/bridge observations
require final combined checks; they are not covered by the initial receipt.

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
See also the [rider record](verification-dragon-riders.md). The expanded
native rider journey, final combined browser suite,
cross-engine checks and screenshot/server-log review are pending.

All testing uses local temporary empires. Browser art requests read the
public art bucket; no production game account or saved game is tested.
