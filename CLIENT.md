# New game client: scope

Phase 4 of the [roadmap](ROADMAP.md): replacing the Flash client with a
modern one that draws the same art and talks to the same server. This is a
first pass at what that involves, measured on the client we run today
(0.9.26b) in October 2026. Steps 1 and 2 below don't change the game's
server, so they went ahead alongside Phase 2 and Cash. Both are built: the
art pipeline ([step 1](#step-1-the-art-pipeline)) and a page that shows your
town with PixiJS ([step 2](#step-2-look-at-your-town)).

## In short

- **The Flash client is the whole game, not just its pictures.** The server
  only records what the client says happened. A new client means writing the
  game again: about 184,000 lines of decompiled ActionScript, roughly 25 times
  the size of our whole server.
- **The art can be reused.** Most buildings are a single picture. Units are
  pre-drawn pictures with labelled animations. A test conversion was
  pixel-perfect and, as WebP, smaller than the original Flash file.
- **It can be built a piece at a time.** The new client can talk to the server
  exactly as the Flash client does, so both can run side by side on the same
  saves, and players move over when the new one does what they need.
- **Recommendation:** TypeScript, PixiJS 8 to draw the map, windows in HTML
  and CSS, and the game rules kept apart from the drawing code.
- It is the biggest project on the roadmap, bigger than Phase 2. Its first
  step, turning the Flash art into ordinary image files, is built:
  `tools/export_art.sh`.

## Why replace it

What the Flash client costs us today:

- It runs inside Ruffle, an emulator. When Ruffle gets something wrong, we
  can't fix it (WebGPU crashed the game, for example).
- The game is laid out for 760 × 600 and scaled to fit the window: its
  pictures go soft on a big screen, everything is tiny on a phone, and it is
  made for a mouse, not fingers.
- We can hardly change it: switching on its welcome-back bonus took
  patching three bytes of the file (`tools/patch_client.py`). New units and
  buildings need new Flash files.
- It decides what happened, and the server believes it. That is the cheating
  gap in the [Cash](ROADMAP.md#cash) section.

What a new client gives:

- Sharp at any size, real full screen, phones and tablets.
- New content as ordinary image files and game config.
- Client code that is ours, so we can change how the game behaves.
- The option to let the server check results (see
  [Who decides what happened](#who-decides-what-happened)).

## What the Flash client does today

### It is the whole game

1. On start, the client asks for the game config (`get_game_config.php`), a
   2 MB JSON file with every item, level, mission and piece of text, and for
   the player's save (`get_player_info.php`).
2. From then on it plays the game by itself: timers, building, battles. As
   the player plays, it sends the server batches of what happened (`command.php`),
   for example "bought item 26 and placed it at 52, 52". The server replays
   the batch onto its copy of the save and answers "success".
3. A few more calls cover the world map, player profiles and error reports.

So the rules of the game live in the client. The server's 105 commands copy
their effects onto the save; they don't decide them.

### How big it is

Decompiled locally with `tools/decompile_client.sh` (the output is never
committed). These are lines of decompiled code, which is wordier than code a
person writes, so a rewrite will be smaller. The order of size still holds.

| Part | Lines | What it covers |
| --- | ---: | --- |
| Windows and menus | 41,300 | About 100 kinds of window (shop, quests, temple, dragons, market...) and the toolbar |
| Item behaviours | 36,700 | 350 small pieces of code for buildings and units that do something special |
| Quests | 20,000 | The islands and survival mode |
| Special units | 18,700 | 115 units with code of their own: dragons, colossi, heroes, bosses |
| Map engine | 15,400 | The isometric map, and what every building and unit can do: be placed, move, fight, be clicked |
| Battles | 10,400 | Unit behaviour in battle, projectiles, attacks on other empires, spells |
| Everything else | 41,200 | Loading, talking to the server, the tutorial, particles, settings |
| **Game code in total** | **184,000** | About 25 times our whole server (7,500 lines of Python) |

Not to rewrite: 11,700 lines of libraries (animation, JSON, encryption) and
12,500 lines of small classes that Flash generates for pieces of art.

The long tails stand out: 115 special units, 350 special items and about 100
windows, each to be looked at one by one.

All of it is now mapped, class by class, in
[docs/original/](docs/original/README.md): what each part does in our own
words and how far the new client has got, with rule books for running a
town and the rules that run with no button.

### The art

Measured by reading the frames, pictures and animation labels in every Flash
file, and by exporting one unit with FFDec (the decompiler that
`tools/decompile_client.sh` builds).

| What | Files | How it's made | Converting it |
| --- | ---: | --- | --- |
| Buildings | 900 | 571 are a single picture; the rest have a few | Easy: take the pictures out |
| Units | 669 | Pre-drawn pictures (69 per unit, typically) on a timeline, in 5 directions; the other 3 are mirrored. Animations are labelled in Spanish: idle `QUIETO`, walk `ANDAR`, attack `ATAQUE`, death `MUERTE`, hit `PICAR` | Mostly automatic: 347 have only those animations and 220 add a special move. 102 (bosses and the like) are laid out their own way and need a look by hand |
| Effects | 244 | Particles, projectiles and spells, mostly vector drawings; also 35 of the game's sounds | Render to frames, or redo with the engine's particle effects |
| Windows and buttons | (the client) | Inside the client file: 1,347 vector shapes and 365 pictures | Rebuild in HTML and CSS, reusing the pictures |
| Music, thumbnails, backgrounds | 2,557 | Already MP3, JPG and PNG | Nothing to do |

**Test:** the Advanced Catapult (`767_lanzapiedras.swf`, 0.94 MB) exported in
7 seconds: 59 pictures, five directions and every animation, identical to
what the game shows. As PNG the pictures take 3.1 MB; as WebP at quality 85,
0.73 MB. So the converted art doesn't need to be bigger than today's 1.3 GB.

The asset pipeline is therefore the first step of the new client: one script
that turns the Flash files into sprite sheets (WebP) plus a small JSON file
per item naming its animations. It is built for buildings and units; see
[Step 1](#step-1-the-art-pipeline).

## Choices

### Engine

| Option | What it is | For | Against |
| --- | --- | --- | --- |
| Stay on Ruffle | Keep the Flash client | No work | Every limit above stays |
| **PixiJS 8** (recommended) | A fast 2D drawing library (WebGL and WebGPU) | Mature, light, made for many sprites on screen; we keep full control | We put the rest together ourselves: camera, sound, animation timing |
| Phaser 4 | A full game framework with its own renderer | Scenes, loading, input, sound and animation included | Bigger; version 4 is new (2026); its extras, like physics, aren't needed here |
| Godot or Unity, exported to the web | Full game engines | Strong editors | Large downloads and a slow start in a browser; harder to mix with HTML windows |

Neither PixiJS nor Phaser draws isometric maps for us, so the map is our code
either way. The choice matters less than it looks, as long as the game rules
are kept out of the drawing code. Step 2 below (drawing a real town) is where
we confirm it: if PixiJS struggles there, switching is still cheap.

**Chosen: PixiJS 8** (October 2026). Step 2 draws a fully grown town of 400
items with it, animated and in order, with smooth zooming; nothing needed
more than PixiJS gives.

### Windows in HTML, not drawn by the engine

The game has about 100 kinds of window. Built as HTML and CSS on top of the
map, they are sharp at any size, easy to fit on a phone and easy to
translate, and the extracted pictures can still be their backgrounds and
icons. The engine draws only the map, the units and the effects.

### Who decides what happened

Today the client decides and the server believes it. There are two ways
forward:

1. **Keep it that way at first** (recommended). The new client sends the same
   commands as the Flash client. No server changes, the same saves, and both
   clients side by side.
2. **Let the server decide.** The server checks timers, costs and battle
   results. That closes the cheating gap, but the battle rules then have to
   run on the server too.

To keep the second way open, battles are written to be repeatable: a seeded
random number generator and a fixed time step, so the same battle with the
same armies always ends the same way. Later the server, or a small
TypeScript service next to it, can replay a battle and check what the client
reported.

## How we'd build it

**Side by side.** The new client is a second game page on the same server and
the same saves. Players can try it and go back to the Flash client at any
time. The Flash client stays until the new one does everything players
actually use; the bug radar on the admin page shows what that is.

| Step | What it delivers | Size |
| --- | --- | --- |
| 1. Art pipeline (built for buildings and units) | A script that turns the Flash files into sprite sheets and animation files on R2 | Small |
| 2. Look at your town (built: `/client.html`) | Load the config and the save; draw the map, buildings and idle units; scroll, zoom, full screen, touch. Read-only. Confirms the engine | Medium |
| 3. Run your town (started: shop, storage, move, turn, store, sell, collect, levels) | Collect, build, move, store, sell, the shop, levels, sending the same commands as the Flash client. The server's tests show what each command looks like | Large |
| 4. Battles | Island quests, unit behaviour, projectiles, spells, attacking other empires | Largest |
| 5. Everything else | The world map, temple, collections, market, dragons, survival, darts, the time machine, the tutorial, sound; the special units and items | Large, long tail |
| 6. Switch over | The new client becomes the default; the Flash one stays as "classic" for a while | Small |

After step 3 the new client is already a working town builder for players
who aren't fighting, which is a good moment to open it as a beta.

**In the repository:** a `client/` folder (TypeScript, built with Vite), with
the game rules (`rules/`, no drawing, unit-tested), the drawing (`view/`,
PixiJS), the windows (`ui/`) and the server calls (`net/`) kept apart. The
server's Docker image builds it; the art goes to R2 with a GitHub workflow.

### Step 1: the art pipeline

`tools/export_art.sh` turns the buildings and units (the 1,587 files in
`assets/buildingsprites/`) into sprite sheets: `art/sheets/<item>.webp` and
`<item>.json`, named like the item's `img_name` in the game config. It needs
a Java JDK (for FFDec, which `tools/ffdec.sh` builds) and Python with Pillow,
and takes more than a day on one 4-core computer, almost all of it for the
biggest animated dragons and bosses (up to two hours each; most items take
seconds). `art/` is not committed: the **Export art to R2** workflow makes
it on 8 machines at once, in about four hours, and puts it in the bucket
under `art/` ([DEPLOY.md](DEPLOY.md)).

**How the files are laid out**, read from all 1,587:

- **Units:** one sprite, named after the file. For each animation it has 5
  frames, one per drawn direction; the game mirrors these for the other 3.
  The animations are labelled `QUIETO` (idle), `ANDAR` (walk), `ATAQUE`
  (attack), `MUERTE` (death) and `PICAR` (work: empty for units that don't),
  and about 1 unit in 3 adds special moves (`sp attack1`, `RAY`, `LIMIT`...).
  A frame shows either one picture or a child animation that plays by
  itself, like the catapult's 87-frame attack.
- **Buildings:** 873 of 898 have 2 frames and no labels: the two ways a
  building can face, each drawn separately (not mirrored). A few have more
  frames, for animation or variants.
- Units play at 30 frames a second, most buildings at 24.

**What the script does:**

1. `tools/art/RenderSwf.java` draws every frame of the item's sprite with
   FFDec's renderer, letting child animations play, as the game does when it
   jumps to a frame. All of an item's pictures share one canvas, so the point
   the game positions the item by is at the same pixel in each. A picture
   repeated across frames is kept once. It also notes each frame's box as
   Flash measures it, transparent edges included: the game places buildings
   by it. When something is drawn outside the sprite's bounds and reaches
   the canvas's edge (a glow on a part inside, as on some decorations), it
   draws the item again with more room. Only pictures are read, never code.
2. `tools/art/pack_sheet.py` trims the empty space, packs the pictures into
   one WebP (quality 85, transparency kept exact) and writes the JSON in
   TexturePacker's "JSON hash" layout, which PixiJS and Phaser both load as it
   is: where each picture is, its anchor, and each animation as
   `<label>/<direction>` (for example `ATAQUE/2`), one picture per frame.
   What doesn't fit in one 4,096 x 4,096 image (big bosses, the ground) goes
   on more pages, `<item>-1.webp` and so on. Each batch of 5 items is packed
   as soon as it is drawn and its pictures deleted, so the export needs
   little disk space; small files go first, the big animated bosses last.
3. `tools/art/preview.py` plays a sheet back into an animated WebP, reading
   only the sheet and the JSON, to check it by eye against the game.

The Advanced Catapult, for example: 435 frames drawn, 61 different pictures,
one 1,750 x 1,854 sheet of 0.58 MB (the Flash file is 0.94 MB).

Found on the way: `1410_bahamut_heart.swf`, the Bahamut Heart, is an empty
file in the repository, so neither client can draw it.

**Made: 1,575 of the 1,587** (October 2026), and the last 11 (Beta 2's first
slice) with three changes, each found on one of them:

- **Too big for a sheet.** Some pictures are bigger than a whole sheet
  (4,096 pixels each way, the most phones' graphics chips accept), like the
  water gods and the abyss dragons (up to 6,479 x 4,278). The packer then
  stores the item's pictures at half size (a quarter if need be) and says
  so in `meta.scale`; PixiJS reads it and draws them at full size, and the
  client's tap test and thumbnails allow for it.
- **Too many pictures.** An item may take at most 4 sheet pages (each up to
  64 MB in a graphics chip). The chained water god, a 4 x 4 decoration
  whose 13-second animation is 394 pictures of nearly 4,000 x 2,500 pixels,
  would have taken 48 pages. Over the budget, the packer stores pictures
  smaller first, then holds each picture for 2 or 3 frames
  (`meta.step`), until the item fits: the god is 5.4 MB at a quarter size,
  each picture held 2 frames.
- **Too slow, or a crash.** The biggest dragons and gods have up to 5,500
  pictures to draw on canvases of millions of pixels: hours on one
  processor core. With fewer items than cores left, `RenderSwf` now draws
  an item's frames on several threads at once (each thread with its own
  copy of the file), pixel for pixel the same, and an item gets 4 hours
  instead of 2. The medieval slayer crashed because a part of it is placed
  15 million pixels away; a canvas that big is now cut to 4,096 pixels
  around the item, where it really is.

The projectiles and effects are made the same way: `assets/fx/` (blasts,
beams, the spells' pictures) as items of their own, and the projectiles
from one clip in the game's library (`05122012_projectiles.swf`,
`ProyectilMC`), whose frame n is projectile n: each becomes a small sheet,
`projectile_<n>` (the arrow is 400 bytes), so a battle loads only the
shots it shows.

**Existing exports are not rebuilt automatically.** The exporter skips an
item whose main JSON already exists. On 16 October, the public
`2075_elemental_red_god` bundle still predated the packing budget: 76
pages, about 3.79 GiB decoded, enough to exhaust the browser test machine.
The unchanged current exporter makes two pages, about 124 MiB, for that
item. A guarded browser check also found eight oversized bundles loaded
by the island before the team picker; refreshing the selected unit alone
is insufficient. With subsequent owner authorization, Codex ran the
targeted **Export art to R2** workflow for all nine. Cloudflare initially
served old cached WebP images alongside the new manifests. After the
owner purged the 20 image URLs, all images verified against the fresh
export at 11:24 UTC, both without Origin and with
`Origin: https://socialemperors.me`; their dimensions match the JSON.
The refreshed-cache `team` check now passes alone and in the full suite;
the art follow-up is closed in #91. No further export or purge is pending
for these items. The workflow
inputs, purge list, cache refresh and verification are in
[the art repair notes](docs/art-loading-repair.md). A browser test's disk
cache in `.tools/art-cache/` does not expire by itself.

Still to do for the art: the sounds inside the Flash files, and the
scaffolding pictures for buildings under construction (in
`assets/swf/120608_dynamic.swf`).

### Step 2: look at your town

`/client.html` is the new client's page, offered on the home page as "The
new game (preview)" next to Ruffle and Flash. It opens the same empire with
the same signed game token, asks for the game config and the town exactly as
the Flash client does (`get_game_config.php`, `get_player_info.php`) and
draws the town (step 3 adds changing it). `/client.html?visit=<player id>`
shows another player's town, as visiting a neighbour does, to look at only.

- The ground and every building and unit, in the game's drawing order, each
  where the Flash client puts it: side by side with the Flash client, a new
  town lines up, and the walls of a fully grown town meet without gaps.
- Units waiting in town play their idle animation, animated buildings theirs,
  each from a random point so a crowd doesn't move in step.
- Drawn as often as the screen shows a new picture (60 or 120 times a
  second; Flash drew 24 or 30), and sharp on high-resolution screens.
- Drag to move, with a glide after letting go; wheel or pinch to zoom,
  smoothly, around the pointer; the arrow keys, as in the Flash client
  (letters are the menus' shortcuts: with WASD too, S, A and W did both);
  full screen; phones and tablets.
- A bar in HTML with the player's name, level, resources and cash, and a way
  back to the classic game.

**How a town is laid out**, read from the Flash client (our notes, our words):

- 100 x 100 tiles, drawn as 2:1 diamonds 108 px wide and 54 high: one tile
  along x moves 54 px right and 27 down, along y 54 px left and 27 down. The
  map is cut into 5 x 5 blocks of 20 x 20 tiles; players open the middle
  3 x 3 (the save's `expansions`, numbered 1 to 25 across, then down). The
  outer ring is never opened.
- A building's x and y in the save name the last tile of its footprint. Its
  picture stands with its bottom centre on that tile's bottom corner, the
  picture measured as Flash measures it, transparent edges included (a
  picture with transparent margins would otherwise sit up to 32 px off).
- A unit stands in the middle of its tile, half a tile higher. In town it
  faces down-right, down or down-left, by chance. Its art draws 5 directions
  (up, up-right, right, down-right, down) and mirrors 3 of them.
- Drawing order, back to front: by tx + ty - width; farms under everything.
- The ground: each block is one 2,160 x 1,080 terrain picture for the
  island's skin (item 1000 + skin): open land as it is, the rest darker.
  Trees change with the skin. Around the island, a flat colour per skin.
- The camera starts where the Flash client's does, at its zoom (0.7 of its
  760 x 600 stage, scaled to the window), and zooms from 0.15 to 1.4 likewise.

**Code:** `client/`. `npm run build` there makes `client/dist/`, which the
server sends at `/client/`; `npm test` runs its tests with Node's own test
runner (no test library needed). Everything, PixiJS included, is 252 KB
(74 KB compressed). The page needs the sheets in the bucket: run **Export
art to R2** before trying it on staging; until then items show as outlines.

**Not yet:** buildings under construction (the game shows scaffolding), the
villagers working at trees and mines, the "for sale" signs on closed land,
what the Flash client adds by itself (lost objects, wandering trolls...),
effects and sound. A big town (400 items) took 16 seconds to load on our
test machine, a busy server with no graphics card; staging will show what
players get. (Since then: under 3 seconds with its art cached, about 10
the first time; see "Sound and speed".)

### Step 3: run your town

Built so far: **the shop and building**, **storage**, **move, turn, store
and sell**, and **collecting from buildings**, with levels. Tap (or click) a building
to select it; a bar at the bottom shows its name and what can be done with it.
What's selected is marked as in the Flash client, with its own pictures: a
unit stands on a golden ring (that walks with it), a building's ground gets
a golden outline of its size (1x1 to 6x6), and a small life bar shows over
either, green, red for what a raid took (`view/selected.ts`, test
`e2e/tests/selected.mjs`). Selling (with the bulldozer) asks first and says what it gives back. While moving, the footprint
under the pointer shows green where it fits and red where it doesn't; tap
the new place, or Cancel (Escape). Tapping picks the picture actually under
the finger, not its box, so a tree in front of a house doesn't steal the tap.

**How the changes reach the save:** exactly as the Flash client sends them,
so both clients can be used on the same empire. Actions wait in a queue and
go to `command.php` in a batch every 3 seconds, one batch at a time; a batch
that fails is tried again, up to 3 times, then the player is told to reload.
What's left when the page closes is sent on the way out. Our copy of the
town changes at once, as in the Flash client, so the game doesn't wait for
the server.

**The rules**, read from the Flash client (our notes, our words):

- A building covers width x height tiles back from the tile the save names,
  whichever way it faces (turning doesn't swap them). A unit takes its own
  tile.
- Something fits where all its tiles are on bought land (the save's
  expansions) and none is taken by a building or a standing unit.
- Turning goes round the item's ways of facing (its art's frames). Space
  turns a building while it's being placed or moved, as in the Flash
  client: it's bought, placed or moved facing that way (cancelling a move
  turns it back). The server keeps the facing a `move` sends (it didn't).
- Selling gives back a twentieth of the price, in what it was bought with,
  rounded down; nothing for things bought with cash. What comes back rises
  from it as it goes ("+3 gold"), as in the Flash client.
- Whose things are: an item's `race` in the config says. The player's own
  people's ("h" or "t") and anyone's ("a") are the player's; trees, rocks,
  scenery, treasures and lost things are nobody's ("n"). Only the player's
  can be moved, turned, stored or sold.
- What the info panel offers: most of the player's buildings can be moved,
  turned, stored and sold. The town hall can only be moved and turned.
  Treasures, scenery and boss statues can only be sold (the bulldozer).
  Units have no buttons. What stands on the wild ring around the island
  isn't the player's.
- The bulldozer also clears gold and stone rocks, though they're nobody's,
  but only from bought land; they give nothing back, so the button says
  Remove. Trees can't be removed: a villager cuts them, for wood.
- The commands: `move` (old place, item, new place, facing, town),
  `orient` (place, new facing, town), `sell` (place, item, town) and
  `store_item` (place, town, item).

**Collecting.** A building that's ready has a bubble over it in the colour
of what it gives; tap it, or its bubble (part of the building, as in the
Flash client), to collect: the game's short bar runs at its foot with
"Collecting..." (about two thirds of a second, as there), then the
harvest and experience rise from it. The glove collects at once, without
the bar. Mills and mines whose workers wait for orders show "zz": tapping
asks how long they should work, with what each choice gives. Selecting a
producing building shows when it will be ready.

**How production works**, read from the Flash client (our notes, our words):

- Each round of work starts at the time the save keeps for the building
  (`item[4]`, the server's clock); it's ready once its working time has
  passed since then. The Flash client counts it up second by second; we
  work it out from the clock, which comes to the same.
- Three kinds of producing building:
  - with workers (farms, ranches, troll mills and mines): they work while
    units are inside, for the config's `activation` seconds, then again;
  - with a working time (human mills, and gold, stone and lumber mines:
    the config's `COLLECT_VARIABLE_IDS`): units inside, and the player picks
    5 minutes, 1, 4 or 8 hours for half, once, twice or three times the
    harvest (`activate` with 1 to 4). After each collect they go back to
    sleep (`activate` with 0) until the player picks again;
  - on their own: anything else with a working time and no room for
    workers (wonders, the bakery, the restaurant, the temple, the Cash
    Wonder's 1 cash a day), round after round.
- The harvest is the config's `collect`; each worker after the first adds a
  fifth, then the working time's share; all rounded down. Farms use up a
  third of their harvest in wood (rounded). The config's `collect_xp` comes
  with it.
- A ranch's harvest uses up its first animal, for good (the Nursery keeps
  its own): `pop_unit` (place, town, the animal) with no tile, after the
  `collect_new`. When the last has gone the ranch stops. The Flash client
  shows the animal flying off; for now a "−1 Sheep" rises with the harvest.
- Collecting sends `collect_new` (place, town, item, workers inside, 1, 0),
  and its work starts over then. The 1 is a bonus the Flash client only
  gives gold rocks on the map; the 0 is cash paid to hurry it.
- Levels: when experience reaches the next level's in the config's `levels`
  table, the town goes up one level at a time, each paying its prize, and
  sends `rt_level_up` with the new level (the server pays the same prize
  into the save).
- **The level-up window** (`ui/levelUp.ts`, test `e2e/tests/levelup.mjs`),
  as the Flash client's: one for each level reached, one after another,
  with the level-up sound; the game's parchment in its wooden frame and its
  title band, "LEVEL 7!", "You've reached Cadet rank", "You can now buy:"
  and up to four buildings first sold at that level for the town's people
  (the game's thumbnails, `rules/levels.ts`, `unlockedAt`), and "Level
  reward:" with the prize (and from level 36 "+2" mana). An open shop
  redraws its cards for the new level. The original's Share and Skip both
  only closed it; ours has OK (DECISIONS.md).
- Not the same as the Flash client: a farm collected without enough wood is
  left as it is, with a message; the Flash client lets it go to waste.

**The shop.** The Shop button opens a window with the game's categories
(Village, Defense, Army, Decorations, Wonders, New) and their tabs, and a
card for each building: its picture (the Flash client's own,
`buildingthumbs/<img_name>.jpg`, loaded as the card scrolls into view;
drawn from the map's sprite sheet for the few without one), price,
experience, and what stops buying it ("From level 11", "You have one",
"Not enough wood").
Choosing one closes the window and the building follows the pointer,
see-through, with its footprint green or red; each tap buys one, until Done.
On a phone there's no pointer to follow, so a tap shows it there and a tap
on it then buys it (a tap elsewhere shows it there instead); moving a
building works the same way (test `e2e/tests/phone-place.mjs`).

**How the shop works**, read from the Flash client (our notes, our words):

- Humans are sold items whose `in_store` is 1 or 3, trolls 2 or 4. An item
  shows from its `store_level`, and can be bought from its `min_level`, or
  sooner if the save has it unlocked (`privateState.unlockedEarlyBuildings`,
  from the old site; nothing in the game unlocks one now).
- Each category lists its items by `display_order`, the locked ones last;
  its tabs are the config's `categories` table, by `subcategory_id`. The
  New category has its own items, and the other categories' new ones
  (`new_item`) and cash ones in tabs of their own. Two castles are for gold
  members only, which nobody is here.
- How many a town may have: one of each level of mill and of gold, stone and
  lumber mine; one of about fifty special buildings (the university, temple,
  bakery, markets...); one market and one eagle building; three nurseries;
  and 400 towers bought with resources per block of land.
- Buying pays the price (`cost`, in `cost_type`) and gives the item's `xp`,
  then sends `buy` (item, place, facing, town, 0, 1, "b"); the server does
  the same to the save. A building that produces starts its first round
  then. The Flash client also stays ready to place another, until the
  player stops.

**Storage.** As in the Flash client, the storage is part of the same
window (the Storage button opens it there): a card for each thing kept,
with how many, Place and Sell. Place works like building, for one, free;
Sell asks first, on the card itself.

**How storage works**, read from the Flash client (our notes, our words):

- Two boxes: gifts and prizes (`privateState.gifts`), shared by the
  player's towns, and what a town put away (`map.store`). Both are counts
  by item id; older saves keep them as lists indexed by id.
- Placing one obeys the shop's limits (one mill...), and not what belongs
  to the other people's towns (a troll's thing in a human town). A gift
  also gives its experience when placed; the level-up statue gives what's
  missing for the next level. `place_gift` or `place_stored_item` (item,
  place, facing, town).
- Selling one gives back a twentieth of its price, rounded down; nothing
  for cash things, the Dock or the Zeppelin Tower. `sell_gift` or
  `sell_stored_item` (item, town). The town hall can't be sold; the
  Bahamut Heart and the pieces of special collections are only kept.
- Units can be stored too (heroes); placing one needs room among the
  town's people and obeys its kind's limit, as training does (the Mummy
  and the Ent are let through, as in the Flash client).
- Social buildings (the Summit, the Allied Markets...) are in the classic
  game for now, but as the town opens the new client hires the Flash
  client's free helper for one waiting for staff: one when its staff list
  is empty and it has 3 places or more, a second when it has one and 7 or
  more (`buy_si_help`, free). Test: `e2e/tests/town-rules.mjs`.

**Tested:** the rules and the command queue have unit tests (`npm test`).
The browser tests are in `e2e/tests/`, and `node e2e/run.mjs` plays them
against a server of its own with a throwaway database. One edits a new town
(turns a tower, moves a house, finds a tree can't be sold, sells a house,
stores a tower) and checks the server's save afterwards: every
change is there, with the refund, and reloading shows the town as it was
left. Another sets a new town up as the Flash client would (a farm and a
gold mine with a villager each, a sheep ranch with a sheep), then in the
new client chooses the mine's working time and collects the farm and the
ranch: the save has the harvests, the farm's wood, the experience, level 2
with its prize, the timers started again, and the ranch's sheep used up. A third buys three farms and a mill in a new
town through the shop: placing on the town hall is refused, placing goes on
after each farm and stops after the mill (one per town, and level 2 with
its prize), the mill's card then says "You have one", and the save has all
four, the wood paid and the experience. Another checks the original's
rules for nobody's things (a tree has no Sell, a stone rock on bought land
can be removed) and the storage: a tower and a house stored, the tower
placed again, the house sold for 1 wood; the save agrees. The walk test
sends a new town's Light Knight round the town hall and checks the save
has it where it stopped, that closed land is out of reach, and that it's
there after reloading. The work test sends one villager to the trees by
the houses (it cuts one and goes on to the next), one to a stone rock
(which leaves one growing back) and one into a gold mine, lets it out
again, and checks the save after each. The train test trains villagers at
a new town's hall until there's no room (6 of 11 people to 11 of 11), and
checks the save has them and the food paid. The cash test takes a town to
level 20 (its prizes give cash), buys land for cash after gold is refused,
finds House IV can't be opened early, hurries a gold mine and trades cash for gold at the
bank, checking the save for each. The bonus test checks there's no daily
bonus or welcome-back chest at level 1; at level 5, on the empire's first
day, the chest's window says to come back tomorrow, its chests shut (one
can't be opened before an empire is a day old, which a test can't make:
the rules test and the server's `test_comeback_bonus.py` cover it); it
collects the daily bonus's first day, reaches the first
goal by building a farm (its gold is paid), and checks that goals have no
Skip and that the save has
the goal and the bonus. The menus test
opens every window from the rail, checks one is open at a time with its
button lit, visits another test player from the neighbours list, and on a
phone checks the dock, short numbers and the sheet closing when dragged
down; the collect test ends with the glove collecting two buildings. The client is
now 309 KB (93 KB compressed).

**Not yet in step 3** (Beta 1's next slices): turning a building while
placing it (units walk, villagers work, and land and cash are in now:
[Units walking](#units-walking), [Villagers at work](#villagers-at-work)).
Moving on a phone places on
the first tap, without the green/red preview a mouse gets.

**The look.** The windows take the site's look (parchment in a wooden
frame, gold buttons, a round font) and the Flash client's own pictures:
its resource icons with each number in the top bar, its experience star
with a bar to the next level, its Build and gift-box buttons at the bottom
right (Storage), its info panel's tiles for Move, Turn, Store and
Upgrade (and the whole panel since: "The building card"), its resource icons and "zZ" in the bubbles over
buildings, and in the shop's prices. `tools/art/export_ui.py` draws them
from the game's file (`tools/art/RenderSymbols.java`, which finds a picture
by its class or by the names the game's code gives its parts, like
`GuiMC/bgBar/storeButton`) at three times their size, into
`client/src/ui/art/`. Food is a carrot of our own (`food.svg`, in the
game's style) instead of the game's steak. The game's fonts (Arial Rounded
Bold and Eras Bold) are licensed fonts we can't hand out: the page uses
the player's own copy of the first when they have one, or Nunito.

### The menus: rail and dock

The owner picked this layout in October 2026 (option 3 of the plan's
three); it is built (Beta 1's first slice): `ui/menus.ts` (the buttons),
`ui/panel.ts` (the windows), `ui/hud.ts` (the numbers, the glove and the
messages), `ui/actions.ts` (the selected thing's card), and the windows in
`ui/shop.ts`, `ui/neighbours.ts`, `ui/world.ts` and `ui/army.ts`. The same buttons and
windows are arranged one way on a wide screen and another on a phone,
using the game's own button pictures (`client/src/ui/art/`).

**Wide screens** (computers, tablets held sideways):

- A **rail** down the left edge, parchment in a wooden frame, with Build,
  Storage, Army, Quests, Battle and Neighbours, each the game's picture
  with its name under it. The open one is lit in gold.
- Beside the rail at the top: the **level** (the experience star, the
  level, a bar to the next) and the **resources** (gold, wood, food,
  stone, cash) as dark pills with the game's icons. Classic game and Full
  screen stay at the top right.
- **Windows open as a panel on the right**, about a third of the screen
  wide and nearly its full height, with a title and the game's close
  button. The town stays in view, and can still be scrolled and tapped.
  - Shop: category tabs that wrap onto a second line when they must, then
    the game's pictures three to a row with their prices. Things above the
    player's level are grey, with "Level N" in red, as in the original.
  - Neighbours: a list, one row each (picture, name, level, Visit).
  - Battle: a row per mode (Attack a player, Survival, Tournament), each
    with its icon, a line on what it is, and Play.
- A **selected building's card** sits at the bottom middle: the original's
  info panel on its parchment ("The building card", below).

**Phones held upright** (or any narrow screen):

- A **status bar** across the top: the level with its bar, and the
  resources with short numbers (12.4k). The empire's name is left out
  there: today's page cuts it to "E…" on phones.
- A **dock** across the bottom: Build, Storage, Army, World, Neighbours.
- **Windows open as sheets** over the lower half, just above the dock, with
  a handle at the top: drag down or tap close to put them away. World's
  sheet lists Quests, Attack a player, Survival and Tournament.
- A selected building's card sits just above the dock.

**In both:** messages slide in at the top instead of over the middle of
the town; red counts on buttons for what's waiting (gifts, ready
buildings); and a **Collect all** button, like the original's fast-collect
glove. The site's own links, the classic page's bar, are in a gold
**Menu** after Full screen (on a phone, after Classic game): Friends,
opening the site's Friends page in a new tab, with a red count of what
waits there (requests, gifts, help; the Menu carries it too, asked again
every two minutes and when the tab comes back into view, as the classic
page does); Empires, the front page; and Log out, a form, as the site's
(`ui/hud.ts`; test `e2e/tests/site-menu.mjs`). Read-only server responses
do not renew the login cookie, so an image arriving after logout cannot
sign the browser back in. The 30-day expiry starts at signing in or the
last session change (`tests/test_accounts.py`). Until Beta 2, Quests, Battle and World's battle modes open the
classic game. The mockups are the reference for the look (drawn over a
real town; a monitor on the left, a phone on the right):
[neighbours](docs/menus/neighbours.webp), [the shop](docs/menus/shop.webp),
[a building selected](docs/menus/selected.webp) and
[battles and quests](docs/menus/world.webp).

**How it's built:**

- The rail and the dock are one row of buttons; the style sheet stands it
  up or lays it down, and shows Quests and Battle on the rail, World in
  the dock. The phone arrangement takes over at 720 pixels wide or
  narrower, or on
  any screen held upright up to 1000 wide (so a tablet held upright gets
  the dock); `NARROW` in `ui/panel.ts` and the last rule of `style.css`
  say the same. On a short screen (a phone held sideways) the rail's
  pictures shrink so all six fit.
- One window is open at a time. Its menu button is lit; pressing it again,
  the window's close button or Escape puts it away. A sheet also closes
  when its handle or title is dragged down past 80 pixels.
- While a panel is open, what sits on the right (Classic game, Full
  screen, the glove) moves left of it, and the selected thing's card
  centres on the space between the rail and the panel.
- The shop's things above the player's level are grey with "Level N" in
  red where the price would be. Storage has its own button and is still a
  tab of the same window, as in the original; whichever is showing is lit.
- Neighbours: the list the server sends with the town, sorted by
  experience, smallest first, then Arthur, as the original's bar. Each row
  has the player's initial on a colour of its own (Facebook's pictures are
  gone), their level and experience, the original's "ASSIST!" when they
  can be helped today (not helped in the last 24 hours), and Visit, which
  opens their town to look at; a visited town has no menus, only Back
  home. Gifts comes first (the original's Send gift).
- Army: the town's units by kind, with how many. Training comes with the
  training slice; until then the window says to train in the classic game.
- The glove (the Flash client's fast-collect button) shows bottom right
  when something is ready, with how many, and collects them all in one
  press, sending what tapping each would.
- Red counts: the gifts waiting in storage on Storage, the ready buildings
  on the glove.
- Shortcuts on a keyboard: B build, S storage, A army, Q quests, W world
  (phones), N neighbours, C collect all, Escape to close.
- **Naming the empire:** the level at the top carries the town's name in
  its tip; tapping it opens the game's "NAME YOUR EMPIRE" window, as the
  town's name in the Flash client's top bar did (`ui/rename.ts`, test
  `e2e/tests/rename.mjs`). A name needs 3 letters or more (30 at most);
  Save or Enter sends `name_map` (town, name), Cancel or Escape closes.

### Units walking

Built (Beta 1's second slice). Tap one of your units, then the ground: it
walks there, round what's in the way, playing its walk, and stops on that
tile; the server hears where. Code: `rules/walking.ts` (the rules, with
tests), `TownView.walk` (the drawing), `TownEditor.walkTo` (the taps).

**How units walk**, read from the Flash client (our notes, our words):

- The whole map can be walked on, the wild ring and land not yet bought
  too, except under buildings (this client kept units on the bought land
  until the map of the original showed otherwise). Fields (farms) and open
  wall gates can be walked over, and units don't stand in each other's way.
- A path goes tile by tile in 8 directions, but never squeezes diagonally
  between two corners. Flying units go in a straight line, over anything.
  A tile that has become a building since the unit set off stops it there.
- Speed is the config's `velocity`: pixels a frame of the Flash client (30
  a second), along the longer of the two screen directions, the other in
  proportion. A villager (3) takes about 0.6 seconds a tile.
- A walking unit faces where it's going: left or right of it, then up or
  down, which picks one of 8 ways (5 drawn, 3 mirrored). It plays `ANDAR`
  while it walks and `QUIETO` when it stops.
- A unit standing in town looks around now and then: every 61 frames
  (about 2 seconds) there's a 4% chance it turns towards a tile beside it.
- What the server hears: `move` with the tile the save had, the item, the
  tile it stopped on, which way it faces, the town and "Unitat". The Flash
  client sends it every 6 seconds for each unit that has stopped somewhere
  new; we send it as it stops, in the next batch.
- Only the player's own units walk (their people's, or anyone's, and
  animals they caught); wild animals and trolls on the island don't
  answer.

**Getting unstuck** (after the owner found villagers stuck; test
`e2e/tests/stuck.mjs`):

- A unit standing in a building (a gate shut on it) walks out across it.
  (`unitPath` and `reachable` in `rules/walking.ts`.) One left off the
  bought land, after a fight at a troll camp, simply walks home: units
  walk the whole map.
- A unit stopped short by something built in its way, on its way to work,
  repair or go inside, sets off once more from where it stopped. It used to
  start working from wherever it had stopped.
- Where a unit stands by a tree, a building or an animal skips tiles other
  units are walking to, and is chosen by one sweep of what it can reach
  (a search for each tile could freeze the game for a quarter of a second).
- A villager done with a tree goes on to the nearest one touching it that
  it can reach, not just the nearest.
- The tidy-up as the town opens keeps a unit on the land when it moves it
  off a building, and moves one off a gate (gates are shut then).
- A raid stops units' walks where they are; the server hears where.

**Wall gates** open and close, as in the Flash client: the gate's card has
Open door (the game's button); open, the gate shows its open picture,
units walk through it, and Move, Turn, Store and Upgrade are hidden until
Close door. It isn't saved: gates are shut each time the town opens.

**Not yet:** the speech bubbles units say now and then, and a mark on the
ground where a unit is going. (Units sent to a building or a tree: "Villagers
at work"; wild animals following a unit home: "The living map".)

### Selecting several units

Built after Beta 1's run-through, at the owner's request. Code:
`rules/group.ts` (the rules, with tests), `TownEditor.selectGroup`,
`sendTo`, `startsBox` and `dragBox`, the box in `Camera` and `TownView`,
the portraits in `ui/actions.ts`, and the square tool's button in
`ui/hud.ts`. Test: `e2e/tests/group.mjs`.

**How it works**, read from the Flash client (our notes, our words):

- **A box:** a drag that starts on one of the player's units draws a box
  (a thin white line, faintly white inside) instead of moving the map; let
  go, and the player's units whose pictures touch it are selected, at most
  20. A drag from anywhere else still moves the map.
- **The square tool** (its button at the bottom right, or Space): the next
  drag draws a box wherever it starts, then the tool is off again, even
  after a plain tap. Taking it up clears the selection, and does goal 41.
  Space still turns a building while it's being placed or moved.
- **A double click** (a second tap on a selected unit within a second)
  selects the units of its kind within 10 tiles, nearest first, at most 20.
  The kinds: healers; the engineer; the monk; those that fight up close
  (clerics, footmen, riders and specials with a range of 1); villagers;
  archers and riders that shoot; siege engines; kamikazes; and each of the
  five elementals. Animals and pets pick nothing.
- **The card** shows their portraits, ten to a row, each with its life bar;
  tapping one selects it alone. Each unit stands on its golden ring.
- **Sent to the ground,** they stand in a square grown from the tile
  tapped: that tile, then the next column down and the row along, ring by
  ring, the i-th unit on the i-th free tile. They stay selected.
- **Sent to a tree or rock,** each villager lines it up, and those free set
  off together. **To a building with room,** as many as fit go in, and the
  building is selected. **To a wild animal,** each goes to it. **To a
  burning building,** the villagers repair it. **To a camp's enemy,** those
  that can fight attack it.
- The server hears each unit's own commands, as when it's sent alone; there
  is no command for a group.

### The pointer's tools

Built with selecting several units, at the owner's request. Code:
`ui/hud.ts` (the button and its menu) and `TownEditor.chooseTool`,
`bulldoze` and `sweep`. Test: `e2e/tests/tools.mjs`.

**How they work**, read from the Flash client (our notes, our words):

- The pointer's button sits in the bottom right corner, before the square
  tool. It opens a menu above it: Pointer, Remove (the bulldozer) and Fast
  collect (the glove). Pressing the map closes the menu.
- With a tool on, the button reads CANCEL (the game's picture) and puts it
  down; so does Escape, and taking up the square tool. Taking up a tool
  clears the selection.
- **Remove:** the bulldozer's pointer, the only way to sell, as in the
  original. Tapping a thing removes it if it can be sold: never the town
  hall, units, trees or other people's things, but gold and stone rocks on
  the player's land.
  Something that cost nothing goes at once; anything else asks first, with
  what it gives back. It stays on for the next one, and a drag still moves
  the map. The server hears `sell` (reason "BLDZE").
- **Fast collect:** the glove's pointer. A ready building it passes over is
  collected; nothing is selected. On a phone, which has no pointer to move
  without pressing, dragging a finger sweeps it.
- **Collect all** (our own) stays beside them, collecting everything ready
  at once.

### Villagers at work

Built (Beta 1's third slice). With a villager selected, tap a tree, a stone
or gold rock, or a mill, mine or farm; with any unit, a refuge. It walks
there and works it, or goes inside. A building with units inside offers
Let out. Code: `rules/work.ts` and `rules/villagers.ts` (the rules, with
tests), `TownEditor.work`, `lineUp`, `goInto` and `letOne`. Tests:
`e2e/tests/work.mjs` and `villagers.mjs`.

**How it works**, read from the Flash client (our notes, our words):

- Villagers work trees (wood), stone and gold rocks. A unit stands on a
  free tile beside what it works or goes into: the first ring of tiles
  around it with any free, then the tile nearest the unit, up to four rings
  out. A villager at a tree plays its attack (`ATAQUE`), at a rock its
  `PICAR`, facing it.
- A tree or rock takes the config's `activation` in whole seconds (4 for a
  tree, 7 for a rock) from the first villager's arrival; more villagers
  don't make it quicker. If they all leave first, the work is lost. With
  the Forestry Academy, trees take a second; with the Minery Academy,
  stone and gold rocks do.
- Done: it gives the config's `collect` (20 wood, 10 stone, 10 gold) and
  its experience (1). Gold gives more as the town grows: 1 to 5 times (up to
  level 10, 15, 20, 25, then more). The tree or rock goes. The commands:
  `collect_new` (place, town, item, villagers at it, the gold multiplier,
  0), then `sell` (place, item, town, 0, "HARV").
- A rock leaves one growing back (`buy` of item 81 for stone, 80 for gold).
  After its `activation` (3 hours) it's sold ("REGEN") and a new rock of
  one of the four kinds, by chance, is bought in its place.
- A line of trees and rocks: each one tapped with a villager selected
  joins the end of its line and glows pale yellow round its edge (tapped
  again, it moves to the end). The villager sets off for it if it's the
  only one in line or the villager isn't busy; otherwise it waits its turn.
  When one is done the villager goes to the next in line that's still there
  and nobody else is at. The line holds 3 with no town hall, 5, 7, 9 and 10
  with Town Hall I to IV, 2 more with the Academy (the Troll Coliseum in a
  troll town). A tree tapped when the line is full is selected instead, as
  in the Flash client. Sent anywhere else (the ground, a building), the
  villager forgets its line. Code: `rules/villagers.ts`.
- The line done, the villager goes on to the next tree or rock of the same
  kind that touches the last one (or touches those, and so on), nearest
  first, skipping any another villager is at, until there are none. Tapping
  a tree meanwhile starts a new line.
- Villagers grow with the town hall: they walk at 3 (the config's speed)
  with none, 5 with Town Hall I or II and 6 with III or IV, 2 faster with
  the Academy; and they're called Villager I to IV (Peasant in a troll
  town) after it. The Flash client changes its own copy of the items, and so
  do we, so the barracks offers "Villager III" too.
- Into buildings: villagers into mills, mines and farms; any unit into a
  refuge, siege engines too; only the player's own, with room. (Not the
  Sacrifice Altar, a mine by its kind: in the classic game for now.) The unit
  leaves the map; a building with nobody inside starts its work as the
  first comes in (a mine whose time is chosen waits for the choice).
  `push_unit` (where the save had the unit, its item, the building's
  place, town).
- What a farm or ranch shows (`view/looks.ts`): its picture in the game's
  file holds every state one after another, and the game shows the one that
  fits. A farm's 45: the empty field; the man at work (2 to 21, played in a
  loop) or the woman (22 to 43), whichever villager is inside; ripe crops
  with the man (44) or the woman (45) when it's ready. A ranch's: as many
  animals as are inside (1 for none). Buildings whose pictures are laid out
  otherwise, such as the Training Stables' long animation, play as they
  are. Test: `e2e/tests/looks.mjs`.
- Let out: the last unit in comes out beside the building
  (`pop_unit`: the building's place, town, item, the tile, 0). Where a
  unit comes out (let out or trained): ring by ring round the building's
  tile, the first ring with a free tile, and on it the one furthest down
  the map, anywhere on the map, as in the Flash client.
  The last one out ends the building's work; a mill or mine whose time is
  chosen forgets the choice too (`activate`, 0) and asks again when the
  next worker comes in. Selling, storing or lifting a building to move it
  lets everybody out first, as the Flash client does (a cancelled move
  doesn't put them back). A building can't be moved or stored while it
  trains a unit.
- The Nursery takes a white cow, a white sheep, a horse or a boar, and
  then only the same animal as the first inside.
- Pointers: with a unit selected, the mouse pointer over the map is the
  Flash client's own for what the unit would do there: an axe over a tree
  it can chop, a pickaxe over a rock or gold, a red arrow over a building it
  can go into (`CursorMC` in the game's file, exported by
  `tools/art/export_ui.py`). Phones have no pointer, so there the same
  picture pops up for a second over what the unit was sent to (the owner's
  pick). Test: `e2e/tests/pointers.mjs`.

**Not the same as the Flash client:** the server gave a fifth more for each
extra villager at a tree or rock, which the Flash client never showed; it
now gives the same as the client (`production.py`).

**Not yet:** the Unit Warehouse, the hatchery's own work, the sacrifice
altar and the dragon nest (in the classic game for now; animals go into
ranches, "The living map"); villagers putting out fires after a battle; the collection pieces
the Flash client sometimes drops from a harvest.

### The living map

Each time the player opens their town, it's tidied up, and trees, rocks
and wild animals grow back, as in the Flash client, so wood, stone and gold
don't run out; wild animals are caught by coming near them. Code: `rules/nature.ts` and
`rules/animals.ts` (with tests), called from `main.ts` once the camp of the
moment is up, as in the original (a camp that clears the wild ring first
doesn't take what just grew); catching in `TownEditor.caught`. Tests: `e2e/tests/nature.mjs` and
`animals.mjs`.

**How it works**, read from the Flash client (our notes, our words):

- The game counts the trees, the stone rocks and the gold rocks on the map
  (rocks growing back count; the fourth kind of stone and of gold doesn't,
  a quirk kept).
- It wants 3 clumps of gold, 3 of stone and 10 of trees. For each clump's
  worth already there (6 rocks, 18 trees, the clump's average) it adds one
  clump fewer. A clump is 5 or 6 rocks, or 16 to 19 trees, the size picked
  once per kind each time.
- A clump starts on a tile picked at random in one of the blocks of the
  wild ring round the island or of the middle land not bought yet, never
  the player's own; each of its trees or rocks takes the free tile nearest
  it (the tile itself first, then the first ring of tiles out with a free
  one). So a clump at a block's edge can spill onto the player's land, as
  in the original. Villagers walk out to them.
- Then single trees, until there are a hundred: each at a random tile, or
  a free one up to 5 tiles from it, else not at all.
- Each is "bought" for nothing (`buy`, the item, its tile, 0, town, 1, 1,
  "b"), so the server keeps it. A new town gets about 270 trees and a few
  dozen rocks the first time it opens.
- Wild animals come after the trees, one by one like single trees: up to 7
  sheep and 7 cows, and 6 horses from level 11 (in a troll town, 7 boars),
  counting those on the map, but no more than the config's
  `ANIMALS_PER_DAY` (20) of a kind a day. The server hears how many came
  (`admin_add_animal`, kind, how many) and keeps the day's count in
  `arrayAnimals`, which it starts again each day (`animals.py`; it never
  did before).
- Which animals are wild isn't saved: as the town opens, those off the
  player's land are wild, those on it theirs. A wild one stands looking
  about (the original's don't wander).
- Catching: one of the player's units on the map (an animal caught before
  too) within 4 tiles of a wild animal catches it. "Captured!" shows over it
  for 5 seconds (the game's own picture, `IconoCapturadoMC`), the goals
  count it, and it walks to the nearest ranch of its kind and in (sheep
  ranches, cow ranches, the training stable for horses, boar ranches), as
  workers go in (`push_unit`); with none, to beside the town hall. Units
  and animals find their way anywhere but through buildings, as the
  original's paths do, so one caught in the wild walks in.
- A caught animal is the player's: select it and tap one of its ranches (or
  the hatchery) to send it in. Tapping a wild animal with a unit selected
  sends the unit beside it, and so catches it.
- Tidying, first of all (`rules/cleanup.ts`): a save can have things on
  top of each other (a bug, an old game). Buildings take their tiles first,
  the town hall before all, then the units, in the save's order. One of the
  player's people's buildings that finds a tile taken, or stands off the
  map, goes to storage (`store_item_frombug`); anyone else's off the map is
  removed for nothing (`sell`, "OUTOB"); anyone else's on a taken tile
  stays. A unit on a tile something else has (but a farm or a gate) steps to
  the nearest free tile (`move`, "Colisio #1"...), and so does the second of
  two units on one tile. Terrain (paths) takes no tile, as when placing.
- A town with no villager on the map or at work in a farm, mill or mine
  (one sheltering in a refuge doesn't count) gets one, a man or a woman by
  chance, on a free tile near the middle (54, 54), bought for nothing. Not
  before Arthur's mandatory lessons are finished; the Flash client likewise
  waits during its tutorial. Test: `e2e/tests/tidy.mjs`.
- The browser tests give each new town enough trees, rocks and animals
  first, in the wild corners at the top, so none grow on the land a test
  uses, and a villager far off (`e2e/lib.mjs`, `FULL_WILD`).

### Training and population

Built (Beta 1's fourth slice). A building that trains a unit (the town hall
villagers, barracks spearmen, stables knights...) shows the unit's picture
on its card's TRAIN box with the price: tap it to train one, or BUY to pay
in cash ("The building card"). The top bar counts the town's people against the room for them,
and so does the Army window. Units in storage can be placed when there's
room. Code: `rules/training.ts` (with tests), `TownEditor.train`.

**How it works**, read from the Flash client (our notes, our words):

- Each building trains one kind of unit (the config's `trains`), one at a
  time, in 3 seconds. The price is paid when it starts, with the unit's
  experience; then it stands beside the building (where units come out:
  "Villagers at work").
- Price: the unit's `cost` (a blacksmith takes a tenth off footmen,
  horsemen and archers, a university off siege engines, rounded up), and
  twice that in food; villagers need no food. Or the unit's
  `cost_unit_cash` in cash instead.
- Room: the `population` of the player's buildings (houses, the town
  hall...), at most 175, plus that of the wonders on top (they count in
  both, as in the Flash client), except the Great Church, whose own room
  counts once and whose steps (10 room each) go on top instead. Taken: the `population` of the player's units, on the map and
  inside buildings. Wild animals and the island's trolls don't count.
- What stops it: no room for the unit, the unit's `units_limit` reached
  (counting those inside buildings), not enough to pay, or the building
  already training.
- The commands: `buy` (unit, tile, 0, town, 0, the discount as 1 or 0.9,
  "u"); the server charges the same price and food. With cash: `buy_cash`
  (unit, tile, 0, town).

**Not yet:** hurrying a training with cash isn't in the Flash client
either; the dragon nest's riders, the hatchery and other special training
windows are in the classic game for now.

### Land and cash

Built (Beta 1's fifth slice). Tap land for sale to buy it, in gold or cash;
finish a building's work now for 2 cash; and the bank, from the + on the
gold and cash pills. Code:
`rules/land.ts`, `unlock` in `rules/shop.ts`, `hurry` in
`rules/production.ts` (all with tests), `ui/bank.ts`.

**How it works**, read from the Flash client (our notes, our words):

- Land: a closed block in the middle 3 x 3 is for sale when the block
  before or after it, or above or below it, is open. Its price is the
  config's `expansion_prices` row for how many blocks are open (the first
  4,000 gold or 20 cash). Paying in gold needs that row's number of
  neighbours (every neighbour counts but "Best Empire"); cash doesn't.
- Each closed block in the middle has the game's "for sale" sign in its
  middle (`btnBuyExpandTileMC`, exported by `tools/art/export_ui.py`), in
  the player's own town only, as in the Flash client; tapping a block that
  doesn't touch theirs does nothing.
  `expand` (block, "gold" or "cash", town).
- Opening a building early: the original has a price for it (a third of
  the level in cash, rounded up; `unlock_building`), but nothing in it
  opens that window: the "Level N" tag on a shop card does nothing. So
  ours doesn't offer it either (it did, until the map of the original
  showed this); unlocks already in a save still count.
- Hurrying: 2 cash finishes a working mill, mine, bakery or a wonder that
  houses nobody, and collects it at once; the cash goes in `collect_new`'s
  last place. Farms and ranches can't be hurried.
- The bank is the site's (bank.py): 2,000 of a resource for 1 cash, up to
  5 a day, and the game's own trade, 5 cash for 2,500 gold
  (`exchange_cash_new`, town). The window first sends the town's waiting
  commands, so the bank counts what the player sees.

### Missions and bonuses

Built (Beta 1's sixth slice). The next goal shows bottom left (tap it for
its own window, and from there all 15 open); goals reached are paid their
gold. The daily bonus and
Monday's chest show as round buttons at the top right while on offer. Code: `rules/goals.ts` and
`goals.json`, `rules/bonuses.ts` (with tests), `goals.ts`, `bonuses.ts`.

**How the goals work**, read from the Flash client (our notes, our words):

- Goals run only in a human town below level 35, decided when the town
  loads, as in the Flash client (from 35 the spells box takes their place;
  ours has none yet). Reaching level 35 at home stops them at once, and a
  Wizardry Academy is placed for free near tile (59, 59), even if the town
  has one (`levelThirtyFive` in `rules/dock.ts`).
- The config's `missions` have each goal's title, text and gold ("#0#" in
  them is the host, Arthur); what each
  asks is in `goals.json`, by the goal's number (the Flash client looks it
  up by its place in its own list, and the numbers written in that list
  drift by one from goal 80; the place is what matches the titles). The
  server's config adds a stand-in for goal 1 after the real one: the first
  counts.
- The first 15 goals not both done and paid are open (up to goal 226).
  Every 2 seconds the open ones are checked; those reached are sent as
  done (`complete_mission`, the goal, 0), and the first done one is paid
  its gold (`reward_mission`, town, goal), one a check.
- Some goals count the town as it is: things built (on the map and units
  inside buildings), units of a kind, units inside buildings of a kind,
  people, land, walls along the south edge, units near the town hall, the
  Small Refuge's units. Units near the town hall: the nearest 20 of the
  player's units within a circle of 3 tiles round its tile. Others count
  what the player did since the page opened, as the Flash client counts
  them: collecting (buildings, trees and rocks), units let out, animals
  caught, zooming, taking up the square tool, the neighbour visited last
  and the buildings helped on visits (kept in the browser tab, so a visit
  counts back home) always; working times chosen (the last choice),
  buildings moved and stored, something placed from storage, units trained
  at a building, units sent into buildings, cash spent, the daily bonus's
  day, the island map opened and a defence plan picked only while a goal
  of that kind is open and
  not done, as there (before each check the game listens again for the
  open goals' kinds only).
- No skipping for cash: the Flash client had its Pay button switched off
  (only a test setting turned it on), so ours has none.
- Goals about battles, quests, the social buildings and the like say
  they are not available yet (50 of the 227); the server
  keeps them done whichever client does them. The market's three (buy 200
  stone, buy 100 wood, sell 100 wood) count the trades made while they're
  open, in any number of trades, as the original counts them.

**A goal's window** (`ui/goalWindow.ts`, since the parity list), as the
Flash client's "Goal INFO": the game's parchment and band, the goal's title
and text, the game's picture of its steps (`images_new/goal_NNN.jpg`, goals
1 to 100), one of the game's 25 children beside it (`nino_NN.png`, by the
goal's number), its gold, OK, and for goals 1 and 2 and those that build
something HELP!, which draws the game's arrow at the Build menu (goal 2:
the town hall's card, at its Train), gone once followed
(`ui/helpArrow.ts`). The goal card opens its goal's window (a goal done,
the list); the list's +INFO opens any goal's. The original's fourth button,
paying cash to skip a goal, was switched off: in its place, Goals opens the
list. Goals 6 to 9 carry the game's "Click here!" tag until tapped, and
below level 8 "New Mission!" points at the box whenever a new goal joins
the 15 open (and as the town opens), until a goal is looked at; neither in
Arthur's lessons. In the lessons, "tap the goals" opens this window and its
OK closes it, as the original's lessons did (they listen for
`GOAL_WINDOW_EVENT`). Test: `e2e/tests/goal-window.mjs`.

**The bonuses** (the server pays from the same config, `daily_bonus.py`,
`monday_bonus.py`, `comeback_bonus.py`):

- Daily: from level 5, in a human town; on offer from the next calendar
  day (UTC) after the last; the
  five days' prizes in turn, the first again after a day missed. A hero is
  drawn at random and goes into storage. `win_bonus` (gold, town, hero,
  day, cash).
- Monday's chest: on a Monday (the player's own calendar) not yet
  collected; previewed on Sundays. Three chests; whichever is picked holds
  one of the config's three prizes by chance (gold, cash or a unit).
  `weekly_reward` (kind, amount or unit).
- Welcome-back chest: switched off in the Flash client as it was built;
  our classic game switches it on (`tools/patch_client.py`), so the new
  client offers it too (the owner's call). From level 4 (or on reaching
  it), on the empire's first three days (the page says how many days since
  it was made, 0 to 2), until the third day's chest is opened; its button
  is the game's own "Reward" box. On days 1 and 2 three chests are ready
  to pick, once each; whichever is picked holds one of Monday's prizes by
  chance, its unit the day's own (`COMEBACK_BONUS_UNITS`, the first on day
  1, the second on day 2). On day 0, or once day 1's is opened, the window
  says what tomorrow's holds, the chests shut. `comeback_reward` (kind,
  amount or unit, day). The daily bonus, like the original's, is decided
  as the town opens: reaching level 5 shows it on the next visit.

**Not yet:** the troll raids and their treasure chest (with battles), and
renaming the empire.

### Neighbours

Built (Beta 1's seventh slice). The Neighbours window lists the player's
neighbours, Arthur last; Visit opens their town. Code:
`rules/neighbours.ts` (with tests), `visit.ts`, and the carts in
`editor.ts`.

**How it works**, read from the Flash client (our notes, our words):

- **Arthur** is added after the other neighbours by the client, not the
  server. His level is a fifth above the player's (no higher than the last
  level), and the town shown is the one for the player's stage: up to
  level 10, up to 20, then the grown one (the server's villages
  100000030 to 32). So his town grows as the player's does.
- **Visiting**, the top bar shows the neighbour's numbers (gold, wood,
  food, stone, cash, level, an empty XP bar), as the Flash client did, with
  "Visiting <name>", five rays for the helps left (the game's own; one fades
  with each help) and Back home. The help's gold and XP rise from the
  building. Their farms, mills, mines, ranches, the bakery
  and wonders that house nobody can be helped: up to 5, each once, for 10
  gold and 3 XP each. A neighbour can be helped once a day (the player's
  `neighborAssists`). The help goes to the server as one command on
  leaving (`assist_neighbor_new`, neighbour, 0, the buildings as
  `[[x, y, id], ...]`), sent before Back home moves on.
- **The donkey cart:** on their next visit home, the helped player sees a
  cart by the town hall for each neighbour who helped (`receivedAssists`),
  one after another. Let it in, and it goes to each building helped and
  brings it a quarter of one harvest and 10 XP (`assist_receive`, town,
  building); No thanks sends it away. Either way the server hears first
  (`clean_received_assists`, helper, town). A cart left waiting asks again
  when tapped.
- **A server fix:** the server used to drop the cart's help when told the
  cart was met, so the shares that followed found nothing. It now keeps
  them as "on the way" (`assistsOnTheWay`) until each is delivered.
- **The server's message:** what friends did for the player while away (a
  help request answered) and gifts taken on the Friends page wait in the
  save as a message, a line each (`privateState.message`). As the town
  opens, before the carts or Arthur's lessons, it shows in the bar with OK,
  once: OK tells the server it's read (`clear_message`), as the Flash client
  does. Before, the new client left it, and it waited for the classic game.
  Test: `e2e/tests/messages.mjs`.
- **Friends' help at a building at work** (`rules/friendsHelp.ts`, with
  tests; `view/friendBubble.ts`): the Hurry up of a mill, mine or bakery
  at work opens the game's hurry window, with **Ask for help** beside
  finishing it for cash, as the original's. It opens the site's ask window in the panel
  (`ui/askFriends.ts`, the server's `helps.py`, kind "collect"). Each friend
  who answers on their Friends page waits over the building when the town
  next opens, in the game's bubble (FotoNeighbourMC: "Hurry Up?", and
  "Accept" with the game's hand while the mouse is on it). A tap on the
  building takes the top one: an hour off its work
  (`COLLECT_HELP_SECONDS`), the collect sound, "-1 hour" rising, and
  `accept_collect_help` (x, y, town, building, friend). As in the
  original, the bubbles go once the building is ready, until the town
  opens again, and only at home. The site has no pictures of friends, so a
  friend's is their initial on a colour, as in the neighbours' list.
  Test: `e2e/tests/friends-help.mjs`.

- **Gifts** (`ui/gifts.ts`): the classic page's Gifts window
  (`templates/_gifts.html`, the server's `gifts.py`, `/gifts/game`) in the
  panel, from the first row of Neighbours (the original's Send gift was on
  a neighbour's portrait): gifts friends sent, to take into storage; today's
  free gift for a friend; giving from storage. It opens by itself when gifts
  wait as the town opens, as the classic page does. What sends the town's
  waiting commands first, so the server's storage is the one on screen;
  what it changes shows once the town loads again, as the window closes.
  Test: `e2e/tests/gifts.mjs`.

**Not yet:** requests between neighbours, and adding neighbours from
inside the game (the site's friends page does it). The site's links are
available in Menu ("The menus: rail and dock", above).

### Sound and speed

Built (Beta 1's eighth slice). Code: `sound.ts`, the sounds in
`client/src/sound/` (made by `tools/art/export_sounds.sh` from the game's
own library, `assets/swf/120608_dynamic.swf`), and `compress.py` on the
server.

**Sound**, as the Flash client plays it (our notes, our words):

- **Music:** "Spirit of Eternity" on a loop in a town ("trollcamp" in a
  troll town), at a quarter of full volume, from the game's `music/`
  folder in the assets bucket. Browsers only allow sound after the first
  tap or key, so it starts then; it pauses while the page is hidden.
- **Effects,** at a quarter of full volume, each 50 to 150 ms after what
  made it, and at most 3 of one at a time (2 for the rock sound), so ten
  farms collected at once don't make ten times the noise: a click for
  every button; a building placed, a unit trained or sent off (the game's
  "roll over" sound); collecting; a building turning ready; a level
  reached; a villager starting on a tree or a rock.
- **The switches:** the Flash client's own music and sound buttons, in the
  top bar; each is remembered in the browser. Both start on, as in the
  original.
- Building: hammering through the 10 seconds of scaffolding (one at a
  time, 9 times over), and a sound when it's done (see "Construction").
- The battle and quest sounds wait for those parts.

**Speed:** the server now sends text gzip-compressed (`compress.py`): the
game's config, which every start needs before anything shows, goes from
1.9 MB to 145 KB; the client's script from 415 KB to 143 KB; towns
too. Each packed copy is kept, so the config is packed once, not at every
start. Files keep their version tags (marked "weak"), so a browser that
has the client already gets a short "unchanged". Arthur's grown town (402
things, 69 pictures) opens in under 3 seconds on our test machine once its
art is cached, and in about 10 the first time, mostly downloading the
pictures; the bucket keeps them a day in the browser's cache.

### Hovering

Built (PARITY.md, "Small things"). Code: `rules/hover.ts` (what lights up
and what its popup says), `view/bars.ts` (the popup and the bars),
`view/selected.ts` (`markLife`), the editor's `light`. Test:
`e2e/tests/hover.mjs`.

As the Flash client does it, with a mouse (our notes, our words):

- **What the mouse is on lights up:** a thin white outline round its
  picture and its life bar over it, and the game's popup a little above its
  point: its name, and for a building that works the yellow bar with how
  far along its round is and the time left under it (a building with no
  workers shows its whole round still to go, as the game's does). The time
  goes down each second.
- **No popup** for towers, walls and castles (they're still lit), and the
  name alone for a mill or mine waiting for its working time. Scenery and
  anything being built light nothing.
- **With the bulldozer** only what it would take lights up, its ground
  outlined in white too.
- Phones have no mouse, so nothing lights there, as with the Flash client
  on a touch screen.
- The popup is drawn over the town; the Flash client drew it on the
  ground, under the buildings, where a building's front can hide it
  (DECISIONS.md). Its trick of fading what stands in front of the thing
  under the mouse isn't built.

### Construction

Built (PARITY.md, "Construction"). Code: `rules/construction.ts`,
`view/construction.ts` and `view/bars.ts` (the bar), the editor's `startConstruction`; the scaffolding
sheets and the bar's pictures in `client/src/view/art/`, made by
`tools/art/export_ui.py` from the game's library
(`assets/swf/120608_dynamic.swf`, where the Flash client finds them too).
Test: `e2e/tests/construction.mjs`.

As the Flash client builds (our notes, our words):

- **Ten seconds of scaffolding** for anything bought from the shop, units
  included, and for a building placed from storage (a unit from storage
  comes as it is). The game's own scaffolding: a farm's field being dug, a
  ranch's fence going up (not the Nursery's), else one for the width, 1x1
  to 4x4, with workers at work. It plays once, about 4½ seconds, and the
  workers keep at it after. It stands where the building will, placed by
  its box as it first appears, as the game places a building.
- **The bar** at its foot fills with the percentage on it, the game's own
  pictures; a 1x1 thing has the percentage alone, edged in white. It keeps
  its size on the screen whatever the zoom, as the Flash client's.
- **Meanwhile** it takes nobody in, its card has its picture, name and
  time bar (the share built and the time left) but no buttons, the bulldozer and the glove pass it by, a
  tower doesn't shoot in a raid, and a unit can't be sent anywhere. Its
  work clock runs all the same.
- **Sounds:** hammering, then a sound of its own when it's done (both the
  game's).
- **Not saved,** as in the original: the server has the building at once,
  and opened again, the town shows it finished.
- **Not built here:** the troll town's own scaffolding (with the troll
  town), upgrading's (with upgrading), and the speed-up for 10 cash, which
  the original only offers for items with a build time, and none has one.

How the sheets are made: `RenderSymbols.java` draws a picture playing
("Construction2x2*140": 140 frames, its workers' own animations running
too) and measures each frame's box as Flash would; `export_ui.py` keeps
every other frame (15 a second), stores each picture once and packs them
with `pack_sheet.py`, the buildings' packer, so the client reads them like
a building's sheet (`view/art.ts`, `bundledArt`). All six come to about a
megabyte, most of it the ranch's fence, and each is fetched only when
something of its kind is built.

### Arthur's lessons

The owner requested a mandatory, clearer tutorial after the first desktop
playthrough. It starts automatically in the home town, with eight chapters,
Arthur and the original pictures. Instructions name one action at a time.
The camera pans to objectives (instant only for reduced-motion preferences),
and a labelled ground marker makes walking and placement destinations clear.
The final tree count sits inside the bubble. Other feature menus, goal
notices and level-up windows wait until the reward is saved.

`rules/lessons.ts` describes objectives and matching editor events;
`lessons.ts` restores selections, reopens placement and provides Show me.
If a villager is lost, it offers replacement training and returns to the
unfinished objective, retaining the chapter and tree count.
Construction must finish before the farm is a click target. Its lesson
advances after the worker enters, rather than when a walking order starts.
A ready crop is recognised after reload. Combat targets fighting units,
never villagers, and waits for an enemy defeat. A lost army during this
lesson can receive one replacement training knight through the server's
presence-checked `tutorial_knight` command.

The server checkpoint `privateState.tutorial` stores the exact objective
and the last task's tree count. Reports share the action's ordered command
batch. Browser storage is not authoritative. The final choice is step 32;
only `claim_tutorial_reward` completes step 33. This command saves the nest
and chosen draggy once, including on request retries. A new nest starts
at seven steps with no wait; existing nests on the map, in Storage or in
Gifts retain their progress. A gift
without map space goes into Storage. The choice stays open until a server
read confirms completion. Interrupted old saves resume; saves already
holding the old completed tutorial's nest and draggy remain completed.
Legacy `complete_tutorial` reports remain supported.

The empire page's Play opens the new client; classic-client choices and
fallback links are hidden. The old routes and save compatibility remain.
This is the owner's temporary UI change, not removal of the old client.

Tests: `lessons`, `lessons-phone` play the full tutorial on fresh towns,
including reloads and reward persistence; `lessons-recovery` covers a lost
army or villager, replacement training, saved tree progress and a lost
reward response. Camera and tutorial
rules have unit tests; `tests/test_tutorial.py` verifies checkpoint ordering,
reward retries, storage and legacy compatibility. `classic` still checks
that the old route reads buildings saved by the new client.

### The nests

Built with "The switch". The dragon nest (1233, the lessons' gift, or 6,000
gold in the shop) and the monster nest (1255) raise a row of dragons or
monsters, one after another: the dragon nest six, the monster nest four
(their ids are in `rules/nest.ts`). The nest's **Open** button shows its window, in the panel like
every window here, with the original window's parts (`ui/nest.ts`; the
rules in `rules/nest.ts`, with tests):

- **Progress n/10** and its bar, and this step's picture, from egg to
  grown: eleven per dragon, from the game's own Flash files
  (`tools/art/export_progress.py` makes a strip of them for each,
  `client/src/ui/art/nest/`).
- **Take care** (the first, third and fifth hatch from eggs) or **Feed**
  (the others): a step, `next_step [0]` (the monster nest's
  `next_monster_step`), and a six-hour wait, with its countdown and
  **Speed up** for 3 cash (15 for the fed dragons, 7 for any monster):
  `buy_step_cash`.
- At ten, **Get Dragon!**: the grown one stands free on the nearest free
  tile to the nest (`buy`, free), `next_dragon "0"`, and the next one
  starts. The row of them shows those open in colour, the rest locked,
  the one in training framed and marked.
- **Hire friends** (the dragon nest only) lists the player's friends to
  ask, as the classic page's Ask friends window does (`ui/askFriends.ts`,
  the server's `/help/game`). Each friend who answers gives two steps
  without their wait: when the window next opens, a "Congratulations!!"
  takes them (`next_step [0]` each, then `finish_dragon_help`).
- **The ?** shows the original's help, its picture and words.
- Once all are raised the nest closes (`desactivate_dragon`); its window
  then offers **Start again** for 100,000 gold or 50 cash
  (`activate_dragon`). A new empire's monster nest starts closed, as in
  the original's save.

The save's privateState keeps where each nest is (`dragonNumber`,
`stepNumber`, `timeStampTakeCare`; the monster nest's own); the client
changes its copy as the server does, so the window is right without a
reload. Test: `e2e/tests/nests.mjs` plays a step, the wait, the speed up,
the dragon got, the friends' list and the monster nest opened, with checks
on the server's save.

### The market

Built with Beta 1's parity list. A market (the first, second or third,
the trolls' too; not the Allies' Market, a social building with its own
window) has **Visit Market** on its card, the original's button. Its
window, in the panel like every window here (`ui/market.ts`; the rules in
`rules/market.ts`, with tests), has six of the game's trade cards: buying
wood, stone and food along the top, selling them below, as the original
lays them out. Each card has the lot (100, 200 or 300 by the market's
level), the good, the price in gold and the button, with the game's words
("Buy", "sell", "Trades left today:"). Below them, the trades left.

- **Prices**, as the original and the server's `market.py` work them out:
  the config's base for 100 (wood and food 100 gold, stone 150) times the
  lot, plus 2% of that for each purchase so far (each sale takes 2% off),
  rounded; a sale pays three quarters of the price. The count is kept
  between 25 sales and 200 purchases, by good.
- **20 trades**, then the game's "Market resources have been exhausted"
  until 20 hours after the last trade; the count starts again then (as the
  town loads, as in the original, or at the next trade if the window has
  stayed open that long, as the server does).
- A trade is at once: the town's gold and goods change, every card's price
  changes, and `trade_resource_b` (town, good, 1 sell or 0 buy, lot) goes
  with the town's other commands. Selling more than the town has gives the
  game's "You don't have enough wood to sell!", naming the right good;
  buying without the gold opens the bank, as the original opened its gold
  window.
- The save keeps the counts in the town (`resourcesTraded`,
  `numTradesDone`, `timestampLastTrade`), so a reload shows the same.

Test: `e2e/tests/market.mjs` trades until no trades are left, with both
warnings, the server's save, the three goals done, a reload and a phone.
Before asking for either warning, it waits for the earlier messages to
finish: goal rewards share the queue, and a full queue drops new messages.
The wait has a 30-second limit; the warning and save checks stay the same.

### The troll town

The player's second town, as the Flash client offers it (`rules/towns.ts`,
with tests; `ui/towns.ts`). A human town has a **Towns** button from level
20 (on a wide screen on the rail; on a phone in World), the original's own
picture of a boy and a troll; a player with two towns has it in both. With
one town, its window shows the game's picture of a troll town, its words,
and founding it for 100,000 gold or 22 cash, paid from the town that's open
(the Flash client's own numbers; it never read the config's). Founding
sends `buy_map` (1, 1 for cash or 0 for gold, "t", the paying town) at
once and opens the troll town. With two towns the window ("SELECT TOWN")
lists both with their pictures and names, this one greyed; **Travel!**
sends what's waiting and opens the other. A town opens as the page loads
with `?town=1` (the server's `get_player_info` with `map`); without it,
the default town, as before. Each town keeps its own resources, level,
camps and raids (by its race); cash is the player's. A troll town has no
goals, daily bonus or lessons, as in the original, and its own music and
shop. Test: `e2e/tests/troll-town.mjs` founds one with cash, checks the
troll town, its shop and the server's two towns, and travels home.

### Collection pieces

A tree or rock harvested in a human town now and then gives a piece of one
of the game's 23 collections of 5, as the Flash client drops them
(`rules/collections.ts`, with tests). Out of 100 harvests, on average: half
a piece of the rarest kind (the Ravager Troll's or the High Elf's first), 2
rare ones (the dog's, the cat's or the skeleton's first) and 1.5 uncommon
ones (any of the Pyramid, Treasure Chest, Garden, Golden Fountain, Frozen
Mammoth, Crocodile Pit, Life Tree, Guillotine and Prison, or the Soldier
Statue's first): 4 in all. Never in a troll town. The piece's picture,
from the game's sheet of them (`images_new/collectibles_new.png`), pops up
from the tree or rock, a message names it and its collection (the game's
own words), and the server hears `add_collectable` (collection, piece),
which keeps it in `privateState.collections`. The original dropped it on
the ground to tap, as it did the wood; ours gives it at once, like the
wood. The collections' window, to trade a full set for its prize, is for
later; until then the classic game has it. Test: `e2e/tests/collections.mjs`.

### The building card

The card for the thing selected is the Flash client's info panel
(RecuadroInfo), the owner's pick of the mockups (design A): the game's
parchment at the bottom middle, 580 by 146 as there, and on a phone the
same parts stacked above the dock, with room below for the pointer tools.
The phone test checks those tools stay tappable and checks both upgrade
taps against the save. Code: `ui/actions.ts` (the card),
`rules/card.ts` (what each kind shows) and `rules/upgrade.ts` (both with
tests), `TownEditor.select`. Test: `e2e/tests/card.mjs`.
Full integrated verification: [#87 delivery record](docs/verification-87.md).

**What it shows**, left to right, as the original (our notes, our words):

- **The picture** (the shop's) in the game's brown frame, and under it the
  life bar with "life/most" for anything that fights: buildings and units,
  not trees or rocks.
- **The name**, then **the numbers** by the game's own pictures, each
  with the game's words as its tooltip ("Attack Damage", "Attack Delay",
  "Attack Range", "Unit Speed", "Population Capacity"). Which ones depends
  on the kind, as there: a unit has attack, delay, range and speed; a
  house attack, delay and its room for people (a decoration no room);
  towers, walls, gates, the town hall and the castle add their range;
  barracks, stables and the market attack and delay. Producing buildings
  show none.
- **What it earns** ("Earns: 15" with the resource's picture) and **the
  time bar** (the game's white bar filling yellow, its percentage on it,
  the time left under it) for a farm, mill, mine or ranch with someone
  inside, or a building that works on its own; for a tree or rock, what a
  villager's harvest brings (gold times the level's multiplier). The bar
  also shows a building going up, and a unit training (our extra: the
  original showed training only on the map).
- **Hurry up** (the game's red picture) on a mill, mine or bakery at work
  and on wonders that house no one, as there; never on farms and ranches.
  It opens the game's hurry window over the card ("WORK IN PROGRESS"):
  the building and its time left, **Ask for help** (friends, when the
  player has any) or **Buy for 2** cash.
- **The tip,** in the game's words, by kind: "Put peasants inside to
  produce resources" (the farm panel's own words), "Put sheeps inside to
  produce food" for sheep ranches and so on, the blacksmith's tenth off,
  the eagles' line and their life, what a tree or rock needs. A building
  with room for units shows its tip only while it's empty.
- **Who's inside:** "CAPACITY 1/3", then each one's picture in the game's
  frame; a tap lets that one out beside the building (`letOut` with its
  place in the list), as the original's portraits.
- **The unit it trains** (town hall, barracks, stables...): its name, its
  picture on the game's TRAIN box (a tap trains one), "COST:" with the
  price and the food it also takes, and the game's BUY button to pay in
  cash. With the mouse on the unit, the game's bubble: "Allows you to
  train:", the unit, its life and attack, and for villagers how many trees
  they line up ("They can collect 5 trees in a row").
- **The building's own window** where it has one (Visit Market, the
  harbour, the graveyard, a gate's door...).
- **Move, Turn, Store and Upgrade,** the game's tiles two by two, each in
  its own place (the town hall has no Store, so its corner stays empty).

**Upgrade.** 104 buildings in the config name the next one (`upgrades_to`):
houses, farms, mills, ranches, towers, walls, barracks, the town hall
(Town Hall II to IV are had only this way)... With the mouse on Upgrade, the
game's bubble shows the next building's name and picture, then "UNLOCK AT"
with its level on the star or "Cost" with its price. Pressed:

- below the next one's level: the game's words, "You need to be level 28
  to upgrade this building.";
- without its price: "Not enough wood" and the price;
- else the old building goes and the next stands on its tile in scaffolding:
  whoever was inside comes out first; the next one's whole price is paid, a
  twentieth of the old one's comes back (nothing if it cost cash, as when
  selling) and its experience is gained, each rising from it; the server
  hears `sell` (x, y, item, town, 0, "UPGR") and `buy` of the next on the
  same tile. The card closes, as the original's did.

The original upgraded at the first click. On a touch screen, with no mouse
to show the bubble, ours shows it at the first tap and upgrades at the
second.

**Selling** is the bulldozer's (the pointer's Remove), as in the original:
the card has no Sell. Someone looking at another player's things sees the
card without its buttons.

### Step 4: battles

Beta 2. Code: `rules/battle.ts` (the fighting, with tests), `rules/quest.ts`
and `rules/islands.json` (the islands; their rules in words are in
`rules/islands-notes.json`, which the game doesn't load),
`view/battleView.ts` (the drawing), `questPlay.ts` (an island played in
the page, loaded only there) and `ui/islandMap.ts` (the Quests window).

**How a battle works**, read from the Flash client (our notes, our words):

- **The clock.** Everything counts frames of the Flash client, 30 a
  second, on one clock, so a swordsman's `attack_interval` of 35 is a hit
  every 35 frames. The page steps the battle 30 times a second whatever
  the screen's rate (more for the Speed button). A unit's mind works every
  61 frames (about 2 seconds); it looks at its attack every 5 frames, each
  unit on its own one of the 5 (picked at random), and hits on its
  interval's beat. Towers fire when the clock is a multiple of their
  interval.
- **The numbers** are the config's `life`, `attack`, `defense` (1 for
  everything), `attack_range` (tiles), `attack_interval` and `velocity`.
- **Damage.** The attack, plus or minus 4 at random; 1 hit in 10 is a
  critical, half again (the 4 counted up); less the defense; rounded,
  and at least 1. Siege engines do half to units, and units a quarter more
  to siege engines. Nothing else: no unit beats another by kind.
- **Who fights whom.** Soldiers (footmen, archers, knights, siege, animals,
  bosses) look for the nearest enemy within 10 tiles, by straight-line
  distance, those that can't fight counted a little further off (fighters
  first), and go for it. Villagers, farm animals and healers don't fight;
  hit, they run 5 tiles towards the middle of the map. Hit, a soldier turns
  on the attacker if it had no target, if its target can't fight, or if the
  attacker is less than half as far. Allies with nothing to do within 4
  tiles of anything hit come to help. When its target dies, a soldier looks
  around where it fell.
- **Reaching.** "In range" is the most tiles across or down between the two
  footprints (1: side by side, diagonals too). A unit sent to attack walks
  to the free tile nearest it on the ring at its range around the target,
  so archers and siege stop at their full range; one that can't get there
  (walled off) gives up. Ranged units shoot while walking; others only hit
  standing. A unit walking where it was told ignores enemies until it
  arrives.
- **Shots** fly at their own speed (arrows 30 pixels a frame, axes 20,
  rocks 18, cannonballs 40; others about 33) and hurt only when they land,
  if the target is still within 100 pixels of where they were aimed: a
  unit can walk out of an arrow's way. No splash: the blast is only a
  picture.
- **Towers, castles and town halls** (from Town Hall II) shoot the nearest
  enemy in range, keep it while it's within half their range, and turn on
  whoever hits them. Healing springs heal the nearest hurt unit of their
  side. Walls, houses and the rest never fight back.
- **Death.** A unit plays its death and lies 4 seconds, then fades; a
  building is gone at once and its ground can be walked.
- **The kamikaze** doesn't hit: it blows up, 500 to itself and to whatever
  stands on the 25 tiles around it, friend or foe (a building once for
  each of its tiles there), and sets off any kamikaze there within half a
  second.
- **Sounds**, the game's own: a sword for a hit up close (one of two at
  random), the shots (arrows, ballista bolts, cannon and rocks), and four
  death cries (a man, a woman, a troll or a boss, a machine). Quests play
  the game's quest music.

**The quests**, the same way:

- The Quests window is the game's own island map: its seven painted pages
  side by side (`images_new/quests_manager_img_<n>.jpg`), each island's
  ribbon where the Flash client puts it, with its name, the stars won (or
  a padlock while out of reach) and Enter Now once it can be sailed to;
  tapping a locked or resting island says why. It scrolls sideways, opens
  on the furthest island reached, and a page is never drawn narrower than
  560 pixels so the names stay readable. The 28 islands come in the game's
  order (`ISLE_ORDER`), from level 6: the first open, each win opening the next
  (`privateState.unlockedQuestIndex`), the last two from level 40, the god
  islands always. An island rests 4 hours after it's attacked
  (`map.questTimes`). Stars won are `privateState.questsRank`.
- **Sailing:** the whole army goes, every unit but villagers, farm animals,
  settlers and carts. The island loads (`get_player_info.php` with `user`
  the quest's id, a town save) and shows behind the start window, which
  offers the stars: 1, 2 after winning 1, 3 after winning 2. The island's
  own rules (`rules/islands.json`) say which of its things are enemies and
  which nobody's, which units it lends the player (a High Elf on the first
  island), where the army lands, and its ground (a picture per block of 20
  x 20 tiles; sea blocks can't be walked). Start battle: 2 stars add a
  copy of every enemy unit beside it, 3 stars two, then the army lands.
  `game_status` ("LOAD_MAP", "NORM", "QUEST") when the island is shown,
  `start_quest` (island, town) on Start.
- **Teams:** the last two hardcore islands and the god islands take a
  team of 20 instead of the whole army (the start window becomes the
  picker: tap a kind to add one, tap one in the team to take it out). Each
  kind counts up to its `units_limit`, the last team is offered again
  (`privateState.teams.quest`), and the god islands need 1 god or
  colossus in it (God Isle 3: 5), by the unit's `groups`. Fewer than 20
  asks once. Start sends `set_attack_team` ("quest", the 20 ids, 0 for an
  empty place) and only the team lands.
- **Playing:** tap a unit to select it (Shift adds or takes away), Select
  all (or Space) for the whole army; tap the ground to send them there,
  spread out, or an enemy to attack it. Escape lets go. Nothing is sent to
  the server while fighting.
- **Winning:** the troll islands light their treasure chest once every
  enemy unit is dead, and opening it wins; the civilization islands are won
  with their town hall; the hardcore and god islands by killing every
  enemy unit. The Hero Isle too: its heroes wait in seven parts walled
  off by doors (`doorZones` in `rules/islands.json`), and a part's door
  opens (its open picture; units walk through) once that part's last enemy
  is dead. As in the original, an enemy in no part (the nine by the
  landing, and every 2 and 3 star copy) counts against the first part, so
  its door can open before its own heroes are all dead.
- **Boss islands** (`rules/bosses.ts`, and `rules/bossMinds.ts` for the
  bosses that choose for themselves). On the Arctic, Desert and Mineral
  Isles the island lends a few units; its guards stand in four groups
  (by the nearest of four points, or by quarter of the map), and a
  group's key (a power gem on the Desert Isle) lights up once its last
  guard is dead. One tap collects a lit key (no unit has to go there).
  The fourth takes away the gate (or altar), and the boss comes out (or
  appears in its place). Its life comes from the player's level, doubled
  at 2 and 3 stars; at 3 stars there are two. Only the guards pay; the
  win pays the island's prize for its stars, and the island's reward
  unit. On the Arctic Isle each key brings three penguins to the player's
  side, and the gate's picture steps on for each of the first three. The
  bosses' three special moves take turns: a ground pound that throws
  units back, a rain of stones, and four small yetis (golems) at a time.
  - The Mineral Isle's guards are its trolls and undead, their huts too;
    the human fort and the Ravager Trolls fight but pay nothing. The
    fourth brazier brings the Rockdriller (20,000 life, 50,000 at 2 and 3
    stars). It holds a grudge against whoever hurts it most and shoots
    from 20 tiles. Once it has fought, it burrows and comes up in turns of
    15 seconds; burrowed it wanders, can still be hit, and sends up a
    Sanddriller. Its shots leave slime for 40 seconds, which kills a
    Sanddriller standing in it. After 5 minutes it rages: up for good,
    100 every 5 frames, drawn redder. If everyone it could go for is more
    than 20 tiles off, it goes home to the middle at 25,000 life.
  - On the Nest Isle the egg is broken first; rocks close the way back,
    then the Crimson Scale comes (life, attack and speed by the stars). It
    fights for 20 seconds, then flies one bombing run a star along the
    arena, setting fires that kill whatever stands in them, lands and lays
    two eggs a star that hatch draggies, and fights again.
  - On the Dangerous Isle two golden dragons (two shots a beat, and a
    quake) guard a path closed by two rocks, which go once both are dead.
    The black dragon can't be hurt: each of the eight eggs broken wounds
    it, and hitting an egg calls it onto whoever hit it. The eighth egg
    kills it and wins. Nothing on the Nest and Dangerous Isles pays but
    the prize.
  Monks (either side's) turn a unit within 10 tiles to their side instead
  of hitting: 4 each, 24 seconds apart, none with 500 life or more, no
  boss; a turned unit shows lighter, and a monk that has turned its 4
  redder. An enemy turned counts as beaten (it pays); one of the player's
  turned counts as lost. All the
  player's units dead, or leaving (the home button), loses. The results
  come 3 seconds after the end (7 after the chest).
- **What it pays:** each enemy half the price of a fighter bought with gold
  (a quarter with stone), else 5, times the island's share (a quarter on
  most civilization islands), and a twentieth of that in experience
  (rounded up); the win adds the island's prize for its stars, and a tenth
  of it in experience. Each island caps the gold (25,000, 30,000 hardcore,
  35,000 god) and the experience (7,500; 8,500 god); at the end the
  experience is cut to half the gold.
- **The fallen:** 60% of them come home (70% on boss islands), rounded up;
  which are lost is picked at random. Lent units always come home.
- `end_quest` with the report (gold, experience, the units as [unit, sent,
  killed, recovered], won, seconds, left early, the island, the stars) is
  sent as soon as the results show; Back home sends `game_status`
  ("LOAD_MAP", "QUEST", "NORM") and opens the town with the Quests window.
  The server pays it, removes the units lost, and opens the next island.

**Not the same as the Flash client:** chance comes from a function given
in, so the same seed plays the same battle (tests use it; the page still
plays at random); the battle's timers count frames, not seconds, so the
Speed button speeds them too. The report goes as the results show, not
when the player shares or skips them, so closing the page then loses
nothing.

**Spells**, from the Flash client the same way. Code: `rules/magic.ts`
(what each spell does, with tests; our notes on each in
`rules/spells-notes.json`, which the game doesn't load) and `ui/spells.ts`
(the windows).

- **Learning.** Human empires get magic at level 35 (the Wizardry
  Academy), troll empires always. The Academy's card has a Spells button
  that opens its window: every spell from the config's `magics` table,
  with its picture (`images_new/<img_name>.jpg`), mana, area and price.
  Gold learns a spell from its level; cash learns it at any level, as in
  the original. Learning gives the spell's mana once, so the first cast is
  free. `buy_magic` (spell, town, 0 gold or 1 cash), sent at once.
- **Mana** (`privateState.mana`) doesn't come back by itself: 2 a level
  from level 36, the spell's mana when it's learnt, and the Wizard's bank,
  5 mana for 20,000 gold or 1 cash (`buy_mana_new`, town, 1 cash or 0
  gold). The bank opens from the Academy's window and from the mana in
  battle.
- **Ranks.** A spell grows stronger with use (`privateState.magics`, times
  cast): rank 2 from its 25th cast, rank 3 from its 50th. The rank sets
  its area (5, 7 or 9 tiles a side for most) and its numbers.
- **Casting,** in battle: the spell book at the bottom left, with the mana
  left beside it. Open it, pick a spell (too little mana opens the bank),
  and the game's marker follows the mouse, lighting up whom it would
  reach; click to cast. On a touch screen the first tap shows the marker,
  a second tap there casts. The book, or Escape, cancels. The tapped tile
  is the bottom corner of the spell's square. The name and the mana float
  up, the mana goes at once, and `use_magic` (spell) is sent at once.
  The book's "Open book" opens the Academy's window, so troll empires
  (who have no Academy) can learn there.
- **The fifteen spells**, each with the game's own animation, frame by
  frame on the battle's clock:
  - *Fire Havoc:* 30 fireballs over 3 seconds; every third falls on an
    enemy fighter in the square, the rest anywhere in it. Each hurts
    whatever it lands on (150, 200, 250), the player's own too.
  - *Ultimate Hail:* a boulder on each tile, in its own time; enemy
    buildings take 800, 1,000 or 1,500 (not town halls, chests or keys),
    enemy units a tenth and are knocked down for 2.5 seconds.
  - *Deadly Frostbite:* enemy units in the square freeze (blue) for 15,
    20 or 30 seconds: no walking, no fighting. Bosses don't.
  - *Sacred Rain:* 100 life to the player's units under it; rank 2 adds
    20 a second for 5 seconds, rank 3 for 10.
  - *Golem's Wrath, Yeti's Trail, Summon Dragon:* a golem, a yeti or one
    of five Bahamut dragons joins the player's side on the tapped tile (or
    the nearest free one) with 4,000, 5,000 or 7,000 life. The dragon
    leaves after 30 seconds at rank 1, 60 at rank 2. Summoned units are
    no loss, earn nothing and don't keep a battle going.
  - *Hell Abyss:* the ground swallows the enemies in the middle of the
    square, buildings too; not bosses, town halls, chests, keys or units
    of 500 life or more. *Black Hole* does the same once a second for 15,
    20 or 30 seconds.
  - *Poisonous Flood:* enemy units around the tapped tile take 15, 20 or
    25 every 3 seconds, 5, 7 or 10 times.
  - *Ether Shield:* hits on anyone standing in the square are cut to 70%,
    55% or 40% for 20, 30 or 40 seconds.
  - *Age of Colossus:* the player's units around the tapped tile grow
    twice as big and hit half again as hard for 30, 45 or 60 seconds.
  - *2x Speed, 2x Range:* up to 20 of the player's units in the middle
    walk twice as fast, or reach twice as far, for 15, 30 or 45 seconds;
    casting again starts the time over.
  - *Instant Limit:* fills the LIMIT bar of the player's special units in
    the middle (the bar comes with the heroes' slice).

**Special moves**, the same way. Code: `rules/specials.ts` (the
machinery, with tests), `rules/specials-table.json` (each move as one of a
few kinds with its numbers; our notes in words are in
`rules/specials.json`, which the game doesn't load) and
`ui/specialButtons.ts` (the buttons).

- **By themselves:** the heroes and some other units (the elephants,
  level 5 soldiers, draggies, the Juggernaut...) have moves that come
  while they fight: after a while fighting (its own number of frames), the
  unit plays its special animation, and its attack beats in that time do
  the move instead of a hit (the Warrior Princess's whirlwind hits the four
  diagonal tiles, the Valkyrie heals her side around her, Willy Wallace's
  war cry makes his soldiers hit faster...). Some take turns between
  several moves. Enemy units do this too.
- **Buttons:** with one special unit selected (dragons, gods, colossi,
  titans...), its moves show at the bottom as the game's own pictures
  (`buildingthumbs/<name>.jpg`). A move starts on the unit's next whole
  second and plays its special animation; then every button waits the
  unit's cooldown (25 seconds, 24 for a few). Some need an enemy in reach;
  eggs and minions stop at 3 alive (or the unit's own number). The moves
  are of a few kinds: a volley of shots, a storm of hits around the
  target, a whirlwind round the unit (hitting, throwing, poisoning), a
  blast, a line of hits ahead, a single hit, healing, eggs and minions,
  swallowing, freezing, poison, growing, a war cry.
- **The rarer ones:** a shield of its own (Leonidas's shield wall and the
  Ether Messiah's shelter take no damage for 10 seconds, the Dragon
  Hunter II's force field half); the Invisible Killer can't be picked as
  a target for 8 seconds (drawn see-through); the Luring Warrior draws up
  to 10 enemy units within 17 tiles to fight it for 15 seconds; the
  Rainbow Dragon becomes a Crystal, Vulcano, Death or Electric Bahamut
  dragon for 20 seconds, keeping its life and its own buttons; the
  Chameleon takes its target's form for 30 seconds, keeping its share of
  life; the epic dragons' seals lift small enemy units helpless (drawn
  higher), hurt them and drop them, and the skull seal kills some
  outright; the Red Hot dragon's ghost copies strike four points 8 tiles
  round it, throwing and burning; the Ether Messiah's copies strike ahead
  and behind; the werewolf's curse turns its target (one whose kind has
  under 500 life, no boss) into a werewolf on its side, poisoned for good;
  the Red Wizard's fire rain is only a picture, as in the original.
- **Counted beats:** about a hundred special units (the titans, the
  tiny gods, the myths, the undead army, the elves, orcs and gladiators,
  the beasts...) count their attack beats, as each one's own class in the
  original does, and on certain ones play a move instead of the plain
  hit: every 5th beat a sweep, the 7th of every 13 a whirlwind, a draw
  of 1 in 9 each beat, only when the target is up close, or only against
  a building. Some keep a count for near and far beats apart, or start
  one beat later. Many also add something to every plain hit: burning
  (a second at a time), poison, a throw, or the hit lands by hand. Some
  stand busy while a long move plays (no beats meanwhile), play a last
  move as they die, or push what they meet on each tile they walk onto
  (the rhinos). Area moves can hit buildings and villagers too, spare the
  target (a splash round it), burn, or throw on a coin; a volley can go
  to several enemies; a swallow that finds nobody hits instead. New kinds
  of move came with them: a small unit killed outright (thrown and dying
  as it lands), a web that holds a unit and hurts it each second, and
  enemy units turned to its side for a while. The undead army raises
  skeletons: an enemy unit it kills has 3 chances in 10 of rising as a
  skeleton on its side for 15 seconds; summons that run out fade. The
  table is `beats` in `rules/specials-table.json`; each unit's notes,
  including what is still missing, are `beats` in `rules/specials.json`
  (`rules/specials-beats.test.ts` plays every one).
- **LIMIT:** the gods, colossi, titans and the upgraded dragons fill a bar
  from the damage they deal (healers from attempted healing, including
  a whole patient), at most once a second, doubled beside a Limit Wizard
  of their side; full at
  2,000 (500 for the Dragon Hunters). Full, the LIMIT button lights up:
  50 lightning bolts at random enemies in reach, 50 healing beams on
  their side's hurt, or a smash that hits and throws every enemy around,
  or the unit's own. The bar starts empty each battle; the Instant Limit
  spell fills it.
- **Thrown and knocked down:** a thrown unit lands about half the distance
  away and lies helpless for a second; a knocked-down one for 2.5
  seconds. Giants, bosses and big units (4 population or more) stand.
- No command is sent for any of this, as in the Flash client.

**Defending the town**, the same way. Code: `rules/raids.ts` (what comes
and how it behaves, with tests), `homeDefence.ts` (the town as a
battlefield, loaded from level 10 only), `battleControls.ts` (the
player's hands in any battle, shared with the islands), `view/fire.ts`
(the game's flames, `FireMC`, exported by `tools/art/export_ui.py`), and
`raiders.py` on the server.

- **What comes,** rolled afresh each time the town opens, and never
  saved, as in the original: from level 10 a band of bandits that attacks
  after 7 minutes, from 15 a second at 14 minutes, from 20 a third at 21.
  A band is a quarter of the level in units (half for a troll town),
  picked from the enemy race's soldiers for the level, and comes from a
  random edge of the map. From level 25 there's 1 chance in 10 of a siege
  of the level's kind: the village siege (25 to 29: 20 soldiers, 5
  engines and a captain, from the bottom of the map), the stampede (30 to
  34: 6 big mounts and a captain) or the army (35 and up: 30 from the left
  edge, while one of the town's villagers runs in crying for help).
- **How they fight:** a band goes for the nearest building or unit of the
  player's, at random between the two, until it has burnt out 2 buildings
  and killed 2 units (3 from level 11, 4 from 16), then walks back to its
  edge and leaves. A siege waits a minute, its captain riding up and down
  calling out (the game's own lines, from the config), then sends its
  engines at the nearest building, its first squad 5 seconds later, its
  second squad and the captain 15 seconds after that, and retreats 2
  minutes later. The stampede and the army never retreat.
- **The town as a battlefield:** when a raid comes, everything in town
  becomes a fighter (the player's units and buildings, with nature and
  scenery as nobody's), drawn by the battle's view over the town's ground.
  Building, moving and collecting wait until it's over (a line at the
  bottom says so); the player commands as on an island, with Select all
  (villagers stay out of it), the spell book and the special buttons.
  Towers, castles and town halls (from Town Hall II) shoot by themselves.
- **Burning:** at home the player's buildings are never destroyed. They
  burn as they lose life (the game's flames, in 4 stages), and at 0 they
  burn out: out of the fight, giving no room for people (the town hall
  still does), with their workers thrown out (`pop_unit`), until
  villagers repair them in full. A villager selected, the game's bucket
  pointer shows over a burning building of the player's; tap a burning
  building: it walks over and puts back 25 life every 2 seconds. Nothing
  about burning is saved, as in the original: reopening the town finds it
  whole.
- **The server hears** what the Flash client tells it: `sell` (x, y,
  unit, town, 1, "KILL", 1 or 0 for villagers and heroes) for each of the
  player's units killed, and `kill` (x, y, unit, town, "u") for each
  raider killed. Each raider killed pays 5 gold and its experience, saved
  by the server (`raiders.py`, up to 300 a day). When the raid is over the
  units stay where the fight left them (`move`, as after a walk).

**Troll camps**, the same way. Code: `rules/camps.ts` (with tests),
`rules/camps.json` (the layouts, as data in our own schema),
`homeCamps.ts`, and `ui/notice.ts` for the camp's window.

- **When:** 4 hours after the last chest was opened
  (`map.timestampLastTreasure`; a new town gets its first camp at once).
  Which camp is `map.idCurrentTreasure` (0 to 29), each chest moving it
  on; a camp the player's race doesn't get moves on as in the original
  (and the server hears `collect_treasure` with nothing to give).
- **The ten camps built here** are those the original lays out by its own
  code: the princess's village, the archers, the kidnapped units, the
  treasure village, the prisoners, the rebel troll, Prince Arthur and the
  three "Kaspar" camps. Three are 15 x 15 walled squares with things
  placed at random inside, by level; seven are 20 x 20 layouts drawn in
  the original, whose walls, towers, houses and soldiers become the enemy
  race's own for the player's level. The other twenty are scripted
  stories, put up by the classic game for now.
- **Putting one up:** the border ring is cleared (`sell` ... `CLEAN_<camp>`
  for what was there; the player's units there walk to the town hall),
  every piece goes on the map with a free `buy`, as the Flash client saves
  them, and trolls are topped up about the border (a few clusters, fewer
  the more enemies there are). The camp's window tells its story in the
  game's words, with its picture. As in the original, a camp still
  standing is put up afresh, somewhere else, the first time the town
  opens in a session (the browser tab: `session.ts`); coming home from an
  island or a visit finds it as it was left.
- **Whose things are:** as the original decides when the town loads: by
  race (the other race's are enemies), and on the border every building
  is an enemy but chests, fields, nature and scenery.
- **Beating it:** a unit selected, tap an enemy: the town becomes a
  battlefield as in a raid, and it's over once nobody has fought for 5
  seconds. Each enemy unit killed pays 5 gold and its experience (kept by
  the server); `kill` (x, y, id, town, "u" or "b") removes it from the
  save.
- **The chest** (or prison) lights up once no enemy unit is left anywhere
  on the map, the border's trolls and any raiders included; until then a
  tap says how many are left. Tapping it open: `sell` ... "TREAS", then
  `collect_treasure` (gold, experience, the next camp): 250 gold and 50
  experience up to level 5, rising by 100 and 10 every five levels to 750
  and 100 from level 26. A prison frees its prisoners beside it (a free
  `buy` each): the princess, three rangers, a rebel troll, Prince Arthur,
  healers... The next camp comes 4 hours later.

- **Music and the alert:** when one of the player's things is hit at home,
  the game's battle tune (BATALLA) takes over from the town's; every 70
  frames, with no enemy fighting, the town's comes back. Damage taken out
  of sight adds up (in sight takes away); past 50, a red "Your town is
  under attack!" shows for 5 seconds, and its Help button takes the
  camera there.

**Scripted camps**, the same way. Code: `rules/scripted.ts` (the rules,
with tests), `rules/scripted-camps.json` (every piece of the eighteen
camps players reach, our own notes on the original's tables) and
`homeScripted.ts` (playing them in the town).

- **Which:** twenty of the thirty camps are stories. They stand in the
  map's four corners, always in the same places. Camps 9 and 11 are never
  reached by any player, as in the original. All eighteen others are
  played here: a human town gets 7 and 13 to 29, a troll town 13 and 14.
- **How:** each key (a well, a statue) is guarded by the enemy units
  standing within 7 tiles of it when the camp is read (border trolls
  there too). When they've all fallen it lights up; one tap takes it: it
  pays its experience (`collect_new`), and it and its scenery go (`sell`
  ... "COLQS" and "ATRZO"). The last key lights the chest (the mill), or
  brings a wave of five skeletons (the statue), whose fall lights it.
  Unlike the ten camps built by code, these chests don't wait for every
  enemy on the map to fall. Opening one pays the level's reward and the
  next camp comes in 4 hours.
- **Reloading:** camps 7 and 13 save nothing of their own: how far one
  has got is read from the pieces still standing (keys left, the chest,
  the wave), as in the original. The newer camps (14 to 29) save their
  progress with `set_quest_var` (started, the keys taken, the bosses
  beaten). Each time the town opens, they clear the four corners and put
  back what isn't done: the guards of the keys left come back whole, and
  so does a boss not yet beaten.
- **Bosses and prizes:** a boss comes when the last key is taken (or at
  once, when the camp has no keys); the chest lights up when it falls, or
  the camp ends there when it has no chest (the Balrog), or when the last
  key is taken (the treasure, the portals, the wizards). A camp's helpers
  join the player by the town hall when it starts. Its prizes come with
  the chest: units beside it (or beside the last key), buildings to
  storage (`store_add_items`).
- **Their own rules:** the four festivals (the fireworks, the Viking
  beer, the Aztec altar, the tree of life) fill up a step for each key
  taken; their chests' step pictures are drawn by `tools/art/RenderSwf.java`
  (the layers named `step1`, `step2`... shown one more at a time, as
  `steps/0` in the sheet). The Chinese dragon's village starts half burnt
  (once a session), and the dragon can't be killed: below a tenth of its
  life it says its line and gets away, which counts as beating it.
  Neptune's pen has two doors, each opened by the fall of its wave (the
  crab knights, then the seahorses); Neptune gets away like the dragon.
  The Ent can't be hurt while its door stands; the fall of its wave opens
  the door, and the Ent's own fall ends the camp. The pens' walls and
  doors, and the festivals' buildings, are nobody's (they can't be
  attacked, and their towers don't shoot).

**The graveyard**, the same way. Code: `rules/graveyard.ts` (the rules,
with tests) and `ui/graveyard.ts` (the three windows).

- **Who goes there:** every unit of the player's that falls, at home or
  on an island, is counted in the save (`privateState.deadHeroes`, unit:
  how many). At home the client counts it as it sends the death (`sell`
  ... "KILL"); after an island the server has counted the losses. Villagers
  aren't kept. Heroes are kept apart, for their own graveyard.
- **The Graveyard** (its card's Open): the fallen of the town's race
  bought with gold or cash, by the shop's order. Each comes back for its
  potions, or for half its price: half the cash, or half the gold and its
  whole price in food, as in the original. Room for people and the units
  limit are checked first. It stands on the nearest free tile to the
  graveyard (`resurrect_hero`, the last argument "1" for potions). The
  window stays open. Potions are bought below (`graveyard_buy_potions`,
  100 cash for one, from `config/patch/graveyard.json`).
- **The Heroes' Graveyard:** the eight heroes, how many have fallen, and
  their price: 500 gold for each cash of the hero's price. The hero's
  experience comes again, and the window closes after each.
- **The Altar of Heroes:** the eight heroes for cash (`buy_cash`), each
  from its level; it stands beside the altar.
- **Not yet:** the Blue Phoenix's egg (it would hatch the phoenix again
  if it lasts five seconds); a phoenix that falls goes to the graveyard.

**The harbour and the zeppelin**, the same way. Code: `rules/dock.ts`
(with tests).

- **Given:** each time a human town opens, a harbour it hasn't got (on the
  map or in storage) is put down for free on the player's land nearest
  tile (59, 59), unless the Prisoner Princess still waits in the town;
  from level 30 the zeppelin tower too. A new one is staffed at once by 20
  free helpers and opened (`buy` free, `buy_si_help` 20 times,
  `finish_si`), and the message at the top says so. Troll towns get
  neither.
- **Open:** the harbour's card opens the island map at its first page,
  the zeppelin tower's at its third (with no army, a line says why not).
  Neither is needed to sail: the Quests button opens the map without
  them, as in the original.
- **Drawn open:** the harbour's picture, like other social buildings'
  (the Church, the second mill...), has two frames: open, and in
  scaffolding while it waits for its staff. They're drawn open, as the
  server opens them for good; they used to flicker between the two.

**Pausing**, the same way. Code: `ui/pause.ts`. The game stops when the
page loses the player (another window, another tab), or from the pause
button by the music and sound buttons, at home and on an island. A
dark curtain and the game's GAME PAUSED say so; RESUME, or any key let go,
starts it again. While paused nothing moves (the drawing's clock stops);
work and training go on, as they're the server's clock.

**Monks at home** turn units as on the islands (four each, one every 24
seconds). As in the Flash client the server isn't told: a unit of the
player's turned and then killed dies as an enemy (`kill`, so it's gone,
not buried), and an enemy turned fights for the player.

**Not yet:** the collection pieces dropped by enemies (they come with the
collections, in the last stop).

### Attacking players

"The switch". Attacking another player's town is played in the new
client: from Neighbours or the world map, with the defence plans, the
history, revenge and spying. A reading of the original,
in our words, is the plan (how an attack starts, the battlefield and the
four defence plans, the report, the windows after, spying, the world
map, revenge).

First slice, the server (`pvp.py`, with tests in
`tests/test_social.py`): the report the client sends at the end
(`end_attack`) is no longer taken on trust. Whichever game sends it:

- **Gold** is at most what the defender's things killed are worth, as
  the Flash client prices them: a town hall its owner's level x 100 (the
  level from the defender's save), a fighter half its gold price, an
  eighth of its stone price or ten times its cash price, each at most
  200; a won attack that found none pays 25; 20,000 at most in all.
- **Experience** is at most a twentieth of each kill's gold (at least 1),
  plus 1 for each other thing the defender's town has.
- **Honour** is worked out again from both armies: what the defender
  lost less what the attacker lost, against what the defender had, 1 to
  10 (0 when there was no town hall).
- **Losses:** at least the attacker's share of its fallen stay lost, by
  its level: 5 in 100 below level 10, a quarter from 10 to 15, half from
  16.
- **The count:** a fourth attack within the 6 hours up to the last (a
  fifth with an Odin Statue) is recorded, but pays nothing.
- The defender's tenths go to the town that was attacked; each player
  keeps the last 20 attacks made and received (the history shows 10).

Second slice, the battle in the new client (`attackPlay.ts`, the rules
in `rules/pvp.ts` and `rules/defencePlans.ts`, the browser test
`e2e/tests/attack.mjs`). From level 6, **Attack** sits beside each
neighbour but Arthur in the Neighbours window, as on the original's
neighbour bar; it opens `/client.html?attack=<player>`.

- **Before:** the attack is turned away for the player's own empire,
  below level 6, with no army, or with no attacks left: 3 in the 6 hours
  up to the last one (4 with an Odin Statue), all back together 6 hours
  after it, as the Flash client counts them. Then `attack_player` is
  sent (the attack counts from here) and a little map of the island's
  5 x 5 blocks asks where the army starts: one of the 16 round the edge,
  the top left picked.
- **The battlefield** is the defender's town, drawn as their town. Their
  soldiers, buildings that shoot and town hall fight; trees, rocks,
  animals and refuges are nobody's; units of the other race, buildings on
  the border blocks, lost things and the attacker's ships are cleared
  away. The army stands round the corner picked, every unit of the town.
- **Their soldiers follow the defence plan** saved in their town (the
  army window's plan, `set_strategy`): all stay and fight what comes
  near; half go out (as many as came, at the first attacker to hit, then
  home); archers against siege engines; or everyone on the siege engines.
  A town with none saved plays "half go out", as the Flash client did.
- **Playing it:** the same orders, spells and specials as on an island.
  The bar at the top counts the gold and XP won and the targets left
  (their soldiers, shooting buildings and the town hall); Select all,
  Speed and the crown (end the attack, which counts as lost). Their town
  hall falling wins it; the army falling, or leaving, loses it.
- **The pay:** a town hall its owner's level x 100, a fighter by its
  price (at most 200), 25 for a win that found none, 20,000 at most;
  nothing when the town had no town hall. The defender earns a tenth of
  each attacker their town killed.
- **The end:** the report goes to the server at once (`end_attack`, as
  the Flash client's), with who of the fallen comes home by the player's
  level (5 in 100 lost below level 10, a quarter to 15, half after) and
  the honour; then a window with the gold, XP, honour and units lost.
  Back home sends `game_status` and opens the player's own town.

Third slice, the town's own defence plan (`ui/army.ts`, the browser test
`e2e/tests/defence.mjs`). The Army window has two tabs, as the Flash
client's battle options window: My Army, and My Defensive Strategy with
the four plans, each with the game's picture, name and description (from
the config's texts) and its tick on the one chosen. A new town starts on
"Defensive" (all stay), as the game's own new save has it; a save with
no plan at all fights as "Mid Aggressive" (half go out). The
plan picked is saved with `set_strategy` as the window closes, only if
it changed, as there; picking one also counts for the goal that asks
for it.

Fourth slice, the history (`ui/attackHistory.ts`, in `e2e/tests/attack.mjs`).
**Battle Results**, a row in the Battle and World windows (the Flash
client's button on the world map's bar), lists the last ten attacks made
or received, newest first: the date, the opponent, won or lost and the
gold. +INFO opens a battle's report: both armies alive and dead (the
player's dead are those lost for good), the result in the game's words,
what was won, the units lost, and Take Revenge!!, an attack on them.

- **Coming home to an attack** not yet seen, the window opens by itself
  on the attacks received with the game's "Attacked!" notice, the attack
  marked new, and `clean_attacks` tells the server it has been seen. As
  in the Flash client, the town hall and the first five of the player's
  buildings (not walls or decorations) are found half burnt, for
  villagers to repair; that isn't saved.
- **Goals:** attacking a player (fought to the end, not left), attacking
  a neighbour, and opening the Battle Results now count here. Each attack
  is played on its own page, so what it did is kept in the browser tab
  (`attacksMade.ts`), as visits are.
- **Names:** the server now puts the attacker's username in the
  defender's history (every empire is called "Emperor" otherwise), as
  the neighbours list does.

Fifth slice, the world map (`ui/worldMap.ts`, the rules in
`rules/world.ts`, the browser test `e2e/tests/world.mjs`). **Attack a
player** in the Battle and World windows opens it from level 6, as the
Flash client's world button. It is the game's own screen, rebuilt in
HTML from its pieces: the continent picture (`images_new/mapa1-5.jpg`,
one for each continent in turn), and over it the eight islands, the
borders, the statue, the ship and the zeppelin, drawn from the game's
file by `tools/art/export_world.py`, which also reads where each piece
sits on each of the five pictures (`tools/art/Placements.java`) into
`ui/art/world/places.json`.

- **The islands:** the player's town and its seven rivals, each a town
  by its owner's level (a troll town for trolls), the flag on the rubble
  once beaten. On the town's own continent the borders show, and the
  town's land and the islands beaten are coloured in, as there. Each
  island has its owner's name and level under it (an extra: the original
  showed them only in the menu).
- **An island's menu:** the owner and level, Profile (their honour and
  attacks won and lost, `get_public_player_info.php`) and Attack. Attack
  isn't offered for the player's own island, someone attacked in the
  last 4 hours, with no army or no attacks left; the menu says why.
  Attack opens the battle with the island's place and continent in the
  report, so the server counts the island beaten (`worlds.py`).
- **The bar:** the attacks left (or when they come back), Battle Results,
  Options (the Army window on its defence plans), the continent to look
  at with its arrows, a number and GO!, and My World to come back.
  Under the map: the progress (islands beaten of 7) and Relocate, which
  asks first and loses the islands beaten (`reset_position_univers`).
- **Moving on:** once the seventh rival is beaten the server moves the
  town to the next continent; the map then shows the game's prize window
  (`reset_world_change`), and OK gives the cash and units into storage
  (`apply_rewards_ranking`). If the player's own island counts as beaten
  (islands swapped about), it changes places with one not beaten
  (`modify_position_univers`), as there.
- **The ship and the zeppelin** (from level 25) open the quests' map at
  its first or third page.
- **Names:** the server now names each island, and each profile, by its
  player's username, as the neighbours list does; it sent the town's
  name before, which is "My Empire" for nearly everyone.
- **Left out:** the help page the original showed the first time. Its
  words ("Try to make it to Island 1") show the original's continents ran
  from 50 down to 1; the server's run from 1 up (`worlds.py`), and the
  owner chose to keep that, so the page would mislead.

Sixth slice, spying (in `attackPlay.ts`, `e2e/tests/spy.mjs`). With an
Eagles building built, the world map's bar shows the eagles left (3 in
the 24 hours up to the last visit, counted as attacks are) and an
island's menu has Spy; without, it says to build Eagles.

- **The visit:** `spy_player` is sent, the game's "Preparing To SPY"
  window opens, and the player's eagle alone flies over their town as
  the battle page draws it, their defence plan and towers shooting at it.
  Its life comes from the Eagles building: 200, 400, 800 or 10,000 for
  Eagles I to IV. Every tap sends it there; it attacks nothing and
  there's no spell book, as the original lets nothing else be tapped.
  The bar counts their targets.
- **The end:** when the eagle falls, or is called home, nothing is won or
  lost and no report is sent; Back home opens the world map at the
  continent spied on, as the Flash client goes back.
- **Goals:** spying, winning two and three attacks (the save's count),
  and attacking two players of the player's level and two above it, now
  count here.

### Survival

"The switch". The Survival Arena is played in the new client
(`ui/survival.ts` for the window, `survivalPlay.ts` for the battle, the
rules in `rules/survival.ts` with the arenas' numbers in
`rules/survival.json`; the browser test `e2e/tests/survival.mjs`). The
server's side was already there (`survival.py`).

- **The window** opens from the Battle and World windows' Survival from
  level 20, as the Flash client's world button, or at any level from the
  Survival Arena's own Enter Survival. It has the lives (three hearts,
  each back 3 hours after its use, and bought ones on top: Buy life, 3
  cash, `add_survival_vida_extra`), the next life's countdown, and the
  five arenas with their pictures, best times and the units won for
  holding out 5, 8, 12 and 15 minutes (or 12 to 25). Two can be played;
  the other three say Coming soon, as in the original, whose maps for
  them never shipped. Its help shows by itself the first time
  (`set_help_map`), and again from "?".
- **The army** is the town's 30 strongest units by attack, picked by
  itself as the original did. They're copies: nothing that falls in the
  arena is lost from the town.
- **The stand:** the game's start window, then Start uses a life
  (`start_survival`). The army stands round the relic (5,000 life) in the
  middle; the arena's walls and statues are nobody's. Waves come from
  eight points round the edge: four of eight units, then a boss (who
  can't be frozen or swallowed) with two waves of five from every point
  while it lives, five times over, faster each time; then the last stage
  sends five from every point every 3 seconds, up to 80 at once, for
  ever. Every enemy goes for the relic, and no monk can turn one. The
  bar shows the time held, the enemies killed and the relic's life, with
  the game's lines ("ENEMY WAVE 1 IS COMING!!!", "BOSS 1 IS COMING!!!",
  the relic attacked).
- **The end:** when the relic falls, the results 3 seconds later: the
  time held, and the unit won if any. OK sends `end_survival` (the arena,
  the seconds, the unit), which keeps the best time and puts the unit in
  storage, and goes home. Leaving early asks first, and sends nothing
  more: the life is spent, as in the original.

The browser test waits for the displayed arena clock to reach three
seconds, with a 30-second limit. Game time can run behind real time when
Chromium draws without a graphics card; the saved stand must still be at
least three seconds long.

### Tournaments

Tournaments open from Battle (World on a phone), from level 15 and while
`TOURNAMENT_ACTIVATED` is on. The list, team editor, waiting room, three
matches, results and friends' rooms all work in the new client. Classic
choices are hidden at the owner's request; the original routes and
compatibility with the same saved rooms and teams remain.

`rules/tournaments.ts` keeps selection, entry and result rules;
`ui/tournaments.ts` owns the panel and phone sheet, with
`ui/tournamentResults.ts` for matches, rankings and prizes. `main.ts`
connects the town and command queue; `net/server.ts` uses the existing
`tournaments/<service>.php` request envelope.

- **Everyday, Weekly and Your own** show the game's tournament pictures,
  entry costs, the server's chosen everyday/friends' prizes, weekly
  availability/countdown and friends' rooms. Already-entered weekly
  tournaments are hidden, as in Flash. Refresh asks the server again;
  a failed request preserves the last room and offers another attempt.
  Weekly prize information lists the ten places before entry.
- **Help** uses the original words and current banned-unit names. It
  opens the first time, recorded as `set_help_map ["tournamentHelp"]`.
- **Your Team** has twenty places. The editor offers owned units from
  the town, buildings, warehouse and town storage (not gifts), strongest
  first and within each unit's limit. It excludes civilians and banned
  units. Adding uses the first empty place; removing returns one copy;
  Reset clears the selection. Save checks current ownership and the
  configured dragon/god/colossus cap. The shared editor keeps that cap
  even for a player planning to enter the weekly tournament, as Flash
  did. Weekly entry skips the public card's ownership/complex-unit
  recheck. Opening the list restores eligible copies then; the original
  weekly exception still applies if ownership changes before entry.
- **Same save and commands:** opening the list prunes unavailable saved
  units and silently saves the remaining team, as the original does.
  Editing saves `set_attack_team ["tournament", JSON-string-of-20-ids]`,
  with zeros for empty places. It never changes `teams.quest` or removes
  owned units. An enrolled room displays its frozen team. Closing a
  panel leaves enrollment and results intact; opening it rereads the
  saved state. Ownership and the saved selection refresh together, so
  units acquired in another tab are not pruned using an old town view.
  Editing and saving use fresh ownership; entry refreshes balances and
  choices, then applies its public or weekly rules. Navigation to a match
  flushes pending commands first. Returning waits for lessons, any pending
  gifts read and welcome dialogs before reopening the room once.
- **Entry and waiting:** empty teams are refused, short teams ask first;
  a full weekly team entering in the last ten minutes also gets a
  warning. Public rooms match five level brackets. The service takes
  the fee once; `tournament_substract_resources` and
  `tournament_refund_resources` retain their original bookkeeping
  formats. Authoritative money is reloaded after a service changes it.
  Four seats show the entrants, with the original bot portraits and
  empty-place artwork. The minute countdown refreshes the room; it is
  not a bot-arrival timer. Public rooms fill empty seats after thirty
  minutes, friends' rooms after a day, when the server next checks them.
  Start opens the matches when all seats are ready. Leaving before
  readiness refunds the fee; leaving afterward abandons the room
  without a refund. Stale leave/cancel requests cannot affect a newer
  enrollment.
- **Friends' rooms:** Your own offers the seven public types for
  creation. The server requires three real player neighbours, including
  Friends-page friends. The waiting host can cancel, refunding every
  entrant, or open Invite. Invite follows the existing classic-page
  adaptation: it explains where neighbours find the room and links to
  `/friends`. No Facebook message or separate invitation record is
  created. After readiness, the host can leave but cannot cancel the
  other players' matches.

`tournamentPlay.ts` loads the configured arena and two copies of the
enrolled armies. `rules/tournamentBattle.ts` places them, controls the
opponent and computes the original score over the existing battle and
special-move engine. Each entrant fights the other three armies
independently; the other player need not be online. Home units, storage,
the graveyard and the saved team do not suffer battle losses.

- **The match:** the original loading/start step, two army life bars,
  unit counts, normal orders, selection, speed and special moves. The
  defender forms up at its slowest member's speed; weekly defenders
  charge after ten seconds. Public defenders have no timed charge,
  but their normal defensive behavior can react to an approaching foe.
  Marching speeds return to normal on the first hit. The four collective
  healers follow friendly patients; Engineers instead use their ordinary
  friendly siege-repair behavior. Healers on both sides retain whole
  patients; attempted healing still builds LIMIT, without a `+0` popup
  when no health is restored. The armies stay in the
  middle of the arena. Crack and Black Hole remain visible but unavailable;
  other learnt spells use normal mana and `use_magic`. Battle controls
  use the shared HUD's phone layout at 720 pixels wide or narrower, or
  on portrait screens up to 1000 pixels wide.
- **The score:** current rooms use accumulated damage, including damage
  healed later and overkill, to the original armies. Summoned units do
  not enter their life totals or completion checks. Older point-type
  zero uses the original slot-array lengths. The result waits three
  seconds, sends the original `finish_tournament_match` fields and
  displays the original victory/defeat picture. Surrender asks first
  and records a zero-point loss. There is no `end_attack`, casualty
  report or battle-gold payment.
- **Coming back:** an unfinished match restarts from the enrolled armies,
  as the original did; health and positions are not saved. The server's
  one-hour unfinished-match timeout still applies. Once queued spell
  and battle commands are saved, a completed result awaiting confirmation
  stays available for Retry, including a reload in the same tab. If
  those commands fail, the client requires a reload from saved state
  without submitting the local result. The server's recorded result always wins. The client
  does not announce a saved result until it has read that result back.

Matches and Results remain available until Done. Public/friends' results
show all four players' scores and times, including departed entrants in
score/time order. A departed high scorer can appear first but cannot win;
the departure label and server's `winner_id` distinguish these cases.
Weekly results show the top ten and the player's own rank. The server
also resolves exact public ties through `winner_id`, because its returned
player list is viewer-first.
Weekly prizes follow the frozen rank at that player's completion, even
if the live table changes later. The server has already paid any prize:
gold/cash update the balances and unit prizes appear in Storage. Done
only sends `clean_tournament` and refreshes home data. Repeated refresh,
result submission or acknowledgement cannot award the prize twice.

Browser coverage is split across `e2e/tests/tournaments.mjs` and the
`tournament-*` tests, using local throwaway accounts and checking screens
against saved rooms, matches and resources. Rule and protocol tests sit
beside their modules; `tests/test_tournaments.py` covers the server's
fees, state transitions, prizes and idempotency. The pre-review browser
suite passed all 73 checks, including all five tournament checks;
verification of the subsequent review fixes is pending. See
[the delivery record](docs/verification-92.md) for the exact tested code
and results. Original-source notes are in
`docs/original/rules/tournaments.md`. No dedicated tournament goal exists
in the shipped missions, so the count of unfinished goals does not change;
ordinary resource-spending progress still receives successful entry fees.

### Making the art look better

- **Smoothness comes from the engine**, and step 2 has it: drawing at the
  screen's rate, the gliding camera, smooth zoom. The animations themselves
  are drawn "on twos and threes" (each picture held for 2 or 3 frames), a
  cartoon style; making up pictures in between would smear fast moves like
  the catapult's swing, so we keep them as they are.
- **Sharper pictures** are a choice. The art is drawn at the size the game
  shows it (one picture pixel per screen pixel at zoom 1), so it is enlarged
  on big or high-resolution screens. We tried an AI upscaler (Real-ESRGAN,
  its model for drawn art) on the catapult and a building, at twice the size.
  Much sharper than plain enlarging, and steady from frame to frame, but it
  changes the style: dark outlines where the artists drew soft edges,
  painted texture flattened, a few made-up details. About 3 times the file
  size, and about 17 seconds a picture on a processor (days for the whole
  game; an hour or so on a graphics card). If we want it, it would be a
  second set of sheets for big screens, with the originals kept.


## Risks

| Risk | What we do about it |
| --- | --- |
| Size: the long tails of special units, items and windows | Side by side, so the new client is useful before it's complete; do what players use first |
| Battles feel different (timing, damage, unit behaviour) | Numbers come from the game config; compare with the Flash client on staging; tests that pin the numbers |
| Copyright: the new client copying Social Point's code | Read the decompiled client to learn how the game behaves, write notes in our own words, then write our own code. Never paste or machine-translate ActionScript into the new client. The art is used as it is today |
| A save the Flash client can't read while both run | Only the existing commands; the server tests; every step tried on staging first |
| Download size and phones | WebP, each item's art loaded only when needed (as now), and testing on a mid-range phone from step 2 |

## Decisions to make

- [x] Engine: PixiJS 8 (chosen; step 2 is built with it)
- [x] Windows in HTML and CSS (the top bar is; the same for the rest)
- [ ] The new client sends the existing commands at first (recommended), with
      repeatable battles so the server can check them later
- [x] The beta page: `/client.html`, a choice on the home page, "The new game
      (preview)" (easy to rename)
- [ ] AI-upscaled art for big screens: sharper but restyled
      ([Making the art look better](#making-the-art-look-better))
