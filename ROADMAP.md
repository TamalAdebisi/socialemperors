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
3. The live game changes **only when the owner merges** the pull request.
   Railway then rebuilds `main` (about 2 minutes, then a short reconnect for
   players).

Passwords, API keys and tokens never go in chat or in the repository, only in
GitHub Secrets or Railway variables.

## Where things live

| What | Where |
| --- | --- |
| Live game server | Railway project `socialemperors`, service `game-server`, deploys `main` |
| Live game data | Railway volume `game-data` at `/data` (SQLite database + secret key) |
| Staging server | Same project, service `game-server-staging`, deploys the working branch, volume `staging-data`, sleeps when idle |
| Art, sounds, SWFs | Cloudflare R2 bucket `socialempires-assets` at `assets.socialemperors.me`, uploaded by the *Upload assets to R2* GitHub Action |
| Domain | `socialemperors.me`, registered at Namecheap, DNS on Cloudflare |

Setup details: [DEPLOY.md](DEPLOY.md). Server settings: [MULTIPLAYER.md](MULTIPLAYER.md).

## Phases

**Order of work:** finish Phase 2 and Cash next, then Phase 3 (which brings
Discord sign-in), then Phase 4, the new game client. Phase 4's first two
steps (the art, and a new client that only shows your town) don't change the
server, so they go ahead alongside.

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
- [ ] Tournaments (needs a small tournament service)
- [ ] An automated test for every command (236 tests so far)

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
- [ ] The welcome-back bonus: the game config has it (a new player back on
      their 2nd and 3rd day opens a chest: 2,500 gold, a unit or 5 cash), but
      the game client we use has it switched off inside the game file, and
      nothing the server or the page sends can switch it on. It needs a small
      change to the client (one setting), so it waits for that
- [ ] A little cash the first time an island is won with three stars
- [ ] Tournament prizes, once tournaments exist
- [ ] Known gap: the server still believes the experience and battle gold
      the game reports, so a determined cheater could fake levels, and with
      them their cash. Checking battles on the server is a bigger project

### Phase 3: Stronger foundations

- [ ] Sign in with Discord, so a player can get back into an account without
      the admin (moved here from Phase 1)
- [ ] Move to Postgres (Supabase or Railway) once a single SQLite file and a
      single server process are no longer enough
- [x] Asset pipeline for buildings and units: `tools/export_art.sh` turns
      them into sprite sheets (WebP, plus JSON naming the animations). This is
      also the first step of the new client ([CLIENT.md](CLIENT.md#step-1-the-art-pipeline))
- [ ] Asset pipeline for the effects and sounds, and uploading it all to R2
- [ ] Content editor for adding new units, buildings and quests

### Phase 4: New game client (scoped)

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
- [ ] 2. Look at your town: a read-only page that draws the map, buildings and
      units from the config and the save. Confirms the engine
- [ ] 3. Run your town, 4. battles, 5. everything else, 6. switch over

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
| Exactly one server process | Villages live in memory and are saved every 5 seconds. More processes need Phase 3 first |
| Ruffle instead of Flash Player | Works in every modern browser with no plugin |
| Client version 0.9.26b | The one that works fully today |
| Supabase later, not now | Postgres and auth are useful at scale; one SQLite file is enough until then |

## Copyright

Social Empires, its art, music and client code belong to Social Point / Take-Two.
We use the original files only to keep the game playable, without charging
anyone.

Decompiled client code is for reading on your own machine. It is never
committed, shared or pasted anywhere (`decompiled/` is in `.gitignore`).
What we publish is our own server code and our own notes about how the game
behaves.
