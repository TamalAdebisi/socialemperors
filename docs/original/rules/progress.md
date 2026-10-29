# Levels, goals, bonuses and the shop

How the original Flash client (the copy in `decompiled/`, version 0.9.26b)
handles experience and levels, the goals on the left of the screen, the
daily bonus and the two chests, the shop and its cash prices, the market,
the game's own cash trades, the second (troll) town and renaming. Each rule
says what the original does, in our words, then how the new client
compares. Our notes, not Social Point's code.

**What was read.** Read through: `managers/MissionsManager`,
`managers/PlayerStatus`, `managers/TownManager`, `popups/MissionPopup`,
`popups/PopupLevel`, `popups/PopupNewDaily`, `popups/MondayBonusPopUp`,
`popups/ComebackBonusPopUp`, `popups/PopupUnlockBuilding`,
`popups/PopupHurryup`, `popups/PopupMarket`, `popups/ButtonMarket`,
`popups/PopupBuyGold`, `popups/PopupBuyMana`, `popups/PopupMoreCash`,
`popups/PopupRaceSelector`, `popups/EnterNamePopUp`, `GUI/BuildingWindow`,
`GUI/ItemButtonLarge`, `core/Config`, and the goal table in
`core/Constants` (all 228 places, turned into numbers and compared with
`goals.json` by a script). Read in the parts that matter here:
`core/Base` (loading the save, the frame loop, the goals switch, the
bonuses' days, the market's counter, buying gold and cash),
`managers/PopupManager` (the level-up window, the start-up windows, money
warnings, the town window), `managers/GameDataManager` (the config
tables), `GUI/GuiManager` (level up, level 35, the bonus buttons, the
rename tap, the town button), `GUI/RecuadroInfo` (hurry and the
construction speed-up only), `core/MagicManager` (mana per level),
`core/MapInitializer` (`attacksInit`, the free buy), `core/Utils` (the
bonus days), `core/CommandManager` (`buy`), `core/isoengine/IsoEngine`
(the counting helpers, the nearest units, which harbour and refuge count),
`core/isoengine/IsoElement` and `IsoBuilding` (only where they feed the
goals). **Skimmed:** where experience comes from (found by searching,
not read source by source); the tutorial's hold on goals and the shop;
`GUI/InfoButtonOver` (the shop's hover card) and `core/LevelUnlock` (a
card in the level-up window) not read beyond their use; the battle,
social-building and quest counters were read where `MissionsManager`
uses them, not at their sources. Our side: `client/src/rules/goals.ts`,
`goals.json`, `goals.ts`, `ui/goals.ts`, `rules/levels.ts`, `editor.ts`
(level up, hurry), `rules/bonuses.ts`, `bonuses.ts`, `rules/shop.ts`,
`ui/shop.ts`, `rules/production.ts` (hurry), `ui/bank.ts`, `ui/spells.ts`
(mana), `main.ts`, and the server's `missions.py`, `levels.py`,
`daily_bonus.py`, `comeback_bonus.py`, `market.py`, `towns.py`,
`economy.py`, `command.py`.

Our classic game serves a copy of the client with the welcome-back chest
switched on (`tools/patch_client.py`); otherwise the copy read here is the
one players get. Words used below: "at home" means the player's own town
in normal play (not a visit, island or battle); "a check" is the goals'
check every 60 frames, which is 2 seconds at the game's 30 frames a
second.

## Experience and levels

- Each town keeps its own experience and level (the save's `map.xp` and
  `map.level`); cash is the player's, shared by both towns. *Ours: same
  (`client/src/rules/town.ts`, the server's `towns.py`).*
- The config's `levels` table has 100 rows; row n is level n. Level n
  needs row n's `exp_required` (level 2 at 29, level 5 at 200, level 20 at
  16,232, level 35 at 74,532, level 99 at 9,494,470; level 100 at about two
  billion, out of reach). *Ours: same (`rules/levels.ts`).*
- Whenever experience is added (buying, training, harvesting, tokens,
  gifts placed, helping...), the game checks for a level up. Gold, cash or
  resources added alone don't check. *Ours: same idea; `editor.ts` checks
  after each gain.*
- It goes up one level per check. The level-up window's two buttons both
  check again on closing, so several levels gained at once come as one
  window after another, each paying its prize as it opens. *Ours: one
  window after another too (`client/src/ui/levelUp.ts`); the prizes are
  all paid as the levels are reached, not as each window opens
  (`rules/levels.ts`). Same totals.*
- A level up sends `rt_level_up` (the new level) at once. *Ours: same
  (`rules/levels.ts`).*
- On opening the home town from level 5, the game sends `rt_publish_score`
  with the town's experience. *Ours: different: not sent. Harmless: our
  server keeps experience itself, and the command only matters to it as a
  catch-up.*
- A save whose level is at or past the table's end is shown as level 99
  on loading (the bar would otherwise have no next level). *Ours: not
  checked; no reachable save gets there.*
- The top bar shows the level, "experience / next level's experience", and
  a bar filled from this level's mark to the next. *Ours: same in
  substance: the level and the bar, the numbers in its tip (`ui/hud.ts`).*
- The Level-Up Statue, placed as a gift, gives exactly the experience
  missing to the next level; placed from the town's storage it gives none.
  *Ours: same (`rules/storage.ts`; see also `docs/original/index/core.md`).*

## What a level up gives and shows

- The prize is the new level's row: `reward_type` and `reward_amount`
  (the game's table: 50 wood at 2, 50 food at 3, 400 wood at 4, 1 cash a
  level from 5; our served config, `economy.py`, makes it 2 cash from
  level 5, 5 on every 5th, 10 on every 10th). Row 1 is never paid. The
  window adds it to the player's numbers as it opens; it gives no
  experience. The server pays the same from `rt_level_up`. *Ours: same
  (`rules/levels.ts`, `levels.py`).*
- From level 36 (`START_LEVEL_MANA_REWARD`), each level adds 2 mana
  (`MANA_REWARD_PER_LEVEL`) to the player's count on screen, and the
  window shows "+2" mana. *Ours: different: the server pays it
  (`levels.py`, `magic.py`), but the new client's mana count doesn't move
  at the level up. It catches up later, when the Wizardry Academy's window
  lists a spell not yet learnt or a spell is learnt (`magicParts`,
  `ui/spells.ts`), and that window's first drawing still shows the old
  number; with every spell learnt it waits for the next load. Nothing shows
  the "+2".*
- The window: "Level N", the level's name from the table, the prize, and
  up to four buildings that open at this level: those whose `min_level`
  is exactly the new level, of type building, sold in some store and of
  the town's own race. A level-up sound plays. Its two buttons (share and
  skip) both just close it here. *Same: `client/src/ui/levelUp.ts`, `client/src/rules/levels.ts` (`unlockedAt`), with one button, OK.*
  *Fixed since "The level-up window".*
- Opening it closes the other window of its sort if one is open (the
  market, for one), and redraws the open shop's cards for the new level
  rather than closing the shop; message windows stay. *Ours: the shop
  redraws its cards (`client/src/editor.ts`, `levelUp`); the market's
  panel stays open beside the level-up window, as every panel does.*
- At home, every level up rolls the raids again as if the town had just
  opened: from level 25 one chance in 10 of a siege, stampede or army by
  level band, and the bandit bands from levels 10, 15 and 20 (the details
  are in the raids' own notes). *Ours: missing: raids are planned only
  when the town opens (`rules/raids.ts`).*
- At home, from level 25 and on every 5th level (25, 30, 35...), an enemy
  orc dragon is put on the map's border. *Ours: missing.*
- Reaching exactly level 35 at home, in any town's race: the goal box goes
  away and goals stop for the rest of the session; the spell box appears;
  a Wizardry Academy is placed free on the first free 3 by 3 spot near
  tile (59, 59) (`buy` with the free flag), when such a spot is found,
  even if the town has one already; a notice about the spell book shows. *Ours: missing: goals run
  on until the next load (they are decided as the town opens) and no
  academy is given. The shop sells the academy instead.*
- Closing the window at level 20 is meant to show the town button in the
  games menu; it points at a part of the bar that isn't where that button
  lives, so it probably only appears on the next load (not verified in
  the bar's art). *Ours: missing (no second town yet).*
- Closing the window at level 5, at home in a human town, with the
  princess still a prisoner in the camp and no allies there, sends the
  camera's helper to her camp. *Ours: missing.*
- On reaching exactly level 4 within 3 days of the empire's start, the
  welcome-back chest's button shows (see below). *Ours: same
  (`bonuses.ts`, `levelled`).*

## Goals: when they run

- Goals run in a human town below level 35, decided as the town loads;
  in a troll town, or from 35, the spell box takes their place. *Ours:
  same at load (`goalsRun`, `rules/goals.ts`); see above for reaching 35
  mid-session.*
- They are checked only at home, once the map has finished loading, every
  60 frames (2 seconds), also while the game is paused. Not during
  Arthur's lessons until their first window has been closed. *Ours: same
  timing (`goals.ts`, `CHECK_MS`); no lessons to wait for.*
- The first check shows the goal box. *Ours: same (`ui/goals.ts`).*
- What a player did is counted for the whole session, across visits,
  islands and even the other town (the counters live as long as the game
  page). *Ours: different: an island trip reloads the page, so counts of
  doings start again (visits are kept in the tab's storage, island stars
  read from the save; DECISIONS.md, 15 October 2026).*

## Goals: which are open, and paying them

- The goal list is the client's own table of 228 places (0 to 227). A
  goal's number is its place; the numbers written in the table drift from
  place 80 (by one, then by more, with repeats), so the place is what
  matches the config's titles. *Ours: same (`goals.json` is keyed by
  place). CLIENT.md says the drift is "by one"; it grows later.*
- A goal's title, text and gold come from the config's `missions`, looked
  up by id. When an id appears twice, the later entry wins. Our server's
  config adds a stand-in for goal 1 after the real one (`config/patch/
  missions_0_1.json`), so the classic game shows goal 1 as the stand-in's
  title with 0 gold, and adds 0 gold on screen when it's paid. Our server
  looks goals up the same way (`get_game_config.py` keeps the later entry
  too), so `reward_mission` for goal 1 pays 0 there as well. *Ours:
  different: the first entry wins, so the new client shows the real goal 1
  and adds its 10 gold on screen (`readGoals`), which the server never
  pays: until the next load the gold shown is 10 more than the save's.
  CLIENT.md says "the first counts", which is true of neither the Flash
  client nor our server.*
- Open goals: the first 15 places from 1 up, counting every goal not both
  done and paid. Goal 227 can be among them. *Ours: different: we stop at
  226 (`LAST_GOAL`), so goal 227 never shows.*
- Each check looks at the open goals in order, skips those already done,
  and sends `complete_mission` (goal, 0) for each one reached. Goal 227 is
  never checked (the check stops one short of the table's end), and its
  entry lacks the star count anyway: it sits in the list for good. *Ours:
  same for 1 to 226.*
- Then, in the same check, the first open goal that is done but not paid
  is paid: its gold is added on screen and `reward_mission` (town, goal)
  is sent. One a check. *Ours: same (`payGoal`, `goals.ts`).*
- The list's Reward button pays a done goal at once; the check would pay
  it anyway. *Ours: no button; paid by the check.*
- Skipping a goal for cash (`PRICE_COMPLETE_GOAL`, 2 cash, sent as
  `complete_mission` with 1) is switched off: its button is hidden unless
  the page sets a test switch our pages never set. *Ours: same, none
  (DECISIONS.md).*
- Goal 1008 in the config isn't in the client's table and never shows.
  *Ours: same.*

## Goals: how each kind is checked

Kinds are named as in our `goals.json`. Unless a rule says otherwise, the
check counts the player's own things.

- **Things of a kind** (`build-kind`, `have-kind`; goals 1, 2, 7, 8, 12,
  24, 26, 32, 36, 39, 50, 100) and **things by id** (`build`, `have`;
  67 and 19 goals): what stands on the map, plus units inside buildings
  that hold units. "Build" and "have" are counted the same way. *Ours:
  same (`count`, `rules/goals.ts`).*
- **Units inside** (`inside-kind`, `inside`; 3, 13, 15, 22, 28, 45, 47,
  49, 97, 118, 134, 148, 174, 179, 182): units of a kind inside the
  player's buildings of a kind or id. *Ours: same.*
- **Collecting** (`collect-kind`, `collect`; 4, 5, 25, 34, 57, 17, 23,
  35, 61 to 64, 120): every harvest of a building, tree or rock this
  session, hurried ones too, counted from the start of the session
  whatever goals are open. *Ours: same counting (`Doings.collected`),
  from the page's opening.*
- **Capturing** (`capture-kind`, goal 21): wild animals caught this
  session, always counted. *Ours: same.*
- **Letting out** (`let-out-kind`, goal 16): units out of a building of a
  kind this session, always counted; a ranch's harvest that uses up an
  animal counts as one out. *Ours: same idea (`letOut`); not checked
  whether our ranch harvest counts.*
- **Zoom** (goal 6): any zoom, by wheel, slider or keys, this session.
  *Ours: same in effect (the camera's zoom differs from the start).*
- **Units near the town hall** (`near-hall`, goal 18): the nearest 20 of
  the player's living units standing on the map (not inside a building)
  within a circle of 3 tiles from the hall's tile (squared distance 9 or
  less); enough of each kind among them. *Ours: different: a 7 by 7
  square (3 tiles each way), no limit of 20, so corners up to 4.2 tiles
  away count (`nearHall`).*
- **People** (goal 56): the town's people now. *Ours: same (not
  re-checked how people are counted).*
- **Land** (73, 158, 226): blocks owned. *Ours: same.*
- **Walls along the front** (37, 88): walls of the given id on one row, x
  40 to 59, row 79 if block 18 is owned, else row 59; anyone's walls
  count. *Ours: same (`wallsAlongTheFront`).*
- **The refuge** (goal 135): the last Small Refuge placed holds at least
  N units. *Ours: same (the first Small Refuge found).*
- **The harbour** (goal 80): a harbour (human or troll) stands in the town,
  or one was staffed this session. *Ours: same (`have` 224 or 343).*
- **Neighbour visited** (goal 44): the last neighbour visited this session
  is one of Arthur's three towns. Counted on any visit, back home at the
  next check. *Ours: same (kept in the tab's storage).*
- **Sailing another way** (goal 85): the islands opened from the games
  menu or the world map's ship this session, always counted. *Ours: same
  (`islands-from-menu`).*
- The following count only **while a goal of that kind is open and not
  done**: before each check the game stops listening and starts again for
  the open goals' kinds only, so a deed done before its goal is in the
  first 15 doesn't count. Working time chosen (14, 46, 98), buildings moved
  (38), windows opened (54, 68, 81), cash spent (52), the daily bonus
  (55), market trades (65, 66, 72), things stored (70), islands won (82,
  86, 108, 116, 131, 137, 144, 156, 165, 166, 173, 180, 191, 198, 210),
  units pushed into buildings (106), units trained at a building (107,
  127), something placed from storage (130), neighbours' buildings helped
  (102), plus the battle, social and nest kinds. *Ours: different: every
  doing counts from the page's opening, open goal or not, and island
  goals read the stars the save keeps from any time (DECISIONS.md, 15
  October 2026). Goals can complete sooner in the new client.*
- **Working time** (`work-time-kind`, `work-time`): the game keeps the
  last working time chosen for each kind and each building id, not the
  longest; goal 98 needs that last choice to be 8 hours. *Ours:
  different: the longest chosen counts (`Doings.workTime`). Matters only
  if a shorter time is chosen within 2 seconds of the long one.*
- **Cash spent** (goal 52): the sum of cash taken by the game's own
  spends (shop, hurry, mana, chests...) while the goal is open, at least
  1. *Ours: the same spends count: any drop in the town's cash between
  checks (`goals.ts`). The site's bank only ever adds cash (it trades
  resources for cash, `bank.py`), so it doesn't count; its cash-for-gold
  trade is the game's own and counts in both. Two small differences: ours
  counts while the goal isn't open too (above), and a gain and a spend
  within the same 2 seconds cancel out in ours, where the original counts
  the spend.*
- **Daily bonus** (goal 55): counted when the bonus window opens, as its
  day in the five (1 to 5); day 3 or later completes it. *Ours: counted
  on collecting; the same, since the window can't be left without
  collecting.*
- **Islands won** (`quest`): the best stars won on that island this
  session (while the goal is open), compared with the goal's stars.
  *Ours: different, as above; and goals 131, 137, 144 and 156 are island
  goals of this kind but `goals.json` marks them "classic", so the new
  client never completes them.*
- **Units trained at a building** (`train-at`, 107 and 127): units of
  given ids (or any, up to a count) trained at a given building this
  session; the Altar of Heroes counts its heroes. *Ours: same rule.*
- Two kinds compare the wrong way round in the original: buildings moved
  (goal 38) and a window opened (goals 54, 68, 81) complete when the count
  is exactly the goal's 1. Doing it twice between two checks makes the
  count 2 and the goal can't complete until the game is reloaded. *Ours:
  different: one or more completes goals 38 and 81 (`move-kind`,
  `islands-opened`); goals 54 and 68 are marked "classic" in `goals.json`,
  so the new client doesn't complete them at all.*
- **Killing** kinds (19, 31, 76, 128, 143) reset their count to 0 when a
  goal of that kind completes, so "kill 5 more" means five more. One goal
  (151) counts destroyed buildings. *Ours: missing (battles; "classic").*
- **Naming the empire** (goal 33, 66 gold) can never complete: nothing in
  the game sets its flag, renaming included. It stays in the open list
  for good. *Ours: marked "classic", which says it's played in the
  classic game, where it can't be done either.*
- **The square selection tool** (goal 41): taking it up this session.
  *Ours: same (`selection-tool`: its button or Space, `rules/goals.ts`),
  since "Select several units, as in the Flash client"; until then the
  goal was left to the classic game.*
- Other kinds played only in the classic game for now: the market's
  friends (51; its trades, 65, 66 and 72, count here since "The market"), all trolls beaten (42), camp quests on the map (43, 75, 93, 113,
  129, 142, 152, 162, 164, 172, 185, 192, 205, 209), player battles and
  spying (59, 67, 78, 79, 94, 132, 161), the defence plan (60), social
  buildings staffed (53, 71, 90, 96, 104, 115, 122, 150, 159, 170, 176,
  189, 203, 204, 214), repairing (101), the coordinated attack (77), and
  the special moves (124, 171, 177, 195). *Ours: missing; the list says
  "Played in the classic game for now" (61 of goals 1 to 226; CLIENT.md
  says 72).*
- A hard-coded check for the coordinated attack reads goal 78's done flag
  where the goal is 77 (the drift above); it only stops counting archers
  once goal 78 is done. *Ours: not applicable (classic).*
- The progress shown ("N of M") is only kept for some kinds; for the
  reversed kinds it shows the two numbers swapped, for the working-time
  goal by id it shows the ids, and zoom, units near the hall and a few
  others show none. *Ours: different: every kind we check shows its own
  "N of M".*

## Goals on screen

- The goal box, bottom left, shows the first two open goals as "Goal N"
  badges with the host (Arthur, or Guinevere for women players). Goals 6
  to 9 carry a "new" badge until tapped (not during the lessons). *Ours:
  different: one card, the next goal, with its title and a bar (DECISIONS.md,
  14 October 2026); goals 6 to 9's "Click here!" tag, the same.*
- Tapping the host: while the first open goal is 9 or below, its own
  window opens; otherwise the list. The list shows five at a time with
  up and down arrows (15 in all), each with its title, progress, an Info
  button (not done) or a Reward button (done), and a Help button for goals
  1, 2 and the building kinds. *Ours: different: one window with all 15,
  their texts, progress and gold.*
- A goal's window: title, text, gold, a picture (`goal_NNN.jpg`), a
  figure (`nino_` plus the goal's number modulo 25), OK. Opening it for
  goals 10 and below opens the build menu too; Help points an arrow at
  the build menu (goal 2: selects the town hall). Opening the shop after
  goal 9's window shows an arrow at the barracks. *Ours: the window, its
  picture, figure and HELP! (`client/src/ui/goalWindow.ts`); no build menu
  opened with it, nor the barracks arrow in the shop (DECISIONS.md, 16
  October 2026).*
- When a goal completes, the host cheers for 3.5 seconds. When the 15th
  open goal changes, below level 8, a "new mission" notice shows. *Ours:
  the notice, the same (`client/src/goals.ts`); a message when the gold is
  paid; no cheer.*
- In "#0#", the host's name is put in the title and text. *Ours: same,
  always Arthur (`readGoals`).*

## The daily bonus

- Offered from level 5, at home, in a human town, when the game starts
  and the day has changed since the last one (`privateState.
  timestampLastBonus`), counted in whole days in the page's time zone;
  our pages give none, so UTC. Decided as the game loads (and again after
  the time machine). *Ours: same (`dailyBonusOffered`, `dailyBonusDay`).*
- Which of the five days: one after the last collected
  (`privateState.bonusNextId`, the last day plus one), back to day 1 when
  more than one day has passed; with no `bonusNextId` it reads a page
  setting our pages don't send, so day 1. *Ours: same.*
- The five prizes come from `DAILY_BONUS_CONFIG` (gold, a hero, cash, a
  hero, cash; amounts set by `economy.py`). A hero is drawn from
  `DAILY_BONUS_CONFIG_HEROES` by rounding a random point along the list,
  so the first and last heroes come half as often as the others; it goes
  into storage. Gold or cash is added with no level check. *Ours: same,
  the rounding too (`collectDaily`).*
- `win_bonus` (gold, town, hero, day 1 to 5, cash) is sent at once. *Ours:
  same.*
- It opens by itself as the first of the start-up windows, and its close
  button is hidden: the only way out is Get prize. There is no button for
  it on the screen. *Ours: different: a round button at the top right
  that the player taps, and the window can be closed (DECISIONS.md, 14
  October 2026).*
- Reaching level 5 mid-session doesn't offer it until the next load.
  *Ours: same (DECISIONS.md).*
- The window shows the five days with ticks on those done, Today and
  Tomorrow marks, the possible heroes walking past in turn (one every 4
  seconds), and the prize. *Ours: different: a plain list of the five
  days, "A hero" for the hero days.*

## Monday's chest

- On a Monday (the computer's own weekday) the button shows unless
  collected that same calendar day (`privateState.timeStampMondayBonus`);
  on a Sunday it shows a preview. No level or race condition. Decided on
  load. *Ours: same (`mondayChest`).*
- Three chests; whichever is picked, the prize is drawn evenly from
  `MONDAY_BONUS_REWARDS` (gold, a unit, cash). A unit is drawn evenly from
  `MONDAY_BONUS_UNITS` and goes into storage. *Ours: same (`openChest`).*
- `weekly_reward` (kind, amount or the unit's id) is sent at once; the
  button goes. *Ours: same.*
- Sunday's window shows the three prizes, the unit one with a unit drawn
  at random for the picture (not necessarily the one Monday gives). *Ours:
  different: a sentence and three greyed chests.*

## The welcome-back chest

- Switched off in the game as built (`Config.COME_BACK_2ND_3RD`); our
  classic copy switches it on. *Ours: offered too (the owner's call,
  DECISIONS.md, 15 October 2026).*
- The button shows on loading when the page's days since the empire
  began is 0 to 2, the level is 4 or more and day 2's chest isn't opened;
  also on reaching exactly level 4 when the days are 3 or fewer. *Ours:
  same, except day 3 (`welcomeBackChest`).*
- Day 0, or day 1 once opened: the window shows what the next day's chest
  holds (its unit: the first of `COMEBACK_BONUS_UNITS` for day 1, the
  second for day 2). Days 1 and 2 not yet opened: three chests, the prize
  drawn as Monday's, its unit that day's own. `comeback_reward` (kind,
  amount or unit, day) at once; after day 2's, OK hides the button. *Ours:
  same.*
- A quirk: a player reaching level 4 on day 3 gets the button, and the
  window offers chests with no unit behind them. Our server never tells
  the page "3" (`comeback_bonus.page_days`), so it doesn't happen in our
  classic game. *Ours: same outcome (no chest on day 3).*

## The shop: what it sells and in what order

- Humans see items whose `in_store` is 1 or 3, trolls 2 or 4. An item
  with a `store_level` above the player's level is hidden. *Ours: same
  (`soldTo`, `shopItems`).*
- The Diamond Castle and the Dragon Killer Castle show only to gold
  members (a page setting). *Ours: same (never).*
- Items are sorted by `display_order`; those above the player's level and
  not opened early go after the rest. In a town that hasn't finished the
  lessons, everything above level 1 is sorted to the end. *Ours: same,
  without the lessons' order (we have no lessons in the shop).*
- The New category holds its own items plus every item of categories 1 to
  11 marked `new_item` (its own tab) or bought with cash (another tab).
  *Ours: same.*
- Eight cards a page (4 by 2), with arrows. Each card: name, price and its
  resource, the experience it gives, "Level N" while it is above the
  player's level, a "new" badge, a "limited" badge with the days left for
  limited editions. Hovering shows more about it. *Ours: different: a
  scrolling list; no "new" or "limited" badges and no hover card
  (PARITY.md).*
- A card above the level can't be picked. *Ours: same.*
- Buying takes the price (`cost`, `cost_type`), adds the item's `xp` (with
  a level check) and sends `buy` (item, x, y, facing, town, 0, 1, type).
  Short of gold: "not enough gold" with a way to the gold trade; short of
  cash: a way to the site's cash page; short of wood, food or stone: a
  warning. *Ours: same purchase (`buy`, `rules/shop.ts`); the warnings
  are our own messages.*

## Opening a building early

- The price exists: a third of the building's level in cash, rounded up,
  then `unlock_building` (its id, as text) and the shop sells it.
  *Ours: same price and command (`unlock`, `rules/shop.ts`).*
- But nothing in this build opens that window. The card's "Level N" tag
  gets a hand cursor and nothing else: the actions written for it (show
  the price on hover, open the unlock window on a tap) are never
  attached. So in the Flash client players could not open buildings
  early. The game still honours unlocks already in the save
  (`privateState.unlockedEarlyBuildings`). *Ours: different: the shop
  offers "Unlock" on every locked card, one tap, no confirmation
  (`ui/shop.ts`). CLIENT.md ("Land and cash") and PARITY.md ("Already the
  same") present it as the original's; they are wrong about that.*

## Hurrying and other cash prices

- Hurry: 2 cash (`Config.COST_HURRY_UP`) finishes and collects a working
  mill or mine (with workers inside), a bakery-type building or a wonder
  that houses nobody; the cash goes in the collect command's last place.
  It counts as a harvest for the goals. The window shows the time left,
  ticking, and an "ask friends" button that opened a Facebook request.
  *Ours: same rule (`hurry`, `rules/production.ts`), paid 1,000 food
  instead of 2 cash since 29 October 2026 (the owner's rule; CLIENT.md,
  "Speed-ups cost food"); Ask friends sits beside it on the card.*
- Speeding up a building under construction costs 10 cash (written into
  the info panel), but only for items with a build time, and no item in
  the config has one, so it never shows. *Ours: not applicable.*
- The second town: 100,000 gold or 22 cash (see below). Gold for cash: 5
  cash for 2,500 gold. Mana: 5 for 1 cash or 20,000 gold. Skipping a goal:
  2 cash, switched off. *Ours: see each section.*

## The market

- The market's window (from the market building) trades wood, stone and
  food for gold, in lots of 100, 200 or 300 by the market's level (I, II,
  III; the troll markets the same). *Ours: same, from "Visit Market" on
  the card, in the panel (`client/src/ui/market.ts`, DECISIONS.md, 16
  October 2026).*
- Price of a lot: the base per 100 (wood 100, stone 150, food 100 gold)
  times the lot over 100, plus 2% of that for each purchase so far,
  rounded; a sale pays three quarters of that, rounded. The count goes up
  one per purchase and down one per sale, kept between -25 and 200 (the
  town's `resourcesTraded`). *Ours: same (`client/src/rules/market.ts`);
  `market.py` uses the same sums.*
- 20 trades, shown as "trades left"; the count is set back to 0 when the
  town loads more than 20 hours after the last trade. Trading with none
  left, buying without the gold or selling without the goods each gives a
  warning. *Ours: same, with the game's words; selling names the right
  good (the game's line always said wood); buying without the gold opens
  the bank.*
- Each trade sends `trade_resource_b` (town, resource, 1 sell or 0 buy,
  amount), adds or takes gold and the goods on screen, and feeds the three
  market goals while they are open. *Ours: same (`market-trade` in
  `client/src/rules/goals.json`).*

## Trades with cash inside the game

- Gold for cash: 5 cash for 2,500 gold (`Config.BUY_GOLD_*`), sent as
  `exchange_cash_new` (town). The window opens when a purchase lacks gold
  (and from the game's add-cash button); it stays open after a trade, so
  it can be repeated. *Ours: same trade and command (`ui/bank.ts`,
  `main.ts`; the numbers from the config's `EXCHANGE_*`, the same); it
  opens from the + on the gold and cash pills (DECISIONS.md, 14 October
  2026).*
- Buying cash went to the site's page; nothing is sold here. *Ours: the
  site's own bank (`bank.py`) sells resources for cash instead; not in the
  original game.*
- Mana: `MANA_PER_PURCHASE` (5) for `COST_MANA_CASH` (1 cash) or
  `COST_MANA_GOLD` (20,000 gold), `buy_mana_new` (town, 1 cash or 0 gold)
  sent at once; short of gold it opens the gold trade. *Ours: same
  (`ui/spells.ts`).*

## The second town and travelling

- A town button in the games menu, hidden below level 20 in a human town
  (decided as the game loads). The web page can also open the same
  window. *Ours: Towns, on the rail from level 20 (on a phone in World),
  `client/src/ui/towns.ts`; the server has `towns.py`.*
- With one town, the window offers a troll town for 100,000 gold or 22
  cash (the client's own constants; the config's `map_prices` table is
  never read). The human-or-troll choice isn't wired, so it is always a
  troll town. Below level 20 the buttons only warn. *Ours: same
  (`client/src/rules/towns.ts`).*
- Buying takes the price on screen, sends `buy_map` (1, 1 for cash or 0
  for gold, "t", the town paying) at once, and travels to town 1. *Ours:
  same, then opens town 1 as a new page.*
- With two towns, the same button lists both; the current one is greyed,
  the other can be travelled to. Travelling sends what's queued, then
  loads the other town (`get_player_info` for that map); goals, the daily
  bonus and the shop then follow that town's race and level. *Ours: same,
  the other town opened as a new page (`?town=1`; DECISIONS.md, 16 October
  2026).*
- The game always starts in the default town (`playerInfo.default_map`);
  the "make default" box exists in the rename window but is hidden and
  `set_default_map` is never sent, so in practice it is always town 0.
  *Ours: the default town, unless the page asks for another (`?town=`).*

## Renaming

- At home, tapping the town's name in the top bar opens the rename window
  with the current name. *Same, from the level at the top, whose tip names the town (`client/src/ui/hud.ts`, `offerRename`).*
- The Save button never works in this build (its action is always
  removed); Enter saves when the name has 3 or more characters. Cancel
  closes. *Different: ours saves with Save too (a recorded call), `client/src/ui/rename.ts`.*
- Saving sends `name_map` (town, name) and shows the new name in the top
  bar. It also writes the name to the wrong place in the player's data,
  so reopening the window shows the old name until the game reloads. The
  name "My Empire" is shown in the player's language. Renaming doesn't
  complete goal 33. *Same: `name_map`, and the top bar's tip has the new name at once (reopening shows it too); the server sets `map_names`.*

## Where CLIENT.md is wrong or short

- "Missions and bonuses": "the server's config adds a stand-in for goal 1
  after the real one: the first counts". In the Flash client the later
  one counts, so the classic game shows the stand-in with 0 gold; the
  first counts in ours and in our server.
- Same section: "numbers ... drift by one from goal 80": the drift grows
  past one later in the table.
- Same section: "up to goal 226": the original lists goal 227 too (never
  checked).
- Same section: "Others count what the player did since the page opened,
  as the Flash client counts them": in the original most of them count
  only while a goal of that kind is open.
- Same section: "Goals about battles, quests, the market, the social
  buildings and capturing animals ... (72 of the 226)": capturing and most
  island goals are done in the new client now, and the square tool's
  (41); 61 of 1 to 226 say
  "classic".
- Same section: goals stop at level 35 also mid-session in the original,
  with a free Wizardry Academy; CLIENT.md only mentions the load.
- "Land and cash": opening a building early "costs a third of that level
  in cash" is right, but the Flash client never offered it.
- "How the shop works": "can be bought ... sooner once unlocked with
  cash" is true of the save, not of anything the Flash client let a
  player do.

## Differences

Most serious first: what changes the save, then what looks or feels
different, then what is missing. Each was read again in the decompiled
client and in our code by a second reader; "(checked twice)" marks those
that held. Where the second reading only skimmed a part, the entry says
so.

1. **Opening buildings early** (changes the save). The original never
   lets a player do it; ours sells it on every locked shop card for a
   third of the level in cash (`client/src/ui/shop.ts`,
   `client/src/rules/shop.ts`). (checked twice)
   *Fixed since "Progress as the original keeps it".*
2. **Reaching level 35** (changes the save). The original stops goals at
   once, adds the spell box and places a free Wizardry Academy near tile
   (59, 59) when it finds a free spot; ours keeps goals running until the
   next load and gives no academy (`client/src/editor.ts`,
   `client/src/goals.ts`). (checked twice)
   *Fixed since "Progress as the original keeps it", but the spell box (missing).*
3. **Raids on a level up** (changes the save). The original rolls the
   raids again on each level up at home and puts an orc dragon on the
   border at levels 25, 30, 35...; ours plans raids only on opening
   (`client/src/rules/raids.ts`, `client/src/homeDefence.ts`). (checked
   twice)
4. **When doings count for goals** (changes the save). The original counts
   most doings only while a goal of that kind is open; ours from the
   page's opening, and island goals from the save's stars, so goals can
   complete and pay sooner (`client/src/rules/goals.ts`,
   `client/src/goals.ts`; the island part is a recorded decision).
   (checked twice)
   *Fixed since "Progress as the original keeps it".*
5. **Units near the town hall** (changes the save). Original: a 3-tile
   circle, nearest 20; ours: a 7 by 7 square (`nearHall`,
   `client/src/rules/goals.ts`). (checked twice)
   *Fixed since "Progress as the original keeps it".*
6. **Working time** (changes the save, rarely). Original keeps the last
   choice, ours the longest (`Doings.workTime`). (checked twice)
   *Fixed since "Progress as the original keeps it".*
7. **The reversed goal checks** (changes the save, rarely). Moving two
   walls or opening the island map twice between checks blocks goals 38
   and 81 in the original for the session; ours completes them. (Goals 54
   and 68 have the same quirk in the original, but ours marks them
   "classic" and doesn't complete them.) (checked twice)
8. **Goal 1** (looks different). The classic game shows the server's
   stand-in for goal 1 and adds 0 gold, and our server pays 0 too (it
   also keeps the later entry). Ours shows the real goal and adds 10 gold
   on screen that the save never gets, until the next load. A config
   patch issue on our side (`config/patch/missions_0_1.json`). (checked
   twice; the server's part corrected: it pays 0, not 10)
9. **Goal 227** (looks different). The original lists it for good, never
   checked; ours never shows it (`LAST_GOAL`). (checked twice)
10. **Goal 33** (looks different). It can't be completed anywhere, but
    ours says it's played in the classic game. (checked twice)
11. **Counts lost on reload** (feels different). An island trip reloads
    our page, so session counts (collecting, letting out...) start again;
    the original keeps them all session. (checked twice; the original's
    side read where the goals' keeper is made, not every island path)
12. **The level-up window** (looks different). Original: one window per
    level with its name, prize, up to four new buildings and the mana;
    it closes a market-type window and redraws the shop. Ours a message
    (`client/src/editor.ts`). (checked twice)
    *Fixed since "The level-up window".*
13. **Mana per level on screen** (looks different). The original adds 2
    on screen from level 36 at once; ours only when the Academy's window
    next lists an unlearnt spell or a spell is learnt, or after a reload
    (`client/src/ui/spells.ts`). (checked twice; "only after a reload"
    corrected)
14. **The daily bonus** (feels different, decided). Original opens itself
    and can't be closed without collecting; ours waits for a tap
    (`client/src/bonuses.ts`). (checked twice)
15. **Sunday's preview** (looks different). Original shows the three
    prizes; ours a sentence (`client/src/bonuses.ts`). (checked twice)
16. **The goal box and windows** (looks different, partly decided). Two
    goals, a list of five, each goal's window with picture and help
    arrows, "new" badges, the host's cheer and "new mission"; ours one
    card and one list (`client/src/ui/goals.ts`). (checked twice; the
    windows' details skimmed)
17. **Several level ups** (looks different). One window each in the
    original, one message in ours; same prizes. (checked twice)
    *Fixed since "The level-up window".*
18. **The shop's cards** (looks different). Eight a page, "new" and
    "limited" badges, a hover card; ours a list without them
    (`client/src/ui/shop.ts`). (checked twice)
19. **The gold trade's door** (feels different, decided). The original
    opens it when short of gold; ours from the + on the pills. (checked
    twice)
20. **Island goals 131, 137, 144, 156** (missing). Marked "classic" in
    `client/src/rules/goals.json` though the kind is built. (checked
    twice)
21. **The market** (missing), with goals 51, 65, 66, 72. (checked twice)
    *Fixed since "The market" (goal 51, friends for the market, stays classic).*
22. **The second town and travelling** (missing). (checked twice; the
    warnings below level 20 skimmed)
23. **Renaming** (missing). (checked twice)
    *Fixed since "Naming the empire".*
24. **Level 5 and level 20 hints** (missing): the princess helper and the
    town button. (checked twice; whether the level 20 one shows anything
    is still not verified in the bar's art)
25. **`rt_publish_score` on opening** (missing, harmless). (checked twice)

## Shop details update, 17 October 2026

Read through GUI/InfoButtonOver, GUI/ItemButtonLarge, GUI/Tab,
GuiManager.setMenu, GUI/SubCategory and the corresponding interface
symbols. `rules/shopDetails.ts` and `ui/shopDetails.ts` now implement the
per-kind facts; `ui/shop.ts` opens details only through the explicit Details
button's click, tap or keyboard activation, at every width. Hover and focus
leave details closed. The short visible label fits narrow cards while its
accessible name retains the item name, including in Storage.
Original category symbols use GuiManager's category-to-tab mapping,
without the embedded placeholder caption. New/limited badges use original
art and local-calendar expiry, preserving item availability. Early cash
unlocking remains disabled. See CLIENT.md, Shop details, and the focused
browser check `e2e/tests/shop-details.mjs`.
