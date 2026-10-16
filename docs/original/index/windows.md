# Windows (popups)

These are the Flash client's windows: everything that opens over the map,
from a one-line warning to the dragon nest, the sea map and the tournament
rooms. Most of them only show what the rest of the game knows and send one
or two commands when the player picks something; a few hold rules of their
own (prices, timers, what a prize is), and those are noted in the rows.
They are opened through `managers/PopupManager.as`, another part of this map.

**Count:** 63 built, 11 partly, 34 not yet, 23 not needed, 5 art (136 classes).

**How deep this was read.** Every window was read, skipping the button
wiring, tweens and text-field set-up. The bigger ones (market, goals,
level-up, bonuses, darts, graveyards, nests, riders, temple, social
buildings, quests, attacks, survival and the team window) were read through.
The tournament list, team editor, room, results and all their cards, rows
and tabs were reread for the complete feature (see `rules/tournaments.md`).
The five picture classes in `popupKompuGacha/` were read by their fields. Whether a window
is ever opened was checked by searching for who calls its `PopupManager`
function. Prices and counts come from the classes and from
`config/game_config_20120826.json`.

**Words used here.** "Not needed: nothing opens it" marks a window still in
the client that no code reaches (or only Social Point's admin panel), so it
is dead in the original too. The new client's windows are in
`client/src/ui/`, with their rules in `client/src/rules/`; the server's side
of a command is named when it's in its own file. A few rows say "not yet"
though the classic game on our server doesn't show the window either (the
potion offer, buying a place on the player-attack world); the row says why.

## Messages, confirmations and help

The plain boxes the rest of the game opens.

| Class | Lines | What it does | Status |
|---|---|---|---|
| `popups/AlertPopup.as` | 71 | The plain message with an OK button (or none), used for most of the game's warnings; it can run something when closed. | built: `ui/notice.ts` and the bar's messages |
| `popups/ConfirmPopup.as` | 86 | A yes-or-no question, with what to do on each answer. | built: the bar's prompts (`ui/actions.ts`, `editor.ts`) |
| `popups/PopupAlerta.as` | 67 | A message with a title and one of the game's pictures; used for a camp's end and similar news. | built: `ui/notice.ts` (with a picture) |
| `popups/PopupHelp.as` | 79 | A help page with a title, text and an optional picture. It also keeps the list of help pages the player has seen (`privateState.helpMap`), adding to it with `set_help_map`, so some pages show by themselves only the first time. | partly: first-time survival and tournament help saved with `set_help_map`; other windows later |
| `popups/PopupRewardsGeneric.as` | 143 | A "you won" window with gold or cash and up to two items; used by darts, unit collections and tournaments. It gives nothing itself. | partly: notices show camp/chest prizes and `ui/tournamentResults.ts` shows server-paid tournament prizes; darts and unit collections remain classic |
| `popups/PopupLore.as` | 148 | A picture book, page by page: the story of the gods and colossi, opened from the news and from a gods icon at the side of the screen. | not yet |
| `popups/PopupMoreCash.as` | 63 | "Not enough cash", with a button to the page that sold cash. | not needed: payments |
| `popups/tournament/Alert.as` | 69 | A small yes/no or OK box drawn inside another window; used by the temple, the team window and tournaments. | built: our windows ask in their own way (`questPlay.ts`) |

## The town: buildings, work and land

| Class | Lines | What it does | Status |
|---|---|---|---|
| `popups/PopupCollect.as` | 177 | Choosing a mill's or mine's working time: four cards (5 min, 1 h, 4 h, 8 h) paying half, one, two and three times the harvest; sends `activate` with the choice (0 resets it). Which buildings ask is `COLLECT_VARIABLE_IDS`. | built: `rules/production.ts` (`WORK_TIMES`), `editor.ts` |
| `popups/PopupHurryup.as` | 115 | Finish a building's work now for 2 cash (`COST_HURRY_UP`), or ask friends; shows the time left, ticking. | built, on the card: hurry and Ask friends in `ui/actions.ts` (DECISIONS.md) |
| `popups/PopupUnlockBuilding.as` | 81 | Open a building before its level for a third of that level in cash, rounded up; sends `unlock_building`. | built: `rules/shop.ts` |
| `popups/MaxBuildingTypePopup.as` | 96 | "You already have the most of these": one of each mill and mine level, one of each special building, one market and one eagle, three nurseries. | built: `rules/shop.ts` (`atLimit`) |
| `popups/PopupNeighbors.as` | 90 | "You need more neighbours" when land paid in gold needs more neighbours than the player has, with a button to invite friends. | built: `rules/land.ts` says why; the invite was Facebook's |
| `popups/PopupNoTownhall.as` | 63 | At start, "you have no town hall"; in an attack, the enemy has none and the attacker wins at once. | not yet: ours says nothing when the town hall is missing |
| `popups/EnterNamePopUp.as` | 229 | Renaming the town (three letters at least, Enter saves); sends `name_map` and shows the name in the top bar. | built: `ui/rename.ts`, from the level at the top |
| `popups/PopUpLost.as` | 154 | A lost thing found on the map (cow, sheep, knight, crate, barrel...): the story, then the thing is taken off the map. Its only other effects are a call to `register_found_item.php` and a Facebook post; it pays nothing and saves nothing. | not yet: no lost things on our map |
| `popups/PopupMarket.as` | 104 | The market: buy or sell 100, 200 or 300 wood, stone or food (by the market's level) for gold; shows the trades left of 20. | built: `ui/market.ts`, in the panel; `market.py` on the server |
| `popups/ButtonMarket.as` | 133 | One market button. Price: the base (food and wood 100, stone 150 gold per 100) plus 2% for each net purchase so far (from -25 to +200); selling pays three quarters. Sends `trade_resource_b`; counts toward the market goal. | built: `rules/market.ts`; `market.py` uses the same sums |
| `popups/PopupSelectResource.as` | 94 | The allied market's choice of resource (wood, stone, food or gold, 125 per ally); sends `set_resource_allies` and starts its 24-hour clock. | not yet; `social.py` |
| `popups/PopupWeather.as` | 148 | The weather machine: six looks for the island; one is free, the others 20 cash each to unlock (`unlock_skin`), then `set_skin` and the town reloads. | not yet; `shop.py` |
| `popups/PopupUnitWarehouse.as` | 259 | The unit warehouse: stored units in pages of 18, Use puts one back beside the building (`place_warehoused_item`) if there is room for people and under the unit's limit; one more slot for 2 cash (`buy_warehouse_capacity_single`), up to 1,000. | not yet; `warehouse.py` |
| `popups/tournament/UnitWarehouseCard.as` | 55 | A card in the unit warehouse: the unit's picture, its name on hover. | not yet (with the warehouse) |
| `popups/PopupSelectTime.as` | 241 | The time machine: buy time packs (30 min to 1 day, 2 to 75 cash; `buy_time_packet`) and use one (`time_ff`), which reloads the town moved forward. Shows its help by itself the first time. | not yet; `time_machine.py` |
| `popups/PopupHelpTimeMachine.as` | 74 | The time machine's help page, recording it as seen with `set_help_map`. | not yet |
| `popups/PopupExpand.as` | 126 | "Congratulations" after buying land, to share on Facebook. | not needed: Facebook share; the land itself is built (`rules/land.ts`) |
| `popups/PopupBuilding.as` | 128 | "Congratulations" for a building: half the time a building is bought for the first time (always for a unit), and when a social building opens. Only offers a Facebook share. | not needed: Facebook share |

## Goals, levels and bonuses

| Class | Lines | What it does | Status |
|---|---|---|---|
| `popups/MissionPopup.as` | 869 | The goal box on the left (two goals, the host, a "new" badge on goals 6 to 9), the list of five at a time with how far each is, a window per goal with its picture, text, reward and a help arrow for building goals, the "goal done" animation, and the raid warning banner (5 seconds, with a button to look). The Pay button is hidden: `CAN_PAY_FOR_GOALS` is off. | partly: `ui/goals.ts` has the card, the list, the "Click here!" tag and "New Mission!"; `ui/goalWindow.ts` the window per goal, its picture and HELP!'s arrow; no "goal done" animation |
| `popups/PopupLevel.as` | 181 | The level-up window: the new level, its prize, up to four buildings it opens, and mana from level 36. The window itself adds the prize to the player's numbers when it opens. At level 20 it shows the way to the other towns; at level 5, with the princess still prisoner, it points at her camp. | partly: `ui/levelUp.ts`, one window per level, with prizes from `rules/levels.ts`; the level 5 and 20 pointers not yet |
| `popups/PopupNewDaily.as` | 459 | The daily bonus: five days of gold, cash or a hero, today's highlighted; the day comes from `bonusNextId` or the server's count of days in a row. Sends `win_bonus`. | built: `rules/bonuses.ts`, `bonuses.ts` |
| `popups/MondayBonusPopUp.as` | 186 | Monday's chest: three closed chests, one prize drawn at random from gold, a unit or cash; the unit is drawn from `MONDAY_BONUS_UNITS` and stored. Sends `weekly_reward`. | built: `rules/bonuses.ts` |
| `popups/ComebackBonusPopUp.as` | 276 | The welcome-back chest on the second and third day, drawn the same way, the day's own unit from `COMEBACK_BONUS_UNITS`. Sends `comeback_reward`. Switched off in the client as built; our classic game switches it on. | built: `rules/bonuses.ts` |
| `popups/PopupDarts.as` | 463 | Darts: 25 balloons hiding 6 prizes (2 rare, once each; 2 uncommon, 4 each; 2 common, 7 and 8), shuffled with a saved seed; one free dart a day, then 20 cash; a bonus item once all six are found. Sends `darts_shoot_balloon`; on start, by itself, `darts_reset` for a new round and `darts_new_free` on a new day. | not yet; `darts.py` |

## Army, graveyards, heroes and magic

| Class | Lines | What it does | Status |
|---|---|---|---|
| `popups/PopUpBattleOptions.as` | 192 | The army and the defence plan: the units in town, and four plans for when another player attacks (all stay, archers against siege, half go out, all go for the siege engines). Sends `set_strategy` on closing if it changed; choosing one also completes a goal. | built: the Army window's two tabs (`ui/army.ts`) |
| `popups/PopUpYourArmie.as` | 92 | A list of the units in town with how many of each. | not needed: nothing opens it; `ui/army.ts` shows the same |
| `popups/PopupGraveyard.as` | 479 | The Graveyard: fallen units of the town's race, six to a page; bring one back for potions, or for half its price (and, for gold units, its whole price in food); checks room for people and the unit's limit. Sends `resurrect_hero`; potion packs for cash (`graveyard_buy_potions`). | built: `ui/graveyard.ts`, `rules/graveyard.ts`; no asking friends for potions |
| `popups/PopupHeroes.as` | 362 | The Altar of Heroes: the eight heroes, each from its level, for cash (`buy_cash`), placed beside the altar. | built: `ui/graveyard.ts` (`AltarWindow`) |
| `popups/PopupResurrectHeroes.as` | 117 | The Heroes' Graveyard: fallen heroes back for 500 gold per cash of their price (`resurrect_hero`). | built: `ui/graveyard.ts` |
| `popups/PopupWizardry.as` | 249 | The Wizardry Academy's spell book: spells by level, six to a page, a preview of each, and the mana counter. | built: `ui/spells.ts` |
| `popups/PopupMagic.as` | 321 | The spell book in battle: the spells learnt, three at a time round the book, and mana; Crack and Black Hole are off in tournaments. | built: `ui/spells.ts` |
| `popups/PopupBuyMana.as` | 128 | 5 mana for 20,000 gold or 1 cash (`buy_mana_new`). | built: `ui/spells.ts` |
| `popups/PopupBuyGold.as` | 79 | 2,500 gold for 5 cash (`exchange_cash_new`). | built: `ui/bank.ts`, `main.ts` |
| `popups/PopupAllUnits.as` | 579 | The units book (unit collections): units by category, grey until owned; buy a missing one for cash (`buy_stored_item_cash`); a full category pays a reward unit and 1 cash (`unit_collections_completed`). | not yet; `shop.py` |
| `popups/PopupRecover.as` | 103 | A list of units recovered after a fight, filled with test data. | not needed: only Social Point's admin panel opens it |
| `popups/PopupHeavySiege.as` | 108 | The heavy siege: wait, attack now, or pay 20 cash to send it away. | not needed: switched off (`Config.HEAVY_SIEGE`) |

## Dragons, monsters and the temple

| Class | Lines | What it does | Status |
|---|---|---|---|
| `popups/PopupInactiveNest.as` | 164 | A dragon or monster nest not yet woken: 100,000 gold or 50 cash (`activate_dragon`, `activate_monster`). | built: `client/src/ui/nest.ts` |
| `popups/PopupDragons.as` | 643 | The dragon nest: six dragons in turn, ten steps each (care and feed), one step every 6 hours, the wait skipped for 3 or 15 cash; friends' help counts as steps (`finish_dragon_help`). Sends `next_step`, `buy_step_cash`, `next_dragon`; after the sixth the nest goes back to sleep (`desactivate_dragon`). | built: `client/src/ui/nest.ts`, rules in `client/src/rules/nest.ts` |
| `popups/PopupHireFriendsGeneric.as` | 120 | The friends who helped at the nest, shown inside the nest's window. | partly: a "Congratulations!!" with OK takes the steps, without the friends' pictures (`client/src/ui/nest.ts`) |
| `popups/PopupMonstersNest.as` | 500 | The monster nest: four monsters, ten steps each, 6 hours apart, 7 cash to skip; no friends' help. | built: `client/src/ui/nest.ts` |
| `popups/PopupDragonRiders.as` | 317 | Choose one of three dragon riders (from levels 35, 40 and 45); hovering shows the dragons each can ride and what riding adds (attack +15/20/25, life +100/150/200). Sends `rider_select`. | not yet |
| `popups/PopupDragonRiderTraining.as` | 342 | Training the rider: 5 to 7 steps, each a mini-game, 15 hours apart, 15 cash to skip; then the rider comes out (`rider_next_step`, `rider_buy_step_cash`). After one paid skip a "Fast train" button lets every later step skip the mini-game. | not yet |
| `popups/PopupDragonTaming.as` | 375 | Dragon taming: put a rider and a dragon of the same rider type inside, win a mini-game, and they become one tamed dragon. | not yet |
| `popups/PopupBahamutSupremeInvocationTemple.as` | 816 | The Supreme Bahamut temple: 12 offerings (100,000 each of gold, stone, wood and food; 50 mana; 50 cash; five big dragons sacrificed; one finished collection), one every 48 hours, the wait skipped for 5 cash; then the final dragon is placed free and the temple starts over. Sends `next_temple_step`, `buy_temple_step_cash`, `reset_temple`. | not yet; `temple.py` |
| `popups/invocationtemple/InvocationStep.as` | 227 | One offering on the temple's strip: its picture or prices, a tick when done. | not yet |
| `popups/SelectYourDragonPopup.as` | 169 | After the tutorial (`POPUP_CHOOSE_YOUR_DRAGON` is on): pick one of three baby dragons, placed free. | built: `client/src/ui/draggy.ts`, `client/src/lessons.ts`; mandatory, retry-safe saved reward |
| `popups/SelectYourDragonReminderNestPopup.as` | 93 | Then a pointer to the dragon nest. | built: `client/src/ui/draggy.ts` |

## Social buildings and neighbours

| Class | Lines | What it does | Status |
|---|---|---|---|
| `popups/PopupSocialBuilding.as` | 459 | A building that needs a staff (the Summit, the allied markets, the Wonder...): friends fill places, or a place costs cash (`buy_si_help`); when full it opens (`finish_si`). The Summit then brings allied troops (it needs room for 9 people); the allied market shows its resource and clock. | not yet; `social.py` (the harbour and zeppelin get theirs free: `rules/dock.ts`) |
| `popups/PopupRecruitment.as` | 482 | The recruitment camp: friends recruited fill places; when full it gives the reward units beside it (`finish_si`). | not yet |
| `popups/PopupRecruitmentPopulation.as` | 360 | The wonder of people: every 4 friends hired adds 10 to the room for people, up to 5 times (`increase_population`). | not yet |
| `popups/PopupSocialFeeds.as` | 385 | The Round Table: post to friends one by one (`assist_send_feed`, at most 60); when it is ready, 4 answers pay 1,000 gold, 6 add 100 XP, 8 an item (`finish_si`, then `collect_new`). | not yet; `helps.py` |
| `popups/PopOverVisit.as` | 84 | The little menu on a neighbour's picture: Visit, Attack (not for Arthur) and Send gift. | partly: Visit and Attack (from level 6) in `ui/neighbours.ts`; no Send gift |
| `popups/AssistPopup.as` | 152 | On a visit to a neighbour not helped for 24 hours: a task picked at random from the config's `neighbor_assists`, OK, a short bar, then 10 gold and 3 XP (`assist_neighbor`). | not yet: `visit.ts` has the building helps but not this request (see `core.md`, surprise 2) |
| `popups/infoFriendAssistPopup.as` | 101 | A neighbour's donkey cart: let it in to go round the buildings helped, or turn it away. | built: `editor.ts` (`welcomeCarts`), `rules/neighbours.ts` |
| `popups/PopupInviteFriends.as` | 133 | Pick Facebook friends to send a gift to. | not needed: Facebook, and nothing opens it |
| `popups/PopupMobileGifts.as` | 167 | Items earned in the iPhone app, to place. | not needed: iPhone app |
| `popups/PopupMobileStorage.as` | 44 | "New iPhone items in storage". | not needed: iPhone app, and nothing opens it |

## Quests and the islands

| Class | Lines | What it does | Status |
|---|---|---|---|
| `popups/PopupQuestsManager.as` | 521 | The sea map: seven pages of islands with stars, padlocks by level and by the last island won, Enter. Islands with teams open the team window; the zeppelin's islands need the tower. Opening it pauses the game. It treats the harbour as always there. | partly: `ui/islandMap.ts`; some islands still sail in the classic game |
| `popups/PopupHelpIsland.as` | 85 | The help page for the sea map (and for the player-attack world, with its prize), shown by itself the first time and recorded with `set_help_map`. | not yet: no first-time help on `ui/islandMap.ts` |
| `popups/quests/NewQuestIslandButton.as` | 57 | One island's ribbon on the sea map: stars, padlock, level lock. | built: `ui/islandMap.ts` |
| `popups/PopupLoadingQuest.as` | 386 | The start window: the island's picture and story, the stars to pick (two needs one star won, three needs two), Start once loaded. | built: `questPlay.ts` |
| `popups/PopupQuestFinished.as` | 324 | The end of an island: won or lost (bosses have their own picture), gold and XP, units lost; then home. | built: `questPlay.ts`; no Facebook share |
| `popups/PopupQuestInfo2.as` | 239 | A home camp's story, at its start and its end, then the treasure message. | built: `homeCamps.ts`, `homeScripted.ts` |
| `popups/PopupEncampment.as` | 118 | An older camp story window, one text per camp type. | not needed: nothing opens it (`PopupQuestInfo2` took its place) |
| `popups/tournament/SelectionTeamWindow.as` | 867 | The team of up to 20 for islands with teams and for tournaments: units from everything the player owns (counted to each unit's limit), strongest first; god islands need some gods or colossi. Saved with `set_attack_team`, also silently each time it opens. Tournaments forbid some units and limit the "complex" ones. | partly: tournament pool, limits, restoration and save in `rules/tournaments.ts`, `ui/tournaments.ts`; quest pool still limited to standing units |
| `popups/tournament/ThumbUnit.as` | 125 | A unit card in the team window, with how many are left. | built: counted choices in the quest and tournament pickers |
| `popups/tournament/ThumbSelectedUnit.as` | 68 | A chosen unit in the team window; a click gives it back. | built: removable selected units in the quest and tournament pickers |

## Attacking other players

Player battles are for the last stop ("The switch"); the World window sends players to the classic game for them.

| Class | Lines | What it does | Status |
|---|---|---|---|
| `popups/popupLoadingAssault.as` | 249 | Before an attack or a spy visit: loading, a help page, Start. A switch lets the attacker pick a start corner. | partly: the start corner in `attackPlay.ts` (a 5 x 5 map to pick from), and the spy visit's start with its words; no help page |
| `popups/PopupAttackFinished.as` | 609 | After an attack: both sides' units alive and dead, gold, XP and honour won, what was lost; Revenge for the defender. Pauses the game. | partly: the attacker's results in `attackPlay.ts` (gold, XP, honour, units lost); from the history, both sides' reports and Take Revenge!! in `ui/attackHistory.ts`; no sharing |
| `popups/PopupAssaultHistory.as` | 175 | The last ten attacks made and received, with gold and result; More info replays the report. On opening the town with an attack received and not yet seen, it opens by itself, sends `clean_attacks`, and shows the town hall and up to five buildings at half life. | built: `ui/attackHistory.ts`, `burnOnReturn` in `rules/pvp.ts` |
| `popups/PopupPlayerProfile.as` | 228 | A player's profile: level, honour and rank, wins and losses, last seen, country; the honour ranks. | not yet |
| `popups/PopupNextIslandAttack.as` | 182 | The player-attack world's progress prizes (cash and items, `apply_rewards_ranking`), or a unit collection's reward. | partly: the world's prize window in `ui/worldMap.ts`; not the unit collection's |
| `popups/PopupBuyTerritoryPvp.as` | 101 | Buy a place on the player-attack world for 5 cash (`buy_pvp_territory`). | not yet: our server doesn't handle `buy_pvp_territory` either |
| `popups/PopUpBuyAssault.as` | 100 | Out of attacks or spy visits: wait, or buy 50 for 30 or 15 cash. | not needed: nothing opens it |

## Survival

| Class | Lines | What it does | Status |
|---|---|---|---|
| `popups/PopupSurvival.as` | 591 | The survival arena: five maps (two open, three "coming soon"), three lives that come back one every 3 hours, more for 3 cash (`add_survival_vida_extra`), maps unlocked for cash (`buy_survival_map`); the army is the 30 strongest units, picked by attack. | built: `ui/survival.ts` (the unlock button hidden, as there) |
| `popups/PopupLoadingSurvival.as` | 80 | Survival's loading window; Start sends `start_survival`. | built: the start window in `survivalPlay.ts` |
| `popups/PopupSurvivalResults.as` | 126 | How long the army lasted and the prizes; closing stores them and sends `end_survival`. | built: the results in `survivalPlay.ts` |
| `popups/survival/WindowSelectionUnitsSurvival.as` | 485 | A window to pick the survival army by hand. | not needed: nothing opens it (the army is picked automatically) |
| `popups/survival/ThumbUnit.as` | 119 | A unit card in that window. | not needed (with it) |
| `popups/survival/ThumbSelectedUnit.as` | 82 | A chosen unit in that window. | not needed (with it) |

## Tournaments

Tournaments run through their own server addresses (`tournaments/<name>.php`, handled by `tournaments.py`), not `command.php`.

| Class | Lines | What it does | Status |
|---|---|---|---|
| `popups/tournament/PopupTournament.as` | 439 | The tournament list: everyday, weekly and the player's own; the team at the bottom; its help shows by itself the first time. | built: list, help, team and entry in `ui/tournaments.ts` |
| `popups/tournament/CreateYourTournamentWindow.as` | 179 | Pick a kind of tournament to create for friends. | built: public-type chooser in `ui/tournaments.ts` |
| `popups/tournament/ThumbTournament.as` | 308 | One tournament card: picture, entry cost, prizes, Enter. | built: original picture, fee, server-selected prize and entry checks in `ui/tournaments.ts` |
| `popups/tournament/ThumbTournamentCreation.as` | 192 | One kind of tournament in the create window. | built: original cards and selected type in `ui/tournaments.ts` |
| `popups/tournament/ThumbFriendsTournament.as` | 228 | The card for creating a tournament with friends. | built: original picture, team checks and creation in `ui/tournaments.ts` |
| `popups/tournament/ThumbWeeklyTournament.as` | 234 | A weekly tournament's card, with its countdown when closed. | built: weekly visibility/countdown, entry exceptions and prize information in `ui/tournaments.ts` |
| `popups/tournament/ThumbWeeklyTournamentPrize.as` | 74 | One prize in a weekly tournament's list. | built: original icons and unit thumbnails in `ui/tournamentResults.ts` |
| `popups/tournament/WeeklyTournamentInfoWindow.as` | 110 | A weekly tournament's prizes by rank. | built: ten-rank preview in `ui/tournamentResults.ts` |
| `popups/tournament/PopupTournamentRoom.as` | 338 | The waiting room: four players, a minute until refresh, searching; the creator can cancel or invite. | built: seats, refresh clock, Start, leave/cancel and Invite in `ui/tournaments.ts` |
| `popups/tournament/PlayerInfoTournament.as` | 87 | One player in the room (bots have their own picture). | built: names/levels and original bot portraits; human initials follow the site's neighbour pattern |
| `popups/PopupLoadingTournament.as` | 131 | A tournament match loading; Start calls the tournament service. | built: original start step after art loading and fresh room validation in `tournamentPlay.ts` |
| `popups/tournament/PopupTournamentFinished.as` | 63 | A match won or lost, with the score. | built: original result pictures, score and confirmed server save in `tournamentPlay.ts` |
| `popups/tournament/PopupTournamentResults.as` | 345 | The tournament's matches and results, its end countdown, then the prize if won. | built: `ui/tournamentResults.ts`; server-paid prize stays visible until Done acknowledges it |
| `popups/tournament/TournamentResultTabMatches.as` | 128 | The matches tab: each player's team and Play. | built: enrolled teams, outgoing matches, pending/played state and Start in `ui/tournamentResults.ts` |
| `popups/tournament/TournamentResultTabResults.as` | 126 | The results tab: score board and ranking with prizes. | built: public score board, weekly top ten/own rank and prizes in `ui/tournamentResults.ts` |
| `popups/tournament/TournamentMatchRow.as` | 24 | One row of the matches tab. | built: `ui/tournamentResults.ts` |
| `popups/tournament/TournamentScoreBoardRow.as` | 18 | One row of the score board. | built: points, played count and duration in `ui/tournamentResults.ts` |
| `popups/tournament/TournamentRankingRow.as` | 93 | One row of the weekly ranking, with its prize. | built: numerically ordered ranks and configured prizes in `ui/tournamentResults.ts` |
| `popups/tournament/TournamentRankingUserRow.as` | 102 | The player's own ranking row. | built: separate own rank, including outside the top ten, in `ui/tournamentResults.ts` |
| `popups/tournament/TournamentPlayerData.as` | 116 | A tournament player's data (no window). | built: typed rooms/matches and score helpers in `rules/tournaments.ts` |
| `popups/tournament/RecuadroTeamTournament.as` | 98 | The team box in the tournament window. | built: twenty-place team box in `ui/tournaments.ts` |
| `popups/tournament/AlertInviteTournament.as` | 47 | A tournament invitation, yes or no. | built/adapted: neighbours accept by entering from Your own; Invite opens the site's Everybody community page, without Facebook start-up delivery |

## Shop offers, collections and news

| Class | Lines | What it does | Status |
|---|---|---|---|
| `popups/PopupArabicDeals.as` | 293 | The Morocco dealer: four random cash buildings at 20% off, haggle for 5% more a time (2 to 5 times before he leaves), buy all four (`add_items_store`). | not needed: he only comes to a "gold member" page, which ours isn't (see `core.md`) |
| `popups/PopupGetPack.as` | 86 | An offer pack for cash. | not yet; `shop.py` |
| `popups/PopupGotPack.as` | 67 | "You got the pack". | not yet |
| `popups/PopupMistery.as` | 103 | A mystery pack: one prize from four (rare to common) for cash. | not yet |
| `popups/PopupSuperMistery.as` | 447 | A super mystery box: one, two or four random prizes for three prices in cash; its XP on closing. | not yet |
| `popups/PopupNews.as` | 613 | The news: ten items turning every 6 seconds, offer packs, links to the shop and the lore. | not yet: left out by the owner's call (PARITY.md) |
| `popups/popupCollections.as` | 330 | Collections: pieces found, three collections a page; trade a full one for its reward or finish it for cash (`finish_collection`). | not yet; `game_collections.py` |
| `popups/PopUpCollectionComplete.as` | 101 | "Collection complete", to share. | not needed: Facebook share |
| `popups/kompu/PopupKompuGacha.as` | 393 | A timed potion offer: three wizards (free, gold, cash) try to brew; enough potions win prizes, then a big unique one. | not yet: our server sends no offer and doesn't serve `kompu_try.php`, so neither game shows it |
| `popups/kompu/PopupKompuResult.as` | 204 | A brewing try: working, then success or failure. | not yet |
| `popups/kompu/PopupKompuRewardGiven.as` | 82 | A potion prize won. | not yet |
| `popupKompuGacha/FooterMC.as` | 43 | The potion offer's footer (picture). | art |
| `popupKompuGacha/ProgressBarMC.as` | 21 | Its progress bar (picture). | art |
| `popupKompuGacha/RewardBigMC.as` | 30 | Its big prize frame (picture). | art |
| `popupKompuGacha/TryButtonMC.as` | 23 | Its try button (picture). | art |
| `popupKompuGacha/TryButton/ButCostMC.as` | 22 | The price on that button (picture). | art |
| `popups/cross/PopupCrossPromotion.as` | 157 | Free dragons for playing Dragon City or Social Wars (`cross_promotion_finished`). | not needed: adverts for other games |
| `popups/cross/PopupPlayNow.as` | 83 | "Play the other game now". | not needed |
| `popups/cross/PopupCrossRewardGiven.as` | 77 | The other game's reward given. | not needed |
| `popups/cross/CrossViralIcon.as` | 26 | The other game's icon. | not needed |

## New towns, the tutorial and Facebook

| Class | Lines | What it does | Status |
|---|---|---|---|
| `popups/PopupRaceSelector.as` | 199 | A second town from level 20: human or troll, 100,000 gold or 22 cash (`buy_map`); later, travel between towns. | built: `ui/towns.ts`, in the panel (troll town only, as the original's choice was never wired) |
| `popups/PopupNewTown.as` | 119 | "Congratulations" on the first town, to share. | not needed: Facebook share |
| `popups/PopupNewMap.as` | 105 | "Congratulations" on a new town, to share. | not needed: Facebook share |
| `popups/TutorialPopup.as` | 105 | A tutorial lesson, page by page (`game_status` "Tutorial Popup Created"). | built: `client/src/ui/lessons.ts`; owner-requested clearer mandatory flow and recovery |
| `popups/PopupMotivation.as` | 91 | The tutorial's opening and closing words. | not yet |
| `popups/PopupInstall.as` | 42 | "Add the app" on Facebook. | not needed: Facebook |

## Surprises

Rules and behaviour found in these windows that our notes don't mention,
most important first. (The lost things, the heavy siege, the Morocco dealer
and the neighbour's arrival request are in `core.md`.)

1. **Attacks received open by themselves.** When the town opens with an
   attack by another player not yet seen, the attack history opens on its
   own and sends `clean_attacks`, and, whatever the outcome, the town hall
   and up to five other buildings (not walls or decorations) are set to
   half their life, so the town looks hit. The new client does none
   of this; the attacks stay unseen until the classic game opens.
2. **Darts move on by themselves at start.** On the first start of a
   session the classic game checks the darts: a new round (the config's
   dates) sends `darts_reset` with a new seed, and a new day sends
   `darts_new_free`, both with no button, then offers the free dart.
3. **The defence plan.** The army window has a second tab with four
   defence plans for when another player attacks (all stay, archers go for
   siege engines, half go out, all go for siege engines). The choice is
   saved (`set_strategy`, `privateState.strategy`; half out by default),
   and making one completes a goal. Nothing in our notes or the new client
   has it.
4. **The team window saves itself.** Each time the team window opens it
   rebuilds the saved team from the units still owned and sends
   `set_attack_team` at once, before the player picks anything. Ours saves
   the team only when it sails.
5. **"Conquer" on the player-attack world.** The window takes 5 cash and
   marks the place won in the classic game, but our server has no
   `buy_pvp_territory`: nothing is saved, so after a reload the place isn't
   won (and the cash comes back).
6. **The start-up windows come in a fixed order**, one after another: the
   daily bonus (level 5 and up, human town), then the potion offer or the
   news (half the time each, when an offer runs), a tournament invitation,
   darts, the heavy siege, a camp story held back, "no town hall", the
   harbour and zeppelin check (and, on day 1, a pointer to the princess's
   camp), and last the server's message.
7. **The level-up window does things.** It adds the level's prize itself
   when it opens. Closing it at level 20 shows the button for other towns;
   at level 5, with the princess still a prisoner, it starts a pointer to
   her camp.
8. **The nests advance when their window opens.** Opening the dragon or
   monster nest moves to the next creature if the steps are past ten
   (`next_dragon`, `next_monster`), and after the last one puts the nest
   back to sleep (`desactivate_dragon`, `desactivate_monster`), with no
   button.
9. **The temple's collection step keeps the piece.** The last offering only
   checks that the collection's reward is in storage; it is taken (sold,
   `sell_stored_item`) only when the final dragon is claimed and the temple
   starts over, and only if it's still there. Each offering waits 48 hours
   (an unused 6-hour figure sits beside it).
10. **A shortcut left in the dragon riders' training.** After paying once to
    skip a wait, a "Fast train" button (in English, not from the language
    file) appears and skips the mini-game for every later step of the
    session.
11. **Survival picks the army itself**: the 30 strongest units by attack.
    A window to pick them by hand exists but nothing opens it. Only the
    first two of the five maps can be played; the other three say "coming
    soon", though two of them have unlock prices (20 and 30 cash).
12. **The daily-bonus goal counts when the window opens**, not when the
    prize is taken (the window has no close button, so in practice it's the
    same).
13. **Weather looks skip number 3** (the six are 0, 1, 2, 4, 5 and 6), and
    choosing one reloads the town.
14. **Dead windows:** buying attack and spy packs, the old camp story, the
    army list, inviting friends, the iPhone storage notice, survival's hand
    pick, and the recovered-units list (admin only) are never opened.
