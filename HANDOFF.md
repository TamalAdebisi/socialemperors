# Handoff: where the work stands, 16 October 2026

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
  counters did not increase. The formal art audit remains tracked in #91.
  Automated review findings were addressed or explained in the PR and
  DECISIONS.md; the original trusted-client command contract is retained.

- **All tournament stages are implemented in #92**, following #89's
  lists, help and team box: rooms, copied-army battles, results/prizes and
  friends' tournaments. Final integration verification is in progress
  after merging #87 and #93. Classic choices stay hidden; the existing
  routes and shared saves remain supported.
- **Tasks 1, 2, 3 and 5 are complete:** #86 delivered the timing fixes;
  #87 delivered the building card, upgrades and site Menu, with both
  agents' work and the later #89 tournament merge preserved. Next is
  task 4, the shop details; its research below is retained. Task 6 remains
  on hold. The separate nine-bundle art follow-up remains open for
  public-art verification after the owner's export.
- **Verification for #87:** 429 server tests (420 passed, 9 existing
  skips), client types and all 348 unit tests passed. The integrated
  browser suite ran all 67 tests: 67 passed, 0 failed. Details and the
  separate art follow-up are below.
- **The live game,** socialemperors.me, has been on Supabase since 15
  October 2026, as a fresh start. It deploys by itself when `main` changes.
  Code work uses local servers and needs no live database access. The
  separate art repair below still needs post-export verification.
- **Phase 4, the new client** (the plan is in CLAUDE.md, "Order of work"):
  - **Beta 1, the town builder:** built. A side-by-side check against the
    Flash game found gaps (PARITY.md); nearly all are fixed. Left: the
    shop's details and the run-through that closes the beta. The building
    card and the site's Menu are complete in #87 (tasks 2, 3 and 5).
  - **Beta 2, battles and quests:** built: combat, every island, spells,
    special moves, defending the town, camps, bosses, graveyards. Left: the
    special units' rarer moves, a short list of battle rules (PARITY.md,
    "Still to do"), and the owner playing it.
  - **The switch:** attacking players, the world map, spying, survival,
    Arthur's lessons and the nests are built. All tournament stages are
    implemented, with #92's final checks pending. Left: the long tail of
    windows and the later decision about retiring the classic client.
- **How far, in numbers** ([docs/original/](docs/original/README.md)): of
  the Flash client's 829 classes that hold the game's own behaviour, about
  50% are built in the new client, 40% partly (mostly special buildings
  and units, whose plain fighting works but not all their own moves) and
  10% not yet (mostly windows). 50 of the 227 goals still need unfinished
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
original deadline and every assertion. The separate art issue remains a
follow-up under task 1, not a claimed fix in #87.

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
build on the delivered card; task 7's complete implementation is in #92,
with final verification after integrating #93 still pending.

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

**Separate follow-up: verify the nine repaired public bundles.**
For #86, `team` timed out at `e2e/tests/team.mjs:38` while the selected
army loaded. It failed on its own too, in a fresh browser, reaching this
machine's 8 GiB memory limit.
At that check, public `art/2075_elemental_red_god.json` named **76 sheets**:
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

**Delivery recheck, 16 October at 12:07 UTC:** the owner-operated
[Export art to R2 run](https://github.com/TamalAdebisi/socialemperors/actions/runs/38885093455)
completed successfully at 10:41 UTC. Ordinary public manifest GETs now
show all nine at the expected two or three pages (20 total). The main
bundle now has two pages, scale 0.25, step 2, SHA-256
`c458f0dfdf33870dbf49f04f33891024e1fab14c061bf57c9dda8ae799fad28c`.
This checkout's cache still holds its old 76-page manifest; the other
eight cached manifests match the new public files. The cache was not
changed during #87's verification. In the final integrated run, `team`
passed in **121 seconds**. Its sampled cgroup peak was **8.00 GiB**, with
**886,334 memory-limit events**, **0 OOM events** and **0 OOM kills**.
This does not close
the art follow-up: consistent images and a refreshed-cache `team`/full
suite remain to be verified. #87 did not operate the workflow or bucket.

The targeted export uses **Export art to R2** on **main**, with **Make these
again** set to **all nine names** in
[the art repair notes](docs/art-loading-repair.md), and **Make every sheet
again** left off. The earlier `2075_elemental_red_god`-only proposal does
not cover the island's other oversized art. The notes contain the exact
repair, evidence, local verification and post-export checks. Wait for a
consistent new manifest and images at their ordinary public URLs (cache
lifetime up to a day), clear only those items' old files from
`.tools/art-cache/art/`, and check for local `art/sheets/` overrides. Then
rerun `team` and the full suite on the integrated main and inspect the
screenshots. Until that public-art verification is recorded, this remains
the known failure; do not mark it fixed or call it a new #87/tournament
regression merely because it recurs. No live workflow or bucket was
changed by #87 verification, and no assertion was skipped or weakened.

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

### 4. Beta 1: the shop's details (M) - [ ]

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

### 7. The switch: tournaments in the new client (L, in slices) - [ ]

**Complete follow-up implemented in draft [#92](https://github.com/TamalAdebisi/socialemperors/pull/92), verification in progress.**
The owner expanded the task to finish all remaining tournament parts.
The separate `codex/tournament-complete` checkout implements waiting rooms,
entry/fees, copied-army battles and recovery, results/rankings/prizes, and
friends' creation/invitation/cancellation. See [CLIENT.md](CLIENT.md#tournaments)
and the expanded original rule notes. It preserves the original commands,
keeps the original routes and shared saves while preserving #93's hidden
classic choices. It includes the other chat's delivered #87 and #93 work;
#91 still owns the public-art audit. Final exact-commit check results and
merge status will replace this pending note before delivery.

**Pre-#93 integration checks:** at
`47471ff44126cad5707a601365beb904d70d23ad`, the server ran **434 tests:
425 passed, 9 existing skips**; client types and **371 tests passed**.
The complete browser run took **91m 52.03s**: **70 of 71 passed**,
including all five tournament checks; `team` passed in **42 seconds**.
Only `keys` failed, at its movement assertion after a fixed 400ms wait.
This is the result before #93, not final verification of the new merge.
#93 then landed on main at `73998ffc`; the integrated branch now requires
fresh checks of its 440 server, 373 client and 73 browser tests.

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
The `team` pass in this run does not close #90's separate public-art
repair and verification. Browser checks used local throwaway accounts;
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
2. The waiting room: four seats, the countdown, bots filling in — implemented.
3. The match: a battle against the other player's army, as the attack on a
   player is played now (`attackPlay.ts`); no units are lost — implemented.
4. Results, the ranking and prizes — implemented.
5. Friends' tournaments: create, invite, call off — implemented.

### 8. The switch: the long tail of windows (S to M each) - [ ]

The windows still "not yet" in `docs/original/index/windows.md`, nearly
all with their server side done. One slice each, or a few small ones
together:

- [ ] Collections: the pieces found, trading a full set for its reward or
      finishing it for cash (`game_collections.py`). Pieces already drop.
- [ ] The units book: every unit by kind, grey until owned, buying a
      missing one for cash.
- [ ] The unit warehouse (`warehouse.py`).
- [ ] The time machine (`time_machine.py`) and its help page.
- [ ] The weather machine: the island's looks (`unlock_skin`, `set_skin`).
- [ ] Darts (`darts.py`).
- [ ] The social buildings: the Summit, the allied markets and their choice
      of resource, the recruitment camp, the wonder of people, the Round
      Table (`social.py`, `helps.py`; friends' help goes through our own
      Friends page, as on the classic page).
- [ ] Dragon riders, their training and taming dragons.
- [ ] The Supreme Bahamut temple (`temple.py`).
- [ ] A player's profile (honour, rank, wins and losses).
- [ ] "You have no town hall".
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
- **Phones:** the dock layout takes over below 720 pixels wide, or on a
  screen held upright up to 1000 wide. Test new windows at a phone's size
  too (`newPlayer(..., { phone: true })`); things have overlapped the
  tools there before.
- **Python:** installing the packages into the system's Python fails on
  some computers (Debian's own `blinker`), which is why setup uses `.venv`.
- **Merges with `main`:** expect conflicts in DECISIONS.md, ROADMAP.md,
  CLIENT.md and PARITY.md when someone else's work went in first. Keep both
  sides; DECISIONS.md is newest first.
