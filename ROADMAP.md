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

### Phase 0: Launch (done)

- [x] Accounts, signed game tokens, SQLite with batched saves, gunicorn
- [x] Railway + R2 + domain, with a step-by-step guide
- [x] Real visitor IPs for login rate limits
- [x] Script to decompile the game client for research (`tools/decompile_client.sh`)

### Phase 1: Polish what exists

- [x] Staging server
- [x] Game page: remove leftovers from Facebook days (*Get Cash*, *Free Gifts*),
      fit the game to the window, and a working full screen button
- [x] Ruffle (the Flash emulator): pin a known-good version (0.7.1)
- [x] Ruffle settings: tried every quality and renderer switch on the game
      page. Ruffle's own defaults are as good as any. WebGPU crashed the game
      (Chrome on a Mac), so the page no longer offers it
- [ ] Ruffle: host it ourselves instead of loading it from unpkg.com
- [ ] The in-game *Add Cash* button is drawn by the game itself; hide or
      repurpose it once we can change the client
- [ ] Missing file: `fx/p.miniFireball2.swf` (the game asks for it, nobody has it)
- [ ] Admin tools: reset a password, delete an account, inspect a village
- [ ] Bug radar: count which unhandled commands players trigger, so we fix the
      most-used missing features first

### Phase 2: Finish the missing game features

The game client knows 154 server commands. The server used to handle 42 of
them and silently ignore the rest, so much of what a player did on screen was
undone by the next reload. It now handles 100. Of the other 54, 24 are never
sent by this client and most of the rest are unreachable (admin panel,
Facebook-only, the iPhone gift box, paid packs whose buttons are hidden).

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
- [ ] A second town (`buy_map`); the server only really supports town 0 today
- [ ] The world map: continent rankings (still a stub with one island) and
      moving between worlds (`modify_position_univers` and friends)
- [ ] Tournaments (needs a small tournament service)
- [ ] An automated test for every command (142 tests so far)

### Phase 3: Stronger foundations

- [ ] Move to Postgres (Supabase or Railway) once a single SQLite file and a
      single server process are no longer enough
- [ ] Asset pipeline: extract images and sounds from the SWFs into normal files
- [ ] Content editor for adding new units, buildings and quests

### Phase 4: New game client (decided later)

Replace the Flash client with a modern one (TypeScript with PixiJS or Phaser)
that draws the same art and talks to the same server. Phase 2 work is reused
either way, because the server rules stay the same. We decide on the tech
once Phase 2 shows how much of the game we have.

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
