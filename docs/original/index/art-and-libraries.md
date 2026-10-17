# Art holders and libraries

Most of these classes hold no rules at all. Flash made one for every picture
the game's code asks for by name (a window's layout, a button, a mark on the
map), and for the pieces it placed inside them; the rest is code from other
people (tweening, JSON, hashing, signals) and a little of Social Point's own
(the path finder, hiding numbers from cheat tools, cross-promotion). The
windows' and the map's real behaviour lives elsewhere in this map
([windows.md](windows.md), [engine.md](engine.md), [core.md](core.md)); here
is what they draw with.

**Count:** 2 built, 28 not needed, 489 art, 78 library (597 classes).

**How deep this was read.** Every picture holder was checked by script: all
489 are a picture or animation with named parts, and their only code stops,
plays or loops the animation (one sends its parent back to frame 1). Their
names and parts were read, not the drawings, so a few descriptions are
inferred from names. Which ones no code names was found by searching the
rest of the client. `AStar`, the `obfuscated` package, `ObfuscatedNumber`,
the `cross` package, the `debug` package and all of `es/socialpoint` were
read through. `BitmapClip` was skimmed. The third-party libraries were
identified by package and version, and by who uses them, not read.

**Words used here.** "art" means the class only holds a picture; "ours uses
it" names the file our client made from it (`tools/art/export_ui.py`, into
`client/src/ui/art/` and `client/src/view/art/`). The other buildings,
units and effects come as sprite sheets from their own files
(`tools/export_art.sh`), not from these classes. "No code names it" means no
other class refers to it by name: it is either never shown or only placed
inside another picture by Flash.
"Not needed: never used" marks code that is in the client but that nothing
starts, so it is dead in the original too.

## Social Point's own code

These sit in the library folders but are Social Point's, so each has its own row.

### Path finding

| Class | Lines | What it does | Status |
|---|---|---|---|
| `com/socialpoint/astar/AStar.as` | 413 | Finds a unit's way across the 100 x 100 map: 8 directions, never cutting a corner past a blocked tile; flying units go in a straight line. Before searching it checks that both ends are in the same walled-off area (a 4-way fill of the map, redone when a building is placed or removed after the map has loaded). A search may take 50 ms at most; one that runs over gives no path, and that unit can't search again for 1 to 3 seconds unless the move is forced. Its step costs don't add up (a slip noted in DECISIONS.md), so it heads greedily towards the target, guessing the rest by straight steps only. | built: `rules/walking.ts` (`findPath`), a correct search; no 50 ms limit or pause |
| `com/socialpoint/astar/IsoNode.as` | 30 | One tile of the path search: where it is, whether it can be walked, and the costs. | built: `rules/walking.ts`'s grid |

### Hiding numbers from cheat tools

| Class | Lines | What it does | Status |
|---|---|---|---|
| `com/socialpoint/ObfuscatedNumber.as` | 51 | Keeps a number as 2 to 10 random parts that add up to it, so a memory scanner can't find it. Used for the gold and XP won in a quest, the nests' step prices, the riders' training steps and times, and the daily bonus's hero. | not needed: anti-cheat; our server checks |
| `com/socialpoint/obfuscated/OArray.as` | 58 | Keeps a list spread out at shuffled places, with its length hidden. | not needed: anti-cheat |
| `com/socialpoint/obfuscated/OData.as` | 208 | A key-to-value box that hides each value by its kind (whole number, number, text, list, nested box); the game's config and parts of the player's state are held in these, with typed getters and JSON-decoding ones. | not needed: anti-cheat; `rules/config.ts` reads the config plainly |
| `com/socialpoint/obfuscated/OInt.as` | 25 | Keeps a whole number with its halves swapped and one flipped. | not needed: anti-cheat |
| `com/socialpoint/obfuscated/ONumber.as` | 48 | Keeps a number's 8 bytes in a rotated order. | not needed: anti-cheat |
| `com/socialpoint/obfuscated/OString.as` | 49 | Keeps text as scaled character codes. | not needed: anti-cheat |
| `com/socialpoint/obfuscated/OUInt.as` | 25 | Like `OInt`, for numbers that can't be negative. Nothing uses it. | not needed: anti-cheat, unused |

### Developer tools

| Class | Lines | What it does | Status |
|---|---|---|---|
| `com/socialpoint/debug/Timing.as` | 66 | Times named stretches of code and reports the last, least, most and average. | not needed: developer tool |
| `com/socialpoint/debug/TimedEntry.as` | 93 | One named timing for `Timing`. | not needed: developer tool |
| `com/socialpoint/debug/Tracing.as` | 107 | A debug log that can be shown in a text box (the admin panel's). | not needed: developer tool |

### Adverts for Social Point's other games

| Class | Lines | What it does | Status |
|---|---|---|---|
| `com/socialpoint/social/cross/CrossManager.as` | 207 | Asks the web page for the player's data in Social Point's other games, shows the cross-promotion icon from the level the page sets (none if it sets 0), and on a finished promotion puts that game's reward unit in storage (by default item 2037 for Dragon City and 2048 for Social Wars, from level 10). | not needed: adverts for other games |
| `com/socialpoint/social/cross/CrossData.as` | 56 | The other games' data, checked against a signature before it's believed. | not needed: adverts for other games |
| `com/socialpoint/social/cross/GameData.as` | 153 | One other game's data: level, when registered, paying or gold member; and the Facebook app ids of each game. | not needed: adverts for other games |
| `com/socialpoint/social/cross/Crypto.as` | 65 | Signs and checks the cross-promotion data (HMAC-SHA256). | not needed: adverts for other games |

### A unit file format the game never uses

| Class | Lines | What it does | Status |
|---|---|---|---|
| `es/socialpoint/utils/UnitLoader.as` | 93 | Reads a unit file that packs the sprite together with its attack data. The game's asset loader can take one, but no code ever starts it: all 1,586 sprites in `assets/buildingsprites/` are plain compressed .swf files. | not needed: never used in this build |
| `es/socialpoint/utils/UnitLoaderResult.as` | 31 | What `UnitLoader` gives back: the loaded sprite and its unit data. | not needed: never used |
| `es/socialpoint/utils/UnitModelUtil.as` | 31 | Registers the unit data's classes so they can be read back from the file. | not needed: never used |
| `es/socialpoint/model/UnitModel.as` | 124 | A unit's data in that format: its sprite's class name and a list of attacks. | not needed: never used |
| `es/socialpoint/model/AttackModel.as` | 134 | One attack: its animation frame (attack by default) and a list of actions. | not needed: never used |
| `es/socialpoint/model/AttackActionModel.as` | 152 | One action of an attack, of kind normal, shooting or callback, with its details. | not needed: never used |
| `es/socialpoint/model/AttackActionType.as` | 18 | The three kinds of action: normal, shooting, callback. | not needed: never used |
| `es/socialpoint/model/AttackActionDescriptorAbstract.as` | 39 | What every action has: a delay (1 by default). | not needed: never used |
| `es/socialpoint/model/NormalAttackActionDescriptor.as` | 45 | A blow: whether it throws the target in the air, and a least distance. | not needed: never used |
| `es/socialpoint/model/ShootingAttackActionDescriptor.as` | 125 | A shot: projectile kind and layer, speed, curve, random and height offsets, a delay and up to 6 points. | not needed: never used |
| `es/socialpoint/model/CallbackAttackActionDescriptor.as` | 21 | An action that calls named code. | not needed: never used |
| `es/socialpoint/model/UnitFrames.as` | 22 | Frame numbers for idle (1), moving (6), attack (11), dying (16) and special attack (31). | not needed: never used |
| `es/socialpoint/events/PropertyChangeEvent.as` | 22 | An event saying a property changed (for an editor of that format). | not needed: never used |
| `es/socialpoint/events/UnitModelEvent.as` | 30 | An event saying an attack was added or removed. | not needed: never used |

## The game bar, top bar and small icons

| Class | Lines | What it does | Status |
|---|---|---|---|
| `AchievementButtonGraphic.as` | 15 | The achievements button's picture. | art |
| `AddCashButton.as` | 15 | The "add cash" button on the top bar. | art; ours uses it: `ui/art/add-cash.webp` |
| `AdminPanelMC.as` | 38 | Social Point's admin panel: offsets, scales, ids, a debugger box. | art |
| `BuildButtonLargeMC.as` | 38 | A large build button with name, XP gained and a limited-offer mark. | art |
| `CashMC.as` | 15 | The cash icon. | art |
| `CheckBoxMC.as` | 17 | A tick box. | art |
| `CollButtonGraphic.as` | 15 | The collections button's picture. | art; no code names it |
| `DailyButtonMC.as` | 15 | The daily bonus button. | art; ours uses it: `ui/art/daily-bonus.webp` |
| `dcBoton.as` | 15 | A Dragon City button. | art; no code names it |
| `dragonCityMC.as` | 15 | The side icon advertising Dragon City. | art |
| `ExpandButton2MC.as` | 20 | A button with a caption and picture on the land-expansion tab. | art |
| `ExperienceMeterMC.as` | 31 | The XP bar with level, name, visitors and the world button. | art |
| `FauxBarMC.as` | 22 | A progress bar with a percentage. | art |
| `FriendButtonMC.as` | 33 | A neighbour's card on the friends bar: photo, level star, town size, world. | art |
| `GamePausedMC.as` | 18 | The "game paused" cover with its resume button. | art; ours uses it: `ui/art/game-paused.webp`, `resume.webp` |
| `GamePausedTextMC.as` | 15 | The "game paused" words. | art |
| `GiftButt.as` | 15 | The gifts button. | art |
| `GiftButtonGraphic.as` | 15 | The gifts button's picture. | art |
| `GiftCounter.as` | 18 | The little number of gifts waiting. | art |
| `GoalLinkMC.as` | 20 | A goal's line on the goals list. | art |
| `GoldMC.as` | 15 | The gold icon. | art |
| `GreenTickMC.as` | 15 | A green tick. | art |
| `GuiCover.as` | 15 | A dark cover laid over the bar while a window is open. | art |
| `GuiCoverExplorationMC.as` | 15 | The bar's cover while exploring the world map. | art |
| `GuiMC.as` | 43 | The whole game bar and top bar: resources, the menus' buttons, the options panel, the quest progress button, collections. | art; ours uses it: the game bar's buttons, pause, music and sound (`ui/art/`) |
| `icoCashMC.as` | 15 | The cash icon, small. | art |
| `icoFoodMC.as` | 15 | The food icon, small. | art |
| `icoGoldMC.as` | 15 | The gold icon, small. | art |
| `icoManaMC.as` | 15 | The mana icon, small. | art |
| `IconCollect.as` | 19 | The hand and resource icon shown over something ready to collect. | art |
| `IconComeBack2nd3rdMC.as` | 21 | The welcome-back bonus icon on the side panel. | art; ours uses it: `ui/art/welcome-back.webp` |
| `IconGodsMC.as` | 15 | The side icon for the gods. | art |
| `IconPlayerMC.as` | 15 | A player icon. | art; no code names it |
| `IconResourcesMC.as` | 15 | All the resource icons, one frame each (cash, gold, wood, stone, population, XP, mana and more). | art; ours uses it: the resource, mana, XP and asleep icons (`ui/art/`) |
| `IconTutorialMC.as` | 21 | The tutorial's pointing icon. | art |
| `IconVideoMC.as` | 18 | The side icon that opened an advert video, with the XP it gave. | art |
| `icoStoneMC.as` | 15 | The stone icon, small. | art |
| `icoWoodMC.as` | 15 | The wood icon, small. | art |
| `InfoPopupManaMc.as` | 18 | The floating mana info box. | art |
| `InfoPopupMC.as` | 26 | The floating info box with a building's name, time left and progress bar. | art |
| `InviteFriendsMC.as` | 15 | The invite-friends picture. | art |
| `LevelUnlockMC.as` | 18 | An item unlocked at a new level. | art |
| `LimitBarMC.as` | 34 | The bar that fills up to a unit's limit attack. | art |
| `ManaMC.as` | 15 | The mana icon. | art; no code names it |
| `MassCollectButtB.as` | 15 | The mass-collect button. | art |
| `MenuTabFriendsMC.as` | 23 | The friends bar's tab with its scroll arrows. | art |
| `MenuTabMC.as` | 19 | A menu tab with arrows to scroll. | art |
| `MenVsWomenMC.as` | 15 | The side icon advertising Social Wars. | art |
| `MobileAnimMC.as` | 15 | The animation on the mobile-gifts button. | art |
| `MondayBonusButtonAsset.as` | 21 | The Monday chest's side icon. | art |
| `NewGoalMC.as` | 24 | The "new goal" announcement. | art |
| `NewsButtonGraphic.as` | 15 | The news button's picture. | art; no code names it |
| `NewTownButt1MC.as` | 20 | A button with a caption and picture for a new town. | art |
| `OkMakeyMC.as` | 15 | The side icon asking for Facebook posting permission. | art |
| `PanelCollection.as` | 38 | The collections panel: five collectibles and their counts. | art |
| `PastillaSubcategoriaMC.as` | 15 | The little badge on a shop subcategory. | art |
| `StarsRankMC.as` | 15 | The stars won on an island. | art |
| `StoreButtonGraphic.as` | 15 | The shop button's picture. | art |
| `Symbol1.as` | 53 | The bar at the bottom (`GuiMC`'s `bgBar`): shop, storage, bulldozer, pointer, home, the menus, missions, friends, troll timer, mass collect, the selection panel. | art; ours uses its buttons' pictures, among them the pointer and its Cancel, the bulldozer, the glove and the square tool (`ui/art/pointer*.webp`, `remove`, `fast-collect`, `square-tool*`) |
| `TabMC.as` | 19 | A coloured tab with an icon, for windows with tabs. | art |
| `tooltipColMC.as` | 18 | A collectible's tooltip. | art |
| `ToolTipMC.as` | 22 | A tooltip box with a pointer. | art |
| `TooltipMultilineMC.as` | 20 | A tooltip box for several lines. | art |
| `TooltipSimbolosAtaqueMC.as` | 18 | The tooltip for the attack symbols. | art |
| `TrollCardMC.as` | 20 | The troll card on the land-expansion tab. | art |
| `trollTimerMC.as` | 19 | The troll raid's countdown on the bar. | art |
| `UniqueBadgeMC.as` | 18 | The "unique" badge on a reward. | art |
| `ZoomSliderMC.as` | 21 | The zoom slider with its plus and minus. | art |

## The panel for the thing selected

The panel at the bottom that shows what is selected (CLIENT.md, "The menus: rail and dock", for ours).

| Class | Lines | What it does | Status |
|---|---|---|---|
| `BotonFlip_MC.as` | 14 | The turn button. | art; ours uses it: `ui/art/turn.webp` |
| `BotonMove_MC.as` | 14 | The move button. | art; ours uses it: `ui/art/move.webp` |
| `BotonPutInStorage_MC.as` | 14 | The put-in-storage button. | art; ours uses it: `ui/art/store.webp` |
| `BotonSell_MC.as` | 18 | The sell button. | art |
| `btNextMc.as` | 14 | A "next" arrow button. | art |
| `btPrevMc.as` | 14 | A "previous" arrow button. | art |
| `BufRemolinoMC.as` | 18 | The swirl behind a picture on the panel, with a lock. | art |
| `CancelButtMC.as` | 33 | A cancel button. | art |
| `CloseButt.as` | 14 | The close button. | art; ours uses it: `ui/art/close.webp` |
| `EP_Allies_MC.as` | 37 | The selection panel for the allies' building. | art |
| `EP_Altar_MC.as` | 37 | The selection panel for an altar. | art |
| `EP_BARRACKS_MC.as` | 58 | The selection panel for a barracks, with the unit it trains and its food cost. | art |
| `EP_Build_MC.as` | 24 | The selection panel for a building under construction, with its time bar and speed-up. | art |
| `EP_DragonNest_MC.as` | 37 | The selection panel for the dragon nest. | art |
| `EP_DragonRiderTraining_MC.as` | 35 | The selection panel for the dragon riders' training ground. | art |
| `EP_DragonTaming_MC.as` | 35 | The selection panel for the dragon taming building. | art |
| `EP_Farm_MC.as` | 45 | The selection panel for a farm, with its capacity. | art |
| `EP_Graveyard_MC.as` | 37 | The selection panel for the graveyard. | art; ours uses it: its open button (`ui/art/open-graveyard.webp`) |
| `EP_Harbour_MC.as` | 33 | The selection panel for the harbour. | art; ours uses it: its open button (`ui/art/open-harbour.webp`) |
| `EP_House_MC.as` | 40 | The selection panel for a house. | art |
| `EP_Magic_MC.as` | 33 | The selection panel for the magic building. | art |
| `EP_Market_MC.as` | 39 | The selection panel for the market. | art |
| `EP_OfferBuilding_MC.as` | 27 | The selection panel for an offer building. | art |
| `EP_REFUGE_MC.as` | 40 | The selection panel for a refuge, with how many it holds. | art |
| `EP_Resource_MC.as` | 30 | The selection panel for a resource building, with what it earns and its time bar. | art |
| `EP_SpecialUnitMc.as` | 34 | The selection panel for a special unit, with its attacks. | art |
| `EP_Survival_MC.as` | 33 | The selection panel for the survival building. | art: its Enter Survival button (`open-survival`) |
| `EP_TEXT_MC.as` | 36 | The selection panel for a building with plain text. | art |
| `EP_TimeMachine_MC.as` | 37 | The selection panel for the time machine. | art |
| `EP_TOWNHALL_MC.as` | 50 | The selection panel for the town hall, with the unit it trains. | art |
| `EP_UnitMC.as` | 30 | The selection panel for a unit: attack, defence, range, speed. | art |
| `EP_Wall_MC.as` | 40 | The selection panel for a wall, with its open/close button. | art; ours uses it: its open and close buttons (`ui/art/open-gate.webp`, `close-gate.webp`) |
| `EP_WarehouseMC.as` | 36 | The selection panel for the unit warehouse. | art |
| `EP_Weather_MC.as` | 37 | The selection panel for the weather building. | art |
| `EP_Zeppelin_MC.as` | 33 | The selection panel for the zeppelin. | art; ours uses it: its open button (`ui/art/open-zeppelin.webp`) |
| `FlechaResMC.as` | 15 | The arrow showing a building's resource. | art |
| `InhibidorClicksMC.as` | 15 | A see-through cover that stops clicks on the panel. | art |
| `RecuadroInfoMC.as` | 15 | The frame of the selection panel. | art |
| `SaveButtMC.as` | 33 | A save button. | art |

## Shop, storage and reward cards

| Class | Lines | What it does | Status |
|---|---|---|---|
| `BuildingMobileGiftMC.as` | 22 | A building gift from the mobile app. | art |
| `ButtonMarketMC.as` | 26 | A market line: resource, gold, buy and sell. | art |
| `ButtonResourceMC.as` | 22 | A resource choice with a tick. | art |
| `ButtonTimeMC.as` | 28 | A working-time choice with its price. | art |
| `CollectTimeMC.as` | 28 | A collect-time choice: resource, time, amount. | art |
| `GiftButtonMC.as` | 28 | A gift in storage: name, count, use and sell. | art |
| `InfoButtonDifficulty.as` | 18 | A difficulty card with a description. | art |
| `InfoButtonStore10MC.as` | 23 | A shop card's details for a fighting building with life. | art |
| `InfoButtonStore11MC.as` | 24 | A shop card's details for something that earns and is collected, another layout. | art |
| `InfoButtonStore12MC.as` | 20 | A shop card's details for something that earns, small. | art |
| `InfoButtonStore13MC.as` | 20 | A shop card's details for a building that houses units. | art |
| `InfoButtonStore14MC.as` | 18 | A shop card's details for an item with a description. | art |
| `InfoButtonStore15MC.as` | 18 | A shop card's details for a discount. | art |
| `InfoButtonStore16MC.as` | 20 | A shop card's details for an attack with a description. | art |
| `InfoButtonStore17MC.as` | 20 | A shop card's details for something with life. | art |
| `InfoButtonStore18MC.as` | 24 | A shop card's details for something that earns and is collected, a third layout. | art |
| `InfoButtonStore1MC.as` | 24 | A shop card's details for something that earns and is collected. | art |
| `InfoButtonStore2MC.as` | 28 | A shop card's details for a building that houses units and earns. | art |
| `InfoButtonStore3MC.as` | 28 | A shop card's details for a building that houses units, earns and is collected. | art |
| `InfoButtonStore4MC.as` | 20 | A shop card's details for an item with a discount. | art |
| `InfoButtonStore5MC.as` | 22 | A shop card's details for something that earns. | art |
| `InfoButtonStore6bMC.as` | 36 | A shop card's details for a unit, second layout. | art |
| `InfoButtonStore6MC.as` | 36 | A shop card's details for a unit: attack, defence, range, speed. | art |
| `InfoButtonStore7MC.as` | 32 | A shop card's details for a unit with a second label. | art |
| `InfoButtonStore8bMC.as` | 28 | A shop card's details for a fighting building with a special, second layout. | art |
| `InfoButtonStore8cMC.as` | 28 | A shop card's details for a fighting building with a special, third layout. | art |
| `InfoButtonStore8MC.as` | 28 | A shop card's details for a fighting building with a special. | art |
| `InfoButtonStore9MC.as` | 26 | A shop card's details for a fighting building. | art |
| `InfoButtonStoreDragonCastleMC.as` | 26 | The shop card's details for the dragon castle. | art |
| `InfoButtonUnitCollectionBuyMC.as` | 38 | A unit card in the units collection, with a buy panel. | art |
| `InfoButtonUnitCollectionMC.as` | 36 | A unit card in the units collection. | art |
| `InfoButtonUnitWarehouseMC.as` | 18 | A card in the unit warehouse. | art |
| `InfoButtonUpgradeMC.as` | 28 | An upgrade card: picture, what it earns, unlock. | art |
| `InfoHeroMC.as` | 28 | A hero's card: attack, defence, range, life, an animation; shown on the heroes window's shelves. | art; no code names it |
| `PackCardMC.as` | 24 | A pack for sale: picture, cash price. | art |
| `RewardItemMc.as` | 20 | A reward's picture and name. | art |
| `StoreInfoBoxMC.as` | 22 | The shop's info box. | art |
| `StoreMC.as` | 32 | The shop window: resources, filter, close. | art |
| `SurvivalMinRewardMc.as` | 20 | The least a survival round gives. | art |
| `UnitListMC.as` | 30 | A line in the units list, with a get-reward button. | art |
| `UnitMobileGiftMC.as` | 22 | A unit gift from the mobile app. | art |
| `UnitWarehouseCardEmptyMC.as` | 18 | An empty warehouse slot. | art |
| `UnitWarehouseCardMC.as` | 25 | A unit's card in the warehouse, with a use button. | art |

## Windows

| Class | Lines | What it does | Status |
|---|---|---|---|
| `backgroundThinFrameMC.as` | 17 | A thin window frame. | art |
| `DartTargetMC.as` | 26 | A balloon target in the darts game. | art |
| `ExplorationWorldMC.as` | 65 | The world map's bar: world number, spies, history, go home, move. | art: its islands, borders, statues, ship, zeppelin and buttons drawn by `tools/art/export_world.py` |
| `FolderWindowMC.as` | 23 | A window with pages and a close button. | art |
| `FotoNeighbourMC.as` | 23 | A neighbour's photo with a hand and a bubble. | art |
| `FotoNeighbourMC2.as` | 17 | A neighbour's photo. | art |
| `FotoSocialFeedMC.as` | 31 | A friend's photo in the social feeds. | art |
| `FotoSocialMC.as` | 31 | A friend's photo in a social building: role, price. | art |
| `FotoTarget.as` | 15 | The picture spot in a help window. | art |
| `GameShowFemaleHostMC.as` | 42 | The female presenter: waits, then talks, on a loop. | art |
| `GameShowHostMC.as` | 64 | The male presenter: waits, then talks, on a loop. | art |
| `helpPageMC.as` | 20 | A spell's help page. | art |
| `HireFriendMC.as` | 17 | A hired friend's frame. | art |
| `infoButtonFriendAssistMC.as` | 26 | A friend's offer of help. | art |
| `InviteFriendsPopupAsset.as` | 26 | The invite-friends window. | art |
| `InviteFriendsPopupItemAsset.as` | 24 | A friend in the invite list. | art |
| `InvocationIcoResourceMC.as` | 18 | A resource needed for an invocation. | art |
| `InvocationStepMC.as` | 24 | A step of an invocation, with a tick. | art |
| `MagicentryMC.as` | 24 | A spell's line in the spell book. | art |
| `MarcoMc.as` | 15 | A portrait frame. | art |
| `mcBuidaMC.as` | 15 | An empty holder that other pictures are put into. | art |
| `mcNegreMC.as` | 15 | A black cover. | art |
| `MondayBonusPopUpAsset.as` | 30 | The Monday chest window. | art |
| `NewQuestIslandButtonMC.as` | 26 | An island on the island map: name, padlock, level lock, stars, the way in. | art; ours uses it: the island map's lock, ribbon, way in and stars (`ui/art/island-*`) |
| `PopOverVisitMC.as` | 21 | The small menu over a neighbour: visit, attack, send a gift. | art |
| `PopUpAlertaMC.as` | 24 | An alert window with a picture. | art |
| `PopupAlertMC.as` | 20 | A plain alert with an OK button. | art |
| `PopupAllUnitsMC.as` | 32 | The all-units collection window with a progress bar. | art |
| `PopupArabicDealsMC.as` | 52 | The Arabian deals window: price before and now. | art |
| `PopupAssaultHistoryMC.as` | 56 | The attack history window: seven attacks. | art |
| `PopupAssistMC.as` | 26 | The window asking a friend for help. | art |
| `PopupAttackFinishedMC.as` | 72 | The end of an attack: alive, dead, XP, results. | art |
| `PopupBahamutSupremeInvocationTempleMC.as` | 46 | The Bahamut temple's invocation window. | art; temple controls and illustration exported by `tools/art/export_temple.py` |
| `PopUpBattleOptionsMC.as` | 34 | The battle options window: army and strategy tabs. | art |
| `PopupBuildingMC.as` | 28 | A yes/no window about a building. | art |
| `PopUpBuyAssaultMC.as` | 30 | The window to buy an attack, with its price. | art |
| `PopupBuyGoldMC.as` | 30 | The window to buy gold with cash. | art |
| `PopupBuyManaMC.as` | 36 | The window to buy mana. | art |
| `PopupBuyTerritoryPvpMC.as` | 28 | The window to buy a place on the player-attack world. | art |
| `PopUpCollectionCompleteMC.as` | 28 | The "collection complete" window. | art |
| `popupCollectionsMC.as` | 32 | The collections window with pages. | art |
| `PopupCollectMC.as` | 22 | A collect window. | art |
| `PopupConfirmMC.as` | 22 | A yes/no confirm window. | art |
| `PopupDartsMC.as` | 101 | The darts game: balloons, units, arrows. | art |
| `PopupDragonRidersMC.as` | 63 | The dragon riders window: two riders. | art |
| `PopupDragonRiderTrainingMC.as` | 39 | The dragon riders' training window. | art |
| `PopupDragonsMC.as` | 69 | The dragon nest window with its timer. | art |
| `PopupDragonTamingMC.as` | 71 | The dragon taming window. | art |
| `PopupEncampmentMC.as` | 28 | The camp window. | art |
| `PopupExpandMC.as` | 28 | The window to buy land. | art |
| `PopupGetPackMC.as` | 30 | The window to buy a pack. | art |
| `PopupGotPackMC.as` | 28 | The "you got the pack" window. | art |
| `PopupGraveyardMC.as` | 61 | The graveyard window: four shelves, potions. | art; ours uses it: its potion (`ui/art/potion.webp`) |
| `PopupHeavySiegeMC.as` | 30 | The heavy siege window: wait or pay. | art |
| `PopupHelpIslandMC.as` | 26 | The help window for an island, with a reward. | art |
| `PopupHelpMC.as` | 24 | A help window with a target picture. | art |
| `PopupHelpTimeMachineMC.as` | 22 | The time machine's help window. | art |
| `PopupHeroesMC.as` | 34 | The heroes window: four shelves. | art |
| `PopupHireFriendsGenericMC.as` | 30 | The window to hire friends. | art |
| `PopupHurryupMC.as` | 44 | The window to finish something now. | art |
| `PopupInactiveNestMC.as` | 26 | The window for an inactive nest: pay gold or cash. | art |
| `PopupInstallMC.as` | 23 | The window asking to install the app. | art |
| `PopupLandBackMC.as` | 15 | The back of the tab for paying for land. | art |
| `PopupLevelMC.as` | 40 | The level-up window: resources and mana. | art |
| `PopupLoadingAssaultMC.as` | 34 | The loading screen before an attack. | art |
| `PopupLoadingQuestMC.as` | 38 | The loading screen before a quest: three stars, difficulty. | art; ours uses it: its stars (`ui/art/star-on.webp`, `star-off.webp`) |
| `PopupLoadingSurvivalMC.as` | 24 | The loading screen before survival. | art |
| `PopupLoadingTournamentMC.as` | 26 | The loading screen before a tournament. | art |
| `PopupLoreMC.as` | 28 | The story window with pages. | art |
| `PopUpLostMC.as` | 21 | The window for things lost, with a treasure list. | art |
| `PopupMagicMC.as` | 29 | The spells bar in battle: mana, spell buttons, the book. | art; ours uses it: its book (`ui/art/spell-book.webp`) |
| `PopupMarketMC.as` | 24 | The market window: trades left. | art |
| `PopupMaxBuildingTypeMC.as` | 28 | The "too many of this building" window. | art |
| `PopupMissingTownhallMC.as` | 24 | The "no town hall" window. | art |
| `popUpMissionsMC.as` | 37 | The goals window: two goals, help. | art |
| `PopupMisteryMC.as` | 52 | The mystery box window. | art |
| `PopupMobileGiftsMC.as` | 45 | The mobile gifts window: buildings and units. | art |
| `PopupMobileStorageMC.as` | 24 | The mobile storage window. | art |
| `PopupMonstersMC.as` | 54 | The monsters' nest window with its timer. | art |
| `PopupMoreCashMC.as` | 24 | The "more cash" window. | art |
| `PopupMotivationMC.as` | 36 | A window urging the player to battle. | art |
| `PopUpNameTownMC.as` | 30 | The window to name a town, with a default text box. | art |
| `PopupNeighborsMC.as` | 24 | The neighbours window. | art |
| `PopupNewDailyMC.as` | 84 | The daily bonus window: five days, ticks, prize. | art |
| `PopupNewsMC.as` | 66 | The news window: hints and packs. | art |
| `PopupNewTown2MC.as` | 24 | A new town window, second layout. | art |
| `PopupNewTownMC.as` | 24 | The new town window. | art |
| `PopupNextIslandAttackMC.as` | 36 | The window about the next island attack. | art |
| `PopupPlayerProfileMC.as` | 65 | A player's profile: level, rank, honour, defeats. | art |
| `PopupQuestFinishedMC.as` | 40 | The end of a quest: XP, results. | art |
| `PopupQuestInfo2MC.as` | 26 | A quest's info window. | art |
| `PopupQuestsManagerMC.as` | 27 | The island map window: pages of islands. | art; ours uses it: its arrows (`ui/art/map-next.webp`, `map-prev.webp`) |
| `PopupRaceSelectorMC.as` | 47 | The window to choose a people (gold or cash). | art |
| `PopupRecoverMC.as` | 28 | The window to recover units after a battle. | art |
| `PopupRecruitmentMC.as` | 48 | The recruitment window. | art |
| `PopupRecruitmentPopulationMC.as` | 44 | The population recruitment window with stars. | art |
| `PopupRewardsGenericMC.as` | 36 | A generic rewards window. | art |
| `PopupSelectResourceMC.as` | 30 | The window to choose a resource (three). | art |
| `PopupSelectTimeMC.as` | 35 | The window to choose a working time. | art |
| `PopupSocialBuildingMC.as` | 28 | A social building's window: friends hired. | art |
| `PopupSocialFeedsMC.as` | 30 | The social feeds window. | art |
| `PopupSuperMisteryBoxMC.as` | 64 | The super mystery box window: three boxes. | art |
| `PopupSurvivalMC.as` | 41 | The survival window: lives and themes. | art: its hearts (`survival-life`, `survival-life-used`) |
| `PopupSurvivalResultsMC.as` | 30 | Survival results. | art |
| `PopupTournamentFinishedMC.as` | 26 | The end of a tournament: score. | art |
| `PopupTournamentMC.as` | 31 | The tournament list window. | art |
| `PopupTournamentResultsMC.as` | 39 | The tournament results window. | art |
| `PopupTournamentRoomMC.as` | 32 | The tournament room: invite, countdown, leave. | art |
| `PopupUnitWarehouseMC.as` | 38 | The unit warehouse window: slots, pages, buy price. | art |
| `PopupUnlockBuildingMC.as` | 34 | The window to unlock a building early for cash. | art |
| `PopupWeatherMC.as` | 19 | The weather window: themes. | art |
| `PopupWizardryMC.as` | 41 | The spell book: pages of spells and mana. | art |
| `PopUpYourArmieMC.as` | 27 | The "your army" window. | art |
| `PortraitAssaultMC.as` | 20 | A unit's portrait in an attack, with a count. | art |
| `PortraitAssaultRecoveredMC.as` | 27 | A unit's portrait to recover after an attack. | art |
| `PortraitCastingMaskMC.as` | 15 | The mask over a portrait while a spell is cast. | art |
| `PortraitMC.as` | 21 | A unit's portrait with its life bar. | art |
| `SelectedMagicMC.as` | 34 | A chosen spell: name, ranks, buy. | art |
| `SelectYourDragonPopUpMC.as` | 34 | The window to choose a dragon: three choices. | art |
| `SelectYourDragonReminderNestPopupMC.as` | 26 | The reminder to put a dragon in the nest. | art |
| `SetDefaultTextMC.as` | 15 | The "use default name" text. | art |
| `SiluetaHeroeMC.as` | 15 | A hero's outline. | art |
| `SpellButtonMC.as` | 24 | A spell button: picture, mana cost. | art |
| `TutorialPopupMC.as` | 26 | The tutorial's window. | art |

## Tournaments, survival and the team windows

| Class | Lines | What it does | Status |
|---|---|---|---|
| `AlertInviteTournamentMC.as` | 23 | A tournament alert with an invite button. | art |
| `AlertTournamentMC.as` | 25 | A tournament yes/no alert. | art |
| `CountDownMC.as` | 24 | A days-hours-minutes-seconds countdown. | art |
| `CreateYourTournamentWindowMC.as` | 24 | The window to create a tournament. | art |
| `DigitCountDownMC.as` | 23 | A flip-digit countdown. | art |
| `PlayerInfoTournamentMC.as` | 31 | A player's info in a tournament: name, level, country. | art |
| `RecuadroTeamTournamentMC.as` | 20 | A team's box in a tournament. | art |
| `SelectionTeamWindowMC.as` | 33 | The window to pick a tournament team. | art |
| `SurvivalMapMC.as` | 28 | A survival map: theme, difficulty, lock. | art: its padlock (`survival-lock`) |
| `ThemeMC.as` | 24 | A theme to apply or unlock. | art |
| `ThumbFriendsTournamentMC.as` | 24 | A friends' tournament thumbnail. | art |
| `ThumbSelectedUnitSurvivalMC.as` | 17 | A chosen survival unit, with a cross. | art |
| `ThumbTeamMC.as` | 19 | A team member's thumbnail, with a cross. | art: empty-place mark and removal cross in `tournament-empty`, `tournament-remove` |
| `ThumbTournamentCreationMC.as` | 40 | A tournament kind to create. | art |
| `ThumbTournamentMC.as` | 36 | A tournament's thumbnail. | art |
| `ThumbUnitMC.as` | 22 | A unit's thumbnail with a count. | art |
| `ThumbUnitSurvivalMC.as` | 22 | A survival unit's thumbnail with a count. | art |
| `ThumbWeeklyTournamentMC.as` | 30 | The weekly tournament's thumbnail. | art |
| `ThumbWeeklyTournamentPrizeMC.as` | 26 | A weekly tournament prize. | art |
| `TournamentMatchRowMC.as` | 17 | A match line. | art |
| `TournamentRankingRowMC.as` | 37 | A ranking line: place, name, matches, score. | art |
| `TournamentRankingUserRowMC.as` | 32 | The player's own ranking line. | art |
| `TournamentResultTabMatchesMC.as` | 24 | The results' matches tab. | art |
| `TournamentResultTabResultsMC.as` | 30 | The results' score tab. | art |
| `TournamentScoreBoardRowMC.as` | 24 | A scoreboard line. | art |
| `tournamentSquareMatchResultMC.as` | 28 | A match result square with a start button. | art |
| `WeeklyTournamentInfoWindowMC.as` | 24 | The weekly tournament's info and prizes. | art |
| `WindowMiniGameDragonRiderMC.as` | 25 | The dragon riders' mini game window. | art |
| `WindowSelectionUnitsSurvivalMC.as` | 28 | The window to choose units for survival. | art |

## On the map: bases, markers and loading

| Class | Lines | What it does | Status |
|---|---|---|---|
| `ArrowMC.as` | 19 | The bouncing arrow the tutorial and a few windows use to point at something, with a ground mark and a 2x2 tile mark (hidden by default). | art |
| `BarraVidaEnemyMC.as` | 17 | An enemy's life bar. | art |
| `BarraVidaMC.as` | 17 | A unit's or building's life bar. | art; ours uses it: `view/art/life-bar*.webp` |
| `BS_MC.as` | 19 | A unit's speech bubble with its words. | art |
| `btnBuyExpandTileMC.as` | 20 | The "for sale" sign on a block of land. | art; ours uses it: `ui/art/for-sale.webp` |
| `BubbleSpeech.as` | 15 | The speech bubble's outline. | art |
| `BubbleSpeechText.as` | 18 | The speech bubble's words. | art |
| `CortinaMC.as` | 15 | The curtain drawn over the map when paused. | art |
| `CursorMC.as` | 15 | The mouse pointers, one frame each (axe, pick, go inside, repair...). | art; ours uses it: the work pointers (`ui/art/cursor-*.png`, `axe`, `pick`, `inside`, `repair`) and the tools' (`square`, `remove`, `collect`) |
| `DebugTile.as` | 15 | A debug tile mark. | art |
| `DebugTileBlue.as` | 15 | A blue debug tile mark. | art |
| `DebugTileEnemy.as` | 15 | An enemy debug tile mark. | art |
| `FireMC.as` | 15 | A building's fire as it loses life, one frame per stage. | art; ours uses it: `view/art/fire-1..4.webp` |
| `FondoNegroTutorialMC.as` | 15 | The dark cover around the tutorial's focus. | art |
| `IconAssaultObjectivMC.as` | 15 | The mark over an attack's target. | art |
| `IconoCapturadoMC.as` | 15 | The mark over a wild animal just caught. | art; ours uses it: `ui/art/caught.webp` |
| `Loading1x1.as` | 15 | The stand-in for a 1x1 building whose picture is still loading. | art |
| `Loading2x2.as` | 15 | The stand-in for a 2x2 building whose picture is still loading. | art |
| `Loading3x3.as` | 15 | The stand-in for a 3x3 building whose picture is still loading. | art |
| `Loading4x4.as` | 15 | The stand-in for a 4x4 building whose picture is still loading. | art |
| `LoadingMC.as` | 21 | The loading animation. | art |
| `LoadingUnit.as` | 15 | The stand-in for a unit still loading. | art |
| `lureMarkMC.as` | 15 | The mark of a lure on the map. | art |
| `MassUnitsPlacerMC.as` | 15 | The area mark when placing many units at once. | art |
| `NumberParticle2MC.as` | 18 | A number that floats up (score, damage). | art |
| `PeanaBuilding1x1MC.as` | 15 | The outline under a selected 1x1 building. | art; ours uses it: `view/art/selected-1x1.webp` |
| `PeanaBuilding2x2MC.as` | 15 | The outline under a selected 2x2 building. | art; ours uses it: `view/art/selected-2x2.webp` |
| `PeanaBuilding3x3MC.as` | 15 | The outline under a selected 3x3 building. | art; ours uses it: `view/art/selected-3x3.webp` |
| `PeanaBuilding4x4MC.as` | 15 | The outline under a selected 4x4 building. | art; ours uses it: `view/art/selected-4x4.webp` |
| `PeanaBuilding5x5MC.as` | 15 | The outline under a selected 5x5 building. | art; ours uses it: `view/art/selected-5x5.webp` |
| `PeanaBuilding6x6MC.as` | 15 | The outline under a selected 6x6 building. | art; ours uses it: `view/art/selected-6x6.webp` |
| `PeanaBuildingEnemy1x1MC.as` | 15 | The outline under an enemy 1x1 building. | art |
| `PeanaBuildingEnemy2x2MC.as` | 15 | The outline under an enemy 2x2 building. | art |
| `PeanaBuildingEnemy3x3MC.as` | 15 | The outline under an enemy 3x3 building. | art |
| `PeanaBuildingEnemy4x4MC.as` | 15 | The outline under an enemy 4x4 building. | art |
| `PeanaBuildingEnemy5x5MC.as` | 15 | The outline under an enemy 5x5 building. | art |
| `PeanaBuildingEnemy6x6MC.as` | 15 | The outline under an enemy 6x6 building. | art |
| `PeanaBuildingNeutral1x1MC.as` | 15 | The outline under a neutral 1x1 building. | art |
| `PeanaBuildingNeutral2x2MC.as` | 15 | The outline under a neutral 2x2 building. | art |
| `PeanaBuildingNeutral3x3MC.as` | 15 | The outline under a neutral 3x3 building. | art |
| `PeanaBuildingNeutral4x4MC.as` | 15 | The outline under a neutral 4x4 building. | art |
| `PeanaBuildingNeutral5x5MC.as` | 15 | The outline under a neutral 5x5 building. | art |
| `PeanaBuildingNeutral6x6MC.as` | 15 | The outline under a neutral 6x6 building. | art |
| `PeanaEnemyFillMC.as` | 15 | The filled ring under an enemy unit. | art |
| `PeanaEnemyMC.as` | 15 | The ring under an enemy unit. | art |
| `PeanaMC.as` | 15 | The golden ring under a selected unit. | art; ours uses it: `view/art/selected-unit.webp` |
| `PeanaNeutralMC.as` | 15 | The ring under a neutral unit. | art |
| `pixelMC.as` | 15 | A one-pixel mark used to test the map. | art |
| `PreloadingImageMC.as` | 20 | The first loading picture with the version number. | art |
| `ResurrectableMC.as` | 15 | The mark over a fallen unit that can be brought back. | art |
| `ShadowMC.as` | 15 | A unit's shadow. | art |
| `StageBlockerMC.as` | 19 | The cover shown while travelling between maps. | art |
| `Tile2x2.as` | 15 | A 2x2 tile mark, part of `ArrowMC`. | art |
| `TokenMC.as` | 15 | The token that pops out of something collected, to be clicked. | art |
| `TransparenciaEspiaMC.as` | 15 | The see-through cover while spying. | art |
| `TutorialTreesMC.as` | 18 | The tutorial's tree counter. | art |

## Effects in town and battle

| Class | Lines | What it does | Status |
|---|---|---|---|
| `AOEMC.as` | 15 | The area a spell will hit, shown while aiming. | art; ours uses it: `ui/art/spell-area.webp` |
| `BloodPuddleMC.as` | 21 | A pool of blood; stops on its last frame. | art |
| `BloodSpilled2MC.as` | 21 | Spilled blood; stops on its last frame. | art |
| `BlueForceFieldMC.as` | 15 | A blue force field (the dragon hunter's). | art |
| `ConfusedSymbolMC.as` | 15 | The mark over a confused unit. | art |
| `DizzyStarsEffectMC.as` | 15 | Stars over a dizzy unit. | art |
| `DizzyStarsEffectWhiteMC.as` | 15 | White stars over a dizzy unit. | art |
| `DomeRangeBottom.as` | 15 | A dome's range, back half. | art |
| `DomeRangeTop.as` | 15 | A dome's range, front half. | art |
| `DummyArrowMC.as` | 15 | The arrow used when the projectiles' library has none to give. | art |
| `DummyBlastMC.as` | 15 | The blast used when the projectiles' library has none. | art |
| `DummyProjectileMC.as` | 15 | The projectile used when the projectiles' library has none. | art |
| `DummyShockWaveMC.as` | 15 | A stand-in shock wave. | art; no code names it |
| `DummySmokeMC.as` | 15 | A stand-in smoke. | art; no code names it |
| `DummyTrailMC.as` | 15 | The trail used when the projectiles' library has none. | art |
| `EfectoUpgradeMC.as` | 15 | The flash when a unit is upgraded. | art |
| `EnemyFaceMC.as` | 26 | The troll's face on the troll timer, two frames. | art |
| `FuegoBahamutMC.as` | 15 | Bahamut's fire. | art |
| `MagicAttackAdderMC.as` | 15 | The glow of an attack boost. | art |
| `MagicLimitAdderMC.as` | 15 | The glow of a limit boost. | art |
| `puntaRayo2MC.as` | 15 | Another lightning bolt's tip. | art |
| `puntaRayoMC.as` | 15 | A lightning bolt's tip. | art |
| `YellowLargeShieldMC.as` | 15 | A large yellow shield (the ether messiah's). | art |

## Flat pictures (PNG)

Pictures kept as plain PNG files rather than drawn symbols.

| Class | Lines | What it does | Status |
|---|---|---|---|
| `AddNeighbors.as` | 15 | The "add neighbours" banner. | art |
| `AddNeighborsIcon.as` | 15 | The "add neighbours" icon. | art |
| `AudioSheet.as` | 15 | The music and sound buttons, in one picture. | art |
| `BuyButton.as` | 15 | A buy button. | art |
| `CashBuy.as` | 15 | A buy-with-cash button. | art |
| `Centerline.as` | 15 | The middle line on the land-payment tab. | art |
| `CheckBoxA.as` | 15 | A tick box, empty. | art; no code names it |
| `CheckBoxB.as` | 15 | A tick box, ticked. | art; no code names it |
| `CoinBuy.as` | 15 | A buy-with-coins button. | art |
| `CoinsBar.as` | 15 | The coins bar's back. | art |
| `Friends20.as` | 15 | A friends picture. | art; no code names it |
| `Hammer.as` | 15 | A hammer. | art; no code names it |
| `MoneyBar.as` | 15 | The money bar's back. | art |
| `MoreCash.as` | 15 | The "more cash" button. | art |
| `MoreCoins.as` | 15 | The "more coins" button. | art |
| `NewIconImg.as` | 15 | A "new" badge. | art; no code names it |
| `PergaminoMapa.as` | 15 | A parchment map. | art; no code names it |

## Pieces inside other pictures (`SE_Lib_fla`)

Pieces Flash placed inside other pictures (buttons, tabs, small animations). No code names them; each is found by its place in a parent picture. Most have a frame script that only stops or loops the animation.

| Class | Lines | What it does | Status |
|---|---|---|---|
| `SE_Lib_fla/ActivableLive_1025.as` | 21 | A life that lights up when active. | art |
| `SE_Lib_fla/ActivableStar_916.as` | 21 | A star that lights up when active. | art |
| `SE_Lib_fla/AdminProcessedErrors_68.as` | 21 | The admin panel's error list. | art |
| `SE_Lib_fla/ANIMACION_885.as` | 21 | An animation that stops at its end. | art |
| `SE_Lib_fla/AnimacionExplorationLoading_296.as` | 24 | The world map's loading animation. | art |
| `SE_Lib_fla/animMissionCompletado_703.as` | 23 | The "goal done" animation with its reward. | art |
| `SE_Lib_fla/bgd_152.as` | 21 | A background. | art |
| `SE_Lib_fla/brillosANI_501.as` | 21 | A shine animation. | art |
| `SE_Lib_fla/btnEditable_950.as` | 33 | An editable button. | art |
| `SE_Lib_fla/btnRelocate_295.as` | 33 | The move-on-the-world-map button. | art |
| `SE_Lib_fla/buttonAbrirCerrarMuralla_371.as` | 26 | The open/close-wall button. | art |
| `SE_Lib_fla/ButtonAssaulHistory_785.as` | 23 | The attack-history button. | art |
| `SE_Lib_fla/buttonbattlehelp_907.as` | 30 | The battle-help button. | art |
| `SE_Lib_fla/buttonBuyForCash_27.as` | 33 | A buy-for-cash button. | art |
| `SE_Lib_fla/buttonbuynowwithcash_1087.as` | 30 | A buy-now-with-cash button. | art |
| `SE_Lib_fla/buttonbuywithcash_810.as` | 30 | A buy-with-cash button. | art |
| `SE_Lib_fla/buttonbuywithgold_809.as` | 30 | A buy-with-gold button. | art |
| `SE_Lib_fla/ButtonEdit_979.as` | 28 | An edit button. | art |
| `SE_Lib_fla/buttonfbsendmessage_967.as` | 33 | The Facebook send-message button. | art |
| `SE_Lib_fla/buttongetmoremana_1052.as` | 30 | The get-more-mana button. | art |
| `SE_Lib_fla/ButtonGetPrize_947.as` | 33 | The get-prize button. | art |
| `SE_Lib_fla/ButtonGoals_706.as` | 28 | The goals button. | art |
| `SE_Lib_fla/buttongoToStore2_949.as` | 33 | A go-to-shop button. | art |
| `SE_Lib_fla/ButtonHelpMission_713.as` | 28 | A goal's help button. | art |
| `SE_Lib_fla/ButtonHeroeBuy_865.as` | 34 | The buy-hero button, three states. | art |
| `SE_Lib_fla/buttonhirefriends_990.as` | 33 | The hire-friends button. | art |
| `SE_Lib_fla/ButtonInfoMission_711.as` | 28 | A goal's info button. | art |
| `SE_Lib_fla/ButtonLeaveTournament_1040.as` | 29 | The leave-tournament button. | art |
| `SE_Lib_fla/ButtonMarketBuy_147.as` | 26 | The market's buy button. | art |
| `SE_Lib_fla/ButtonMarketSell_146.as` | 26 | The market's sell button. | art |
| `SE_Lib_fla/ButtonMissionReward_709.as` | 26 | A goal's reward button. | art |
| `SE_Lib_fla/ButtonNow_807.as` | 26 | A "now" button. | art |
| `SE_Lib_fla/ButtonOK2_40.as` | 33 | An OK button. | art |
| `SE_Lib_fla/ButtonOk_178.as` | 28 | An OK button, another style. | art |
| `SE_Lib_fla/buttonOpenSpellBook_927.as` | 30 | The open-spell-book button. | art |
| `SE_Lib_fla/ButtonPayMission_712.as` | 30 | The pay-to-finish-goal button, with its price. | art |
| `SE_Lib_fla/buttonPlaceUnits_47.as` | 33 | The place-units button. | art |
| `SE_Lib_fla/ButtonPlayNow_545.as` | 33 | The play-now button. | art |
| `SE_Lib_fla/buttonstartBattle_906.as` | 33 | The start-battle button. | art |
| `SE_Lib_fla/buttonstartloading_908.as` | 33 | The start-loading button. | art |
| `SE_Lib_fla/ButtonStartTournament_1038.as` | 29 | The start-tournament button. | art |
| `SE_Lib_fla/ButtonStartTournamentBig_1041.as` | 29 | The big start-tournament button. | art |
| `SE_Lib_fla/ButtonUniteBuy_33.as` | 31 | The buy-unit button, three states. | art |
| `SE_Lib_fla/cancelCasting_923.as` | 21 | The cancel-spell button. | art |
| `SE_Lib_fla/CountdownTournament_1042.as` | 36 | The tournament room's countdown and status lines. | art |
| `SE_Lib_fla/cross_162.as` | 26 | A cross (close) button. | art |
| `SE_Lib_fla/EnemyArmy_790.as` | 26 | The enemy-army tab. | art |
| `SE_Lib_fla/enterQuestButton_554.as` | 30 | The enter-island button. | art |
| `SE_Lib_fla/fondobufstoreunidadesgrande_516.as` | 21 | The large background behind a unit in the shop. | art |
| `SE_Lib_fla/genericButton_58.as` | 33 | A generic button. | art |
| `SE_Lib_fla/genericButtonMultiline_856.as` | 33 | A generic button for two lines. | art |
| `SE_Lib_fla/genericButtonWide_842.as` | 33 | A generic wide button. | art |
| `SE_Lib_fla/globoamarillo_835.as` | 26 | A yellow balloon (darts). | art |
| `SE_Lib_fla/globoazul_836.as` | 26 | A blue balloon (darts). | art |
| `SE_Lib_fla/globorojo_833.as` | 26 | A red balloon (darts). | art |
| `SE_Lib_fla/globoverde_834.as` | 26 | A green balloon (darts). | art |
| `SE_Lib_fla/GoEnemysWorld_802.as` | 31 | The go-to-enemy's-world button. | art |
| `SE_Lib_fla/Herramientacuadrado_425.as` | 26 | The square-selection tool's hint (space key). | art |
| `SE_Lib_fla/lostitems_1063.as` | 32 | The lost things' window part. | art |
| `SE_Lib_fla/manaBall_925.as` | 21 | A mana ball. | art |
| `SE_Lib_fla/MarcSocial_399.as` | 31 | A social frame, three states. | art |
| `SE_Lib_fla/mcCrossFoto_253.as` | 26 | A cross over a photo. | art |
| `SE_Lib_fla/MCGoldCash_180.as` | 26 | A gold-or-cash picture. | art |
| `SE_Lib_fla/MondayBonusPopUpAssetrewarditem_663.as` | 25 | A Monday chest reward: resources or a unit. | art |
| `SE_Lib_fla/parteArribaGui_450.as` | 31 | The top bar's upper part, with the five rays that count neighbour helps left. | art; ours uses it: one ray (`ui/art/help-ray.webp`) |
| `SE_Lib_fla/PresentadorCara_1005.as` | 26 | The presenter's face, two frames. | art |
| `SE_Lib_fla/Progressfalse_1044.as` | 21 | An empty progress mark. | art |
| `SE_Lib_fla/ResultsBtn_792.as` | 26 | The results button. | art |
| `SE_Lib_fla/spellBookSmall_922.as` | 21 | A small spell book. | art |
| `SE_Lib_fla/sprite187_683.as` | 26 | A labelled button. | art |
| `SE_Lib_fla/sprite241_48.as` | 31 | A labelled button. | art |
| `SE_Lib_fla/sprite280_799.as` | 33 | A labelled button. | art |
| `SE_Lib_fla/sprite280copy3_656.as` | 33 | A labelled button. | art |
| `SE_Lib_fla/sprite284_800.as` | 33 | A labelled button. | art |
| `SE_Lib_fla/sprite293_387.as` | 30 | An unlabelled button. | art |
| `SE_Lib_fla/sprite299_388.as` | 30 | An unlabelled button. | art |
| `SE_Lib_fla/sprite357_1092.as` | 33 | A labelled button. | art |
| `SE_Lib_fla/sprite361_1094.as` | 33 | A labelled button. | art |
| `SE_Lib_fla/sprite4202_432.as` | 21 | A still picture. | art |
| `SE_Lib_fla/sprite420_416.as` | 26 | A two-state picture. | art |
| `SE_Lib_fla/spriteAcceptBtn_480.as` | 33 | An accept button. | art |
| `SE_Lib_fla/spriteshare2_939.as` | 31 | A share button. | art |
| `SE_Lib_fla/StageBlockerInfo_1126.as` | 28 | The travelling cover's text and spinner. | art |
| `SE_Lib_fla/StageBlockerProgress_1127.as` | 26 | The travelling cover's progress. | art |
| `SE_Lib_fla/Symbol19_185.as` | 21 | A part that sends its parent back to its first frame when it ends. | art |
| `SE_Lib_fla/UnitsSavedafterbattle_791.as` | 26 | The units-saved tab after a battle. | art |
| `SE_Lib_fla/useBtn2_154.as` | 21 | A use button. | art |
| `SE_Lib_fla/World_294.as` | 26 | The world icon, two frames. | art |
| `SE_Lib_fla/yellowLargeShield_5.as` | 21 | The large yellow shield's animation. | art |
| `SE_Lib_fla/YourArmy_789.as` | 26 | The your-army tab. | art |

## Third-party libraries

One row per package; Lines is the total of its classes.

| Package | Lines | What it does | Status |
|---|---|---|---|
| `caurina/transitions/` (8 classes) | 2023 | Tweener: moves, fades and scales pictures over time, with its easing curves. About 60 of the game's classes use it (windows opening, things popping). | library: our windows animate with CSS, the map with PixiJS |
| `caurina/transitions/properties/` (2 classes) | 1185 | Tweener's colour and filter shortcuts (tints, glows, blurs). | library |
| `com/greensock/` (5 classes) | 2959 | TweenLite, TweenMax, TimelineLite, TimelineMax and the overwrite rules: a second tweening library, used by about 100 classes. | library |
| `com/greensock/core/` (3 classes) | 499 | TweenLite's inner parts (the tween, the timeline, one tweened property). | library |
| `com/greensock/easing/` (9 classes) | 387 | Easing curves: back, bounce, circle, elastic, exponential, linear, quadratic, quintic, sine. | library |
| `com/greensock/events/` (1 class) | 33 | The event a tween sends. | library |
| `com/greensock/motionPaths/` (4 classes) | 605 | Moving along a path or a circle; the water colossus uses the circle to move round its target. | library |
| `com/greensock/plugins/` (24 classes) | 2035 | TweenLite's plugins: alpha, colour, tint, filters (blur, glow, bevel, drop shadow, colour matrix), bezier and circle paths, frames, rotation, volume and more. | library |
| `com/adobe/serialization/json/` (7 classes) | 758 | Adobe's JSON reader and writer: every command sent and every reply read goes through it. | library: the browser's own JSON |
| `com/adobe/utils/` (1 class) | 112 | Adobe's text helpers (trim, begins with, replace); only the admin panel uses them. | library |
| `com/hurlant/crypto/hash/` (4 classes) | 268 | SHA-256 and HMAC, from the as3crypto library: the game signs what it sends and checks the server's replies with them. | library: our server doesn't check; the client sends a blank signature (`net/commands.ts`) |
| `com/hurlant/util/` (1 class) | 63 | Hex to bytes and back, for those signatures. | library |
| `org/osflash/signals/` (7 classes) | 562 | as3-signals: a light way for one part to tell others something happened (about 30 classes use it). | library |
| `com/wearenan/display/` (2 classes) | 227 | BitmapClip and BitmapFrame: turn a Flash animation into a run of pictures, keeping repeated frames once. Used for projectiles and blasts. | library: our projectiles are sprite sheets (`tools/export_art.sh`) |

## Surprises

Things found here that our notes don't mention, most important first. Only
the fourth would change the save, and it is switched off.

1. **The original gives up on long path searches.** A search that runs over
   50 ms gives no path, so the unit ignores the order, and that unit can't
   search again for 1 to 3 seconds (a random wait) unless the move is a
   forced one. On a slow computer and a crowded town, units in the classic
   game can refuse a far order. Ours always searches to the end.
2. **Walled-off areas are known before searching.** The original keeps a
   map of which open tiles join up (4 ways), rebuilt when a building is
   placed or removed once the town has loaded, and refuses at once a walk
   between two parts. Ours finds the same answer by searching; the result
   is the same, only slower to fail.
3. **A unit file with attack data exists but is never used.** The client
   can read a unit file that packs the sprite with its attacks (blows that
   throw in the air, shots with speed, curve and offsets, scripted
   actions), but nothing starts that loader. All 1,586 sprites in
   `assets/buildingsprites/` are plain compressed .swf files (the 1,587th,
   the Bahamut Heart, is empty), so the art pipeline misses nothing. The
   attacks' rules live in the units' delegates instead ([delegates.md](delegates.md)).
4. **Cross-promotion rewards are switched off by the page.** The icon shows
   only when the web page sets a level for it and the player has reached
   it; a finished promotion puts a unit in storage (by default 2037 for
   Dragon City, 2048 for Social Wars, from level 10). Our page doesn't set
   it, so it never shows.
5. **The speech bubbles' art is here.** The bubbles units say now and then
   (CLIENT.md, "Units walking", not yet) are `BS_MC`, made of `BubbleSpeech`
   and `BubbleSpeechText`, one per unit, ready for `export_ui.py`.
