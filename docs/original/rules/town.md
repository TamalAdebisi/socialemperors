# Running a town

The rules the original Flash client plays a town by, read end to end: the
map and its land, what blocks what, buying, placing, moving, turning,
storing and selling, the scaffold, upgrading, production (working times,
workers, farms, ranches, hurrying), room for people, training, villagers,
units walking and going into buildings, wild animals, what grows back, the
tidy-up as a town opens, academies, wonders and other buildings with their
own effects, the town hall, storage and the gift box, and the troll town.
Each rule says what the original does, then (in italics) where our new
client stands: *same*, *different*, *missing* or *not checked*, with the
file.

**What was read, and how deep.** Read through: `core/Config`,
`core/isoengine/IsoElement`, `IsoInteractiveElement` and `IsoBuilding`,
`core/FauxBar`, `FauxBar3`, `LargeTile`, `StoreObject`,
`BuildingReference`, `battle/Maps`, `com/socialpoint/astar/AStar`,
`managers/TownManager`, `GUI/RecuadroInfo` (the info panel),
`GUI/CountdownTimer`, `GUI/GiftButtonLarge`, `popups/PopupCollect`,
`PopupHurryup`, `PopupRaceSelector`, `expansion/ExPayTab`, and which
buttons each info panel class (`EP_*`) has. Read in the parts that run a
town: `core/Base` (loading the map, the grid, taps and tools, building,
moving, selling, storing, land, limits, the tidy-up; its Facebook, asset
loading, debug keys and attack counters skimmed), `core/MapInitializer`
(the home opening and what grows back; its sieges, camps, islands and
tournaments skimmed: they belong to the battle books),
`core/isoengine/IsoEngine` (the registry, free-tile searches, counts,
villagers, population; its target searches for fights skimmed),
`core/isoengine/IsoUnit` (making a unit, its update, walking, `setMove`,
going in, harvesting, repairing; its fighting and special moves not read),
`battle/IA` (the town parts: animals, villagers), `managers/PlayerStatus`
(room for people, money), `managers/CommandManager` (`buy`, the unit-move
timer), `managers/PopupManager` (the start-up checks), `GUI/GiftWindow`
(how cards are grouped) and `GUI/GuiManager` (the tool buttons only).
**Not read:** the shop window (`GUI/BuildingWindow`), the social-building,
recruitment, market and unit-warehouse windows, `MissionsManager` and
`NeighbourManager`. The building delegates were taken from
`docs/original/index/delegates.md`: they are all about fighting. Numbers
from the config come from `config/game_config_20120826.json`. On our side:
`client/src/rules/` (town, geometry, editing, walking, work, villagers,
production, training, land, storage, shop, nature, animals, cleanup, dock),
`editor.ts`, the opening in `main.ts`, the camp clean-up in `homeCamps.ts`
and the tap in `view/camera.ts`, with CLIENT.md, PARITY.md and DECISIONS.md.

**Words used here.** A *tile* is (x, y) on the 100 x 100 grid. A *tick* is
the original's one-second clock; a *frame* is a 30th of a second. *Free*
in a command means its "don't change resources" flag set to 1. *Far
corner*: the point (200, 200), past the bottom of the map, which several
of the original's searches measure from.

## The map and the land

- **The grid.** 100 x 100 tiles in 5 x 5 blocks of 20 x 20. A tile's block
  is x/20 + 5 x (y/20) + 1 (rounded down), numbered 1 to 25 like the save's
  `expansions`; the outer ring of 16 blocks is the wild ring (the client
  gives those blocks negative numbers). *Same: `client/src/rules/geometry.ts`.*
- **What can be bought.** The middle block (13) is always owned. The other
  eight middle blocks (7, 8, 9, 12, 14, 17, 18, 19) are for sale until
  owned; the wild ring never is. *Same: `client/src/rules/land.ts`.*
- **The ground.** Each block is drawn by the island look's land item (1000
  plus the save's `skin`) standing on the block's last tile: frame 3 for
  owned land, 1 for the wild ring, 0 for land for sale. Every unowned
  middle block shows the for-sale button, at home only, whether or not it
  touches the player's land. Trees show the frame for the island's look.
  *Same: `client/src/rules/geometry.ts` (`groundBlocks`), `client/src/view/townView.ts`.*
- **Tapping a for-sale button** opens the land window only if the block
  shares a side with an owned one (its number plus or minus 1 or 5);
  otherwise nothing happens. *Same: `client/src/rules/land.ts` (`landForSale`).*
- **The price** is the config's `expansion_prices` row for the number of
  blocks owned less one: the second block costs 4,000 gold or 20 cash,
  the ninth 500,000 or 60. *Same: `client/src/rules/land.ts`.*
- **Paying in gold** needs that row's `neighbors` count of neighbours (all
  in the save's list but one called "Best Empire"); cash needs none. The
  neighbours are checked before the money. The window offers the gold
  button only when there are enough neighbours, and otherwise says how
  many are missing. *Different, in the look only: ours shows both buttons and says why gold is refused when tapped (a recorded call), `client/src/editor.ts` (`offerLand`).*
- **Buying a block** pays it, replaces the block's for-sale picture with
  owned land, drops the block from the list of land for sale (so nothing
  grows there any more, see "What grows back") and sends `expand` (block,
  "gold" or "cash", town). A congratulations window offered a Facebook
  share. *Same: `client/src/rules/land.ts`; the share isn't needed.*
- **No roads.** This version's config has no paths or roads. Its
  "terrain" category (6) holds only the seven land squares, one per
  island look. They take no tile and never block walking or building.
  *Same: `client/src/rules/editing.ts` (terrain ignored). CLIENT.md and DECISIONS.md speak of paths; there are none in this config.*

## Footprints and what blocks what

- **A footprint** runs back from the tile the save names (its front corner
  on screen): x - width + 1 to x, y - height + 1 to y, using the config's
  width and height whichever way it faces. Every item in the config is
  square, so turning never changes a footprint. *Same: `client/src/rules/editing.ts` (`footprintTiles`).*
- **Taken tiles.** Everything placed but terrain marks its tiles, units
  too (their one tile). A walking unit moves its mark with it, onto a
  tile only if that tile is free; so nothing can be built where a unit
  stands or is walking at that moment. *Same: `client/src/rules/editing.ts` (`takenTiles` uses each unit's tile as it walks).*
- **Fitting.** A building fits when its footprint is inside the map, has
  no taken tile and lies all on owned land. (A quirk checks only the first
  tile of a one-tile-wide item, harmless since those are 1 x 1.) The Blue
  Phoenix Egg skips the check. Things the game puts down itself (trees,
  rocks, animals, a free villager) skip it too and rely on its free-tile
  searches. *Same: `client/src/rules/editing.ts` (`fits`); the Phoenix Egg's exception: not checked.*
- **What blocks a path.** Buildings, trees and rocks block; fields
  (farms) don't, nor units, nor terrain; an open wall gate doesn't. A
  tree's tile opens as soon as it's cut. *Same: `client/src/rules/walking.ts` (`walkGrid`), open gates included (see "Academies, wonders and other buildings").*
- **Whose things are.** By the item's `race`: the player's own people's
  and anyone's ("a") are the player's; "n" nobody's; the other people's are
  enemies. In the wild ring, buildings are enemies except farms, chests,
  scenery, keys, trees, rocks, regrowing rocks, lost things and the
  dealers, which are nobody's. *Same: `client/src/rules/editing.ts` (`isTheirs`), `client/src/rules/camps.ts`.*

## Buying and placing

- **Placing mode.** The building follows the pointer, see-through, with
  its footprint green where it fits and red where it doesn't; but over a
  taken tile the outline disappears instead of turning red. *Different: ours shows red there too, `client/src/editor.ts` (`previewBuilding`).*
- **A tap on a taken tile ends placing mode** (outside the tutorial).
  *Different: ours stays in placing mode and says it doesn't fit, `client/src/editor.ts` (`placeBuilding`).*
- **The checks, in order:** enough to pay (if not: the "get more" window,
  and placing ends); for a unit, the room-for-people cap (175 plus the
  wonders'), then the housing, then the unit's `units_limit` (the Mummy
  and the Ent let through); then the building limits; then the fit.
  *Same for buildings: `client/src/rules/shop.ts` (`buy`, `obstacle`); our shop sells no units.*
- **How many a town may have:** one of each mill and mine level (counted
  by item, so Mill I and Mill II can stand together), one of about fifty
  special buildings, one market of any kind, one eagle building, three
  nurseries. Towers bought with gold, wood or stone: no more than 400 per
  owned block, counted before the new one, so one more than that fits.
  *Same, quirk included: `client/src/rules/shop.ts` (`atLimit`).*
- **Buying** pays the `cost` in `cost_type`, gives the `xp`, sends `buy`
  (item, x, y, facing, town, 0, 1, type) and stays in placing mode for
  another; it ends when a tap fails. The first of a kind (half the time;
  always for a unit) offered a Facebook share. *Same: `client/src/rules/shop.ts`; ours ends as soon as the next one couldn't be bought, the share isn't needed.*
- **Turning while placing.** Space flips the building between its first
  two facings only (0 and 1), whatever it has; it's bought or moved facing
  that way. With nothing being placed, Space switches on the square tool
  for picking units. *Different: ours steps through all its facings (the Oil and Water Towers have four), `client/src/editor.ts` (`turnWhilePlacing`); same: with nothing being placed, Space takes up the square tool (`takeSquareTool`).*
- **A tap or a drag.** A press that moved the map more than 25 pixels
  (scaled by the zoom) is a drag, not a tap. *Different: ours takes 8 pixels and half a second, `client/src/view/camera.ts`.*

## Moving, turning, storing and selling

- **The info panel's buttons.** For the player's own things not under
  construction (and not the Blue Phoenix Egg): Move, Turn and Store, and
  Upgrade when the item upgrades. The town hall's panel has no Store; the
  harbour, zeppelin, graveyard, altar, nests, spell academy, weather and
  time machines, warehouse and allies' panels have no Upgrade. Units have
  no buttons. Trees, rocks, regrowing rocks, treasures and keys show their
  numbers only; scenery, isles, lost things and special-collection pieces
  have no panel (scenery can't even be selected). *Same: `client/src/rules/editing.ts` (`choices`), Upgrade with `client/src/rules/upgrade.ts` (CLIENT.md, "The building card").*
- **Move** is refused while a bar runs on the building (collecting,
  training, building). The building is lifted off the grid and follows
  the pointer; a tap on a free tile where it fits sends `move` (old x, old
  y, item, x, y, facing, town, "mouseUsed"). Cancelling puts it back.
  *Same: `client/src/rules/editing.ts` (`move`); different: ours also lets a building in training move (and be stored), `client/src/editor.ts`.*
- **Lifting a building empties it.** Every unit inside comes out beside
  it (`pop_unit` each) and, as with any building emptied, its work stops
  and starts over at the next worker; a mill or mine on the working-time
  list also sends `activate` 0, whether or not a time was chosen. This happens even when the move is
  cancelled. *Different: ours keeps the units inside and the work going (DECISIONS.md, "Moving a building keeps its units inside"), `client/src/editor.ts` (`startMove`).*
- **Turning during a move** sends `move` with the old facing, then
  `orient` with the facing one step on. *Different: ours sends one `move` with the new facing (our server keeps it), `client/src/rules/editing.ts` (`move`).*
- **Turn** steps to the next facing round the item's `max_frame` and sends
  `orient` (x, y, facing, town). *Same: `client/src/rules/editing.ts` (`turn`).*
- **Store** is refused while moving or while a bar runs. Units inside come
  out first; then `store_item` (x, y, town, item) and it goes to the
  town's storage. Storing the Unit Warehouse also puts its units in
  storage and sends `reset_warehouse`. *Same: `client/src/rules/editing.ts` (`store`), `client/src/editor.ts` (`emptyOut`); different: ours lets a building in training be stored; the warehouse: missing.*
- **Selling is a tool, not a button.** The bulldozer on the bottom bar is
  a mode: hovering lights up what it could take, a tap sells it. It
  refuses units, the town hall, anything under construction, anything not
  the player's except gold and stone rocks, and rocks in the wild ring.
  (The panel's sell slot is wired as the Upgrade button.) *Same (hovering with it too, `client/src/editor.ts`, `hover`): ours has the bulldozer too (Remove, in the pointer's menu), which stays on for one thing after another and takes what the card would sell, `client/src/editor.ts` (`bulldoze`), `client/src/rules/editing.ts` (`choices`); and the card has no Sell, as here.* *Fixed since "The building card" (ours had kept a Sell on the card).*
- **What a sale gives, and when it asks.** A twentieth of the `cost`,
  rounded down, in its `cost_type`; things bought with cash give nothing.
  Free things go at once; wonders and units bought with resources go at
  once; other things ask first; cash things ask, showing 0. `sell` (x, y,
  item, town, 0, "BLDZE"). *Same refund and command: `client/src/rules/editing.ts` (`refund`, `sell`); different: the card's Sell always asks (`client/src/ui/actions.ts`), and our bulldozer lets only free things go at once, so it asks for wonders (`client/src/editor.ts`, `bulldoze`).*
- **Selling or storing a building lets its units out first** (`pop_unit`
  each). *Same: `client/src/editor.ts` (`emptyOut`).*

## Construction (the scaffold)

- **Ten seconds of scaffolding.** A building just bought, placed from
  storage or upgraded stands in scaffolding for 10 seconds with a
  percentage bar and building sounds. So does a unit bought from the shop
  (anything placed by buying is marked; from storage, only buildings),
  in the 1x1 scaffold. The scaffold's picture: the ranch
  one for ranches (not the nursery), the field one for farms, the trolls'
  by width in a troll town, else by width 1, 2, 3 or 4. It isn't saved: a
  reload shows the building finished. *Same: `client/src/rules/construction.ts`, `client/src/view/construction.ts` (CLIENT.md, "Construction"), upgrading's too; the trolls': missing with that part.*
  *Fixed since "Construction: scaffolding for 10 seconds".*
- **Meanwhile** the building has no buttons, takes no units, can't be
  bulldozed, isn't lit when hovered, and a tower doesn't shoot. Its
  production clock runs anyway. *Same (`client/src/rules/hover.ts`, `lights`); a unit in scaffolding can't be sent (nothing in the original's code stops one walking off in it), `client/src/editor.ts`.*
- **Switched off:** a longer build time with a 10-cash speed-up exists for
  items with a `build_time`, but no item in the config has one; and a
  tutorial shortening of the bar has no effect (it's applied after the
  time is kept). *Same: nothing to do. (`docs/original/index/core.md` says the tutorial's bar is a third as long: it isn't.)*

## Upgrading

- **Upgrade** shows on the panel when the item has `upgrades_to`. It needs
  the next item's `min_level` (else a message). It costs the next item's
  full `cost`, gives back a twentieth of the current one's (nothing if it
  cost cash) and gives the next item's `xp`. Then `sell` (x, y, item, town,
  0, "UPGR") and `buy` of the next on the same tile (facing 1, not free).
  Its units come out, and the new building gets the scaffold. A separate
  `upgrade` command exists but nothing sends it. *Same: `client/src/rules/upgrade.ts` (with tests), `TownEditor.upgrade` (CLIENT.md, "The building card"); different: on a touch screen the first tap shows the bubble with the price, the second upgrades; the new building faces as one from the shop (our shop's facing).*
  *Fixed since "The building card".*

## Production

- **Three kinds.** A building with room for units (`unit_capacity` above
  0) works only while units are inside; one with none but a working time
  (`activation`) works on its own, round after round. *Same: `client/src/rules/production.ts` (`productionOf`).*
- **The clock.** Every building has a tick each second, even while the
  game is paused. Its count starts from the time the save keeps
  (`item[4]`); it's ready when the count reaches its `activation`; a
  building at activation 0 doesn't count. *Same: `client/src/rules/production.ts` (`workState`, worked out from the clock).*
- **An emptied building stops and loses its progress;** the next unit in
  starts it from nothing. More units joining don't restart it. *Same: `client/src/rules/work.ts` (`goInside`, `letOut`).*
- **Working times.** Human mills and gold, stone and lumber mines (the
  config's `COLLECT_VARIABLE_IDS`) with workers inside sleep ("zz") until
  the player picks: four cards, 5 minutes, 1, 4 or 8 hours, for half,
  once, twice or three times the harvest; `activate` (x, y, town, item,
  1 to 4). After each collect `activate` with 0, and they sleep again.
  The cards show the base harvest times the share, without the extra
  workers. *Same: `client/src/rules/production.ts`; different: our choices include the extra workers in their numbers, `client/src/editor.ts` (`askWorkTime`).*
- **Ready** shows a bubble in the colour of what it gives, with a sound.
  Buildings never collect themselves (only trees, rocks and the Sacrifice
  Altar finish on their own). *Same: `client/src/editor.ts` (`refresh`).*
- **Collecting.** Tapping a ready building runs a short bar (about two
  thirds of a second), then collects. The glove is a mode in which
  hovering collects each ready building, without the bar. *Same: the bar, `client/src/editor.ts` (`startCollecting`); the glove (Fast collect, in the pointer's menu) collects each ready building it's swept over, `client/src/editor.ts` (`sweep`); ours keeps Collect all beside it, which collects everything ready at once (a recorded call, `collectAll`).*
- **The harvest** is the config's `collect`, rounded down, times the gold
  multiplier (1 for buildings). With more than one worker: the harvest
  plus a fifth of it for each worker after the first, rounded down, then
  times the working time's share, rounded down. *Same: `client/src/rules/production.ts` (`harvest`).*
- **The worker count is kept from the first harvest of the session** (a
  quirk): it's taken at the building's first collect after the game loads
  and never updated until a reload, both for the harvest and for the
  count sent to the server. *Different: ours counts the workers inside now (DECISIONS.md, "the rules the original plays by"), `client/src/rules/production.ts`.*
- **Farms use wood:** a third of the base harvest, rounded. Without
  enough, the farm is destroyed: its villager comes out, it's removed and
  `kill` (x, y, item, town, type) is sent; the first time in a session a
  window says why, after that a floating note. *Different: ours keeps the farm and says it needs wood (a recorded call), `client/src/rules/production.ts` (`collect`).*
- **What collecting gives and sends:** the harvest in `collect_type` and
  the `collect_xp`; `collect_new` (x, y, town, item, workers, multiplier,
  cash paid); the round starts again. *Same: `client/src/rules/production.ts`.*
- **Ranches use up an animal.** Each collect takes the first animal out
  for good (`pop_unit` with no tile, after `collect_new`) and shows it
  flying off for 3 seconds; an empty ranch stops. Not the nursery.
  *Same: `client/src/rules/production.ts`; the flying animal is a rising "−1" line here (a recorded call).*
- **Hurry.** The panel's hurry button shows on mills, mines (the Treasure
  Mine too), the food shops (bakery, restaurant, temple) and wonders that
  house nobody, whenever their earnings show: working, ready or asleep.
  2 cash collects at once, the cash in `collect_new`'s last place.
  Hurrying a sleeping mill reads a working time that isn't there (a bug
  that spoils the harvest). The window also had "ask friends". *Different: ours offers it only while working, `client/src/rules/production.ts` (`canHurry`); "ask friends" sits beside it on the card.*
- **Friends' help.** Neighbours who helped a building (the save's `hc`)
  show as pictures stacked over it; tapping takes one off and an hour
  (`COLLECT_HELP_SECONDS`) off the work: `accept_collect_help` (x, y,
  town, item, friend). *Missing (PARITY.md, "Neighbours").*
- **The next-harvest clock** on the bottom bar counts down to whatever
  finishes soonest (a tree being cut or a rock growing back included), or
  says something is ready; hidden away from home and in the tutorial.
  *Missing.*
- **Buildings that produce their own way.** The Nursery: with two animals
  of one kind inside its clock runs; collected, a copy of the first comes
  out beside it (`buy`, facing 1, not marked free). The Sacrifice Altar:
  every two ticks or so it takes the unit inside by itself (`pop_sell`)
  and drops a twentieth of its price in gold if it was bought with gold. The Treasure Mine: a collection piece a day. The
  Cash Wonder: 1 cash a day, on its own. *Missing: nursery, altar and treasure mine; same: the Cash Wonder, `client/src/rules/production.ts`.*

## Houses and room for people

- **Room.** The `population` of the player's buildings that give room or
  hold units (a burnt one gives none, but the town hall always does),
  capped at 175; then the wonders' population again on top, so under the
  cap a wonder counts twice; the Great Church counts its own 10 in the sum
  and, instead of a second count, `increasedPopulation` times
  `POPULATION_INCREASE` (10). *Same: `client/src/rules/training.ts` (`population`).*
- **People.** The `population` of the player's units on the map, plus
  units inside buildings that give room or hold units. Wild animals and
  enemies don't count. *Same: `client/src/rules/training.ts`.*
- **A unit in training takes no room until it's out,** so two buildings
  training at once can go one over. *Same (DECISIONS.md, training).*
- **The Library does nothing** in this client but count against its
  one-per-town limit. *Same: no effect.*

## Training units

- **Who trains.** The config's `trains`: the town hall villagers, castles,
  barracks, archery ranges, stables, workshops and churches; one at a
  time, a 3-second bar. *Same: `client/src/rules/training.ts`, `client/src/editor.ts` (`train`).*
- **The price.** The unit's `cost`; a blacksmith takes a tenth off
  footmen, riders and archers, a university off siege engines, rounded up;
  food twice that, rounded up, and none for villagers. With cash:
  `cost_unit_cash` only. *Same: `client/src/rules/training.ts` (`trainingPrice`).*
- **What stops it, in order:** (with cash, the cash first) room for the
  unit (the message says whether the town is at its cap or needs houses),
  its `units_limit` counting those inside buildings, the price, the food,
  a training already running. *Same: `client/src/rules/training.ts` (`cantTrain`); ours checks cash after room.*
- **Paid at the start,** with the unit's `xp`; after 3 seconds it stands
  beside the building: `buy` (item, x, y, facing, town, 0, 0.9 or 1, "u")
  or `buy_cash` (item, x, y, facing, town). Sold or stored meanwhile, the
  unit is lost. *Same: `client/src/rules/training.ts` (`trained`), `client/src/editor.ts`.*
- **Where units come out** (trained, let out, a nursery's copy): ring by
  ring round the building's named tile, the first ring with a free tile,
  and on it the tile nearest the far corner; anywhere on the map (a
  nursery's copy looks only 4 rings out, and with none it lands on the
  nursery's own tile). *Different: ours takes the tile nearest the building's corner, on owned land only, `client/src/rules/work.ts` (`freeTileNear`). CLIENT.md says "nearest", which isn't quite the original's choice.*
- **Training a villager centres the map on the building.** *Missing.*

## Villagers

- **The town hall's number:** Town Hall I to IV are 1 to 4, Troll Hall I
  to III 1 to 3, anything else (or none) 0. By it, villagers walk at 3, 5,
  5, 6, 6 and line up 3, 5, 7, 9, 10 trees or rocks; the Academy (Troll
  Coliseum) adds 2 to both; in the tutorial the line is 10. Their name
  carries the hall's numeral. *Same: `client/src/rules/villagers.ts`.*
- **What they work:** trees for wood, stone rocks and gold rocks. A tap on
  one with villagers selected puts it at the end of each one's line if
  there's room (one already in line moves to the end), glowing pale
  yellow; a villager sets off for it if it's first in line or idle. If no
  villager took it, it's selected instead. *Same: `client/src/rules/villagers.ts` (`lineUp`), `client/src/editor.ts`.*
- **A tap on a ready building comes first:** with a villager selected, a
  ready building is collected (and a sleeping mill asks its time) before
  the villager is sent in. *Different: ours sends the villager in when there's room, `client/src/editor.ts` (`tap`).*
- **Where a villager stands** to work or go in: the first of up to four
  rings round the target's tile with a free tile, or a field tile, the
  one nearest the villager; already within one tile, it stays. The path
  isn't checked first. *Different, slightly: ours leaves out field tiles and tiles other units are walking to (a recorded call), and picks one it can reach, `client/src/rules/work.ts` (`standingTile`).*
- **The work.** The tree's or rock's clock starts with the first
  villager there (a tree's `activation` 3.24 needs 4 ticks, a rock's 6.48
  needs 7); more villagers don't speed it; if all leave, the work is
  lost. The Forestry Academy (trees) or Minery Academy (rocks) adds 100 a
  tick, so one tick does it. *Same: `client/src/rules/work.ts` (`harvestSeconds`).*
- **Done:** its `collect` (20 wood, 10 stone, 10 gold), gold times the
  level's multiplier (1 up to level 10, 2 to 15, 3 to 20, 4 to 25, then
  5), 1 experience and now and then a collection piece (never in a troll
  town); `collect_new` (x,
  y, town, item, villagers, multiplier, 0) and `sell` (x, y, item, town,
  0, "HARV"). A stone or gold rock leaves a regrowing one (`buy` of 81 or
  80, facing 1); a tree goes. *Same: `client/src/rules/work.ts` (`harvested`); the collection piece: `client/src/rules/collections.ts`, given at once.*
- **Next:** the next in its line that's still there and nobody's at; with
  none, the group of the same kind touching the last one (and touching
  those), ordered by tiles across plus tiles down, the first taken even if
  another villager is at it. *Different, slightly: ours orders by the larger of the two, skips busy ones and passes over one it can't reach, `client/src/rules/work.ts` (`nextResources`), `client/src/editor.ts` (`goOn`).*
- **Forgetting the line:** a villager sent to the ground forgets it. *Same: `client/src/editor.ts` (`clearLine`).*
- **Repair:** a villager sent to the player's building below full life
  puts 25 back every 61 frames (about 2 seconds). *Same: `client/src/editor.ts` (`repair`).*
- **Villagers flee** five tiles towards the middle of the map when hit.
  *Not checked (the battle books).*

## Units walking

- **Who answers:** the player's units (their people's, anyone's, caught
  animals). *Same: `client/src/rules/walking.ts` (`canWalk`).*
- **Where they can go:** any tile of the 100 x 100 map not under a
  building, the wild ring and unbought land included. *Different: ours keeps the player's units on owned land (a recorded call, DECISIONS.md, wild animals); CLIENT.md ("Units walking") gives it as the original's rule, which it isn't. Only a unit already standing off it (left by a fight at a camp, say) may cross land not bought to get back, and it can still only be sent onto owned land (recorded, DECISIONS.md, 15 October 2026). `client/src/rules/walking.ts` (`gridFor`, `unitPath`).*
- **Paths.** Eight directions, never squeezing between two corners; a
  tile cut off from the start is refused at once. A slip in the
  original's sums means the way so far isn't added up, so paths can
  wander. A search has 50 milliseconds; one that runs out bans automatic
  moves of that unit for 1 to 3 seconds. *Different: ours finds the shortest path (DECISIONS.md, units walking), `client/src/rules/walking.ts` (`findPath`).*
- **A destination under a building** gives no path and the unit stays.
  *Same: `client/src/editor.ts` (`walkTo`; ours says so).*
- **Sending units to the ground:** each selected unit gets its own free
  tile, from a square growing from the tapped tile towards higher x and
  y; the tapped tile is used only if free. Idle units recheck their tile
  every 61 frames, and one sharing it with something else (not a field)
  steps to a free tile within 5. *Same for several units: each gets its own free tile from a square grown from the tapped tile, `client/src/editor.ts` (`sendTo`), `client/src/rules/group.ts` (`squareTiles`). Different: ours hands out only tiles they can walk to (a recorded call); one unit alone still goes to the tapped tile even if another unit stands there; and units don't step off a shared tile.*
- **Speed:** `velocity` pixels a frame, along the longer of the screen's
  two directions, the other in proportion; a villager at 3 takes about 0.6
  seconds a tile. *Same: `client/src/rules/walking.ts` (`stepTowards`).*
- **A tile that became a building** since the unit set off stops it
  there (flying units fly on). *Different, slightly: ours stops it there too, then sets off once more from there, where the original works from there if it's close enough (a recorded call), `client/src/editor.ts` (`walkTo`, `work`, `goInto`, `repair`).*
- **Facing and looking about:** a walking unit faces its next tile; a
  standing one has a 4% chance every 61 frames to turn to a tile beside
  it. *Same: `client/src/rules/walking.ts`.*
- **What the server hears:** every 6 seconds, for each unit whose stopping
  tile changed, `move` (last tile sent, item, new tile, facing, town,
  "Unitat"). *Different: ours sends it as the unit stops (DECISIONS.md, units walking), `client/src/rules/walking.ts` (`unitMoved`).*
- **Picking several:** the square tool (up to 20 of the player's units)
  and a double tap within a second on a unit (up to 20 within 10 tiles of
  the same sort: melee, ranged, siege, healers, workers and so on). *Same: `client/src/editor.ts` (`takeSquareTool`, `dragBox`, `selectGroup`), `client/src/rules/group.ts` (`sameKindNear`); the card shows their portraits with life bars (`client/src/ui/actions.ts`, `showGroup`). Escape puts the square tool down here (a recorded call).*

## Units going into buildings

- **Who goes where:** only into the player's own building, by units not
  summoned or converted, while there's room: any unit into a refuge or
  the Unit Warehouse; villagers into mills, mines and farms; cows, sheep
  and boars into their ranches, horses into the Training Stables; into
  the Nursery an animal of the kind already there (any, if empty); into
  the Sacrifice Altar anything but siege engines; into the Fortress units
  with a range over 1 but not siege engines; dragons and riders into the
  Dragon Taming. *Same for refuges, mills, mines, farms and ranches: `client/src/rules/work.ts` (`canGoInside`), `client/src/rules/animals.ts`; different: our nursery takes any kind; missing: the warehouse, altar (a recorded call), fortress and taming.*
- **Going in:** the unit walks beside it and goes in: `push_unit` (tile
  last sent, item, building's tile, town), sent at once for a refuge.
  *Same: `client/src/rules/work.ts` (`goInside`).*
- **The Training Stables turn soldiers into riders:** a footman or archer
  (I to IV) sent into a Training Stables with a horse inside uses up the
  horse (`pop_unit`, no tile), is removed (`sell`, free, "STABL") and a
  rider of its level appears in its place (`buy`, free). *Missing.*
- **Letting one out:** the panel shows up to six units inside; tapping one
  lets it out (`pop_unit`: building, town, item, tile, facing). *Different: ours lets out the last one in (a recorded call), `client/src/rules/work.ts` (`letOut`).*
- **On loading,** the units the save lists are put back inside; a
  building that holds units with none listed is stopped. *Same: `client/src/rules/town.ts`.*
- **A refuge** is a place to keep units; they still count as people.
  (In an attack on the town it counts as nobody's.) *Same (people); the attack part: not checked.*

## Wild animals

- **Whose:** an animal on the player's land when the town opens is
  theirs; others are wild. It isn't saved. *Same: `client/src/rules/animals.ts` (`markWild`).*
- **Wild animals don't wander;** they stand and look about. *Same.*
- **Catching:** every 61 frames each wild animal looks for the player's
  nearest unit not inside a building within 4 tiles (straight line), not
  on its own tile. If there is one, the animal is theirs (no command), a
  "captured" mark shows 5 seconds, the goals count it, and it walks into
  the nearest ranch of its kind, full or not (sheep, cow and boar ranches,
  the Training Stables for horses); with none, to a free tile by the town
  hall (not in the tutorial). *Same: `client/src/rules/animals.ts` (`caught`, `homeFor`), `client/src/editor.ts` (checked every second).*
- **A unit sent to a wild animal** walks beside it, and so catches it.
  *Same: `client/src/editor.ts`.*

## What grows back

- **On each opening at home,** in this order: units put back inside,
  animals on owned land made the player's, three lost things and a
  villager if none, villager speeds, the camp of the moment (which may
  clear the wild ring first), regrowing rocks that are due, gold and
  stone clumps, trees, animals, then the raids. *Different: ours grows trees, rocks and animals before the camp clears the wild ring (`client/src/main.ts`, `client/src/homeCamps.ts`), so on a day the camp changes the new growth in the ring is sold again at once.*
- **Where things grow:** blocks of the wild ring, and middle blocks not
  yet bought; never aimed at the player's land (a clump started near a
  block's edge can spill over onto it). *Different: ours grows them on the player's land instead of the unbought blocks, `client/src/rules/nature.ts` (`wildAndOwnBlocks`). CLIENT.md ("The living map") says the same, wrongly.*
- **Counting:** gold rocks (the first three kinds and regrowing gold),
  stone rocks (the same), trees (the three kinds); the fourth kind of
  gold and stone isn't counted. Counted once, before anything is added.
  *Same: `client/src/rules/nature.ts`.*
- **Clumps:** 3 of gold, 3 of stone, 10 of trees wanted, one fewer for
  each clump's worth already there (6 rocks, 18 trees). A clump's size is
  picked once per kind: 5 or 6 rocks (never 7), 16 to 19 trees (never
  20). A block is picked by rounding a random number, so the first and
  last in the list come up half as often; the tile in it likewise. Each
  piece takes the nearest free tile, ring by ring, the one nearest the far
  corner. *Same: `client/src/rules/nature.ts`.*
- **Single trees** until there are 100 (counted before the clumps): each
  at a random tile, or a random free tile on the first ring out with one,
  up to 5 out. With none, the original drops it on tile (0, 0) whatever is
  there (a bug; animals and lost things are placed the same way, so the
  same goes for them). *Same, without the bug: `client/src/rules/nature.ts` (`freeNear`).*
- **Each is bought for nothing:** `buy` (item, x, y, 0, town, 1, 1, type).
  *Same: `client/src/rules/nature.ts`.*
- **Animals:** 7 sheep, 7 cows and, from level 11, 6 horses in a human
  town, 7 boars in a troll town, less those on the map (not those inside
  ranches), no more than `ANIMALS_PER_DAY` (20) of a kind a day by the
  save's `arrayAnimals`; placed like single trees; `admin_add_animal`
  (kind, how many). *Same, but where (above): `client/src/rules/animals.ts`, `client/src/rules/nature.ts`.*
- **Regrowing rocks** whose time (10,800 seconds) is up are sold
  ("REGEN") and one of the four kinds of rock bought in their place,
  facing 1, free. This happens as the town opens and also during play, at
  the tick. *Same: `client/src/rules/work.ts` (`regrow`), `client/src/editor.ts` (`refresh`). (`docs/original/index/core.md` says "on open only": wrong.)*
- **Lost things:** three each opening (an injured cow or sheep, a knight,
  an artefact, a crate, a barrel, a troll, an object), anywhere on the 25
  blocks, not saved; tapping one opens a window. *Missing.*

## Tidying a town as it opens

- **Order:** buildings first, the town hall before all, then units.
  *Same: `client/src/rules/cleanup.ts`.*
- **Buildings:** one of the player's people's that overlaps another or
  stands off the map goes to storage (`store_item_frombug`: x, y, town,
  item); anyone else's off the map is removed for nothing (`sell`, free,
  "OUTOB"); anyone else's overlapping stays. Anyone's ("a") counts as
  someone else's here. *Same: `client/src/rules/cleanup.ts`.*
- **Units:** one on a taken tile (but a field or a gate) moves to the
  nearest free tile, toward the far corner: `move` (…, 0, town, "Colisio
  #n"), n counting every unit that collided. *Different, slightly: ours moves a unit off a gate too, and one on the player's land only to a free tile on it (a recorded call); ours counts only those moved, `client/src/rules/cleanup.ts`.*
- **A free villager:** with no villager on the map or inside a farm,
  mill, mine, tree or rock, the town gets a man or woman of its people for
  nothing, on a random free tile up to 5 out from (54, 54) (with none, on
  tile (0, 0)); not during the tutorial. *Different, slightly: ours also counts villagers inside a refuge or any other building, so a town whose villagers all shelter in a refuge gets none; ours waits for the lessons to be taken or skipped (a recorded call), `client/src/rules/cleanup.ts` (`oneVillager`).*

## Academies, wonders and other buildings with their own effects

- **The Blacksmith and the University** take a tenth off soldiers and
  siege engines, from the moment they're put down. *Same: `client/src/rules/training.ts`.*
- **The Academy (the Troll Coliseum)** gives villagers 2 more speed and 2
  more in line. *Same: `client/src/rules/villagers.ts`.*
- **The Forestry and Minery Academies** make trees and rocks a one-tick
  job. *Same: `client/src/rules/work.ts`.*
- **The Leadership Statue** gives one more attack on players a day; the
  **Healing Spring** heals the nearest of the player's units within reach
  each beat. *Not checked (the battle books).*
- **Wonders:** their room counts twice under the cap; some produce on
  their own; those that house nobody can be hurried; bought with cash,
  they sell for nothing. *Same: `client/src/rules/training.ts`, `client/src/rules/production.ts`.*
- **The harbour and the zeppelin tower:** in a human town, at each
  opening, one not on the map, not in storage and not in the gift box is
  put down for free near (59, 59) on owned land, the harbour unless the
  Prisoner Princess waits, the zeppelin from level 30; one still waiting
  for its staff (new or not) gets a message, 20 free helpers and is
  opened (`buy_si_help` x 20, `finish_si`). *Different, slightly: ours checks only the town's storage, and staffs only a new one, `client/src/rules/dock.ts`.*
- **Social buildings** (the Summit, allies' markets, recruitment camps,
  the Great Church and others with a crew list): until staffed they show
  their second picture and tapping opens the staff window; at each
  opening one with a worker cost, no helper and a crew of 3 or more gets one free
  helper, one with exactly one and a crew of 7 or more a second
  (`buy_si_help`, x, y, town, item, 1). *Missing (the classic game; ROADMAP).*
- **The wall gate** opens and closes from its panel, so units can pass;
  not saved. *Same: Open door and Close door on the card, the open picture while it's open, `client/src/editor.ts` (`gateButton`, `openGate`), `client/src/rules/walking.ts`, `client/src/view/townView.ts`.*
- **The Unit Warehouse** takes units off the map up to its capacity
  (`add_unit_warehouse`) and has its own window. *Missing.*
- **Buildings with their own window** (the spell academy, weather and
  time machines, graveyards, the altar of heroes, nests, markets): opened
  from the panel. *Machines built in `ui/machines.ts`; their complete rules are in [machines.md](machines.md). Other windows: see their own books.*

## The town hall

- **Room for 5,** counted even when burnt. *Same: `client/src/rules/training.ts`.*
- **Trains villagers** and sets their speed, line and name. *Same: `client/src/rules/villagers.ts`.*
- **Can't be sold or stored:** the bulldozer refuses it, its panel has no
  Store, storage has no Sell for it. It can be moved, turned and upgraded
  (Town Hall II to IV). *Same: `client/src/rules/editing.ts`, `client/src/rules/storage.ts`, `client/src/rules/upgrade.ts`.*
- **No town hall at the start** opens a window saying so. *Missing.*
- **Things head for it:** caught animals with no ranch, and the
  player's units moved off the wild ring for a new camp. *Same: `client/src/editor.ts`, `client/src/homeCamps.ts`.*
- **Town Hall I doesn't shoot;** II and up do, in a raid. *Not checked (the battle books).*

## Storage and the gift box

- **Two boxes, one window:** gifts and prizes (`privateState.gifts`,
  shared by the player's towns) and what the town put away (`map.store`).
  *Same: `client/src/rules/storage.ts`.*
- **One card per item,** gifts and stored copies together, by name; the
  card uses the first copy. Gifts go into the list before stored copies,
  but the list is then sorted by name and Flash's sort doesn't promise to
  keep that order, so whether a gift (and its experience) is used first
  isn't certain. The Bahamut Heart and special-collection pieces have no
  buttons; the town hall has Use only. *Different: ours has separate cards for gifts and stored copies, `client/src/rules/storage.ts` (`storedItems`).*
- **Use:** refused for another people's item (only the town's own,
  nobody's or anyone's); then placed like building, one at a time; a unit
  must fit the room-for-people cap, the housing and its `units_limit`
  (the Mummy and the Ent let through); the building limits and the fit
  apply. *Different: ours doesn't check a unit's `units_limit`, so one too many can be placed, `client/src/rules/storage.ts` (`storageChoices`).*
- **Placing sends** `place_gift` (a gift, which gives its `xp`; the
  Level-Up Statue gives exactly what's missing for the next level) or
  `place_stored_item` (no experience): item, x, y, facing, town. A
  building placed gets the scaffold. *Same: `client/src/rules/storage.ts` (`placeStored`), the scaffold `client/src/editor.ts` (`startConstruction`).*
- **Sell from storage:** a twentieth of the price (nothing for the Dock
  and the Zeppelin Tower), at once without asking; cash things ask, for
  0. `sell_gift` or `sell_stored_item` (item, town). *Same refund and commands: `client/src/rules/storage.ts` (`sellStored`); different: ours always asks.*
- **The gift button's number** counts everything in storage, gifts and
  stored copies. *Different: ours counts the gifts only, `client/src/main.ts` (`waiting`).*
- **"Place all"** in the original handles only units from the phone app's
  box. *Not needed. (`docs/original/index/core.md` says it puts stored units round the town hall: it doesn't.)*

## The troll town

- **A second town:** from level 20, for 100,000 gold or 22 cash, the
  player founds a town of their chosen people; `buy_map` (1, 0 for gold or
  1 for cash, people, town); travelling loads the other town. *Missing (PARITY.md, "Your calls").*
- **What changes in a troll town:** the shop sells items with `in_store` 2
  or 4; troll halls go to III, so villagers top out at 6 speed and a line
  of 9; the Troll Coliseum is the Academy; troll scaffolds; boars instead
  of sheep, cows and horses; goals off and the spell book on from the
  start; neighbours' helps aren't shown; troll music. *Same where built: `client/src/rules/shop.ts`, `villagers.ts`, `animals.ts`, `client/src/sound.ts`; scaffolds missing.*
- **Its border and raids** bring human soldiers instead of trolls, more of
  them (twice as many bandits by level). *Not checked (the battle books).*

## Differences

Every rule above where the new client differs or lacks something, most
serious first. "Recorded" means DECISIONS.md already has it as a call.

**The second reading.** Each item below was read again on both sides,
starting from the places named in it: the original's code and ours (and
`command.py` for the `move` command). All 47 held up, so each is marked
"(checked twice)"; a few gained a detail on the way, noted in the item and
its rule. Items 48 and 49 came with later changes to our client and were
not read twice. How deep: the code behind each claim was read through; the
missing features (28 to 44) were checked only far enough to see that the
original has them and our client doesn't, not in every detail. One quirk
was seen but not followed up: when a villager's line runs out after a
tree, the original sets that tree kind's `elevation` to 0, and tiles with
elevation 0 count as places to stand (item 23); whether that touches every
tree of the kind wasn't checked.

**Changes the save**

1. **Trees, rocks and animals grow on the player's land.** The original
   grows them in the wild ring and on middle blocks not yet bought. Ours
   uses the player's own blocks instead (`client/src/rules/nature.ts`).
   CLIENT.md repeats the mistake. (checked twice)
   *Fixed since "Units walk the whole map, trees grow in the wild".*
2. **Moving a building keeps its units inside.** The original lets them
   all out (`pop_unit` each), stops its work and, for a mill or mine on the
   working-time list, sends `activate` 0, even when the move is cancelled
   (`client/src/editor.ts`; recorded). (checked twice)
   *Fixed since "Town rules from the map of the original".*
3. **A stored unit ignores its `units_limit`.** The original refuses it
   (the Mummy and the Ent aside) (`client/src/rules/storage.ts`). (checked twice)
   *Fixed since "Town rules from the map of the original".*
4. **A farm without wood is kept.** The original destroys it with `kill`
   (`client/src/rules/production.ts`; recorded). (checked twice)
5. **The worker count is live.** The original keeps the count from the
   first harvest of the session, and sends it (`client/src/rules/production.ts`;
   recorded). (checked twice)
6. **What grows is cleared by the camp.** Ours grows before the camp clears
   the wild ring, the original after (`client/src/main.ts`, `client/src/homeCamps.ts`).
   (checked twice)
   *Fixed since "Units walk the whole map, trees grow in the wild".*
7. **Where units come out.** The original picks the free tile toward the
   far corner, anywhere (a nursery's copy only 4 rings out); ours the
   nearest, on owned land only (`client/src/rules/work.ts`). (checked twice)
   *Fixed since "Town rules from the map of the original".*
8. **A free villager when all shelter in a refuge.** The original counts
   only villagers on the map and in farms, mills, mines, trees and rocks
   (`client/src/rules/cleanup.ts`). (checked twice)
   *Fixed since "Town rules from the map of the original".*
9. **The nursery takes any animal.** The original wants the kind already
   inside (`client/src/rules/animals.ts`). (checked twice)
   *Fixed since "Town rules from the map of the original".*
10. **The harbour and zeppelin.** The original also looks in the gift box
    and staffs one still waiting; ours only the town's storage and a new
    one (`client/src/rules/dock.ts`). (checked twice)
    *Partly fixed since "Town rules from the map of the original": the gift
    box too; none waits for a crew on our server (DECISIONS.md).*

**Looks or feels different**

11. **Units stay on owned land.** In the original they can walk the whole
    map but under buildings (`client/src/rules/walking.ts`; recorded, but
    CLIENT.md gives it as the original's rule). (checked twice)
    *Since "Unstick units, and open and shut wall gates":* a unit
    already off the land may cross land not bought to get back; the rest
    holds.
    *Fixed since "Units walk the whole map, trees grow in the wild".*
12. **Selling from a card.** The original sells only with the bulldozer
    tool, and doesn't ask for free things, for wonders and units bought
    with resources, or (in storage) for anything but cash things; ours
    always asks (`client/src/rules/editing.ts`, `client/src/ui/actions.ts`,
    `client/src/rules/storage.ts`). (checked twice)
    *Partly fixed since "The pointer's tools: Remove and Fast collect, as
    in the Flash client":* ours has the bulldozer too, which doesn't ask
    for free things. Still
    different: the card's Sell stays and always asks, the bulldozer asks
    for wonders, and storage always asks.
13. **Placing over a taken tile.** The original hides the outline there
    and ends placing on a tap; ours shows red and stays (`client/src/editor.ts`).
    (checked twice)
14. **Space while placing** flips only the first two facings in the
    original; ours steps through all, and Space starts no square tool
    (`client/src/editor.ts`). (checked twice)
    *Partly fixed since "Select several units, as in the Flash
    client":* Space takes up the square tool; the facings still differ.
15. **A ready building tapped with a villager selected** is collected in
    the original; ours sends the villager in if there's room
    (`client/src/editor.ts`). (checked twice)
16. **Storage cards.** The original merges gifts and stored copies and its
    button counts both; ours keeps them apart and counts gifts
    (`client/src/rules/storage.ts`, `client/src/main.ts`). (checked twice;
    whether the original uses the gift first is unsure, see the rule)
17. **Hurry** shows in the original whenever earnings show (and misfires
    on a sleeping mill); ours only while working (`client/src/rules/production.ts`).
    (checked twice)
18. **Working-time cards** in the original leave out the extra workers;
    ours include them (`client/src/editor.ts`). (checked twice)
19. **Letting out** any of six portraits in the original; ours the last in
    (`client/src/rules/work.ts`; recorded). (checked twice)
20. **Paths** are the shortest here; the original's can wander
    (`client/src/rules/walking.ts`; recorded). (checked twice)
21. **Group moves and shared tiles.** The original spreads units over free
    tiles and steps units off shared tiles; ours sends one unit, onto any
    tile (`client/src/editor.ts`). (checked twice)
    *Partly fixed since "Select several units, as in the Flash
    client":* several units spread over free tiles (only tiles they can
    walk to, recorded).
    Still different: one unit alone goes onto any tile, and nobody steps
    off a shared tile.
22. **The next tree** is picked by tiles across plus down in the original,
    busy ones included; ours by the larger of the two, skipping busy ones
    (`client/src/rules/work.ts`). (checked twice) Ours also passes over
    one it can't reach.
23. **Where a villager stands** may be a field in the original; ours skips
    fields and checks the path (`client/src/rules/work.ts`). (checked twice)
    Ours also skips tiles other units are walking to (recorded).
24. **The glove** is a hover mode in the original, one press here
    (`client/src/editor.ts`; recorded). (checked twice) *Fixed since:*
    "The pointer's tools: Remove and Fast collect, as in the Flash
    client". Collect all stays beside the glove (recorded).
25. **The land window** shows the gold button only with enough neighbours
    in the original (`client/src/editor.ts`; recorded). (checked twice)
26. **Tap or drag:** 25 pixels in the original, 8 pixels and half a second
    here (`client/src/view/camera.ts`). (checked twice)
27. **A building in training** can be moved or stored here; the original
    waits for its bar (`client/src/editor.ts`). (checked twice)

**Missing**

28. Upgrading (and with it Town Hall II to IV). (checked twice)
    *Fixed since "The building card".*
29. The 10-second scaffold, and the building being out of use meanwhile.
    (checked twice)
    *Fixed since "Construction: scaffolding for 10 seconds".*
30. The Training Stables turning footmen and archers into riders. (checked twice)
31. The troll town: founding it and travelling there. (checked twice)
32. The short collecting bar. (checked twice)
    *Fixed since "Hovering and the collecting bar".*
33. Friends' help on buildings (an hour off each). (checked twice)
34. The Nursery's copies, the Sacrifice Altar, the Treasure Mine. (checked twice)
35. The Unit Warehouse, and storing it. (checked twice)
36. Social buildings' staff and their free helpers on opening. (checked twice)
37. Lost things on each opening. (checked twice)
38. Picking several units (square tool, double tap) and group moves.
    (checked twice) *Fixed since:* "Select several units, as in the
    Flash client".
39. The next-harvest clock on the bar. (checked twice)
40. Collection pieces from trees and rocks. (checked twice) *Fixed since "Collection pieces".*
41. The no-town-hall window. (checked twice)
42. The wall gate opening. (checked twice) *Fixed since:* "Unstick
    units, and open and shut wall gates".
43. The map centring on a villager's training. (checked twice)
44. The flying animal from a ranch (a rising line instead; recorded).
    (checked twice)

**Other**

45. **Turning during a move** sends one `move` with the new facing here;
    the original sends `move` with the old facing then `orient`. Our
    server keeps the facing, so the save ends the same. (checked twice)
46. **A unit's stop** reaches the server as it stops, not on the 6-second
    timer (recorded): the same command, sooner. (checked twice)
47. **The original's tile (0, 0) bug** (a single tree, an animal, a lost
    thing or a free villager with no free tile near is dropped there)
    isn't copied. (checked twice)
48. **The tidy-up and gates.** Since "Unstick units, and open and shut
    wall gates", ours moves a unit standing on a gate off it, and keeps a unit on the
    player's land when it moves it; the original leaves a unit on a gate
    and looks anywhere (`client/src/rules/cleanup.ts`; recorded). (new
    since the second reading)
49. **A unit stopped short** by something built in its way sets off once
    more here; the original works from there if it's close enough
    (`client/src/editor.ts`; recorded, same commit). (new since the second
    reading)

### Where CLIENT.md and our index are wrong

- CLIENT.md, "Units walking": "Closed land, the wild ring and the sea
  can't be reached" is our call, not the original's rule.
- CLIENT.md, "The living map": things grow in the wild ring and on land
  not yet bought, not on the player's land.
- CLIENT.md, step 3: treasures, scenery and boss statues can't be sold at
  all (they're nobody's; the bulldozer refuses them, and so do we). The
  original's panel has no sell button: its slot is Upgrade.
- CLIENT.md, "Villagers at work" and "Training": units come out on the
  free tile toward the far corner, not the nearest; and the next tree
  after a line may be one another villager is at.
- `docs/original/index/core.md`: rocks grow back during play as well as
  on opening; the construction bar is never shortened in the tutorial;
  "Place all" is only for the phone app's units.
