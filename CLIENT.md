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
- We can't change it. The welcome-back bonus is switched off inside the
  client and stays off. New units and buildings need new Flash files.
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
  smoothly, around the pointer; arrow keys; full screen; phones and tablets.
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
Selling asks first and says what it gives back. While moving, the footprint
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
- Turning goes round the item's ways of facing (its art's frames).
- Selling gives back a twentieth of the price, in what it was bought with,
  rounded down; nothing for things bought with cash.
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
of what it gives; tap it to collect, and the harvest and experience rise
from it. Mills and mines whose workers wait for orders show "zz": tapping
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

**How the shop works**, read from the Flash client (our notes, our words):

- Humans are sold items whose `in_store` is 1 or 3, trolls 2 or 4. An item
  shows from its `store_level`, and can be bought from its `min_level`, or
  sooner once unlocked with cash (the save's
  `privateState.unlockedEarlyBuildings`).
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
- Units can be stored too (heroes); placing them waits for training units,
  which needs the town's population.

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
opens House IV early, hurries a gold mine and trades cash for gold at the
bank, checking the save for each. The bonus test checks there's no daily
bonus at level 1, collects its first day at level 5, reaches the first
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
right (Storage), its info panel's tiles for Move, Turn, Store and the
red ✕ for Sell or Remove, its resource icons and "zZ" in the bubbles over
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
- A **selected building's card** sits at the bottom middle: its name, what
  it's doing, and the info panel's tiles (Move, Turn, Store, Sell).

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
glove. Until Beta 2, Quests, Battle and World's battle modes open the
classic game. The mockups are the reference for the look (drawn over a
real town; a monitor on the left, a phone on the right):
[neighbours](docs/menus/neighbours.webp), [the shop](docs/menus/shop.webp),
[a building selected](docs/menus/selected.webp) and
[battles and quests](docs/menus/world.webp).

**How it's built:**

- The rail and the dock are one row of buttons; the style sheet stands it
  up or lays it down, and shows Quests and Battle on the rail, World in
  the dock. The phone arrangement takes over below 720 pixels wide, or on
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
- Neighbours: the list the server sends with the town (friends first, then
  the players most recently seen). Each row has the player's initial on a
  colour of its own (Facebook's pictures are gone) and Visit, which opens
  their town to look at; a visited town has no menus, only Back home.
- Army: the town's units by kind, with how many. Training comes with the
  training slice; until then the window says to train in the classic game.
- The glove (the Flash client's fast-collect button) shows bottom right
  when something is ready, with how many, and collects them all in one
  press, sending what tapping each would.
- Red counts: the gifts waiting in storage on Storage, the ready buildings
  on the glove.
- Shortcuts on a keyboard: B build, S storage, A army, Q quests, W world
  (phones), N neighbours, C collect all, Escape to close.

### Units walking

Built (Beta 1's second slice). Tap one of your units, then the ground: it
walks there, round what's in the way, playing its walk, and stops on that
tile; the server hears where. Code: `rules/walking.ts` (the rules, with
tests), `TownView.walk` (the drawing), `TownEditor.walkTo` (the taps).

**How units walk**, read from the Flash client (our notes, our words):

- Bought land can be walked on, except under buildings. Fields (farms)
  can be walked over, and units don't stand in each other's way. Closed
  land, the wild ring and the sea can't be reached.
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

**Not yet:** the speech bubbles units say now and then, and a mark on the
ground where a unit is going. (Units sent to a building or a tree: "Villagers
at work"; wild animals following a unit home: "The living map".)

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
- Let out: the last unit in comes out on the nearest free tile around the
  building (`pop_unit`: the building's place, town, item, the tile, 0).
  The last one out ends the building's work; a mill or mine whose time is
  chosen forgets the choice too (`activate`, 0) and asks again when the
  next worker comes in. Selling or storing a building lets everybody out
  first, as the Flash client does.
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

Trees, rocks and wild animals grow back each time the player opens their
town, as in the Flash client, so wood, stone and gold don't run out; wild
animals are caught by coming near them. Code: `rules/nature.ts` and
`rules/animals.ts` (with tests), called from `main.ts` before the town is
drawn; catching in `TownEditor.caught`. Tests: `e2e/tests/nature.mjs` and
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
  wild ring round the island or of the player's land; each of its trees or
  rocks takes the free tile nearest it (the tile itself first, then the
  first ring of tiles out with a free one). So a clump at a block's edge can
  spill onto land not bought yet, as in the original.
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
  workers go in (`push_unit`); with none, to beside the town hall. Animals
  find their way anywhere but through buildings, as the original's paths
  do, so one caught in the wild walks in; the player's units still go only
  on their land.
- A caught animal is the player's: select it and tap one of its ranches (or
  the hatchery) to send it in. Tapping a wild animal with a unit selected
  sends the unit beside it, and so catches it.
- The browser tests give each new town enough trees, rocks and animals
  first, in the wild corners at the top, so none grow on the land a test
  uses (`e2e/lib.mjs`, `FULL_WILD`).

### Training and population

Built (Beta 1's fourth slice). A building that trains a unit (the town hall
villagers, barracks spearmen, stables knights...) shows the unit's picture
on its card with the price: tap it to train one, or the cash button to pay
in cash. The top bar counts the town's people against the room for them,
and so does the Army window. Units in storage can be placed when there's
room. Code: `rules/training.ts` (with tests), `TownEditor.train`.

**How it works**, read from the Flash client (our notes, our words):

- Each building trains one kind of unit (the config's `trains`), one at a
  time, in 3 seconds. The price is paid when it starts, with the unit's
  experience; then it stands on the nearest free tile beside the building.
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
open a building early from the shop for cash; finish a building's work now
for 2 cash; and the bank, from the + on the gold and cash pills. Code:
`rules/land.ts`, `unlock` in `rules/shop.ts`, `hurry` in
`rules/production.ts` (all with tests), `ui/bank.ts`.

**How it works**, read from the Flash client (our notes, our words):

- Land: a closed block in the middle 3 x 3 is for sale when the block
  before or after it, or above or below it, is open. Its price is the
  config's `expansion_prices` row for how many blocks are open (the first
  4,000 gold or 20 cash). Paying in gold needs that row's number of
  neighbours (every neighbour counts but "Best Empire"); cash doesn't.
  `expand` (block, "gold" or "cash", town).
- Opening a building early: a building the shop shows but whose level
  isn't reached costs a third of that level in cash, rounded up (House IV,
  level 31: 11 cash); the shop sells it from then on. `unlock_building`
  (its id, as text).
- Hurrying: 2 cash finishes a working mill, mine, bakery or a wonder that
  houses nobody, and collects it at once; the cash goes in `collect_new`'s
  last place. Farms and ranches can't be hurried.
- The bank is the site's (bank.py): 2,000 of a resource for 1 cash, up to
  5 a day, and the game's own trade, 5 cash for 2,500 gold
  (`exchange_cash_new`, town). The window first sends the town's waiting
  commands, so the bank counts what the player sees.

### Missions and bonuses

Built (Beta 1's sixth slice). The next goal shows bottom left (tap it for
all 15 open); goals reached are paid their gold. The daily bonus and
Monday's chest show as round buttons at the top right while on offer. Code: `rules/goals.ts` and
`goals.json`, `rules/bonuses.ts` (with tests), `goals.ts`, `bonuses.ts`.

**How the goals work**, read from the Flash client (our notes, our words):

- Goals run only in a human town below level 35, decided when the town
  loads, as in the Flash client (from 35 the spells box takes their place).
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
  Small Refuge's units. Others count what the player did since the page
  opened, as the Flash client counts them: collecting (buildings, trees and
  rocks), working times chosen, units let out, buildings moved and stored,
  something placed from storage, units trained at a building, units sent
  into buildings, cash spent, zooming, the daily bonus's day, the neighbour
  visited last and the buildings helped on visits (kept in the browser tab,
  so a visit counts back home).
- No skipping for cash: the Flash client had its Pay button switched off
  (only a test setting turned it on), so ours has none.
- Goals about battles, quests, the market, the social buildings and
  capturing animals say they're played in the classic game for now (72 of
  the 226); the server keeps them done whichever client does them.

**The bonuses** (the server pays from the same config, `daily_bonus.py`,
`monday_bonus.py`):

- Daily: from level 5, in a human town; on offer from the next calendar
  day (UTC) after the last; the
  five days' prizes in turn, the first again after a day missed. A hero is
  drawn at random and goes into storage. `win_bonus` (gold, town, hero,
  day, cash).
- Monday's chest: on a Monday (the player's own calendar) not yet
  collected; previewed on Sundays. Three chests; whichever is picked holds
  one of the config's three prizes by chance (gold, cash or a unit).
  `weekly_reward` (kind, amount or unit).
- No welcome-back chest: the Flash client has one, switched off inside it
  as it was built, so it never shows.

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

**Not yet:** gifts and requests between neighbours, and adding neighbours
from inside the game (the site's friends page does it).

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
- The battle, quest and construction sounds wait for those parts.

**Speed:** the server now sends text gzip-compressed (`compress.py`): the
game's config, which every start needs before anything shows, goes from
1.9 MB to 145 KB; the client's script from 415 KB to 143 KB; towns
too. Each packed copy is kept, so the config is packed once, not at every
start. Files keep their version tags (marked "weak"), so a browser that
has the client already gets a short "unchanged". Arthur's grown town (402
things, 69 pictures) opens in under 3 seconds on our test machine once its
art is cached, and in about 10 the first time, mostly downloading the
pictures; the bucket keeps them a day in the browser's cache.

### Arthur's lessons

Built with Beta 1's launch preparation. The Flash client gives Arthur's
lessons (its tutorial: the town hall, a villager, a tree, a farm, a house,
a knight and a first battle) in a player's first town while
`playerInfo.completed_tutorial` is 0, and reports each lesson reached
(`complete_tutorial`, the lesson; the last is 15). They're built around a
new town's layout, so they're best taken before playing on.

The new client has no lessons of its own yet (they come with "The
switch"). A player who hasn't started them is asked at the bottom: **Take
the lessons** opens the classic game on the same empire, where they start;
**Skip them** sends the Flash client's report of the last lesson, as if
they were done. It asks on each visit until answered. Skipping matters
beyond the lessons: the world map only picks rivals who are past them.
Code: `rules/lessons.ts` (with tests), `TownEditor.offerLessons`.

The run-through (`e2e/tests/classic.mjs`) plays a new empire a little in
the new client, takes the lessons, and checks that the classic game opens
it and draws the farm the new client built; another player skips them.

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
- **LIMIT:** the gods, colossi, titans and the upgraded dragons fill a bar
  from the damage they deal (healers from the healing they do), at most
  once a second, doubled beside a Limit Wizard of their side; full at
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
  villagers repair them in full. A villager selected, tap a burning
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
  standing is put up afresh, somewhere else, each time the game opens.
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
  reached by any player, as in the original. Played here so far: camp 7
  (the burning mill) and camp 13 (the skeleton statue); the others are put
  up by the classic game for now, in the same empire.
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
  the wave), as in the original.

**Not yet** (Beta 2's next slices): sixteen of the scripted camps, monks at
home, collection pieces dropped by enemies (they come with the
collections), and the original's repair pointer.

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
