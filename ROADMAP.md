# Roadmap

**Goal:** make Social Empires a complete, playable, free online game at
[socialemperors.me](https://socialemperors.me). We keep all the original art,
music and content, finish the features that never got a server, and over time
modernise it into a full-screen game with room for new content.

This is a non-commercial fan project. See [Copyright](#copyright) below.

## How changes reach players

1. Work happens on a branch and is opened as a **draft pull request** on GitHub.
2. Every push to that branch is deployed to **staging** automatically:
   <https://game-server-staging-production.up.railway.app>. Staging has its own
   empty database, so testing there never touches real players' empires.
3. The live game changes **only when a pull request is merged** into `main`:
   by the owner, or by Claude for its own once all its tests pass, as the
   owner allows. Railway then rebuilds `main` (about 2 minutes, then a short
   reconnect for players).

Passwords, API keys and tokens never go in chat or in the repository, only in
GitHub Secrets or Railway variables.

## Where things live

| What | Where |
| --- | --- |
| Live game server | Railway project `socialemperors`, service `game-server`, deploys `main`, in Singapore (moved 14 October 2026). Its data is in Supabase (schema `game`) since 15 October 2026, a fresh start; the old SQLite file stays on its volume as a backup ([DEPLOY.md](DEPLOY.md#64-connect-the-servers-to-supabase)) |
| Live game data | Supabase project `socialemperors` (Singapore), schema `game`, login `se_game` ([DEPLOY.md](DEPLOY.md#part-6-supabase-the-database)). Railway volume `game-data` at `/data`: the secret key, and the SQLite database from before the move |
| Staging server | Same Railway project, service `game-server-staging`, deploys the working branch, volume `staging-data`, sleeps when idle; its data in the same Supabase project, schema `staging`, login `se_staging` |
| Art, sounds, SWFs | Cloudflare R2 bucket `socialempires-assets` at `assets.socialemperors.me`, uploaded by the *Upload assets to R2* GitHub Action |
| Domain | `socialemperors.me`, registered at Namecheap, DNS on Cloudflare |

Setup details: [DEPLOY.md](DEPLOY.md). Server settings: [MULTIPLAYER.md](MULTIPLAYER.md).

## Phases

**Order of work:** Phase 3 now, one pull request at a time: the database on
Supabase first, then the sign-in options with new pages, then friends and
gifts. Then Phase 4, the new game client. Phase 4's first two steps (the
art, and a new client that only shows your town) don't change the server, so
they go ahead alongside.

### Phase 0: Launch (done)

- [x] Accounts, signed game tokens, SQLite with batched saves, gunicorn
- [x] Railway + R2 + domain, with a step-by-step guide
- [x] Real visitor IPs for login rate limits
- [x] Script to decompile the game client for research (`tools/decompile_client.sh`)

### Phase 1: Polish what exists (done)

- [x] Staging server
- [x] Game page: remove leftovers from Facebook days (*Get Cash*, *Free Gifts*),
      fit the game to the window, and a working full screen button
- [x] Ruffle (the Flash emulator): pin a known-good version (0.7.1)
- [x] Ruffle settings: tried every quality and renderer switch on the game
      page. Ruffle's own defaults are as good as any. WebGPU crashed the game
      (Chrome on a Mac), so the page no longer offers it
- [x] Ruffle: our own copy (`assets/ruffle/0.7.1/`) next to the game's files,
      instead of loading it from unpkg.com
- [x] The game's *Add Cash* buttons, which opened Facebook's payment page,
      open our bank's exchange instead (the game asks the page, through
      `gotoBuy()`; `templates/_bank.html`)
- [x] Missing file: `fx/p.miniFireball2.swf` (the game asks for it, nobody
      has it): a copy of the fireball `p.fireBall_02` under the class name
      the game looks for, made by `tools/rename_swf_class.py`
- [x] Login security: changing your password (on the new account page)
      signs out every other browser and game; every form carries a CSRF
      token; logging out is a button, not a link; at most 5 new accounts an
      hour and 10 wrong passwords in 10 minutes per visitor
- [x] Admin page (`/admin`, `admin.py`), for the usernames in `SE_ADMINS`:
      find an account, reset its password, delete it or one of its empires,
      look inside an empire's save, and see who played last
- [x] Bug radar (`radar.py`, on the admin page): counts the commands the
      server doesn't handle yet, the commands that hit an error (by the line
      of code) and the sync errors the game reports, most frequent first, so
      we fix the most-used missing features first

### Phase 2: Finish the missing game features

The game client knows 154 server commands. The server used to handle 42 of
them and silently ignore the rest, so much of what a player did on screen was
undone by the next reload. It now handles 105. Of the other 49, 24 are never
sent by this client and most of the rest are unreachable (admin panel,
Facebook-only, the iPhone gift box, paid packs whose buttons are hidden).

- [x] Arthur's tutorial is remembered once finished, instead of starting
      over on every reload, and for the whole account: a second empire
      doesn't start it again
- [x] Supreme Dragon Temple (`temple.py`): the 12 offerings, the 48 hour wait,
      skipping it with cash, and summoning the Supreme Bahamut Dragon
- [x] Collections (`game_collections.py`): pieces found are saved, finished
      sets are exchanged for their reward or bought with cash. The Golden and
      Red Bahamut and the Bahamut Heart come from these (their pieces drop on
      hardcore and god islands), so all 12 temple steps can now be completed
- [x] Quests (`quests.py`): stars, best times, the next island opening, units
      lost going to the graveyard; the graveyard itself (`graveyard.py`)
- [x] Collecting and storage (`production.py`, `inventory.py`): production
      timers, the worker bonus, storing and placing items in the right town
- [x] Buying (`shop.py`): training food, offer packs, deals, unit collections
- [x] Missions, troll raids, spells and mana, the Market (`missions.py`,
      `magic.py`, `market.py`)
- [x] The Unit Warehouse, the Time Machine, darts, island skins, survival
      mode and the Monday bonus
- [x] Social buildings (`social.py`), helping neighbours (`assists.py`) and
      attacking other empires (`pvp.py`)
- [x] A second town (`towns.py`): from level 20 the globe founds a troll town
      for 100,000 gold or 22 cash and travels between the two; each town keeps
      its own resources, level and quest
- [x] The world map (`worlds.py`): fifty continents of eight islands, seven
      real rival players picked nearest your level, beating them in battle,
      moving on to the next continent and its prize (cash and units, once a
      continent), relocating, swapping islands, and browsing other continents
- [x] The daily bonus (`daily_bonus.py`): the server decides the day and
      pays the game's own prize for it, instead of trusting the client
- [x] Tournaments (`tournaments.py`): the game's *Tourney* window, from level
      15. Seven public tournaments of four players, matched by level: a room
      still not full after 30 minutes gets computer players with the real
      players' armies, so nobody waits for a crowd. And the weekly
      tournament: you against three bots, once a week, ranked against
      everyone else that week. Matches are fought against the other
      player's army, run by the game, so nobody has to be online together,
      and no units are lost. The battlefield (map 100000040) was missing
      too
- [x] Friends tournaments: *Create Tournament* makes a private room your
      friends (the real players among your neighbours) see in their list
      and can join; you can call it off and every fee comes back, and empty
      seats get bots after a day. The game's Invite buttons, which opened
      Facebook, open a short notice on the page instead
- [x] A test for every command the server handles (325 tests), and a test
      that fails if a handled command has none (`tests/test_every_command.py`).
      Writing them found four bugs: a monster nest reopened after the last
      monster closed itself again, opening a nest took gold from the first
      town instead of the open one and ignored the config's prices, and
      taking a unit the server didn't know about out of a building lost it

### Cash

Cash was bought with real money on Facebook. This server is free and has
nothing to sell, so cash is earned by playing: small amounts often, bigger
ones for milestones, and nothing that can be bought. Every number is in
`economy.py`, to tweak in one place. The game's own windows show the same
numbers, because the server writes them into the game config.

- [x] Levels: 2 cash a level from level 5, 5 every 5th level, 10 every 10th
      (about 150 cash by level 50, 300 by level 100). The level up window
      always showed a prize, but nothing saved it; now the server pays it,
      once a level per town (`levels.py`). Saves from before (version 0.06a)
      get the prizes of the levels they had already reached, once
- [x] Daily bonus: 2 cash on day 3 of the streak, 5 on day 5 (was 1 and 3)
- [x] Monday bonus: the cash chest holds 10 (was 5)
- [x] World map: 5 cash for reaching continents 2 to 11, 10 for 12 to 21, up
      to 25 (was 1 each). The prize table's order is fixed too: the game
      showed the wrong units for continents 19 to 24
- [x] The bank: 2,000 gold, wood, food or stone for 1 cash, up to 5 cash a
      day (`bank.py`). The game's own trade the other way (5 cash for 2,500
      gold) stays. Together with the daily bonus, it is the "daily" source of
      cash, instead of a new town hall feature
- [x] Islands: 5 cash the first time a quest island is won on three stars,
      the hardest difficulty (`quests.py`): 165 over the 33 islands.
      The game has no window for it, so the island window's *Choose
      difficulty* says so, and the cash shows once the player is home. Saves
      from before (version 0.07a) get it for the islands they had already
      won on three stars, once
- [x] Tournament prizes: the winner of a public tournament gets the prize
      the game shows (gold or cash, and a unit in the gift box); the weekly
      top 10 get the prize for their rank, as it is when their own
      tournament ends. A cash tournament's prize is the entry fee back with
      the unit, not twice the fee as in the game: with bots filling seats, a
      good player could win over and over and print cash (`economy.py`)
- [x] The welcome-back bonus: a chest on a new empire's 2nd and 3rd day
      (2,500 gold, a unit or 10 cash: the client draws it from the Monday
      chest's list). The client had it switched off inside the game file;
      `tools/patch_client.py` switches that one setting on (3 bytes) in a
      copy, `SocialEmpires0926bsec_comeback.swf`, which the page now loads
      and tells the empire's day (`comeback_bonus.py`)
- [ ] Known gap, for after Phases 3 and 4: the server still believes the
      experience and battle gold the game reports, so a determined cheater
      could fake levels, and with them their cash. Checking battles on the
      server is a bigger project, and much easier once the new client's
      battles are repeatable ([CLIENT.md](CLIENT.md#who-decides-what-happened))

### Phase 3: Stronger foundations

- [x] The database on Supabase (Postgres), in Singapore next to the game
      server (`storage.py`, [DEPLOY.md](DEPLOY.md#part-6-supabase-the-database)).
      Built and ready; the live server switches over when its address is
      set (DEPLOY.md 6.4), which hadn't happened by 14 October 2026.
      The first start copies the players over from SQLite; each server has
      its own login and schema, so staging can't reach real players; nothing
      is on Supabase's public Data API; `tools/copy_database.py` makes
      backups. The server still runs as one process: empires stay in its
      memory, so more processes need more than a database
- [x] Signing in with Discord or Google, through Supabase Auth
      (`sign_in.py`, [DEPLOY.md](DEPLOY.md#part-7-signing-in-with-discord-and-google)),
      next to usernames and passwords, which stay. A first sign-in picks a
      username, or links an account already here; Settings links and
      unlinks them. A player can then get back into an account without the
      admin. (Email sign-in would need a mail service; not for now)
- [x] New pages around the game, in its own look (sky and hills,
      parchment, its round lettering and buttons): signing in, your empires
      as cards with their Play buttons, and a Settings page to rename or
      delete your empires, link Discord and Google, and set or change your
      password. Off the game's bar: the Discord and GitHub links, and the
      version
- [x] Friends, as Facebook had (`friends.py`): ask by username, the other
      accepts or declines (the Friends page, `/friends`). Friends' empires
      come first among your neighbours in the game, then the most recently
      active players, and each player's username shows under their
      portrait instead of "Emperor". The game's ways to ask for more
      neighbours (an empty place in the bar, "Need allies?") point to the
      Friends page
- [x] Gifts between friends (`gifts.py`): a free gift a day for each friend,
      from the 34 items the game config marks giftable, opening with the
      sender's level (a Yellow Tree from the start, a Scorpion at 30); and
      anything from your own storage. A gift waits, with who sent it, until
      it is taken into one of your empires' Gifts and Storage. The game's
      own Send gift button and empty gift box open our Gifts window
      (`templates/_gifts.html`), which opens by itself when gifts are
      waiting; like the bank, it has the game send back what it holds
      before anything leaves storage, and reload the town after
- [x] Asking friends for help, which also went through Facebook
      (`helps.py`): the game's own Ask friends buttons open our window
      (`templates/_help.html`) to pick friends, and friends answer on the
      Friends page. An hour off a building's work (`accept_collect_help`),
      two steps for the dragon nest's dragon (`finish_dragon_help`), a place
      at the Summit, the Allied Markets, the Recruitment camp and the Wonder,
      and a seat at the Round Table, whose own window picks friends one by one
      (`assist_send_feed`). Each friend helps a thing once a day; the game
      says who helped when it next starts. The Recruitment camp, the Round
      Table and the Wonder take no paid helpers, so before this they could
      never be staffed
- [ ] Found lost animals (`register_found_item.php`): the game shared them on
      Facebook's wall, for friends to adopt; what friends got is unknown.
      (Asking friends for potions has no button in this client.)
- [x] Asset pipeline for buildings and units: `tools/export_art.sh` turns
      them into sprite sheets (WebP, plus JSON naming the animations). This is
      also the first step of the new client ([CLIENT.md](CLIENT.md#step-1-the-art-pipeline))
- [x] The sheets on R2: the **Export art to R2** workflow ([DEPLOY.md](DEPLOY.md))
- [ ] Asset pipeline for the effects and sounds (the town's sounds done:
      `tools/art/export_sounds.sh`; the effects and battle sounds to come)
- [ ] Content editor for adding new units, buildings and quests

### Phase 4: New game client (started)

Replace the Flash client with a modern one that draws the same art and talks
to the same server. The scope is in [CLIENT.md](CLIENT.md). In short:

- The Flash client is the whole game, not just its pictures: about 184,000
  lines of decompiled code, roughly 25 times our server. It is the biggest
  project on the roadmap.
- It can be built a piece at a time. The new client sends the same commands
  as the Flash one, so both run side by side on the same saves, and Phase 2
  work is reused as it is.
- Recommended: TypeScript with PixiJS 8 for the map and HTML for the windows,
  confirmed once the new client can draw a real town.

- [x] 1. Art pipeline: buildings and units as sprite sheets (`tools/export_art.sh`)
- [x] 2. Look at your town: `/client.html` draws the map, buildings and units
      from the config and the save, with PixiJS; smooth scrolling and zoom,
      touch, full screen. Look only ([CLIENT.md](CLIENT.md#step-2-look-at-your-town))
- [ ] 3. Run your town (started): the shop and building; storage; move,
      turn, store and sell buildings; collect from them, with levels; all
      with the Flash client's commands ([CLIENT.md](CLIENT.md#step-3-run-your-town)).
      The Flash client's own icons are in, and the menus as a rail and
      dock ([CLIENT.md](CLIENT.md#the-menus-rail-and-dock))
- [ ] 4. Battles, 5. everything else, 6. switch over

**From here, in three stops** (agreed October 2026). Each is built in
slices, about one task each; every slice ends tested, documented and merged.
The ground rules for the work are in [CLAUDE.md](CLAUDE.md).

- [ ] **Beta 1, the town builder** (the rest of step 3), built 14 October
      2026, now closing the gaps a side-by-side check against the Flash game
      found ([PARITY.md](PARITY.md)): the menus as a rail and dock (the owner's pick: the shop,
      storage, army, neighbours and battle windows, the glove, messages at
      the top); units walking; villagers at work (trees, rocks, workers into
      buildings and out again); training and population; land and cash
      (land, opening early, hurrying, the bank); missions and bonuses
      (goals, the daily bonus, Monday's and welcome-back chests); neighbours
      (visiting and helping, Arthur, the donkey carts); sound and speed (the
      town's music and sounds, compressed downloads); and a run-through
      against the Flash game (`e2e/tests/classic.mjs`: an empire played in
      the new client opens in the classic game, and Arthur's lessons are
      offered there). Players can use the new client for everything but
      battles, which open in the classic game.
      **Launch: a fresh start,** ready for the owner (DEPLOY.md, 6.4). The
      live server moves to Supabase with an empty database: none of today's
      accounts or empires go with it (the owner's call). `SE_COPY_SQLITE=0`
      stops the automatic copy from SQLite. The owner signs up first and
      becomes the admin (`SE_ADMINS`); test accounts stay on staging and in
      the browser tests, never on the live game. AcidCaos's built-in village
      is gone; Arthur's stay, and his town grows with the player's.
- [ ] **Beta 2, battles and quests** (step 4): combat, defending a town,
      spells and heroes, the island map, then the quests in batches with
      their bosses, checked side by side against the Flash game.
  - [x] The last 11 sprite sheets: pictures too big for a sheet stored
        smaller, a budget of 4 pages an item, an item's frames drawn on
        several threads, and the slayer's stray part cut off; the
        projectiles and effects exported too
        ([CLIENT.md](CLIENT.md#step-1-the-art-pipeline))
  - [x] Combat and the first islands: the fighting as the Flash client
        does it (damage, targets, reach, shots, towers), the Quests
        window, the troll, civilization, hardcore and god islands played
        here with their stars, prizes and losses, and the battle sounds
        ([CLIENT.md](CLIENT.md#step-4-battles))
  - [x] The island map: the game's own painted map, its ribbons, stars,
        padlocks and Enter Now; the team of 20 for the last islands
  - [x] Spells: the fifteen spells as the Flash client casts them, the
        Wizardry Academy's window, the mana bank and the spell book in
        battle ([CLIENT.md](CLIENT.md#step-4-battles))
  - [x] Special moves: the heroes' moves that come by themselves, the
        special units' buttons with their shared cooldown, and the LIMIT
        bar ([CLIENT.md](CLIENT.md#step-4-battles))
  - [x] Defending the town, raids: bandits from level 10 and sieges
        from 25, the town as a battlefield, towers, burning and repairs,
        and the raiders' gold kept by the server
        ([CLIENT.md](CLIENT.md#step-4-battles))
  - [x] Defending the town, camps: the ten troll camps the original
        lays out by code, their chests and prisoners every 4 hours, and
        the trolls on the border ([CLIENT.md](CLIENT.md#step-4-battles))
  - [ ] The twenty scripted troll camps
  - [x] The Hero Isle: its seven parts behind doors that open as each is
        cleared, and the monks turning units to their side
        ([CLIENT.md](CLIENT.md#step-4-battles))
  - [x] The boss islands, part 1: the Arctic Isle (the Giant Yeti) and
        the Desert Isle (the Stone Golem): guards, keys, the gate, the
        boss by level ([CLIENT.md](CLIENT.md#step-4-battles))
  - [ ] The boss islands, part 2: the Rockdriller, the dragons
- [ ] **The switch** (steps 5 and 6): battles against players, the long
      tail, the tutorial and polish. The new client becomes the default, with
      the Flash game one tap away for a while.

## How we add a missing feature

1. **Find it.** The bug radar or a player report names a command the server ignores.
2. **Read the client.** Run `tools/decompile_client.sh`, then look up the
   command name in `core/Constants.as` and read what the client sends and what
   it does with the answer.
3. **Write the server side** in our own words in `command.py` (or its own
   module, like `temple.py` or `game_collections.py`), with a test in
   `tests/` that replays the commands the client sends. Run them with
   `python -m unittest discover tests`.
4. **Try it on staging**, then merge.

## Decisions so far

| Decision | Why |
| --- | --- |
| Railway, not Render | Persistent disk on the cheap plan, deploys from GitHub, usage-based price (about $5 a month). Comparison in [DEPLOY.md](DEPLOY.md#appendix-a-railway-vs-render) |
| Assets on Cloudflare R2 | Free downloads (no egress fees); keeps 1.3 GB out of the server |
| Exactly one server process | Villages live in memory and are saved every 5 seconds. More processes need them out of memory, not just a database server |
| Ruffle instead of Flash Player | Works in every modern browser with no plugin |
| Client version 0.9.26b, with one setting switched on | The one that works fully today; `tools/patch_client.py` turns on its welcome-back bonus, and nothing else changes |
| PixiJS 8 for the new client | Light, fast with many sprites, and we keep control; confirmed by drawing real towns ([CLIENT.md](CLIENT.md#engine)) |
| Supabase for the database, and for sign-in next | Postgres, plus sign-in with Discord, Google and email ready-made; the free plan is enough. Chosen over Railway's Postgres for the sign-in part |
| Singapore for the server and the database | Most players are in Asia, then Europe. Railway's regions are California, Virginia, Amsterdam and Singapore; the database must be in the same city as the server, which asks it something on every page |

## Copyright

Social Empires, its art, music and client code belong to Social Point / Take-Two.
We use the original files only to keep the game playable, without charging
anyone.

Decompiled client code is for reading on your own machine. It is never
committed, shared or pasted anywhere (`decompiled/` is in `.gitignore`).
What we publish is our own server code and our own notes about how the game
behaves.
