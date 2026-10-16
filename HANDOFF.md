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

- **Task 1 is complete in #86**, with a separate art-loading failure
  recorded below for follow-up. All **nine stale art bundles have now
  been exported**, under the owner's subsequent authorization. The CDN
  mismatch was also resolved: all 40 ordinary public files verified at
  11:18 UTC. The full browser run is in progress. The
  owner requested merging the two wait
  fixes with that failure documented. Draft #87 contains tasks 2, 3 and 5;
  those are implemented but still awaiting browser verification and merge.
  #87 also has conflicts with `main`; its delivery task is below. Leave
  those tasks with that pull request, and start dependent work from the
  latest `main` after it lands.
- **Tests for #86:** the server ran 427 (418 passed, 9 skipped), the
  client's 324 passed, and 63 of 64 browser tests passed. The two flaky
  tests passed; `team` failed and prompted the separate art repair
  described in task 1. Post-export verification is recorded there.
- **The live game,** socialemperors.me, has been on Supabase since 15
  October 2026, as a fresh start. It deploys by itself when `main` changes.
  Code work uses local servers and needs no live database access. The
  separate art repair below has published and verified its public files.
- **Phase 4, the new client** (the plan is in CLAUDE.md, "Order of work"):
  - **Beta 1, the town builder:** built. A side-by-side check against the
    Flash game found gaps (PARITY.md); nearly all are fixed. Left: the
    building card (upgrading, and what it shows), the shop's details, the
    site's bar, and the run-through that closes the beta.
  - **Beta 2, battles and quests:** built: combat, every island, spells,
    special moves, defending the town, camps, bosses, graveyards. Left: the
    special units' rarer moves, a short list of battle rules (PARITY.md,
    "Still to do"), and the owner playing it.
  - **The switch:** attacking players, the world map, spying, survival,
    Arthur's lessons and the nests are built. Left: tournaments, the long
    tail of windows, and making the new client the default.
- **How far, in numbers** ([docs/original/](docs/original/README.md)): of
  the Flash client's 829 classes that hold the game's own behaviour, about
  45% are built in the new client, 40% partly (mostly special buildings
  and units, whose plain fighting works but not all their own moves) and
  15% not yet (mostly windows). 50 of the 227 goals still say they're
  played in the classic game (CLIENT.md, "Missions and bonuses"); that
  number falls as features land.

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

**Immediate delivery task: verify and merge #87.** Read AGENTS.md,
CLAUDE.md and this file. Continue #87 on `claude/charming-hamilton-jiyrk5`;
merge the latest `origin/main` into it (do not rebase). Resolve conflicts
by retaining both sets of work: #86's waits and art-failure notes, these
standing instructions, and #87's card, upgrade, Menu and shop research.
The owner already chose card mockup A and delegated the Menu's placement;
do not ask those questions again. The PR description reports unit-test
passes, but a completed full browser run has not been recorded.

Run the server tests, client type check and unit tests, then all browser
tests (66 at #87's current head). Inspect desktop and phone screenshots
and the server log. Fix failures without weakening assertions. Record
the tested commit, counts, duration and any unresolved failure in the PR.
The existing `team` art-memory failure is documented under task 1; if it
recurs, establish whether it is the same accepted unrelated failure.
Merge once verification is complete and regressions are resolved, using
the standing authorization. Keep tasks 1, 2, 3 and 5 ticked in the merged
handoff. Update the status at the top instead of restoring #87's stale
"no open pull requests" text.

**Checks that different chats can run concurrently:** use separate
machines or cloud environments and separate checkouts of the same commit
after the coordinator has merged `main` into #87. Each chat records its
commit, command, results, screenshots and failures. One coordinator owns
changes to #87 and the final merge. Run browser checks one at a time on
the shared 2-CPU, 8-GiB machine; separate chats or worktrees do not add RAM.
The runner also overwrites `e2e/out/server.log`, so never share a checkout
between simultaneous runs.

| Check | Browser test names for `PYTHON=.venv/bin/python node e2e/run.mjs` |
| --- | --- |
| Building card, upgrades and building actions | `card edit storage train construction friends-help cash bubble looks` |
| Site Menu and desktop/phone controls | `site-menu menus dock keys pointers phone-place` |
| The two repaired timing checks | `survival market` |

These focused checks help locate failures; the coordinator still ensures
the complete suite is covered on the final code. Server tests and the
client's type/unit checks can run alongside browser checks. Research for
task 4 (shop details) and the first slice of task 7 (tournaments) can also
proceed independently; task 4's implementation builds on #87.

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

**Separate follow-up: export and public files verified; browser run ongoing.**
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

**The CDN was initially inconsistent:** ordinary image URLs returned old
Cloudflare `HIT` responses whose dimensions disagree with the new JSON.
A request-side `no-cache` header did not refresh them. The exact remaining
step was a targeted Cloudflare purge of
[these 20 image URLs](docs/team-art-cache-purge.txt), or waiting for the
24-hour cache lifetime to expire. This environment has no Cloudflare
access; the owner coordinated that step with Opus. At **11:18 UTC**, all
40 ordinary JSON/WebP responses were independently fetched and matched
the verified fresh files byte for byte. No further export or purge is
pending. Other checkouts must still refresh affected files in
`.tools/art-cache/art/`; also check for local `art/sheets/` overrides.
With the freshly published image bodies in the isolated cache,
`team` passed in **41 seconds**, using **3.44 GiB** peak
anonymous/shared/kernel memory (4.84 GiB including file cache), with no
memory-limit/OOM events. File hashes, requests, screenshots and server log
were checked. The full browser suite is running with these same files;
a final cold-cache `team` check will follow it. Keep stale local-cache
failures distinct from new #87 or tournament regressions. See
[the repair notes](docs/art-loading-repair.md)
for evidence and exact checks. No source art, game code or test assertion
was changed.

### 2. Beta 1: Upgrade on the building card (M) - [ ]

PARITY.md, "The building card", and `docs/original/rules/town.md`,
"Upgrading". 104 buildings upgrade to the next one (houses, farms, mills,
ranches, towers, walls, barracks, the town hall). It needs the next one's
level and costs its full price; the old one gives back 1/20 of its price
(nothing if it cost cash); the new one gives its experience and stands in
scaffolding like any new building. The Flash client sends `sell` (reason
`"UPGR"`) and then `buy` on the same spot; the server already handles both.
Town Hall II to IV can only be had this way, so three goals open up with
it. The button can join the card's tiles in their current style (say so in
DECISIONS.md); the card's new look is task 3.

### 3. Beta 1: what the building card shows (S each) - [ ]

PARITY.md, "What it shows": the picture with its health, its numbers
(attack, speed, range, the room a house gives), what the next collect
brings with a time bar, how full it is, the units inside (tap one to let
it out), what a barracks trains, and a tip per kind of building. **The
card's look was the owner's pick:** they chose mockup A, the original's
info panel. It is implemented in #87, awaiting verification and merge.

### 4. Beta 1: the shop's details (M) - [ ]

PARITY.md, "Windows and messages", Shop: what each thing gives or houses
(a unit's numbers), on hover or tap; the tabs' own pictures; "new" badges.
The same line asks for a confirmation before opening a building early for
cash, but the map of the original found later that opening early is
switched off in the original, and ours was removed: check, and reword the
line rather than build it.

### 5. Beta 1: the site's bar (S) - [ ]

The classic page has Empires, Friends and Log out; the new client has
none of them yet on `main`. The owner delegated their placement. #87
implements a Menu after Full screen; verify and merge that work.

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

The last box in ROADMAP.md's switch list. The server side is done
(`tournaments.py`, with tests; ROADMAP.md, Phase 2, says how it works:
public rooms of four filled by bots after 30 minutes, the weekly
tournament against three bots, friends' tournaments, prizes). In the new
client the Battle window's Tournament row still opens the classic game
(`client/src/ui/world.ts`). The Flash windows are listed in
`docs/original/index/windows.md` under `popups/tournament/` (about twenty
classes). Suggested slices:

1. The tournament list (everyday, weekly, your own), its help and the team box.
2. The waiting room: four seats, the countdown, bots filling in.
3. The match: a battle against the other player's army, as the attack on a
   player is played now (`attackPlay.ts`); no units are lost.
4. Results, the ranking and prizes.
5. Friends' tournaments: create, invite, call off.

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

As each lands, its goals stop saying "classic game": update the count in
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

The new client becomes the default, with the Flash game one tap away for
a while. When is the owner's call: ask once Betas 1 and 2 are played and
tournaments are in.

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
- When the new client becomes the default (task 10).
- AI-upscaled art: still open.

Already decided, don't reopen: the menus as a rail and dock (CLIENT.md);
the building card's mockup A and the agent-chosen Menu placement (both
implemented in #87, awaiting verification and merge);
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
