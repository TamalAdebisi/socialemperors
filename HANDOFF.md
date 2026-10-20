# Handoff: where the work stands, 17 October 2026

> **Standing owner authorization: build and merge autonomously.** Agents
> should finish agreed work, test it, update the docs, and merge ready
> pull requests without asking again, including another agent's work.
> Automatic deployment on merge is authorized. See CLAUDE.md for the
> full delivery rule. Explicit feature decisions and holds still apply.

Claude built this project up to 16 October 2026; Codex picks it up from
here, and Claude may come back later. This is a snapshot for whoever
starts next. Read [AGENTS.md](AGENTS.md) (setting up, testing, delivering)
and [CLAUDE.md](CLAUDE.md) (the owner's rules) first.

The live status is kept in [ROADMAP.md](ROADMAP.md) (Phase 4),
[PARITY.md](PARITY.md) and [docs/original/](docs/original/README.md).
Update those as you go, as before. In this file, tick a task in
[the queue](#the-queue-in-order) when its pull request is merged, so the
next agent knows where to start.

## Where things stand

### Delivery receipt, 17 October 2026

[Integration #110](https://github.com/TamalAdebisi/socialemperors/pull/110)
merged normally at `064dd7bd961e554a5325906dc1c4276d1a1388ab` on 2026-10-17T16:19:23Z. GitHub reports all five
scoped PRs [#100](https://github.com/TamalAdebisi/socialemperors/pull/100),
[#101](https://github.com/TamalAdebisi/socialemperors/pull/101),
[#102](https://github.com/TamalAdebisi/socialemperors/pull/102),
[#103](https://github.com/TamalAdebisi/socialemperors/pull/103) and
[#104](https://github.com/TamalAdebisi/socialemperors/pull/104) **merged**.
The merge commit retains their histories and latest menus/control work.
No required check or merge rule was bypassed. The automatic deployment is
authorized; these local checks do not assert a production gameplay test.
New Soul Mixer recipes remain blocked by four missing original configuration fields;
window/help and safe legacy collection are delivered. Existing Beta 1,
combat and later-content holds remain. Exact checks and retained failures
follow below; status-only receipt edits change no game, art or test file.

### Current status

- **A cash box on the admin page (20 October).** The owner asked for 50
  cash (a tournament joined with too many units), then for it to be taken
  off again, then for a way to do it themselves. An empire's admin page now
  gives or takes cash on the server's own copy, so it needs no restart.
  An empire changed in the database alone, while the server runs, is
  written over by the server's copy: use the box, or restart at once. See DECISIONS.md (20 October). Test
  `e2e/tests/admin-cash.mjs` (site pages only: it needs no art).

- **Weekly tournament prizes wait for the end of the week (19 October).**
  The owner asked: the server paid each player as their own weekly room
  ended, so the week's first player took the top prize. Now the top 10 of
  the final ranking are paid at Monday 00:00 UTC (at the first town load
  or tournament request after it), and weekly rooms end with their week.
  Prizes already paid stay paid and aren't paid again. The owner also had
  a Vulcano Dragon sent to every other account's gift inbox. See
  DECISIONS.md (19 October) and `docs/original/rules/tournaments.md`.

- **Owner requests of 19 October, in three slices:** (1) the God Isles
  with a colossus: the Rodas and Genesis Wind colossi, which the data
  doesn't tag "colossus", now count in the team (DECISIONS.md). Test
  `e2e/tests/god-colossus.mjs`. (2) The Monster Nest: a new one opened
  closed and asked 100,000 gold or 50 cash; new empires and never-used
  nests now start it on (save version 0.08a; DECISIONS.md). Test
  `e2e/tests/monster-nest.mjs`. (3) The Soul Mixer rebuilt from the
  wiki's content follows, its own pull request.

- **Owner requests, 19 October 2026, on this machine's side:** (1) a
  rock growing back on land the player has bought no longer blocks
  building: a building put over it clears it, and the bulldozer takes it.
  (2) Battles pick units more finely: a double click takes every unit of
  that kind, the bar groups kinds, Shift-drag boxes, Shift and a number
  keep groups. Both are in DECISIONS.md and CLIENT.md (#117). The Soul
  Mixer from the wiki (slice 3 above) is the owner's call overruling the
  "original data only" rule further down. The wiki blocks automated
  reading; its old copies are on the Internet Archive, which the cloud
  environment's network settings must allow (`web.archive.org`).

- **The repository no longer names the live game (17 October).** It
  stays public (GitHub won't make a public fork private), so its docs use
  "the live site" or `example.com`; don't write the real addresses back
  (CLAUDE.md, "Never"). The browser tests now take the art bucket's
  address from `SE_E2E_LIVE_ASSETS`. If it isn't set and there's no
  `art/sheets/`, `e2e/run.mjs` stops at once and says so: ask the owner
  to add it to the environment (AGENTS.md, Setting up).

- **Special-building delivery in [#110](https://github.com/TamalAdebisi/socialemperors/pull/110):** latest main `f88ea31f`
  (#113, including privacy/art-setting #114) is integrated at clean
  `dc920d60`. Client types and **480/480 tests** pass; server **467 run,
  458 passed, nine existing PostgreSQL skips**. Final affected Chromium
  passes **9/9 in 1780.184s (29m 40.184s)**, including all six building scenarios,
  Shop Details, Storage and the units book. All 74 fresh captures and
  the 10,029-line server log were reviewed and hash-checked. The earlier
  full attempt remains **94/95**, followed by unchanged Shop **1/1** at
  `f3c55854`; all 95 pass across those runs, not one final-head 95/95.
  Earlier preview failures and their incoming menus fix remain recorded in
  [the integration record](docs/verification-special-buildings.md).
  New Soul mixing still requires four genuine original configuration fields. Merge
  `064dd7bd` completed normally; all standing owner holds remain.

- **Shop/Storage details follow-up in
  [#113](https://github.com/TamalAdebisi/socialemperors/pull/113):** details
  open only by click, tap or keyboard activation at every width. Buttons
  say Details, with full item names kept for accessibility. Eight widths
  from 320 to 1280 pixels check text containment and actual opening/closing.
  The resize checks also exposed a first-frame preview clock crash; clamp
  negative elapsed time to zero, retaining the original animation order.
  Full Chromium passed **89/89 in 2h 3m 48.08s** at `e333f8c9`.
  Main #114 was integrated at `5e080221`; game/library/case files stayed
  identical. The merged art-setting runner passed **5/5 in 6m 37.80s**;
  its missing-setting guard returns the expected exit 2 before a browser.
  After integration, types, all 437 client tests and server 449 run
  (440 passed, nine existing skips) passed. All 527 full-run and 26
  integration captures were reviewed; complete server logs are clean. See
  [the verification record](docs/verification-click-details.md) for runner
  checks, screenshots, logs and retained initial failures. Other chats'
  combat/click controls and special buildings retain their ownership.
- **Menus/progression delivered in
  [#99](https://github.com/TamalAdebisi/socialemperors/pull/99) and
  [#105–109](https://github.com/TamalAdebisi/socialemperors/pull/109):**
  collections, the units book, darts, repeatable social buildings, shop details,
  profiles and the missing-hall notice are merged through `a6f24580`. Menu cash
  payments count once toward their mission. Main #98's combat controls are
  retained; kill-drop triggers remain combat-owned. Other special-building work
  and all standing holds remain with their owners.
- **Initial menus delivery verification:** server 449 run (440 passed, nine existing PostgreSQL
  skips), client types and all 436 tests passed. Full Chromium **88/89 in 1h 59m
  26.250s** on `76b1663f`; `villagers` tried to select its worker behind the new
  expected missing-hall warning. Test-only `6fcf0646` clicks OK before
  continuing and passes **1/1 in 1m 24.643s**, retaining every queue/glow/save
  assertion. All 89 have passing results across runs, not a single final-head
  89/89 run. All 516 full-run PNGs and both final captures were reviewed;
  browser server logs are clean. At that delivery's closure, the merged
  game/art/tests matched `6fcf0646`; only verification documentation
  differed. [The delivery
  record](docs/verification-menus.md) retains exact revisions, every initial
  failure and visual limits. The owner’s manual Beta 1 run-through remains on
  hold.

- **Current workstreams, 17 October:** the coordinating chat owns combat,
  Medusa availability research and integration. Separate owner-started chats
  own special buildings (Soul Mixer, warehouse, machines, dragon training,
  temple) and menus/progression (collections, units book, darts, social
  buildings, shop and profiles). Coordinate collection kill drops across
  those streams. Existing feature holds remain.
- **Combat controls in [#98](https://github.com/TamalAdebisi/socialemperors/pull/98):**
  Bull Gladiator's click margin now excludes transparent export padding in
  town and battle. Original sword cursor is shared by battle modes, with
  selection, movement and aiming updates. Server 449 run (440 passed,
  nine existing skips), client types and all 408 tests passed. Full Chromium
  attempted all 80: 70 passed, ten failed; final isolated follow-ups passed
  **10/10 in 15m 19.58s**. All 80 have passing results across runs, not one
  final-head 80/80 run. Linux WebKit controls passed **1/1 in 89s**.
  All full/focused captures and server logs were reviewed. Exact revisions,
  retained failures and coverage limits are in
  [the controls record](docs/verification-combat-controls.md).
- **Special-building integration:** the five scoped branches/PRs are
  combined on `codex/special-building-verification` for their full local
  release checks. After final queue-parsing, machine recovery stacking
  and ordered rider-claim corrections plus the legacy output-type guard,
  latest main #98 is included. Exact `b6ed5175` passes 467 server tests
  (458 passed, nine existing skips), client types and all 451 client tests.
  The complete rider Chromium focus
  passes 1/1 in 540s. Initial combined WebKit passes 5/6; a narrow adventure
  touch-focus fix and a stronger Storage-picture capture pass their combined
  repeat 2/2 in 488.296s at `db5d614d`, with all 15 fresh captures reviewed.
  All six new cases have passing WebKit results across runs. The full
  earlier 86-case Chromium run passed at exact `56d1bdbe` in 8305.262s;
  all 507 captures and the 78,774-line server log were reviewed. The later
  `a75d1e05` legacy Soul fixture passed focused Chromium/WebKit separately.
  The complete `f3c55854` 94/95 attempt and unchanged 1/1 `shop-details`
  repeat are recorded separately in
  [the integration record](docs/verification-special-buildings.md#latest-main-integration-and-current-release-checks).
  The earlier full pass does not verify this newer merge or erase its
  111s phone-preview failure. Soul Mixer remains blocked on all four
  genuine original fields/tables; the delivery receipt above records the merge.

- **Time/weather machines delivered in #100 through #110:** implemented in `ui/machines.ts` and
  `rules/machines.ts`, with original art and local-source notes in
  `docs/original/rules/machines.md`. Earlier focused checks below retain their own revisions; the combined
  verification and actual merged delivery are recorded above. Initial unit/type and
  focused server checks passed. Exact `4a81d5ae` passed both desktop/phone
  browser cases (136s time, 99s weather); all ten captures were reviewed.
  The later recovery-warning stacking fix passes in combined WebKit at
  `22f5fd02` (123s time, 46s weather); all ten fresh captures were reviewed.
  [The slice record](docs/verification-time-weather.md) retains the initial
  camp-notice failure and each exact revision.
  Machine goal 220 already has the ordinary build hook, so there is no
  progression-runtime edit and the unfinished-goal count stays unchanged.
  The narrow server fix advances sent PvP attacks/reset with time travel;
  generic training queues also advance their positive start timestamp,
  preserving completed zero markers. Other existing calendar behavior is
  preserved; Soul Mixer content remains gated by genuine original data.

- **Supreme temple special-building slice:** implemented on
  `codex/supreme-temple`; delivered in #102 through #110. Original rules and complete
  entry/window/step/helper reading are in `docs/original/rules/temple.md`.
  The ordinary 48-hour wait is preserved: its cash skip is admin-only in
  the original. Initial checks passed all 410 client tests and types; temple
  server replay passed 7/7. Exact clean `9bfa2581` passes the focused
  Chromium desktop/phone screen/save check 1/1 in 199 seconds. All ten
  fresh screenshots were reviewed and the server log is clean.
  `docs/verification-temple.md` records exact scope, archive and limits.
  Combined verification and actual merged delivery are recorded above.

- **Dragon riders and taming delivered in #103 through #110:** native picker,
  recovery/shortcut, free rider claim and compatible-pair taming. The
  original action adventures remain unchanged in their shipped asset,
  loaded only on demand with the pinned Ruffle runtime and our own bridge.
  See CLIENT.md and `docs/original/rules/dragon-riders.md`; touch keys and
  config-output spelling repair are recorded in DECISIONS.md. The early
  36-second adapter smoke did not prove physics: a later real-input check
  caught an unsupported bitmap operation in Ruffle's legacy renderer.
  The bitmap-capable renderer now proves actual movement. Complete focused
  Chromium passed 1/1 in 540 seconds at `54a1ad0a`: real first-adventure win
  and eighth-adventure loss through their original buttons, recovery/claim,
  ordinary pair admission and phone input/save. All 15 fresh captures and
  final logs were reviewed. The phone victory uses the success adapter;
  no complete eight-adventure playthrough is claimed. Shared integration
  at `f3529ef2` passed types, all 447 client tests and 467 server tests
  (458 passed, nine existing skips). First combined Linux WebKit passed
  five of six cases; rider native callbacks passed, but its phone control
  retained DOM focus after the touch attack. An exact-listener two-engine
  probe proved WebKit's compatibility mousedown bypasses the cancelled
  pointerdown. A scoped mousedown cancellation preserves focus and native
  Tab/Enter defaults; the complete rider repeat passed in 419s at
  `db5d614d`, including phone focus/input/save, with all 11 fresh captures
  reviewed. The complete combined attempt and final affected follow-up are recorded above.
  [The verification record](docs/verification-dragon-riders.md) preserves
  every failed/interrupted attempt and the measured new-fixture calibration.

- **Soul Mixer support has an original-data blocker.** Local 1.4.07 research
  recovered its window, generic rules and queue commands; 0926 predates it.
  Archived/historical config and preservation upstream have no
  `breeding_order`, `sm_training_time`, `SOUL_MIXER_POWERUPS_LEVELS` or
  `SOUL_MIXER_MIN_LEVEL`. Its original-art window/help are built, but new
  mixing safely stays unavailable; all entry and cash spending are blocked.
  Known completed legacy work can be collected without spending, never by
  treating an unknown or malformed timestamp as finished.
  Recover genuine later config to enable it; never infer those tables
  from unit strength or community guesses. [Research and coverage](docs/original/rules/soul-mixer.md).
  Exact `c944e853` passed server 459 (450 passed, nine existing skips), types,
  client 420/420 and focused Chromium 1/1 (67s). All three desktop/help/phone
  captures and the clean server log were reviewed. A later saved-integer
  parser correction prevents underflow/fractional text from rounding into
  completed work, and legacy outputs must resolve to actual units. Types,
  18 focused client tests and 12 real server tests pass after these guards.
  Root integration verifies the combined change separately.
  [Verification and limitation](docs/verification-soul-mixer.md).

- **Unit Warehouse delivered in #101 through #110:** its window, walking admission,
  deployment, bought room and storage/reset follow the original rules.
  Initial client types and 412 client tests passed; the warehouse/time
  server suite passed 8/8. Focused Chromium passes 1/1 in 106 seconds at
  `76a20d73`, including phone saving and reload. All four captures and the
  clean server log were reviewed. [The verification record](docs/verification-warehouse.md)
  retains the earlier failures and the final admission trace; integrated
  delivery checks and merge are complete in #110.

- **Structure idle repair in [#96](https://github.com/TamalAdebisi/socialemperors/pull/96):**
  completed buildings retain their idle state, nested motion stays animated,
  and outlines follow the current picture, including walking units. Seven
  fully blank loop endings are removed. Safari keeps worker loading and
  decodes empty bitmaps again, plus one atlas with reproduced partial
  corruption. The second decode must have visible pixels. Broad page-decoding and rendering workarounds
  caused scene regressions and are withdrawn; original mipmaps remain.
  The gallery checks that recovery preserves every sampled ground pixel.
  One incomplete legacy animation holds its original first pose; only its
  two required image pages load, avoiding 100 pages / 4.255 GiB decoded.
  Click duration uses native input timestamps so slow handlers do not lose
  short clicks. Main #95's separate Shift selection is preserved.
  All 1,010 configured entries were inventoried: 900 readable art files
  cover 941 entries; 69 unavailable names are listed in
  [the audit](docs/structure-idle-audit.md). No new public art is required.
- **#96 verification:** server 449 run (440 passed,
  nine existing skips), client types and all 404 tests passed. Complete
  combined Chromium: 77/79 in 2h 22m 31.78s; final collection, unchanged siege
  and one-atlas alpha/ground checks passed 3/3 in 255.75s. All 79 cases have
  passing results across runs, not one final-head 79/79 run. WebKit's full
  structure gallery passes all 98 files / 199 facings with exact reference
  images. The seven-case run was 6/7; a reproduced test visibility bug caused
  its tournament polling errors. After correcting the fixtures, WebKit
  tournament/controls passed 2/2 in 289.41s, and Chromium controls passed 1/1
  in 68.31s. All seven selected WebKit cases have passing results across runs.
  Game runtime remains `862d9893`; final fixture commit is `ab8c3d60`.
  [The delivery record](docs/verification-96.md) retains every failed run,
  exact revisions, screenshot review, the earlier construction timing limit
  and the Linux WebKit/Mac GPU distinction. No error or test was disabled.
  Full Chromium review covers all 461 fresh PNGs; final gallery comparisons
  and every later fresh capture were reviewed. Final server logs are clean
  and memory-limit/OOM counters did not increase.

- **Getting in touch:** `SE_DISCORD_URL` (DEPLOY.md) puts a Discord link
  on the pages around the game, the classic bar, the new client's Menu and
  by the invite code. It is off until the owner sets it on Railway, with
  `SE_INVITE_CODE`, to keep new sign-ups to people they invite. No in-game
  chat for now (DECISIONS.md). Test: `e2e/tests/contact.mjs`.
- **Playthrough follow-up in [#95](https://github.com/TamalAdebisi/socialemperors/pull/95):**
  recurring low-level raids and recovery, ten-minute camps with a countdown,
  shared battle inspection/Deselect, and Everybody without friend requests.
  Main #94 is integrated, retaining its controls and site fixes. Decisions
  are recorded in DECISIONS.md. Server: 436 run (427 passed, 9 existing skips);
  client types and 357 tests passed after review. Complete integrated Chromium: **73/73
  in 1h 23m 18.88s** on `10507be4`. WebKit: **4/4 in 2m 37.96s**. Test-only
  rendering/save waits at `4f049001` and a central click target at `20ba5058`
  follow the full run. Card passed in Chromium (111s); final selection passed
  in Chromium (50.22s total) and WebKit (21.77s total). Review corrections at
  `ad9adfd7` have fresh server/client passes, affected Chromium **8/8 in
  7m 2.97s**, and WebKit **3/3 in 1m 31.96s**. Automated re-review found zero
  new issues. The full-suite result remains attributed to `10507be4`.
  [The delivery record](docs/verification-95.md)
  retains the initial 71/71 run, WebKit failures and their corrections,
  screenshot/log review and the Linux WebKit/Mac GPU distinction.

- **Owner playthrough controls in [#94](https://github.com/TamalAdebisi/socialemperors/pull/94):**
  Friends forms keep their CSS/images after nested POSTs; unit targets
  have an eight-pixel margin and a 44-pixel minimum, with original art
  sizes. Ground clicks flash the original gold ring. Hidden tabs keep
  simulation running, while explicit Pause remains available. No
  auto-collect: the owner withdrew it. Building previews snapshot their
  loading origin and clear stale hover state, keeping pictures aligned
  and footprints visible.
- **#94 verification:** server 435 run (426 passed, 9 existing skips),
  types and 354 client tests passed. Full Chromium: **67/71 in 1h 52m
  56.27s**. Follow-ups resolve summon/flight/delivery/repair timing checks;
  all 71 cases have passing results across the full and focused runs.
  No runtime changes follow the tested `01ddd0cd` game code. WebKit:
  **4/4 in 3m 50.48s** for buildings, controls, hover and Friends/Menu.
  [The complete record](docs/verification-94.md) preserves every failure,
  test-only adjustment and screenshot review. The two shared preview
  bugs are fixed; the exact wide ground streak reported on Safari/Mac
  was not reproduced. Linux WebKit does not reproduce a Mac's GPU, so
  do not claim a separate terrain-rendering repair.

- **Owner playthrough follow-up completed in [#93](https://github.com/TamalAdebisi/socialemperors/pull/93):**
  the tutorial is mandatory, with smooth camera pans, explicit destinations,
  soldier-only combat guidance and saved progress/rewards. Show me restores
  interrupted actions; replacement villager training returns to the unfinished
  task without resetting its chapter or count. Classic choices are hidden;
  their routes and shared saves remain. Keep this visibility decision when
  integrating tournament work. #87's building card and Menu/logout are retained.
- **Tutorial verification:** server 435 run (426 passed, 9 existing skips),
  client types and 350 tests passed. All 69 browser tests passed in **64m
  32.58s**, on game code `20a87d8d`, including #87. The subsequent main merge
  changes documentation only. Final recovery/review corrections at `6754695a`
  passed desktop, phone, recovery and tournaments **4/4 in 8m 15.30s**.
  These include resize guidance, own-unit selection, villager-specific
  training recovery and keeping a nest already in Gifts. A later test-only
  assertion tightening at `8638394b` passed all 14 tutorial server tests.
  The other 65 browser tests use completed-tutorial fixtures; tournament
  label styling is confined to that window. Screenshots and server logs were
  inspected; no HTTP 5xx, Python tracebacks or unhandled commands. Refreshed
  ordinary public art was used: team passed in 34 seconds, and memory-limit/OOM
  counters did not increase. The formal art audit is completed in #91.
  Automated review findings were addressed or explained in the PR and
  DECISIONS.md; the original trusted-client command contract is retained.

- **All tournament stages and required verification are complete in
  [#92](https://github.com/TamalAdebisi/socialemperors/pull/92).** Exact
  `f798788b6529388f918098989b8f4997eab553c8`, including main #97,
  passed **78/78 browser cases in 92m 33.33s**. Server **449 run:
  440 passed, 9 existing skips**, types and **393 client tests passed**.
  All five tournament cases, spells, team and scripted bosses passed;
  the server log is clean and all 260 fresh archived screenshots were reviewed.
  All 22 review threads are resolved; independent source reviews found no
  new issue. Automated re-review was unavailable because of Cubic's quota
  and Qodo's paused trial. The [delivery record](docs/verification-92.md)
  retains the earlier failures and their limits, including the historical
  quest reload follow-up. No tournament slice remains. Shop details are
  now delivered in #108; task 6 remains on hold. PR #92 holds release metadata; these checks
  do not themselves claim merge or deployment. Classic choices stay hidden,
  with routes and shared saves supported.
- **Tasks 1–5 are complete:** #86 delivered the timing fixes;
  #87 delivered the building card, upgrades and site Menu, with both
  agents' work and the later #89 tournament merge preserved. #108 delivered
  task 4, the shop details; its research below is retained. Task 6 remains
  on hold. **The nine-bundle art follow-up is closed in #91:** all images
  match in both request modes, and `team` passes alone and in the full
  suite. Its pre-#93 full run was **66/67**; the historical tutorial
  observation and final integration checks are recorded under task 1.
- **Verification for #87:** 429 server tests (420 passed, 9 existing
  skips), client types and all 348 unit tests passed. The integrated
  browser suite ran all 67 tests: 67 passed, 0 failed. Details and the
  separate art follow-up are below.
- **The live game** has been on Supabase since 15
  October 2026, as a fresh start. It deploys by itself when `main` changes.
  Code work uses local servers and needs no live database access. The
  separate art repair below has verified the public files and the final
  integration through #93. No owner-operated art step remains.
- **Phase 4, the new client** (the plan is in CLAUDE.md, "Order of work"):
  - **Beta 1, the town builder:** built. A side-by-side check against the
    Flash game found gaps (PARITY.md); nearly all are fixed. Left: the
    owner's held run-through that closes the beta. Shop details are now
    delivered in #108. The building card and the site's Menu are complete in #87 (tasks 2, 3 and 5).
  - **Beta 2, battles and quests:** built: combat, every island, spells,
    special moves, defending the town, camps, bosses, graveyards. Left: the
    special units' rarer moves, a short list of battle rules (PARITY.md,
    "Still to do"), and the owner playing it.
  - **The switch:** attacking players, the world map, spying, survival,
    Arthur's lessons, the nests and all tournament stages are built;
    tournaments passed all required checks, with
    the quest reload follow-up recorded below. Left: the long tail of
    windows and the later decision about retiring the classic client.
- **How far, in numbers** ([docs/original/](docs/original/README.md)): of
  the Flash client's 829 classes that hold the game's own behaviour, about
  53% are built in the new client, 40% partly (mostly special buildings
  and units, whose plain fighting works but not all their own moves) and
  7% not yet (mostly windows). 47 of the 227 goals still need unfinished
  feature windows (CLIENT.md, "Missions and bonuses"); that number falls
  as features land.

## How the work has been done

Keep doing it this way: it's what the owner agreed to, and what the docs
and tests assume.

1. **Look it up first.** Find the feature in `docs/original/`: the index
   (`index/windows.md`, `index/delegates.md` and the rest) names the Flash
   classes, and the rule books (`rules/town.md`, `rules/progress.md`,
   `rules/neighbours.md`, `no-button.md`) give the rules, with what the new
   client already does. Then read those classes in `decompiled/`.
2. **Check the server.** Most features already have their server side
   (`command.py` and a module per part: `tournaments.py`, `darts.py`,
   `warehouse.py`...), with tests in `tests/` that replay what the Flash
   client sends. The new client sends the same commands. Change the server
   only when it's missing something, with a test.
3. **Build in layers:** the rules in `client/src/rules/` (no drawing,
   unit-tested next to them, `*.test.ts`), drawing in `client/src/view/`,
   windows in HTML in `client/src/ui/`, the commands in
   `client/src/net/commands.ts`, and `client/src/editor.ts` tying them
   together. Read a neighbouring feature first and copy its shape: the
   market (`rules/market.ts`, `ui/market.ts`) is a small, recent example;
   survival (`rules/survival.ts`, `ui/survival.ts`, `survivalPlay.ts`) a
   big one.
4. **The game's own art and words.** Windows use the game's pictures,
   drawn by `tools/art/export_ui.py` into `client/src/ui/art/` (add a line
   to its list, run it, commit the pictures), and the game's own texts.
   Windows open in the panel on the right (on a phone, a sheet over the
   dock), as every window does now: CLIENT.md, "The menus: rail and dock".
5. **A browser test per feature** in `e2e/tests/`, checking the screen and
   the server's save. Look at the screenshots.
6. **Docs in the same pull request:** CLIENT.md gets a section on the
   feature (how it works, its files, its test), ROADMAP.md and PARITY.md
   their ticks, `docs/original/` its status lines, DECISIONS.md its calls.
7. **Two agents at once** worked well: one on the town builder, one on
   battles and the switch, each merging `main` back in whenever the other's
   pull request went in. Conflicts were nearly always in the docs; keep both
   sides.

## The queue, in order

**Immediate delivery task completed: [#87](https://github.com/TamalAdebisi/socialemperors/pull/87).**
Merged main into the existing branch without rebasing or rewriting either
agent's history. Conflicts retain #86's waits, the standing instructions,
#87's card/upgrade/Menu and shop research, #90's art investigation and
#89's tournament slice. The final integrated code is
`d760f3a318571b07ccbae8d51004efa0b0bf98f4`, including main `36b2f277`;
only the delivery documentation follows that verification commit.

- Server: **429 run, 420 passed, 9 existing skips**, **34.33 seconds**.
- Client: type check and **348/348 passed**, **14.10 seconds**.
- Browser: **all 67 run**, **67 passed, 0 failed**, **80m 30.65s**
  including the build. The repaired checks and new feature checks ran
  first, then the other 60 alphabetically; [the full record](docs/verification-87.md)
  lists their order and individual timings.
- Desktop and phone screenshots and the local server log were inspected.
  The server log has no HTTP 5xx responses or Python tracebacks. All
  accounts and game writes were on throwaway local servers; only public
  art was read remotely.

The earlier complete 66-test run at `b412f28a` took **75m 14.75s**:
63 passed; `siege`, `sound` and `walk` failed. Siege now waits for its
minute on the game clock (30-second limit). Sound and walking use a
visible destination above the card; walking waits for arrival (15-second
limit per destination) before its unchanged saved-position checks. The
combined branch verifies all three repairs. No assertion was removed or
weakened. #86's market and survival waits remain unchanged and pass.

Verification also fixed the phone card covering pointer tools, touch
pointer-leave dismissing the upgrade price before the second tap,
tutorial progress crossing the card, and late read responses restoring
a login cookie after logout. The reported scripted battle timeout was
124 of 150 quiet frames after 30 seconds, with nobody attacking; closing
already-checked independent towns frees drawing time while retaining its
original deadline and every assertion. The separate art issue was not a
claimed fix in #87; #91 closes it under task 1 with refreshed-cache checks.

**Future concurrent checks:** use separate machines or cloud
environments and separate checkouts of the same integrated commit. Each
chat records its commit, command, results, screenshots and failures. One
coordinator owns changes and the final merge. Run browser checks one at
a time on the shared 2-CPU, 8-GiB machine; separate chats or worktrees do
not add RAM.
The runner also overwrites `e2e/out/server.log`, so never share a checkout
between simultaneous runs.

| Check | Browser test names for `PYTHON=.venv/bin/python node e2e/run.mjs` |
| --- | --- |
| Building card, upgrades and building actions | `card edit storage train construction friends-help cash bubble looks` |
| Site Menu and desktop/phone controls | `site-menu menus dock keys pointers phone-place` |
| The two repaired timing checks | `survival market` |

These focused checks help locate failures; the complete suite still
needs coverage on the final code. Server tests and the client's type/unit
checks can run alongside browser checks. Task 4 (shop details) can now
build on the delivered card. Task 7's implementation is in #92; its
pre-#95 75/75 pass and later interrupted runs are recorded, alongside
the merged 77/78 result after #97 in
[the delivery record](docs/verification-92.md). All tournament checks
passed; the sole quest failure did not recur in ordinary repeats. Its
save/read diagnostic and separate follow-up remain recorded.

Sizes as in PARITY.md: **S** a few hours, **M** about a day, **L** more.
Items marked *owner* wait on a decision from the owner (next section):
ask, then build.

### 1. Mend the two flaky browser tests (S) - [x]

Completed in **[#86](https://github.com/TamalAdebisi/socialemperors/pull/86)**.
The owner requested merging on 16 October with the separate `team`
failure below documented for follow-up.

- **`e2e/tests/survival.mjs`** waits for three seconds on the displayed
  game clock, with a 30-second limit. Drawing without a graphics card can
  make game time lag behind real time; the existing save check still
  requires at least three seconds.
- **`e2e/tests/market.mjs`** waits for earlier messages to finish before
  triggering either warning. Goal rewards share a queue of three
  messages; a full queue drops new messages. Each wait has a 30-second
  limit. All existing warning, trade and save checks stay in place.

**Verified on 16 October:** both tests pass on their own and in the full
suite. The server ran 427 tests (418 passed, 9 existing skips); the
client's type check and all 324 tests passed. Screenshots were inspected.
The full browser run took **64 minutes 51 seconds**, including the build:
**63 of 64 passed**, with `team` the only failure. AGENTS.md records the
machine and timing.

**Separate art follow-up: closed in #91 on 16 October 2026.**
For #86, `team` timed out at `e2e/tests/team.mjs:38` while the selected
army loaded. It failed on its own too, in a fresh browser, reaching this
machine's 8 GiB memory limit.
The public `art/2075_elemental_red_god.json` then named **76 sheets**:
about **3.8 GiB** of decoded RGBA pixels, or **5.1 GiB** with mipmaps,
before other graphics copies. This is separate from the two wait fixes;
neither changes the team test, game code or art.

**Rechecked on 16 October from main `002fcbeb`:** the ordinary public URL
still served 76 pages at scale 1, last modified before the current packer
was added. All 76 page manifests total 4,074,714,156 decoded RGBA bytes.
An unchanged local export of the original SWF made two pages at scale
0.25, step 2, about 124 MiB decoded, preserving animation lengths, bounds,
origin and frame rate. **That one-item repair is insufficient:** a guarded
browser run with it stopped before the team picker (`team.mjs:18`). The
island loads eight more stale bundles, each with 5–20 pages, totalling
another 3.88 GiB decoded. The current packer selects two or three pages
for each. Full local source exports confirmed **20 pages, about 988 MiB
decoded across all nine**, with every item within its existing four-page
budget. The unchanged `team` test then **passed in 36 seconds**, with
screenshots and server log inspected: peak anonymous/shared/kernel memory
3.49 GiB (4.70 GiB including file cache), no memory-limit or OOM events.
Each repaired manifest/image was requested once. Server tests ran 427
(418 passed, 9 existing skips); client types, build and all 324 tests
passed. No exporter, loader, gameplay or test change was needed. The
browser helper's disk cache has no expiry, so a fresh browser alone will
not refresh any of these bundles. This local replacement pass does not
replace the recorded 63/64 public-art result or close its follow-up.

**Published under subsequent owner authorization on 16 October:** Codex
ran [Export art to R2, run 38885093455](https://github.com/TamalAdebisi/socialemperors/actions/runs/38885093455)
on main `2918c71f`, with all nine names and **Make every sheet again**
off. All requested exports and uploads succeeded. The public manifests
now reference 20 pages; fresh published images fetched with a cache-busting
query verify at **987.84 MiB decoded**, with animation lengths, bounds,
origins and frame rates preserved.

**The CDN was initially inconsistent:** all 20 ordinary WebP URLs served
old cached images alongside new JSON. The owner subsequently confirmed
purging exactly [these 20 URLs](docs/team-art-cache-purge.txt) in the
Cloudflare dashboard. No further export, bucket deletion or purge was
performed. On **16 October, 11:24:20–11:24:40 UTC**, each ordinary image
was compared with its `?repair=38885093455` version both without Origin
and with the live site's `Origin`. **All 40 comparisons passed:**
SHA-256 bytes and actual WebP dimensions agree, dimensions match the JSON,
and all files match the verified fresh export. Plain ordinary requests
were `HIT` (Age 369–400 seconds); Origin ordinary requests were `MISS`
(Age absent). Every Last-Modified was the new 16 October upload.
[The per-response audit](docs/team-art-cdn-verification-2026-10-16.json)
records hashes, dimensions, CF-Cache-Status, Age and Last-Modified for
both addresses in both modes. No stale URLs remain to recheck after the
owner's 17 October 10:45 UTC expiry fallback.

**Public-art verification before #87 merged, in the requested order:** at 11:25:07 UTC,
all 40 active cache files for these nine items were moved aside; there
was no local `art/sheets/`. On `efcb4d242760d273f20ab0c36d20052cbd17a7f1`
(runtime identical to main `36b2f277`, including #89), `team` fetched the
ordinary live files and **passed 1/1 in 48 seconds** (53.7 seconds with
build/startup). All 40 cache hashes match and each file was requested
once. Screenshots show the original artwork and the server log has no
HTTP errors or exceptions. Peak anonymous/shared/kernel memory was
**3.55 GiB** (5.75 GiB including file cache); no memory-limit/OOM events
occurred. The full browser suite then ran **11:26:30–12:44:15 UTC**:
**61/65 passed in 77m 45s**, including `team` (41 seconds), `market`,
`survival` and `tournaments`. Peak anonymous/shared/kernel memory was
**3.74 GiB** (7.35 GiB including file cache); no memory-limit/OOM events
occurred. All **176 screenshots** were reviewed, the server log has no
HTTP errors or exceptions, and all 40 repaired cache hashes still match.
Server checks also passed: **428 run, 419 passed, 9 existing skips**;
client types, build and **333 unit tests passed**.

The four full-suite failures are `construction` (line 46, nine-second
interaction deadline), `scripted-bosses` (line 120, fight-completion
wait), `siege` (line 32, building targets) and `walk` (line 33, saved
position). #89 independently reproduced all four test names on unchanged
main `2918c71f`. This run's boss timeout came from line 65, an earlier
battle than #89's recorded portal case. A separate isolated check on
unchanged `2918c71f` at **12:44–12:51 UTC** reproduced that later case
(line 88 → 120): **0/1 passed**, 6m 56s with build/startup, **2.16 GiB**
peak anonymous/shared/kernel memory (6.05 GiB with file cache), no memory
limit/OOM events. None of its 706 art requests used the nine repaired
items. Captured state showed the fight still active after all enemy
units were marked dead; artwork and server log were checked. This older run was not all green. #87 subsequently fixed this and the
other three waits without weakening their assertions; its work is
preserved unchanged. No owner-operated step remains for the art repair.

The earlier cache-busted-files `team` pass (41 seconds, 3.44 GiB peak)
and the stopped full run are historical evidence, not the final ordered
verification. Other checkouts must refresh these nine items in
`.tools/art-cache/art/` and avoid local `art/sheets/` overrides before
classifying a recurrence. Keep stale-cache failures distinct from new
#87 or tournament regressions. See [the repair notes](docs/art-loading-repair.md)
for commands, timing and memory methodology. No source art, game code
or test assertion was changed by this repair.

**#87 integration:** #87 merged as main `6c2fa146` at 12:51 UTC while
this record was being finalized. Its own 67/67 run retained a stale
76-page red-god cache: `team` passed in 121 seconds at 8.00 GiB with
886,334 memory-limit events (no OOM), so it did not verify the fresh art.
That evidence remains in [its delivery record](docs/verification-87.md).
This branch preserves all #87 work. On main `6c2fa146` integrated at
`4f2f969a` (documentation-only `a2cfe59a` at full-run start), the cache
was refreshed again at **12:58:41 UTC**. `team` passed **1/1 in 52s**
(57.2s with build/startup), with all 40 ordinary live files fetched once
and hash-verified. Screenshots and server log passed review. Peak
anonymous/shared/kernel memory was **3.56 GiB** (7.52 GiB with file
cache), with no memory-limit/OOM events. The full suite ran
**13:00:41–14:20:30 UTC**: **66/67 passed in 79m 48.48s**, including
`team` in **42 seconds**. All four pre-#87 failing checks passed, as did
market, survival and tournaments. Peak anonymous/shared/kernel memory
was **3.76 GiB** (4,039,917,568 bytes), or **7.75 GiB** including file
cache, from a 4.26-GiB baseline. No memory-limit/OOM events occurred and
the guard did not fire. All **188 screenshots** and the clean server log
were reviewed; all 40 repaired cache hashes still match. Server checks:
**429 run, 420 passed, 9 existing skips**, 67.8 seconds including startup;
client types and all **348 tests passed**, 25.4 seconds together.
The earlier 61/65 and baseline results above remain historical checks.

**Separate pre-#93 tutorial observation:** `lessons` failed after
22 seconds at line 30, called from line 49, with **the arrow points
somewhere (step 3)**. At the test's Train-button call the game had already
advanced to step 3; the screenshot shows the villager still training,
with artwork loaded. The runtime/test match main `6c2fa146` and are
unchanged by this repair. At **14:21:16–14:24:22 UTC**, the unchanged
focused test **passed 1/1 in 179s** (3m 6.45s with startup/build), with
**1.00 GiB** peak anonymous/shared/kernel memory (5.23 GiB including
file cache), no memory events, and all three screenshots/clean server
log reviewed. None of its **104 art requests** used the repaired items.
The exact intermittent cause was not established. #93 merged while the
full run used the older code and subsequently replaces this tutorial
flow; this is not a claimed #93 failure. Do not confuse it with the
closed memory failure or call the 66/67 run all green. No game rule or
test assertion was changed by the art repair.

**Final #93 integration and closure:** latest main `73998ffc` was merged
at `3bd0c7dfc9e3296612ea8d094a215aee475eea7d`; this branch differs only
in documentation. #93's separately recorded **69/69 full run** used
refreshed ordinary art, followed by its **4/4** checks for the final
tutorial corrections. Those results are attributed above; they are not
another full run performed in this art-repair checkout.

After moving all 40 files aside again at **14:27:51 UTC**, with no local
`art/sheets/`, `team` **passed 1/1 in 66s** (72.2s with build/startup),
**14:28:57–14:30:10 UTC**. Every repaired file was fetched once and
hash-verified. Its three screenshots and clean server log were reviewed.
Peak anonymous/shared/kernel memory was **3.68 GiB**, or **7.99 GiB**
including accumulated file cache from a 4.55-GiB baseline. No memory-limit
or OOM event occurred; the guard did not fire.

The desktop/phone tutorial, recovery and tournaments then **passed 4/4
in 10m 28.77s**, **14:30:36–14:41:05 UTC** (190s, 239s, 96s and 97s).
All **20 screenshots** and the clean server log were reviewed. Peak
anonymous/shared/kernel memory was **1.30 GiB** (5.62 GiB including file
cache); no memory events occurred. All 40 repaired hashes still match.
Server checks for that art verification: **435 run, 426 passed,
9 existing skips**, 34.6s with startup; client types and **350 tests passed**, 13.1s together.
These **5/5 focused checks** verify the documentation merge alongside
#93's full-suite record. **The art follow-up is closed. No further
export, bucket operation, purge or owner-operated step remains.**

### 2. Beta 1: Upgrade on the building card (M) - [x]

Completed in [#87](https://github.com/TamalAdebisi/socialemperors/pull/87)
with tasks 3 and 5 (CLIENT.md, "The building card"). Verification and
repairs are recorded above; the reported scripted battle timeout is
resolved with completed test towns closed before the next scenario.

PARITY.md, "The building card", and `docs/original/rules/town.md`,
"Upgrading". 104 buildings upgrade to the next one (houses, farms, mills,
ranches, towers, walls, barracks, the town hall). It needs the next one's
level and costs its full price; the old one gives back 1/20 of its price
(nothing if it cost cash); the new one gives its experience and stands in
scaffolding like any new building. The Flash client sends `sell` (reason
`"UPGR"`) and then `buy` on the same spot; the server already handles both.
Town Hall II to IV can only be had this way, so three goals open up with
it. The Upgrade button uses the original card's action pictures, with
the price shown on hover or the first phone tap (DECISIONS.md).

### 3. Beta 1: what the building card shows (S each) - [x]

Completed in #87 (see task 2): the owner picked mockup A, the original's info panel.


PARITY.md, "What it shows": the picture with its health, its numbers
(attack, speed, range, the room a house gives), what the next collect
brings with a time bar, how full it is, the units inside (tap one to let
it out), what a barracks trains, and a tip per kind of building. **The
card's look was the owner's pick:** they chose mockup A, the original's
info panel. It is verified and delivered in #87.

### 4. Beta 1: the shop's details (M) - [x]

Completed in [#108](https://github.com/TamalAdebisi/socialemperors/pull/108),
with the combined verification recorded above. Original per-kind facts,
explicit click/tap/keyboard details, category art, New/limited badges and
training animation are built. The owner's 17 October follow-up makes
Details explicit at every width: hover and focus leave it closed. Buttons
show the short Details label with the item name retained for screen readers.
The historical research below remains; early cash unlocking stays disabled.
Beta 1's run-through remains on hold.

PARITY.md, "Windows and messages", Shop: what each thing gives or houses
(a unit's numbers), on hover or tap; the tabs' own pictures; "new" badges.
The same line asks for a confirmation before opening a building early for
cash, but the map of the original found later that opening early is
switched off in the original, and ours was removed: check, and reword the
line rather than build it.

What the original shows (read by Claude on 16 October; the class is
`GUI/InfoButtonOver`, its layouts `InfoButtonStore*MC` in the game's file):
a white speech bubble over the item, one layout per kind.

- **A unit:** its name, life, attack, attack delay, speed, range, room.
- **A house:** its line (`INFOPOPUP_HOUSE`), "Earns" its room for people,
  "Timer".
- **Mills, farms, mines:** `INFOPOPUP_VILLAGERS`, "Earns" what it collects
  with the resource's picture, "Capacity" (workers), "Timer" (its working
  time). The sacrifice altar and the treasure mine have a line of their
  own instead.
- **Ranches:** `INFOPOPUP_ANIMALS_FOOD`, the same numbers with animals.
- **The bakery and the like:** `INFOPOPUP_RESOURCES`, Earns and Timer.
- **Barracks, archery, stables, workshop, church:** `INFOPOPUP_TRAIN`, the
  unit they train, with its name and numbers; a few have an extra line
  (`STORE_EDIFICIO_*`).
- **The castle:** `INFOPOPUP_DEFENSIVE`, its own numbers, then the unit it
  trains.
- **Towers, walls, gates, the dragon killer:** `INFOPOPUP_DEFENSIVE`, life,
  attack, delay and range; the ice, water, oil towers and the fortress have
  an extra line.
- **Decorations:** Earns their experience.
- **The market:** `INFOPOPUP_TRADE` and its lot (100, 200, 300).
- **The blacksmith and the university:** their line and "10%" with a
  green arrow.
- **Eagles:** `INFOPOPUP_EAGLES` and their life (200, 400, 800, 10000).
- **Healing buildings:** their line and their attack.
- **Refuges:** Capacity.
- **Wonders:** with room, the wonder line filled with 175 and its room;
  without, `INFOPOPUP_MARAVILLA_RECURSOS` with Earns and Timer.
- **Feature buildings and heroes' buildings:** one line each (`STORE_EDIFICIO_*`
  by id).

Where to start in our code:
- The words' ids are in `Language.as`: look up `INFOPOPUP_*` and
  `STORE_EDIFICIO_*`. Read them through main's `line(id, fallback)`.
- `client/src/rules/card.ts` already has the building card's facts by
  kind: the new code can sit beside it.
- The building card's numbers' pictures (`stat-*` in `ui/icons.ts`) and
  the barracks bubble (`train-bubble`) are exported already.
- A phone has no hover: give it a tap, and say so in DECISIONS.md.

### 5. Beta 1: the site's bar (S) - [x]

Completed in #87 (see task 2): the owner left the place to us; a Menu after
Full screen (DECISIONS.md, "the site's links in the new client").


The new client's Menu now provides Empires, Friends and Log out, as on
the classic page. Friends carries its waiting count and opens a new tab;
logout uses the site's form. The owner delegated their placement.

### 6. Beta 1: the run-through, and closing the beta (M) - [ ]

**On hold at the owner's request.** Resume when they ask; the standing
merge authorization does not change this hold.

`e2e/tests/classic.mjs` already opens an empire played in the new client
in the classic game. Go through PARITY.md's Beta 1 part once more against
the original, play a town from the start in both clients on this computer
(never on the live site), fix what differs, then tick Beta 1 in ROADMAP.md
and tell the owner it's ready to play. They test by playing, at that
point, not before.

### 7. The switch: tournaments in the new client (L, in slices) - [x]

**Implementation and required verification complete in [#92](https://github.com/TamalAdebisi/socialemperors/pull/92).**
The completion mark records all five implemented parts and their final
checks. See the PR for release metadata; merge and automatic deployment
are not claimed by this handoff's test results.
The owner expanded the task to finish all remaining tournament parts.
The separate `codex/tournament-complete` checkout implements waiting rooms,
entry/fees, copied-army battles and recovery, results/rankings/prizes, and
friends' creation/invitation/cancellation. See [CLIENT.md](CLIENT.md#tournaments)
and the expanded original rule notes. It preserves the original commands,
keeps the original routes and shared saves while preserving #93's hidden
classic choices. It includes the other chats' delivered #87 and #93 work;
the other chat completed the separate public-art audit in #91.

**Final required verification: 78/78.** Exact clean tested
`f798788b6529388f918098989b8f4997eab553c8` includes unchanged latest main
`8f8c57ab`; #96 remained draft at `f9ed9060`. Server **449 run: 440 passed,
9 existing PostgreSQL skips** (29.763578436s wrapper, 29.297s unittest),
types (2.120334289s) and client **393/393** (7.087552535s) passed.
The full Chromium suite passed **78/78 in 92m 33.33s**: every tournament
case, shared spells, team (36s), scripted bosses (144s) and world (115s).
The archive has 260 fresh screenshots in 73 image folders, with no stale
files. All 260 were reviewed and matched by path/hash, with no coverage
gaps; the complete server log has zero tracebacks, HTTP 5xx or unhandled
commands. Concrete screenshot findings and limits are recorded in the
[delivery record](docs/verification-92.md), alongside all earlier runs.
All 22 review threads are resolved and independent source reviews found
no new issue. Cubic's exhausted quota returned NEUTRAL without re-review;
Qodo's trial was paused. No fresh automated pass or required-check bypass
is claimed. This final documentation update leaves runtime, tests and
artwork identical to f798; PR #92 will identify the delivery commit.

**Historical correction focus at `60eba9ff`: 3/3.** Exact
`60eba9ffc910a06b2375aa0afe54c1c641510ac0` passed rooms (224s), results
(151s) and lists (122s) in **502.937054269s**, or **8m 22.94s**.
Runtime matches 97; only the rooms test and documentation changed.
All 31 archived images were reviewed with no visible defects: seven rooms,
13 results and 11 lists. The server log
has no tracebacks, HTTP 5xx or unhandled commands. All 22 review threads
had been addressed and resolved. At that time, main was `8f8c57ab` and
#96 remained draft at `0185b420`. The then-pending full checks completed
at f798 above; the automated re-review limitation is also recorded there.

**Earlier correction focus at `97fb6e79`: 1/3.** Exact
`97fb6e79a437e287b69a55a950629cc6ffe8f7e2` completed rooms/results/list
in **171.295583827s**. Rooms failed in 18s at the new old-refresh assertion;
its leftover public seat caused the results room-id failure in 35s.
Lists passed in 108s, including different-type/team concurrent-entry
reconciliation. Diagnostic tracing reproduced the fixture failure in
19s (25.559556115s total): completing an older expired one-use route
handler made Playwright continue the newer held response. The runtime
ignored the old generation and correctly completed the new reply.
Temporary tracing was removed. The test-only repair keeps each named
handler until its own release, retaining assertions and deadlines.
Its corrected old-runtime negative rerun detected the original reopen
bug again (47s scenario, 53.6751s total); the 60 candidate focus and final
f798 full checks passed. [The delivery record](docs/verification-92.md) keeps both failures
and the distinct diagnostic evidence.

**Completed correction focus at `95e098f3`:** Done captures the displayed
room id, with atomic stale-id cleanup protection and legacy omitted-id compatibility.
Profiles check their window/room/request and invalidate stale replies;
weekly and reward top-level records reject arrays. The new browser
regressions cover stale Done after a newer room finishes and three delayed real
profile replies. Exact clean/pushed
`95e098f386b2feaea7d911de03e2ad2556ef025e` passed the focused
rooms/results/list run **3/3 in 7m 50.29s**. All 30 focus screenshots
were reviewed with no visible defects. The stale-Done fixture refreshes
the desktop immediately before phone acknowledgement to reset its
ordinary minute clock; no runtime interval or assertion changed.
Server **449 run: 440 passed, 9 existing skips** (30.4079s), types
(1.8429s) and client **390/390** (7.2047s) passed.

The full attempt stopped intentionally at **00:32:21 UTC on 17 October**
after five passes and no observed failure: Menu, contact, recurring raids,
weekly tournaments and rooms. `tournaments` was incomplete; 35 fresh
partial-run screenshots in six folders were archived separately from the
focus. Review covered 27 images from completed cases with no visible
defects; eight incomplete-list images are not counted as reviewed
evidence. The server log has no tracebacks, HTTP 5xx or unhandled commands.
Further review found incomplete room/player validation and a pending refresh
blocking reopen after close. The candidate validates nested room, player,
match, ranking, weekly and reward data while preserving supported wire
formats; its nine focused network tests and types passed. The window
invalidates a closed refresh's busy state and ignores late completion.
The later 60 focus and final f798 full suite verify these corrections.
Source-supported healer retargeting, external Leave and recovery of the
actual current enrollment after an ambiguous entry remain unchanged.
PARITY's historical list already marks built features. No dedicated
tournament goal exists among the shipped missions. Finished results
remain until Done or the server's existing 30-day retention expires.

**Completed pre-review verification after #97: 77/78.** Main
`8f8c57abe132c5b0ff805159e276e668403fb5ef` was merged at
`36f618710ba9b4efceb9bd81b70d22bb5867fc09`. Preserve its contact links
and Menu stacking, alongside #95's recurring raids, shared inspection
and Everybody. The now-redundant countdown-hiding rule is removed; the
real hit-target regression covers all four configured Menu destinations.
Exact clean, pushed `47db7f4446e957ab8d65ef8892799649abedf9a6` ran
all 78 cases: **77 passed, one failed in 90m 46.59s**. All five tournament
checks, shared spells and team passed. Server **448 run: 439 passed,
9 existing skips** (30.81s), types (1.97s) and client **388/388** (7.49s)
passed. Menu/contact/raid focus passed **3/3 in 3m 30.75s** first.
The archive has 256 screenshots in 73 populated folders; 79 images were
reviewed, separate from the 14 integration-focus and four quest-focus
images reviewed afterward. The complete local
server log has no tracebacks, HTTP 5xx or unhandled commands.

The sole failure is `scripted-bosses`: the immediate mummy-gem reload
expected two and found three. Ordinary unchanged main passed 1/1
(148s scenario, 153.1088s total), followed by two passing natural traces.
Ordinary tested code at 47 also passed 1/1 (147s scenario, 152.2461s
total), with runtime/art/tests unchanged and only docs dirty. The first
baseline attempt was interrupted by an execution-service disconnect,
with no completed-case result. The exact failure has not been naturally
reproduced. Fourteen relevant source/test blobs are identical; traces show
an aborted request can still reach the server before a retry. A corrected
gate held all attempts until the reload read old progress and forced the
assertion on unchanged main. Late commands reached the server, unlike
the full-run failure. This establishes an existing save/read weakness,
not a natural reproduction or the exact full-run cause. Do not infer
lost saving from abort alone or report 78/78. No tournament regression
was identified in that quest investigation. Documentation commit
`e9765901d3bde23dc7764f2b50b629dd87d914b0` changed eight Markdown files
only, leaving runtime, art and tests identical to exact tested `47db7f44`.
That identity ends there; the later review corrections require new checks.

**Separate quest follow-up:** investigate the intermittent immediate-reload
save/read boundary. Capture the accepted tap, request/retry delivery,
reload snapshot and final saved gem/activator state before choosing a
repair. Keep the existing immediate-reload assertion and original quest
rules. No runtime quest fix or diagnostic gate is shipped in #92.

**Interrupted pre-#97 checks:** exact `cc218b7e9c046d83d915d5bd43a5048168356450`
passed server **442 run: 433 passed, 9 existing skips** (31.05s), types
(2.31s) and client **388/388** (8.06s). Menu/recurring-raids focus passed
**2/2 in 1m 35.91s**, but the subsequent full attempt stopped after
**19 passes and one real recurring-raids failure**, with classic incomplete.
All five tournament checks passed. The archive has 101 screenshots in
20 populated folders, 68 reviewed; the pre-interruption server log has
no tracebacks, HTTP 5xx or unhandled commands. The runner's 77 precreated
directories are not evidence of 77 completed cases.

An exact saved-map replay reproduces the trapped raid on unchanged main
`a3328da6`: the fixture's packed resources enclose the spawn. Moving one
stone through the normal command opens an exit, retaining all 24 stone
and 24 gold resources. The fixture now pins its first scheduled wave to
that edge and checks the saved move; later waves stay random. All
movement/recovery/reward assertions and the 15-second deadline remain.
This test-only correction passed focus and the full-run raid case at 47.
The
[delivery record](docs/verification-92.md) preserves the replay evidence,
Menu/dialog regressions and fixes, all partial timings and visual limits.

**Completed pre-#95 verification:** exact code
`5d220abfa562877ca346b205455f9554e15d497e`, including #94, passed
**75/75 in 92m 46.83s**. Server **440 run: 431 passed, 9 existing skips**
(32.22s); types passed (1.94s), client **385/385** (7.53s). The prior
battle/background-controls check passed **2/2 in 5m 14.79s**. All 243
screenshots across 75 scenario folders were archived. The full local log
has no Python tracebacks, HTTP 5xx replies or unhandled commands; owners
reviewed 47 tournament/spell and 14 building/control/Menu captures.
[The delivery record](docs/verification-92.md) retains all 75 timings and
visual limits. This run preceded #95 and does not verify its integration.

**Completed pre-#94 verification:** exact code
`67d2e02a563d6a2e4f06376cd5af960a1238fd23` passed **73/73 in 92m 32.50s**,
including all five tournament checks and spells. Server **440 run: 431
passed, 9 existing skips** (29.66s); types passed (1.87s), client **381/381**
(7.18s). All 231 screenshots were archived; the full local server log has
no Python tracebacks, HTTP 5xx replies or unhandled commands. Owners
reviewed all 47 tournament/spell screenshots and 11 card/dock/Menu images.
The review fixes preserve weekly saved-team eligibility, original score
ordering and attempted-healing LIMIT, as explained in DECISIONS.md.

Two earlier fixture failures remain recorded: the stopped `d3c8d64d`
full attempt lacked funds for its separate welcome room; `a1f06b48` then
passed 2/3 focused checks because that room occupied a shared public seat.
Normal funding and leave/refund cleanup kept every return/fee assertion.
The `77c31ed0` follow-up passed **3/3 in 5m 19.56s**; after waiting for
team art before capture, `67d2e02a` passed results **1/1 in 2m 42.26s**
before its full run. [The delivery record](docs/verification-92.md) retains
these exact outcomes and every full-run timing.

**Pre-review integrated verification:** exact tested code
`49b5685e368efd6efeecdc348a2202a710715b2f` includes main `73998ffc`
and its #93 tutorial, with #87's building card and Menu preserved. The
server ran **440 tests: 431 passed, 9 existing skips** (31.48s); client
types passed (2.33s), followed by **373/373 rule tests** (7.43s). The full
browser suite passed **73/73 in 93m 28.38s**, including all five tournament
checks and shared spells. Checks used local throwaway accounts and
read-only public art; no production game state was changed. Main
`d4bc1a72` brought #91's completed art-repair documentation, merged at
`8dccab0d` without runtime, test or source-art changes from the tested
code. Subsequent review fixes are outside that identity claim. See
[the delivery record](docs/verification-92.md) for this run's timings,
screenshot and log review, and the latest-main result and quest investigation.

**Pre-#93 integration checks:** at
`47471ff44126cad5707a601365beb904d70d23ad`, the server ran **434 tests:
425 passed, 9 existing skips**; client types and **371 tests passed**.
The complete browser run took **91m 52.03s**: **70 of 71 passed**,
including all five tournament checks; `team` passed in **42 seconds**.
Only `keys` failed, at its movement assertion after a fixed 400ms wait.
This historical result preceded #93. The unchanged keyboard check also
failed twice in three repeated runs on main `6c2fa146`, after an initial
pass. It now waits for the intended camera movement, with a 30-second
bound, retaining the click and saved-rotation assertions and adding
no-zoom/no-vertical-movement checks. Three focused repeats passed in 38s,
41s and 39s. The saved tournament return through #93's mandatory tutorial
also passed its focused check in 109s. The pre-review 73-test run above
includes both fixes and all of #93's tutorial work.

**First slice completed in [#89](https://github.com/TamalAdebisi/socialemperors/pull/89):** the list, first-time help and saved team
editor, with desktop/phone coverage. At that first slice, entry and all
later stages retained explicit classic links.
The owner's later playthrough request hides those classic choices;
#92 preserves that decision while completing the remaining stages.
`docs/original/rules/tournaments.md` records the local source reading,
including the different complex-unit checks in editing and weekly entry.
The subsequent implementation follows the same `tournaments.py` command
and service formats. This work does not own #87 or the art repair.

**First-slice verification, 16 October:** the full browser run at
`ff7000597777d1b9437870cc7dce99a9e62440c0` took **76 minutes 41 seconds**:
**61 of 65 passed**, including `tournaments`, `menus` and `team`.
`construction` exceeded its nine-second interaction deadline;
`scripted-bosses` timed out waiting for the last portal battle to end;
`siege` did not see every engine target a building after its fixed wait;
`walk` did not see the knight saved at the second destination after its
fixed wait. All four failed at the same assertions in a separate,
unchanged-main checkout at `2918c71f58b53783aa3c8dbfff79faa3709df561`
(8 minutes 3 seconds). They are existing failures, not tournament
regressions; no assertions or time limits were weakened.

Main's #90 art notes were merged at
`844035fecf70a91dc9bde435a1bda465e705fbf3`; game, art and test files are
identical to `ff700059` (only documentation differs). At that integrated
commit, the server ran **428 tests: 419 passed, 9 existing skips**; client
types and **333 tests passed**. Final focused browser checks at that
commit passed **2/2** (`tournaments`, `menus`) in **4m 14s**.
Desktop/phone screenshots and local server logs were inspected.
The `team` pass in this run did not close #90's separate public-art
repair; #91 records that verification separately (task 1 above). Browser checks used local throwaway accounts;
an uncommitted environment proxy preload allowed uncached public art to
load. No production game accounts or live writes were used. #87 subsequently
repaired all four timing failures and verified the combined code in the
67-test run recorded above.

The last box in ROADMAP.md's switch list. The server side is done
(`tournaments.py`, with tests; ROADMAP.md, Phase 2, says how it works:
public rooms of four filled by bots after 30 minutes, the weekly
tournament against three bots, friends' tournaments, prizes). The Battle
window's Tournament row opens the integrated panel (`client/src/ui/world.ts`).
The Flash windows are listed in
`docs/original/index/windows.md` under `popups/tournament/` (about twenty
classes). Scope covered by #89 and the complete #92 follow-up:

1. The tournament list (everyday, weekly, your own), its help and the team box — built.
2. The waiting room: four seats, the countdown, bots filling in — built.
3. The match: a battle against the other player's army, as the attack on a
   player is played now (`attackPlay.ts`); no units are lost — built.
4. Results, the ranking and prizes — built.
5. Friends' tournaments: create, invite, call off — built.

All five parts are implemented and their baseline checks passed at
`47db7f44`. The `95e098f3` correction focus passed 3/3; its full attempt
was interrupted for further fixes. The later 97 focus was 1/3 because of
the test-fixture problem described above; the repair passed all three
focused cases at 60. Final required checks passed 78/78 at f798. The
separate quest reload follow-up remains recorded above.
No further tournament slice remains. At that delivery, the next queued
work was task 4, the shop details, now delivered in #108. Task 6 remains
on hold.

### 8. The switch: the long tail of windows (S to M each) - [ ]

The windows still "not yet" in `docs/original/index/windows.md`, nearly
all with their server side done. One slice each, or a few small ones
together:

- [x] Collections completed in #99: Army → Collections, goal 54, saved
      pieces, exchanges/cash, Storage and desktop/phone reloads. Harvest
      drops update live counts; combat still owns kill-drop triggers.
- [x] Units book completed in #105: original configured categories,
      recognition, missing-unit purchases, previews and saved rewards.
- [x] The unit warehouse (`warehouse.py`, `rules/warehouse.ts`, `ui/warehouse.ts`): admission, paging, deployment, capacity and storage/reset; desktop/phone save coverage. Delivery verification is recorded with the special-building work.
- [ ] Soul Mixer: window/generic queue support built; playable mixing
      waits for missing original content described above.
- [x] The time machine (`time_machine.py`) and its help page; special-building slice implemented, delivery verification tracked above.
- [x] The weather machine: the island's looks (`unlock_skin`, `set_skin`); same slice.
- [x] Darts completed in #106: original schedule, seeded board,
      free-day/paid rules and saved prizes. The shipped final pool is
      inactive; no replacement rotation is invented.
- [x] Repeatable social buildings completed in #107: Summit, both
      markets, recruitment, population wonder and Round Table. Real local
      help, original empire-keyed invitations, rewards, clocks and goals
      104/115 are verified. Ordinary buildings keep automatic opening.
- [x] Dragon riders, their training and taming dragons: merged in #103 through #110.
- [x] The Supreme Bahamut temple (`temple.py`): merged in #102 through #110.
- [x] Profiles completed in #109: own/neighbour/world public fields,
      original honour badges/ranks, retry and late-reply protection.
- [x] Missing-hall notice completed in #109: acknowledge the original
      warning without replacing a hall or changing the save. New menu
      spending credits its mission once. Assault handling stays combat-owned.
- [ ] Offer packs and mystery boxes are for cash. Cash is earned by
      playing here and nothing is sold (ROADMAP.md, "Cash"): check
      `economy.py`, `shop.py` and DECISIONS.md, and ask the owner before
      showing these at all.

As each lands, its goals stop saying "Coming soon": update the count in
CLIENT.md.

### 9. Beta 2's leftovers (S to M each) - [ ]

- [ ] The special units' rarer parts: moves as they die, timed summons that
      switch sides, effects on each tile walked, growing. Listed per unit
      in `client/src/rules/specials.json`, under "beats".
- [ ] PARITY.md, "Beta 2", "Still to do": who is an enemy on some islands
      (check in the Flash game before copying: the read-through wasn't
      sure); the team of 20 taking units from buildings, the warehouse and
      storage; the Protection Dome and the Tower Enhancer; squads re-forming
      and archers stepping back; collection pieces from kills and the Blue
      Phoenix's egg; and the small timing differences listed there.
- [ ] Then the side-by-side check of battles, and the owner plays Beta 2.

### 10. The switch itself (*owner*) - [ ]

The owner's playthrough follow-up makes Play open the new client and hides
classic choices now. This is a temporary interface change: keep the classic
routes and shared saves. Full retirement of that client remains a later
owner decision once the outstanding feature work is complete.

### Later, not now

- Phase 3 leftovers in ROADMAP.md: lost animals found on the map
  (`register_found_item.php`, which shared them on Facebook), the effects'
  and battle sounds' pipeline, a content editor.
- The known gap: the server believes the experience and battle gold the
  game reports (ROADMAP.md, "Cash"). Checking battles on the server comes
  after the switch.
- AI-upscaled art for big screens: an open question in CLIENT.md
  ("Making the art look better"), and the owner's.

## Waiting on the owner

Ask these in plain words, with pictures where it's about looks (CLAUDE.md
allows pictures when there's a decision), and carry on with something else
meanwhile.

- Offer packs and mystery boxes: in or out (task 8).
- Full retirement of the classic client (task 10); hiding its choices is
  already authorized.
- AI-upscaled art: still open.

Already decided, don't reopen: the menus as a rail and dock (CLIENT.md);
the building card's mockup A and the agent-chosen Menu placement (both
completed in #87);
the continents counting up from 1, so the world map's first-time help is
left out; the Daily News window left out; the welcome-back chest kept in
both clients; the troll town and the market in Beta 1; a fresh start on
Supabase. The smaller calls are in DECISIONS.md.

## Who does what outside the code

You (the agent) need only this repository. The owner, or Claude when it's
back, handles:

- **Railway:** the live server and staging. Merging into `main` deploys
  the live game by itself.
- **Supabase:** the database and sign-in.
- **Cloudflare R2:** the art bucket, filled by two GitHub Actions the owner
  starts by hand (*Upload assets to R2*, *Export art to R2*).
- **GitHub Secrets**, the domain, and the admin list (`SE_ADMINS`).

If a task needs one of these, stop and say what's needed and why.

## Learned the hard way

- **Both clients play the same empire.** A rule we get wrong changes the
  save, not just the look, and the Flash client then sees it. Check the
  save in the browser tests, not only the screen.
- **Read the whole original, not only the window.** Beta 1 got rules wrong
  because each feature read only the classes next to its own window; rules
  that live elsewhere, or run with no button, were missed. That's why
  `docs/original/` exists: look a feature up there, including
  `no-button.md`.
- **What looks like a feature may be switched off** in the original:
  skipping a goal for cash, opening buildings early, the welcome-back chest
  (switched back on in ours, the owner's call). Check that a window is
  actually opened by something before building it (the index says).
- **Slow drawing in tests:** Chromium here has no graphics card, so game
  clocks run behind the wall clock. Wait for what you expect to see.
- **Windows that open by themselves** (level ups, "New Mission!", gifts
  waiting) can cover what a test wants to press. The tests go on past a
  level-up window as a player would; copy how they do it.
- **Phones:** the dock layout takes over at 720 pixels wide or narrower,
  or on a
  screen held upright up to 1000 wide. Test new windows at a phone's size
  too (`newPlayer(..., { phone: true })`); things have overlapped the
  tools there before.
- **Python:** installing the packages into the system's Python fails on
  some computers (Debian's own `blinker`), which is why setup uses `.venv`.
- **Merges with `main`:** expect conflicts in DECISIONS.md, ROADMAP.md,
  CLIENT.md and PARITY.md when someone else's work went in first. Keep both
  sides; DECISIONS.md is newest first.
