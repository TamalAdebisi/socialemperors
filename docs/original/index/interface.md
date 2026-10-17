# The interface, managers and small modules

This part of the original Flash client is what sits around the map: the
top bar and the menus at the bottom, the card for the thing selected, the
shop and storage, the friends strip, and the managers that keep the
player's numbers, check the goals, open the windows, send the commands and
play the sounds. Around them are small helpers and a few modules of their
own: the potion offer, the player-attack world map and the dragon-rider
minigame. The windows themselves are in [windows.md](windows.md), the map
and its units in [engine.md](engine.md) and [core.md](core.md).

**Count:** 36 built, 16 partly, 17 not yet, 18 not needed, 11 art (98 classes).

**How deep this was read.** Read through: `GuiManager`, `PlayerStatus`,
`MissionsManager`, `CommandManager`, `CollectableManager`, `KompuManager`,
`SoundManager`, `BuildingWindow`, `GiftWindow`, `GiftButtonLarge`,
`ItemButtonLarge`, `FriendsWindow`, `FriendButton`, `CountdownTimer`,
`ExpandTab`, `ExPayTab`, `NeighbourManager`, `GameDataManager`,
`DomeManager`, `HonorManager`, `TownManager`, `UnitCollectionsManager` and
the small classes. `RecuadroInfo` (the selected thing's card) was read in
its main parts: the card for each kind of building, its buttons, selling,
upgrading and storing; the text and layout lines were skipped.
`InfoButtonOver` was read for what it shows per kind, not every text.
`PopupManager` was read for its start-up sequence and its "not enough"
prompts; its hundred or so window openers only by name (the windows are in
windows.md). `TournamentManager` and `ServiceManager` were reread for
entry, fees/refunds, state routing, battles, results and cleanup (see
`rules/tournaments.md`). `ExplorationsManager` was read for its set-up,
relocation and the continent's loading; the drawing and tweens were
skimmed. `Projectiles` was read in its main parts. `AdminPanel` only by its
list of buttons and commands. The image loaders and the paginator were read
by their function names, the picture classes by their fields. Statuses come
from searching `client/src` and the server's `.py` files for the commands,
config keys and rules each class uses.

**Words used here.** "At home" means the player's own town, not a visit or
a battle. "Free" in a command means the "don't change resources" flag
(`buy` with that flag set). The new client's windows are in
`client/src/ui/`, their rules in `client/src/rules/`.

## The screen: the bars, the menus and the selected thing's card

| Class | Lines | What it does | Status |
|---|---|---|---|
| `GUI/GuiManager.as` | 2553 | Everything around the map: the top bar (level, experience, gold, cash, wood, food, stone, people), the bottom buttons and their pop-up menus (pointer, bulldozer, fast-collect glove, square selection, shop, storage, gifts, news, units, collections, world, games), the options (music, sounds, full screen, pause), the offer and bonus icons, the goal box or spell box, the troll-camp countdown, and the switches between home, visiting and battle. Its rules: the people count turns red when over the room and blue at the most a town can have; the world menu locks attacks and quests below level 6, tournaments below 15 (and while the config's `TOURNAMENT_ACTIVATED` is off), survival below 20; humans below level 20 don't see the troll-town picker; collections are for human towns only; the glove is a mode, one building per click. On a level up it sends `rt_level_up`; on reaching level 35 at home it places a free Wizardry Academy (see Surprises). Leaving survival asks first; leaving a ship or zeppelin island sends its results. | partly: the top bar, the pointer's menu (bulldozer and glove) and the square tool in `ui/hud.ts` and `editor.ts`, the rail and dock in `ui/menus.ts`, the goals in `ui/goals.ts`, the bonuses in `bonuses.ts`; our glove sweeps (and Collect all stays, DECISIONS.md); the camp/raid countdown is built in `homeDefence.ts` (owner-requested ten-minute camp cycle); missing renaming the town, the collections panel, the people colours, the free Academy at 35 |
| `GUI/RecuadroInfo.as` | 2211 | The card for the thing selected: a picture, life bar and the right panel for each kind of building (farm and mill with a time bar and what the next harvest gives, barracks with the unit it trains and its price less the blacksmith's or university's tenth, food twice the price; town hall with its villager queue; house, tower, wall gate, refuge, market, harbour, zeppelin, nests and the rest with an Open button), a special unit's move buttons, the units inside (tap one to let it out), and Move, Turn, Store and Upgrade. The red button is Upgrade, not Sell: selling is only with the bulldozer. Nothing on the card shows for another player's things; the Blue Phoenix Egg can't be moved, turned or stored. A building under construction offers "finish now" for 10 cash, taken in the client only. | built: `ui/actions.ts`, `rules/card.ts`, `rules/upgrade.ts` and `editor.ts` (the panel on its parchment: picture and life, the numbers with their tooltips, the tips, what it earns with the time bar, Hurry up and its window, who's inside, Train and BUY with the unit's bubble, a building's own window, Move, Turn, Store and Upgrade with its bubble; the portraits of several units selected; shared battle inspection and Deselect in `ui/battleSelection.ts`; CLIENT.md, "The building card"); missing a special unit's attack buttons (Beta 2) |
| `GUI/Portrait.as` | 162 | A small portrait with a life bar, used for the units inside a building; clicking it selects (or lets out) that unit. | partly: several units selected show as portraits with life bars (`ui/actions.ts`, `showGroup`); a building's units inside are one Let out button, not a portrait each |
| `GUI/CountdownTimer.as` | 424 | Three counters: the next harvest (hidden in practice), the troll camp at home (4 hours after the last chest; when it runs out with the town open, a new camp comes) and, in battle, the targets, gems or town halls left. The world map's "more attacks in" counter uses it too. | partly: the camp's timing in `homeCamps.ts`, visible camp/raid countdown in `homeDefence.ts` and "left to beat" in `questPlay.ts` |
| `GUI/IconPanel.as` | 177 | The column of round offer and bonus icons down the right side, as many as fit, sliding up when one goes. | built: `bonuses.ts` (round buttons at the top right) |
| `GUI/MondayBonusButton.as` | 32 | Monday's chest icon, ready or not yet. | built: `bonuses.ts` |
| `GUI/GuiButton.as` | 101 | The pictures behind the gold and cash numbers; clicking cash could open the payment page. | built: the pills in `ui/hud.ts` |
| `GUI/ZoomSlider.as` | 165 | The zoom slider and its plus and minus buttons, in steps of 0.2; not in tutorial, spying or locked islands. Using it counts for the zoom goal. | built: wheel and pinch in `view/camera.ts` (no slider) |
| `GUI/InfoPopup.as` | 71 | The label over a hovered building: its name, the time left and how far along, in percent. | not yet (PARITY.md, "Small things") |
| `GUI/FolderMenu.as` | 125 | An empty folder window with next and previous buttons. | not needed: nothing opens it |
| `GUI/GuiGiftButton.as` | 73 | A shaking gift icon that opened Facebook's gift page. | not needed: Facebook, and nothing creates it |
| `GUI/GuiInviteButton.as` | 31 | An icon that opened Facebook's invite page. | not needed: Facebook, and nothing creates it |
| `GUI/MobileGuiGiftButton.as` | 33 | The icon for gifts earned in the iPhone app. | not needed: iPhone app |
| `GUI/DealSpotNPPIcon.as` | 85 | Loads an advertiser's offer icon from a web address. | not needed: adverts |
| `GUI/AdminButton.as` | 42 | A plain button for the admin panel. | not needed: Social Point's admin |
| `GUI/AdminPanel.as` | 2220 | Social Point's test panel: give resources, fast-forward, spawn and kill units, load maps, finish the tutorial or goals, reset, open any window. Only with an admin switch. Read by its buttons only. | not needed: Social Point's admin |

## The shop and storage

| Class | Lines | What it does | Status |
|---|---|---|---|
| `GUI/BuildingWindow.as` | 657 | One shop page: the items of a category, eight to a page, with the category's tabs. Hides items whose `store_level` is above the player's level and the Dragon Killer Castle from non-members; puts locked items last; during the tutorial everything above level 1 goes last. The New category gathers items marked new and every cash item. A switch to show only the next locked item per tab is off. | built: `rules/shop.ts`, `ui/shop.ts` |
| `GUI/ItemButtonLarge.as` | 324 | One shop card: picture, name, price, experience, the level it opens at (click it to open it early for cash), a "new" or "limited edition, days left" badge, and the hover card. Locked items can't be bought. | partly: `ui/shop.ts`; no hover card, no new or limited badges |
| `GUI/InfoButtonOver.as` | 695 | The hover card in the shop: for a unit its life, attack, rate, speed, range and people, with its animation; for a house the room it gives; for a farm, mill or ranch what it makes and how often and how many workers; the blacksmith's and university's discount; a market's trade size; an eagle's life; a line for each special building. | not yet (PARITY.md, shop) |
| `GUI/Tab.as` | 94 | A shop tab with the game's own picture and name. | partly: our tabs have names, not the pictures |
| `GUI/SubCategory.as` | 101 | A sub-tab label in the shop and storage, sized to its text. | built: `ui/shop.ts` |
| `GUI/GiftWindow.as` | 395 | The storage page: stored things and gifts by name, the same kind stacked with a count, eight to a page; a second tab for iPhone items with a first-time hint. | built: `rules/storage.ts`, `ui/shop.ts` (the iPhone tab not needed) |
| `GUI/GiftButtonLarge.as` | 223 | One stored thing with Use and Sell. Bahamut's Heart and special collection pieces can be neither; a town hall can't be sold; another race's thing can't be placed. Selling gives a twentieth back (nothing for cash things, nor for the Dock or Zeppelin Tower) and sends `sell_gift`, `sell_iphone_item` or `sell_stored_item`. | built: `rules/storage.ts` |
| `GUI/BuildingMobileGift.as` | 34 | A building earned in the iPhone app, with a count. | not needed: iPhone app |
| `GUI/UnitMobileGift.as` | 34 | A unit earned in the iPhone app, with a count. | not needed: iPhone app |
| `expansion/ExpandTab.as` | 290 | The shop's Expansion tab: a picture saying how to buy land, a button to the player-attack map, one to the troll town, and the offer packs one at a time (a mystery box, a super box or a plain pack). | not yet: land is bought from the map's signs (built); the troll town, attack map and packs aren't here |
| `expansion/ExPayTab.as` | 236 | Buying the next block of land: its gold price (only with enough real neighbours, else how many more) and its cash price. | built: `rules/land.ts` |
| `expansion/ExButton.as` | 35 | The land window's buy button picture. | art |
| `expansion/LinkButton.as` | 63 | Buttons in the land window to buy coins or cash or invite neighbours. | not needed: payments and Facebook invites |

## Spells, special moves and battle portraits

| Class | Lines | What it does | Status |
|---|---|---|---|
| `GUI/MagicEntry.as` | 65 | One spell in the Academy's book: learnt, available or locked with its level. | built: `ui/spells.ts` |
| `GUI/SelectedMagic.as` | 220 | The chosen spell: its text, mana, the three ranks, a bar to the next rank (`NUM_SPELL_USES_LVL2` and `LVL3` casts, 25 and 50), and buying it for gold (from its level) or cash. | built: `ui/spells.ts`, `rules/magic.ts` |
| `GUI/SpellButton.as` | 88 | A spell in the battle book with its mana; greyed out when it can't be cast. | built: `ui/spells.ts`, `battleControls.ts` |
| `GUI/PortraitSpecialAttack.as` | 214 | A special unit's move button: uses left, the cast and cooldown shown as a shade; says "not ready" otherwise. | built: `ui/specialButtons.ts` |
| `GUI/PortraitLimitAttack.as` | 209 | The LIMIT move's button, a bar filling in the unit's colours and glowing when full. | built: `ui/specialButtons.ts` |
| `GUI/PortraitAssault.as` | 40 | A unit picture with a count, in the army and after-battle windows. | partly: the island's end window in `questPlay.ts`; the attack windows aren't built |
| `GUI/PortraitAssaultRecovered.as` | 43 | A recovered unit with half its price. | not needed: only a window the admin panel opens uses it |
| `GUI/UnitTooltip.as` | 172 | A unit's numbers and animation, for the dragon and monster nests and the super mystery box. | not yet |
| `GUI/AnimatedUnit.as` | 212 | Plays a unit's animation in a window (darts, dragon taming, unit warehouse, potion offer). | warehouse built with original thumbnails in `ui/warehouse.ts`; this shared animation player is not yet ported |

## Friends and neighbours

| Class | Lines | What it does | Status |
|---|---|---|---|
| `GUI/FriendsWindow.as` | 344 | The friends strip: neighbours sorted by experience, then Arthur at round(level x 1.2), then an empty "add" slot; six at a time. A switch for made-up neighbours is off. | partly: `ui/neighbours.ts` (friends, then the most active, then Arthur); not sorted by experience |
| `GUI/FriendButton.as` | 278 | One neighbour: picture, level, a mark when they can still be helped today; clicking offers Visit. Arthur's town is one of three by the player's level (to 10, to 20, above). | partly: `ui/neighbours.ts`, `rules/neighbours.ts` (Arthur's three towns built); no help mark |
| `managers/NeighbourManager.as` | 183 | Helping: up to 5 buildings a visit, sent as `assist_neighbor_new` when leaving; at home a donkey cart near the middle for each friend who helped, which sends `clean_received_assists` when met. | built: `rules/neighbours.ts`, `visit.ts`, `main.ts` |

## Managers: the player, goals, windows and commands

| Class | Lines | What it does | Status |
|---|---|---|---|
| `managers/PlayerStatus.as` | 1062 | The player's numbers (gold, cash, wood, food, stone, experience, level, mana, people) and save fields (dragons, riders, darts, quests, magic, skins, bought units, seen hints). Room for people is the houses' room (a burnt house gives none, a town hall always) up to 175, plus extra from special buildings. Level ups one at a time, each with its window; at home a level up also re-runs the raids' set-up and, from level 25 every fifth level, puts an enemy dragon on the border (see Surprises). `set_info_showed` marks hints seen. | partly: `rules/town.ts`, `levels.ts`, `training.ts`; missing the level-up side effects and the seen hints |
| `managers/MissionsManager.as` | 1467 | The goals: the first 15 not done and paid are open; each kind's check (built, trained, inside, collected, captured, killed, moved, stored, time chosen, popups opened, market trades, spends, neighbours, quests, walls on the front row and the rest); `complete_mission` when reached, `reward_mission` for the first done one, gold added. Counts of things done start again each page load; a kill count resets when its goal is done. Skipping for cash exists but is off. | partly: `rules/goals.ts`, `goals.ts`; battle and social-building goals are left to the classic game (the square tool's and the market's goals are built; the rename goal can't be done in either) |
| `managers/PopupManager.as` | 1519 | Opens every window (one at a time, over a dark cover) and runs the start-up sequence at home: the daily bonus (from level 5, human towns), the potion offer (half the time when one is on) or the news, a tournament invitation, darts, the heavy siege, quest info, the no-town-hall warning, the harbour and zeppelin checks with the Prisoner Princess's helpers, then the server's message (`clear_message`). Short of gold or cash it offers the payment page; short of mana, the mana shop. | partly: windows in `ui/`, the server's message and daily bonus in `main.ts` and `bonuses.ts`; no darts, news, no-town-hall or heavy siege steps |
| `managers/CommandManager.as` | 564 | Sends the commands to `command.php` in batches on a timer, one batch at a time, 3 tries with a 30-second wait; units that moved are sent every 6 seconds as `move` with their last stop. Commands made away from home are dropped unless forced (a visit passes only the old help command). 45 minutes between batches means "session expired" and a reload. | built: `net/commands.ts`, `rules/walking.ts` |
| `managers/GameDataManager.as` | 274 | Reads the config: items by id and by category, levels, goals, spells, offer packs, darts prizes by date, tournament types, land prices, and the potion offer. A switch can take the graveyard out of the shop (off). | built: `rules/config.ts` |
| `managers/TownManager.as` | 69 | Switching between the player's towns: sends what's waiting, loads the other town and resets its markers. | built: travelling sends what's waiting and opens the other town as a new page (`ui/towns.ts`) |
| `managers/HonorManager.as` | 86 | Honour from an attack, 1 to 10, from both armies' worth (each unit counts a hundredth of its price, capped at 1,000) and what was lost; and the rank for a score. | built: `honour` in `rules/pvp.ts` (`pvp.py` works it out again); the rank not yet |
| `managers/DomeManager.as` | 143 | The domes: the Protection Dome halves hits on the owner's things within its square; the Tower Enhancer halves the attack interval of towers in its square when a tower is placed or moved. | not yet (PARITY.md, "Domes") |
| `managers/CollectableManager.as` | 452 | The 23 collections, five pieces each: which source drops each piece and how often (see Surprises), `add_collectable` sent at once, completing one for its prize (into storage) and its cash price. Human towns only. | not yet: collections come later |
| `managers/UnitCollectionsManager.as` | 151 | The units book: which units of each category the player has ever had (bought, or standing in town when the game opens) and a message when a category fills. | not yet |
| `managers/TournamentManager.as` | 875 | Tournaments: the list, creating or joining a room (the fee taken with `tournament_substract_resources`), leaving or cancelling (refunds), playing a match against another player's army, the life bars and the results. | built: `rules/tournaments.ts`, `ui/tournaments.ts`, `ui/tournamentResults.ts`, `tournamentPlay.ts`; services own actual fees/prizes |
| `managers/ServiceManager.as` | 96 | Calls a server page (the tournaments' ones) with a signed request and checks the reply's signature. | built: original tournament service envelopes in `net/server.ts`; this project's unsigned pages do not require signatures |
| `managers/services/Service.as` | 26 | One waiting service call and its handlers. | built: tournament request parameters and Promise success/error handling in `net/server.ts` and its callers |
| `managers/SoundManager.as` | 599 | Music and effects: seven tracks (town, battle, ship, attack, quest, troll town, survival) faded into each other over a second; effects a moment after their cause, a few of each at once, only for things on screen; the death cry by kind (women, trolls and bosses, machines, men). | partly: `sound.ts` has the town's music and 16 effects; no other tracks, no fading, no boss or spell sounds |
| `managers/Projectiles.as` | 594 | The layer of flying shots: arrows and rocks, the puff where they land, smoke trails, a castle's stream of shots, with a cap on puffs at once; pauses with the game. | partly: shots drawn in `view/battleView.ts`; no puffs, trails or streams |

## Pictures, loading and fonts

| Class | Lines | What it does | Status |
|---|---|---|---|
| `managers/AssetManager.as` | 54 | Gets an animated picture, loading it once if needed. | built: `view/art.ts` |
| `managers/assets/SingleAssetLoader.as` | 68 | Loads one animation file and says when it's in. | built: `view/art.ts` |
| `managers/ImageManager.as` | 256 | Loads and keeps pictures: thumbnails, the language's pictures, Facebook photos. | built: pictures by address in `ui/` (Facebook photos not needed) |
| `managers/images/ImageManagerResource.as` | 204 | One loaded picture, given out at a size. | built: as above |
| `managers/images/ExtendedBitmap.as` | 69 | A picture that says when it's ready. | built: as above |
| `managers/ThumbManager.as` | 138 | Keeps building thumbnails, one copy each. | built: thumbnails by address (`main.ts`) |
| `utils/FontsLoader.as` | 214 | Loads the game's fonts at start, by language. | built: the page's fonts come by CSS (`ui/style.css`) |
| `fonts/IRuntimeLoadedFont.as` | 15 | What a loaded font must offer. | built: as above |
| `utils/TextFieldUtil.as` | 121 | Puts text in a field, shrinking it to fit. | built: our windows are HTML |
| `utils/StageBlocker.as` | 204 | The "loading" cover that stops clicks while waiting for the server, and the time machine's "travelling" screen. | partly: loading/travelling text (`ui/hud.ts`, `ui/machines.ts`); the original extra travel-animation delay is omitted |
| `btns/Buttonize.as` | 358 | Makes a picture act as a button: grows on hover, fades when off. | built: the buttons' styles in `ui/style.css` |
| `utils/ExpandSprite.as` | 173 | A frame that stretches without blurring its corners, for tooltips. | art |
| `utils/TooltipMultiline.as` | 100 | A tooltip of several lines that follows the mouse (dragon nest, Bahamut temple). | partly: temple information and native tooltips; cursor-following tooltip not reproduced |
| `utils/CountDown.as` | 151 | A flip-clock countdown (darts, tournaments, the heavy siege, the Bahamut temple). | partly: tournament refresh, availability/deadline and temple offering clocks; darts later and heavy siege off |
| `utils/countdown/DigitCountDown.as` | 66 | One flipping digit of that clock. | art |
| `utils/paginator/Paginator.as` | 246 | Pages through a list of things. | not needed: only the iPhone gifts window uses it |
| `utils/paginator/PaginatorConfig.as` | 228 | The paginator's settings. | not needed: as above |
| `utils/paginator/effects/Effect.as` | 36 | The paginator's page effects (none here). | not needed: as above |

## Small helpers

| Class | Lines | What it does | Status |
|---|---|---|---|
| `utils/ElementsManager.as` | 61 | The five elemental units, each hitting one other 1.35 times as hard. | built: `rules/battle.ts` |
| `utils/ItemsCollection.as` | 41 | Keeps the config's items by id. | built: `rules/config.ts` |
| `utils/RandomGenerator.as` | 42 | A seeded number generator, so darts shuffle their prizes the same way from the save's seed. | not yet: darts (`darts.py` keeps the seed) |
| `utils/TimerProxy.as` | 16 | A timer that carries a note, for two units' timed moves. | built: our battles count frames (`rules/battle.ts`) |

## Small modules: the attack map, the potion offer, cross-promotion, the minigame

| Class | Lines | What it does | Status |
|---|---|---|---|
| `newTowns/ExplorationsManager.as` | 1061 | The world map for attacking players: continents of islands by level, attack (`attack_player`) and spy (`spy_player`) with their counters, profiles, history and the army. Opening it can move the player's own island and clear the "next continent" flag without a button (see Surprises). Relocating sends `reset_position_univers`. Drawing and tweens skimmed. | partly: `ui/worldMap.ts` and `rules/world.ts` (the map, islands, menu, attack, spy, profile, browsing, relocating, the prize); no first-time help yet; `worlds.py` serves the map |
| `minigames/WindowMiniGameDragonRider.as` | 96 | Loads a separate minigame for a dragon rider's training level and reports won or lost. | built: unchanged shipped adventure through the pinned runtime and our own `ui/riderAdventure.ts` loader |
| `managers/offers/KompuManager.as` | 354 | The timed potion offer: on from `KOMPU_MIN_LEVEL` (10) while the config has an offer, a try every so often through `kompu_try.php`, a prize (into storage) at certain potion counts, done when all are brewed. | not yet: our server sends no offer, so neither game shows it |
| `managers/offers/KompuReward.as` | 83 | One potion prize: its count and unit. | not yet |
| `managers/offers/KompuViralIcon.as` | 58 | The offer's animated icon with its time left. | not yet |
| `managers/services/ServiceKompuTryVars.as` | 52 | What a potion try sends. | not yet |
| `managers/services/ServiceKompuHurryUpVars.as` | 28 | What skipping the wait sends. | not yet |
| `managers/services/SimpleServiceManager.as` | 119 | Calls the potion offer's server pages and checks their signature. | not yet |
| `kompuGacha/OfferIconMC.as` | 21 | The offer icon's frame (picture). | art |
| `kompuGacha/PopupKompuGachaMC.as` | 43 | The offer window (picture). | art |
| `kompuGacha/PopupKompuResultMC.as` | 32 | A try's result window (picture). | art |
| `kompuGacha/PopupKompuRewardGivenMC.as` | 30 | The prize window (picture). | art |
| `kompuGacha/ProgressBarMC.as` | 17 | Its progress bar (picture). | art |
| `kompuGacha/StepRewardMC.as` | 28 | One step's prize (picture). | art |
| `kompuGacha/goldenFrameMC.as` | 17 | A golden thumbnail frame (picture). | art |
| `sDragons/kompu/viralIcon/iconMC.as` | 19 | The offer icon's background (picture). | art |
| `cross/BadgeObtainedMC.as` | 15 | A badge for another Social Point game (picture). | not needed: adverts for other games |
| `cross/PopupCrossPromotionMC.as` | 27 | The window offering free dragons for other games (picture). | not needed: adverts for other games |
| `cross/PopupPlayNowMC.as` | 28 | "Play this other game" (picture). | not needed: adverts for other games |
| `cross/popupCross/crossUnitMC.as` | 28 | One dragon in that window (picture). | not needed: adverts for other games |

## Surprises

What we found here that our notes didn't say, the most important first.

1. **A free Wizardry Academy at level 35.** Reaching level 35 at home
   swaps the goal box for the spell box and places a Wizardry Academy for
   free (`buy`, free flag) on the nearest free 3 x 3 spot to tile (59, 59),
   with a notice. There's no race check. Ours places nothing, so a player
   who reaches 35 in the new client never gets it.
2. **An enemy dragon every fifth level from 25.** At home, reaching level
   25, 30, 35 and so on puts an Evil Orc Dragon (895) on the map's border,
   bought free, so it's in the save. Ours never does.
3. **A level up re-runs the raids.** At home each level up sets the
   bandit bands again (7, 14 and 21 minutes, by level) and rolls another 1
   in 10 for a siege, stampede or army. Ours rolls once when the town opens.
4. **Collection pieces from chopping and mining.** Each tree, stone or gold
   rock gives a piece about 4 times in 100 (half a chance in 100 an epic
   one, 2 a rare one, 1.5 an uncommon one); a boss and the treasure chest
   always give one, the treasure mine always (from any source), hardcore
   islands half the time. Human towns only. `add_collectable` goes at
   once, even in battle. CLIENT.md says harvests drop pieces but not how
   often; players chopping in the new client get none.
5. **Opening the attack map can change the save.** If the player's own
   island is marked beaten and another isn't, the client swaps the two
   (`modify_position_univers`); a pending "next continent" flag is cleared
   (`reset_world_change`) and its reward shown. No button. The server
   (`worlds.py`) handles both.
6. **Completing a collection.** The cash price drops by 1 for each piece
   already held (at least 1), except collections 10 and 20; the two
   Bahamut dragon collections refuse while a copy is in storage; a unit or
   building prize refuses if the player already has one; completing uses
   one of each piece and puts the prize in storage.
7. **The welcome-back chest's days differ by path.** On opening the town
   its icon shows to day 2; on reaching level 4 it shows to day 3. Ours
   uses days 0 to 2 both ways.
8. **The Blue Phoenix Egg (1282) can't be moved, turned or stored** from
   the card in the original. Ours treats it as any building, so it can be
   stored or sold.
9. **Selling isn't on the original's card.** The card's red button is
   Upgrade; selling and removing are only with the bulldozer. Ours puts
   Sell on the card, a design choice DECISIONS.md doesn't mention.
10. **"Finish construction now" is switched off in effect.** The card
    offers it for 10 cash, taken in the client with no command, but only
    for items with a `build_time`, and no item in our config has one.
11. **The Tower Enhancer only boosts towers placed or moved in its
    range** (or there when the town loads); towers already standing when
    it's placed wait for the next load.
12. **The world menu's locks.** Attacks and quests from level 6,
    tournaments from 15 and only while `TOURNAMENT_ACTIVATED` is 1,
    survival from 20; humans below 20 don't see the troll-town picker. Ours
    locks quests; the rest open the classic game, which locks them itself.
13. **Commands away from home are dropped** unless forced, and 45 minutes
    without a batch means "session expired" and a reload on the next
    action. Ours doesn't need either, but it explains why some things done
    while visiting were never saved in the classic game.
14. **The units book counts units on the map** as collected when the game
    opens, without telling the server; filling a category only shows a
    message.
