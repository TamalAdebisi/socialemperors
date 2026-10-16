# The game core (Base, MapInitializer, Constants...)

**16 October playthrough follow-up:** raids now recur at every level after
lessons/rescue, with recovery between waves. Camps return after ten minutes.
These requested pacing changes override the original schedule below; see
CLIENT.md and DECISIONS.md.

This part of the original Flash client starts the game and keeps it running.
`Base` loads the config and the save, draws the map, turns taps and keys into
building, moving, selling and fighting, and sends the commands; `MapInitializer`
sets up a town each time it opens (tidying it, growing back trees and rocks,
sending raiders and camps). Around them sit the fixed numbers (`Config`,
`Constants`), the words (`Language`), and small helpers the windows and the
map engine (see [engine.md](engine.md)) lean on.

**Count:** 19 built, 12 partly, 7 not yet, 3 not needed, 1 library (42 classes).

**How deep this was read.** `Base`, `MapInitializer` and `Config` were read
through. `Constants` and `Language` were surveyed by kind, not value by value.
`TutorialMain` was skimmed: how steps advance and how it ends were read, the
table of steps was not. `MagicParticle` was skimmed: its kinds and their
timings were read, not each effect's code. `Stats` was identified from its
first lines. Every other class was read in full. Statuses come from searching
`client/src` and the server's `.py` files for the commands, config keys and
rules each class uses.

**Words used here.** "On open" means each time the player's town finishes
loading, with no button pressed. "Free" in a command means the "don't change
resources" flag (`buy` or `sell` with 1 in that place).

## Starting up and running the town

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/Base.as` | 7882 | The game itself: loading, the main loop, the mouse and keyboard, building, moving, selling, storage, land, the clock, raids' and spies' counters, and switching between home, neighbours and battles. Its parts are listed below. | partly: town running is built across `main.ts`, `editor.ts` and `rules/`; missing the lost things, social buildings' helpers, a stored unit's limit, the collecting bar, Facebook parts (not needed) |
| `core/MapInitializer.as` | 2714 | What happens as a map opens: at home, the town's tidy-up, trees, rocks and animals growing back, the camp of the moment, raiders and sieges; on an island or in a tournament, placing the armies. Its parts are listed below. | partly: home opening is built (`main.ts`, `rules/cleanup.ts`, `nature.ts`, `animals.ts`, `camps.ts`, `raids.ts`, `dock.ts`) and tournament placement in `rules/tournamentBattle.ts`; missing the lost things |

### The parts of `Base.as`

| Part | What it does | Status |
|---|---|---|
| Page settings | Reads what the web page passes in: server address, language, gender, days since the empire began, offers, friends, test switches (no graveyard, no XP in the shop, paying for goals, forced reloads). Keeps music, sound and zoom per browser. | partly: our pages pass what the server needs (`templates/play.html`); the test switches are off; sound and zoom kept by `sound.ts` and the camera |
| Loading | Asks for `get_game_config`, then `get_player_info` with the friend list and a random client id. Each reply is signed; the check is skipped when the page says so (ours does). | built: `net/server.ts`, `main.ts` |
| Reading the save | Goals done and paid, buildings opened early, towns owned, neighbours (one can be helped if the last help was over 24 hours ago; "Best Empire" doesn't count as a real neighbour), land, the map, server time, upgrades made today, raids and spies, the daily bonus (by the page's time zone; ours passes none, so UTC), Monday's chest (ready on a Monday not yet taken, shown on Sundays), the unit warehouse. | built: `main.ts`, `rules/town.ts`, `rules/bonuses.ts`; the warehouse is not yet |
| Starting the town | A `ping` every 5 minutes, but only away from home. Goals run for a human town below level 35; from 35 the spell book takes their place; never in a troll town. Sends `game_status` "MapLoaded". | built: goals in `rules/goals.ts`; no ping (the server only logs it) |
| The grid | 100 x 100 tiles in 25 blocks of 20 x 20; the outer 16 blocks are the wild ring (negative numbers). Path finding skips units, terrain and fields, so units walk over farms. | built: `rules/geometry.ts`, `rules/walking.ts` |
| Each frame | A speed-hack check (switched off by the config's `SPEED_HACK_CONTROL` 0). Arrow keys scroll 50 pixels; with a ship, boat, eagle or zeppelin selected they also steer it a tile. Goals are checked every 60 frames (2 seconds). | partly: arrows scroll (`view/camera.ts`); no steering by keys |
| The second's tick | Every building's clock, and the countdowns to the next raid and spy allowed. | built: `editor.ts` refresh |
| Pausing | The game stops when the window loses focus; the button or any key let go resumes it. | owner-requested difference: explicit Pause remains; tab changes keep simulation running (`gameLoop.ts`, 16 October 2026) |
| The clock | Server time plus seconds counted since loading; a first check gives 0 if the two drift over a minute apart. | built: the clock in `main.ts` |
| Taps and tools | Look, build, move, sell, collect-all (the glove), cast, place units. A press that moved more than 25 pixels is a drag, not a tap. Space turns the building being placed, or else switches on the square selection: up to 20 of the player's units, never walls, paths or deco. | partly: the tools (the bulldozer, the glove), Space and the square selection in `editor.ts`, `rules/group.ts`, `ui/hud.ts`; a drag starts at 8 pixels here and Space turns through every facing ([town.md](../rules/town.md)); group recall (`saveGroup`, `loadGroup`) is never called in the original: not needed |
| Building | Checks money, room for people (at most 175 plus wonders' extra, then housing), the unit's own limit (`units_limit`; the Mummy and the Ent are let through) and the building limits below. Sends `buy`. The first of a kind built may offer a Facebook share. | built: `rules/shop.ts`, `rules/training.ts`; the share is not needed |
| Building limits | One of each mill and mine level, and of a long list of special buildings; 3 nurseries; one market and one eagle building; towers bought with gold, wood or stone no more than 400 per block owned. | built: `rules/shop.ts` (`atLimit`) |
| Placing from storage | A gift gives its experience (`place_gift`); the Level-Up Statue gives exactly what's missing for the next level. A stored thing gives none (`place_stored_item`); a phone box item uses `place_iphone`. A unit must fit the population and its own limit. "Place all" puts stored units round the town hall. | partly: `rules/storage.ts`; a unit's own limit isn't checked there; no "place all"; phone boxes not needed |
| Moving and selling | `move` (reason "mouseUsed"). `sell` (reason "BLDZE"): not the town hall, not units, not others' things, not something being built, not rocks in the wild ring. Gives back a twentieth of the price; cash things give nothing (the config's `SELL_FOR_ZERO_CASH` is on). Asks first, except wonders, paths and free things. | built: `rules/editing.ts`, the bulldozer in `editor.ts` (`bulldoze`; ours asks for wonders, and the card's Sell always asks) |
| Storing | `store_item`, `store_item_frombug` (from the tidy-up), `store_add_items`. Storing the unit warehouse empties it into storage and sends `reset_warehouse`. | partly: `rules/storage.ts`; no warehouse (the server has `warehouse.py`) |
| Land | A block for sale must share a side with an owned one. Gold needs the price table's number of real neighbours; cash doesn't. Sends `expand`. | built: `rules/land.ts` |
| The tidy-up on open | Buildings first, the town hall first of all. The player's own buildings that overlap or stand off the map go to storage; anyone else's off the map are sold free ("OUTOB"). A unit on a taken tile (not a field or a gate) moves to the nearest free one ("Colisio #n"). | built: `rules/cleanup.ts` (ours also moves a unit off a gate, and keeps one on the player's land: DECISIONS.md) |
| Social buildings' free helpers | On open, a social building still waiting for staff that has no helper yet, and whose crew list has 3 or more, gets one helper free (`buy_si_help`); one with exactly one helper and a crew of 7 or more gets a second. | not yet (social buildings are for later) |
| Leaving a map | Sends what's queued, then `get_player_info` for the next map (with `privateState=1` for a player battle); on a neighbour, sends the visit's helps first. `game_status` "LOAD_MAP" with where from and to. | built: visits reload the page (`visit.ts`), quests in `questPlay.ts` |
| Raid and spy counters | 3 player attacks in each 6 hours (or a bought pack), not the same player within 4 hours; 3 spyings a day; market trades reset after 20 hours. | partly: the market's in `rules/market.ts`; player battles' counts on the server (`pvp.py`) |
| Fallen units | The save's dead list split into heroes (8 of them) and the rest, for the graveyard. | built: `rules/graveyard.ts` |
| Facebook and tracking | Bookmark, like, invite, gifts page, buying cash, share windows, error reports, status tracking. | not needed |

### The parts of `MapInitializer.as`

| Part | What it does | Status |
|---|---|---|
| Opening the home town | Units inside buildings are put back; wild animals on the player's land become the player's; out of the tutorial, 3 lost things and a villager if there is none. | partly: `rules/animals.ts`, `rules/cleanup.ts`; no lost things |
| The camp | When the troll timer is done and no chest waits: the wild ring is cleared ("CLEAN" plus the camp's number; the player's units walk home), the camp is put up, and clusters of idle trolls added. A camp number that doesn't exist for the race is moved on (humans skip 9 and 11) and reported with `collect_treasure`. | built: `homeCamps.ts`, `rules/camps.ts` |
| Rocks growing back | A growing rock whose time is up is sold ("REGEN") and one of the four rocks bought free in its place. Done on open only. | built: `rules/work.ts` (ours checks every second, not only on open) |
| Trees, rocks and animals | Clusters of gold, stone and trees and 100 single trees, fewer the more there are; then sheep, cows, horses from level 11 (boars for trolls), no more than `ANIMALS_PER_DAY` a kind a day (`admin_add_animal`). | built: `rules/nature.ts`, `rules/animals.ts` |
| Raids | From level 25, 1 chance in 10 of a siege, stampede (30) or army (35); bandits from levels 10, 15 and 20 after 7, 14 and 21 minutes. The heavy siege is switched off (`Config.HEAVY_SIEGE`). | built: `rules/raids.ts`, `homeDefence.ts`; owner-requested recurring bands after lessons/rescue, five minutes to prepare and five to seven between fights (DECISIONS.md) |
| Extras on open | The Morocco dealer (only for a "gold member" page), offer buildings and other games' adverts. | not needed |
| Islands, survival, tournaments | Places the player's army at the landing tile (or a chosen edge for a player battle), and a tournament's two armies of up to 20 facing each other. | built: `questPlay.ts`, `attackPlay.ts`, `survivalPlay.ts`, `tournamentPlay.ts` and `rules/tournamentBattle.ts` |
| Free spawns | Villagers, units and allies bought free (`buy` with the free flag); the Allies Building's 9 knights. | partly: villagers built; the allies not yet |
| After the tutorial | Places a Dragon Breeding Nest free near tile (50, 60) and moves the dragon story 7 steps on. | not yet |
| Developer tools | Kill all, clear the map, test spawns. | not needed |

## Fixed numbers, words and helpers

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/Config.as` | 452 | The game's fixed numbers and switches: server addresses, map size and zoom limits, mine limits, population cap (175), raid levels, attack and spy counts, market prices, selling (a twentieth), villagers' speed and queue by town hall, collect times and multipliers, the level spells start (35), and feature switches (several off: heavy siege, fake friends, paying for goals). Also the key for signing replies. | partly: current town, player-battle, market and tournament values in `rules/`; remaining feature values follow their windows |
| `core/Constants.as` | 3765 | Names for numbers: about 1,100 item ids, 156 server command names, subcategories, the goals' definitions, projectiles, raid and AI states, sell reasons, cursors, keys, factions; and the share of units that come home after a battle (from the config's globals). | partly: commands all in `constants.py`; the goals in `rules/goals.json`; ids each `rules/` file needs |
| `core/Language.as` | 3264 | About 1,500 numbered text ids (windows, shop, collections, tutorial, quests, tournaments...) and 15 languages. The text itself comes from the config's `localization_strings`; fonts are loaded by language. | partly: English only; some lines read from the config (`homeDefence.ts`, `homeCamps.ts`), the rest written in the client |
| `core/GameStatic.as` | 417 | Helpers: random numbers and shuffles, date and time strings, a cost letter's icon frame, which neighbour buildings can be helped (mills, farms, mines but the treasure mine and the altar, ranches but the nursery and the training stables, collect buildings, wonders that house nobody). Its day string uses the weekday by mistake, but only the unused "upgrades today" count reads it. | built: `rules/neighbours.ts` (`canBeHelped`), `ui/format.ts` |
| `core/Utils.as` | 582 | Helpers: tile and pixel conversions, drawing order (fields drawn under everything), counted lists, the daily bonus day check (a new calendar day in the page's time zone; more than one day resets the run), weekday, same day. | built: `rules/geometry.ts`, `rules/bonuses.ts` |
| `core/Crypto.as` | 84 | Signs and checks replies with HMAC-SHA256 and a key. | not needed: anti-cheat; our pages turn the check off and the server ignores the command hash |

## A thing on the map and its data

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/BuildingReference.as` | 79 | One placed thing: its item, tile, facing, drawing order and its save row. | built: `PlacedItem` in `rules/town.ts` |
| `core/DynamicData.as` | 64 | The save row's fields: tile, facing, time collected, activation, level, units inside, extra attributes. | built: `rules/town.ts` |
| `core/ComplexBuildingInfo.as` | 20 | A save row with its item, used while sorting the map on load. | built: `rules/cleanup.ts` |
| `core/StoreObject.as` | 28 | One thing in storage or the gift box (with its gift id, or a phone box id). | built: `rules/storage.ts` (phone boxes not needed) |
| `core/CommandPacket.as` | 28 | One batch of commands: first number, when, tries. | built: `net/commands.ts` |
| `core/BBox.as` | 49 | The box round all the player's units; an enemy building only acts when its range meets the box. | partly: towers wake by range in `rules/battle.ts`, not by this box |
| `core/LargeTile.as` | 29 | Draws each block as owned ground or land for sale. | built: `view/townView.ts` |
| `core/BuildOutline.as` | 235 | The see-through building and its footprint while placing, green where it fits and red where not; the white outline of the hovered building. | built: `editor.ts`, `view/selected.ts`; delayed placement art keeps its captured origin (`view/townView.ts`, 16 October 2026) |

## Rising numbers, tokens and bars

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/NumberParticle.as` | 244 | The numbers and icons that rise after a purchase, a harvest or a sale. | built: `view/markers.ts` |
| `core/ParticleSystem.as` | 71 | Runs the rising numbers; keeps no more than 7 at once. | built: `view/markers.ts` |
| `core/Token.as` | 443 | Gold, experience, wood, food, stone and collection pieces dropped on the map to tap; they pick themselves up when 6 or more lie about. Gold and the rest only add to the top bar at home (the server counts them). | partly: values rise and count at once (DECISIONS.md), collection pieces too (`rules/collections.ts`) |
| `core/FauxBar.as` | 98 | The short "collecting" bar (about two thirds of a second) before a harvest is counted; the glove skips it. | not yet (PARITY.md, "Small things") |
| `core/FauxBar2.as` | 78 | The bar after accepting a neighbour's request on arrival: 10 gold and 3 experience (the config's `ASSIST_REWARD_*`), then `assist_neighbor` at once. | not yet: the arrival request isn't offered (the server has `assists.help_request`) |
| `core/FauxBar3.as` | 103 | A timed bar over a building: the 10-second construction (a third as long in the tutorial) and other waits. | not yet (PARITY.md, "Construction") |
| `core/ToolTip.as` | 83 | A small label with a pointer, used by the menus. | built: labels and titles in `ui/` |
| `core/FotoNeighbour.as` | 43 | A friend's picture over a building they helped, to accept their help. | built: `view/friendBubble.ts`, their initial for the picture |

## Spells and special moves

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/MagicManager.as` | 504 | The spell book: which spells are learnt and cast how often, aiming (lights up who it hits), casting (`use_magic`, mana taken), shields, and mana for each level from `START_LEVEL_MANA_REWARD` (36). | built: `rules/magic.ts`, `battleControls.ts` (home and islands); level mana in `levels.py` |
| `core/MagicParticle.as` | 810 | The effects of special moves and spells: 79 kinds (fire, lightning, auras, doubles, slime, freezing...), each with the frame it hits on and how long it lasts. Skimmed. | partly: effects drawn from sheets in `view/battleView.ts`, timings in `rules/specials-table.json` |
| `core/MagicParticleMinion.as` | 84 | An effect tied to one target unit, with signals on chosen frames. | partly: as above |
| `core/MagicParticleSpell.as` | 117 | A spell's effect from its own picture, hitting on its "attack" frame (frame 10 if it has none). | partly: as above |
| `core/SpecialUnitAttack.as` | 96 | One button of a special unit: uses, cast time, cooldown, picture, name. | built: `rules/specials.ts` |

## Camera, keys and the tutorial

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/Scene.as` | 389 | Short camera trips with black bars top and bottom (to a camp's chest, a quest's start), optionally zooming and coming back; Escape skips. The game pauses meanwhile. | partly: `camera.lookAt` for alerts; no trips with bars |
| `core/Key.as` | 108 | Which keys are down; any key let go ends a pause; two hidden key sequences show a joke message. | partly: keys in `view/camera.ts`, `editor.ts`, `ui/pause.ts`; no hidden sequences |
| `core/TutorialMain.as` | 786 | Arthur's lessons in the first town: steps with an arrow and a window, `complete_tutorial` at each, the last 15. The finale (three trees chopped) ends it, gives the Dragon Breeding Nest and offers a dragon. Skimmed. | built: `client/src/lessons.ts`, rules in `client/src/rules/lessons.ts` |
| `core/AprilFools.as` | 285 | On 1 April from level 5: villagers walk round the town hall complaining, and trees creep towards the middle and fight. Nothing calls it in this build. | not needed: switched off |

## Loading pictures and libraries

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/AssetLoader.as` | 113 | Loads extra files one at a time, up to 3 tries each, and keeps them. | built: `view/art.ts` |
| `core/ImageLoader.as` | 140 | Loads a picture from `images_new/` (by language when asked), with a spinner. | built: `view/art.ts`, `ui/` |
| `core/SwfLoader.as` | 129 | Loads an animated picture named in the config's image list. | built: art from `tools/art/` and the bucket |
| `core/ExternalClass.as` | 96 | Takes a class from an extra library (projectiles, magic effects) once it has loaded. | built: sheets in `view/art.ts` |
| `core/Stats.as` | 170 | A frame-rate and memory meter (the "/" key). | library |

## Windows, offers and collections

| Class | Lines | What it does | Status |
|---|---|---|---|
| `core/LevelUnlock.as` | 65 | One card in the level-up window: a building that just became available. | not yet (PARITY.md, "Level-up window") |
| `core/NoGifts.as` | 101 | The empty gift box picture, which opens the site's gifts page. | not needed |
| `core/PromotionPacks.as` | 234 | Offer packs bought with game cash: resources, mana and items (fixed, by chance, or the super pack's three tiers), into storage; `buy_offer_pack`, `buy_super_offer_pack`. | not yet (later; the server has `shop.offer_pack`) |
| `core/Collectible.as` | 40 | One collection piece: its collection, name, where it drops and how often. | partly: harvests' pieces in `rules/collections.ts`; the window is for later |

## Surprises

Rules and behaviour found here that our notes don't mention, most important
first.

1. **A stored unit's own limit.** The original won't place a unit from
   storage once the town has its `units_limit` of that kind (5 Healers, 4
   Monks, 3 of many gladiators...); only the Mummy and the Ent are let
   through. Our `rules/storage.ts` checks room for people and building
   limits, not this, so the new client can place one too many.
2. **The arrival request on a visit.** On a neighbour not helped in 24 hours,
   the first visit of a session opens a request (picked at random from the
   config's `neighbor_assists`); accepting gives 10 gold and 3 experience and
   sends `assist_neighbor` at once. The building helps of the same visit go
   on leaving (`assist_neighbor_new`). Our server marks the neighbour helped
   on the first, then refuses the second as "already helped today", though
   the Flash client showed their gold. Worth a test in `assists.py`. The new
   client doesn't offer the request.
3. **Free helpers for social buildings on open.** A social building waiting
   for staff with no helper yet and a crew list of 3 or more gets one
   `buy_si_help` free; with exactly one and a crew of 7 or more, a second.
   No button; it changes the save.
4. **The tutorial's prize.** Finishing Arthur's lessons in the Flash client
   places a Dragon Breeding Nest for free (`buy`, free flag) and sends 7
   `next_step`. Skipping in the new client sends only `complete_tutorial` 15,
   and the server only sets `dragonNestActive`, so no nest appears.
5. **Lost things on open.** Out of the tutorial, each home opening scatters 3
   lost things (a cow, a sheep, a crate, a barrel...) anywhere on the map.
   They aren't saved; tapping one removes it and calls
   `register_found_item.php` to share it with friends.
6. **The classic game resets experience on open.** From level 5, each time
   the home town loads, the Flash client sends `rt_publish_score` with its
   experience, and our server writes it over the save's experience and
   level. Harmless when it has just loaded, but a classic tab left open
   while playing in the new client could send an old number.
7. **Rocks grow back on open only.** The original checks growing rocks when
   the town opens; ours checks every second (`editor.ts`), so a rock can
   come back mid-visit. Same commands, different moment.
8. **The heavy siege is switched off** (`Config.HEAVY_SIEGE` false), though
   the server knows `start_heavy_siege` and `reset_heavy_siege`.
9. **The speed-hack check is off** (`SPEED_HACK_CONTROL` 0 in the config).
   Were it on, it would pause the game and send `system_set_count_hack`,
   which our server doesn't handle.
10. **Dead code:** the April Fools prank, the Halloween pumpkin, fake
    neighbours, the "upgrades today" count and the Morocco dealer (it needs
    a page flag we never send) never run.
11. **Arrow keys steer ships.** With a ship, boat, eagle or zeppelin unit
    selected, the arrow keys move it one tile at a time as well as
    scrolling.
12. **Placing from storage gives no experience.** Only gifts do; the
    Level-Up Statue as a gift fills the bar to the next level, from
    storage it gives nothing. Ours matches; noted because it's easy to get
    wrong.
