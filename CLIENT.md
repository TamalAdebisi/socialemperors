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
and makes everything in a few hours on 4 processor cores. `art/` is not
committed: the **Export art to R2** workflow makes it on 8 machines at once
and puts it in the bucket under `art/` ([DEPLOY.md](DEPLOY.md)).

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

Still to do for the art: the effects in `assets/fx/` (mostly vector
drawings, which can be drawn sharper than the original), the sounds inside
the Flash files, and the scaffolding pictures for buildings under
construction (in `assets/swf/120608_dynamic.swf`).

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
players get.

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
  - on their own (wonders, the bakery, the restaurant, the temple): no
    workers, round after round.
- The harvest is the config's `collect`; each worker after the first adds a
  fifth, then the working time's share; all rounded down. Farms use up a
  third of their harvest in wood (rounded). The config's `collect_xp` comes
  with it.
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
left. Another sets a new town up as the Flash client would (a farm, a ranch
and a gold mine, with a villager in each), then in the new client chooses
the mine's working time and collects the farm and the ranch: the save has
the harvests, the farm's wood, the experience, level 2 with its prize, and
the timers started again. A third buys three farms and a mill in a new
town through the shop: placing on the town hall is refused, placing goes on
after each farm and stops after the mill (one per town, and level 2 with
its prize), the mill's card then says "You have one", and the save has all
four, the wood paid and the experience. Another checks the original's
rules for nobody's things (a tree has no Sell, a stone rock on bought land
can be removed) and the storage: a tower and a house stored, the tower
placed again, the house sold for 1 wood; the save agrees. The menus test
opens every window from the rail, checks one is open at a time with its
button lit, visits another test player from the neighbours list, and on a
phone checks the dock, short numbers and the sheet closing when dragged
down; the collect test ends with the glove collecting two buildings. The client is
now 309 KB (93 KB compressed).

**Not yet in step 3** (Beta 1's next slices): turning a building while placing it, unlocking a
building early with cash, buying resources with cash when short (the Flash
client offers it), training units, placing units from storage,
units walking (so trees, rocks and gold on the map, which a villager works,
and putting workers into buildings), hurrying with cash, and moving or
selling buildings with units inside (the Flash client lets them out first;
for now the bar says to use the classic game). Moving on a phone places on
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
