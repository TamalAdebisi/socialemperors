# Rules with no button

Everything the original Flash client does by itself, with nobody pressing
anything: what happens between loading the save and the player being able
to play, what runs on a clock while they play, what follows from an event
(a level up, a goal, a harvest, the day changing), and what the game has
but keeps switched off. In Beta 1 these were our biggest blind spot,
because features were planned from the menus. Each rule says what the
original does, when, on what conditions and with what numbers, whether it
changes the save (and with which command), and then, in italics, where the
new client stands: *built*, *partly*, *not yet* or *not needed*, with our
file.

**What was read, and how deep.** Read through: `core/MapInitializer.as`
(`Init` and everything it calls for the home town: regrowing rocks,
clumps, trees, animals, lost things, the free villager, the camp's start,
`attacksInit`, the dealer and the adverts; the quest fix-up), the loading
and setting-up parts of `core/Base.as` (`loadPlayerInfoSuccess`, `init`,
`processAttacks`, `tutorialCheck`, the building tick, the frame loop
`UpdateGame` and its first frame `UpdateGame3`, the progressive drawing,
the pause, the clock), `managers/PopupManager.as` (the start-up chain of
windows), `managers/PlayerStatus.as` (`Init`, `load`, the population,
`checkForLevelUp`), `managers/CommandManager.as` (its timers),
`managers/NeighbourManager.as`, `core/isoengine/IsoEngine.as` (`Update`,
`amOverattacked`, `checkOpenDock`, `checkOpenZep`, the gold multiplier),
`IsoElement.tick`, `IsoBuilding` (`initContainedUnits`, `Update`),
`IsoUnit.Update` and its every-61-frames chores, `battle/IA.as` (`Update`,
`idle`), `GUI/CountdownTimer.as`, `GuiManager.onLevelUp`,
`MagicManager.onLevelUp`, `battle/CIA_QuestHelper.as`,
`popups/infoFriendAssistPopup.as`, the darts start check and the switches
in `core/Config.as`. **Skimmed:** the sieges, stampede and army
(`siegeTown*`, `assaultTownStampede`), `CollectiveIA`, the camp layouts
(`spawnQuestInMap`), the gacha (`KompuManager`), the news window, tokens
and collection drops (`Token`, `CollectableManager.getLoot`), the dragons'
care timers, `TownManager`. **Not read here:** the tutorial, survival,
tournaments and attacks on players beyond their start-up parts, and
`MissionsManager` beyond its timing (the goals have their own book,
[rules/progress.md](rules/progress.md)). Many town rules are already
written out in [rules/town.md](rules/town.md) and
[rules/progress.md](rules/progress.md); this list points there for detail
and was checked again against the code where it overlaps. Numbers from the
config are from `config/game_config_20120826.json`.

Words used here: a *frame* is a 30th of a second; a *tick* is the
original's one-second building clock; *free* means a command's "don't
change resources" flag set; *the wild ring* is the 16 outer blocks of the
map, never the player's.

## 1. The start, in order

From the save arriving to the player being able to play. Steps 1 to 10
happen while the save is read; 11 to 16 while the game sets up; 17 to 33
on the first frame of the home town (`UpdateGame3`, then
`MapInitializer.Init`); 34 and on are the windows that follow, one after
another.

**Reading the save** (`Base.loadPlayerInfoSuccess`)

1. **The answer is checked.** A bad signature, an empty answer or a
   "stolen session" answer stops the game with an error window. *Not
   needed: our server doesn't sign its answers; the new client says what
   went wrong in its status line (`client/src/main.ts`).*
2. **Neighbours are listed,** each marked as helpable when the player's
   last help to them was more than 24 hours ago. The site's own helper
   ("Best Empire") isn't counted as a real neighbour. No command. *Built:
   `client/src/rules/neighbours.ts`, `client/src/visit.ts`.*
3. **The land:** the save's owned blocks, and the middle eight not yet
   owned as the ones for sale. *Built: `client/src/rules/land.ts`.*
4. **The map is read** and things that overlap or stand off the map are
   noted for the tidy-up (step 15). *Built: `client/src/rules/cleanup.ts`
   (rules in [town.md](rules/town.md), "Tidying a town as it opens").*
5. **The clock** is the server's time plus the seconds since the save
   arrived. The first reading is checked against a second count and, if
   they differ by a minute or more, comes back as 0 (meant to catch a
   tampered clock). *Built: the clock in `client/src/main.ts`; the check:
   not needed.*
6. **Upgrades made today** (UTC) are counted from the save. The count is
   never used anywhere. *Not needed.*
7. **The day's counters,** worked out from the save once: attacks on
   players left (3 in any 6 hours, or a bought pack's count instead) and
   the seconds until the next; spying (3 in 24 hours); the allies' market
   trades, reset when 20 hours have passed since the last; the player's
   towns; whether goals run (a human town below level 35) or the spell box
   instead; storage and gifts; collections; the fallen units and heroes;
   the island times. No command. *Goals and spells built
   (`client/src/rules/goals.ts`, `client/src/rules/magic.ts`); graveyards
   built (`client/src/ui/graveyard.ts`); attacks, spying and the market:
   not yet (the switch, and PARITY.md).*
8. **The daily bonus and Monday's chest are decided** for the whole
   visit (the daily one needs a new day since the last; Monday's shows on
   a Monday unless taken that day, a preview on a Sunday). *Built:
   `client/src/rules/bonuses.ts`, `client/src/bonuses.ts`
   ([progress.md](rules/progress.md)).*
9. **The Unit Warehouse's contents and room** are read. *Not yet (no
   warehouse in the new client).*
10. **Lost things are not saved:** whatever lost things, wild animals'
    ownership or raiders were on the map last time are not in the save;
    they are made afresh below. *Built, the same.*

**Setting up** (`Base.init`)

11. **The clocks start:** the building tick every second, the command
    batch every 6 seconds, the units' moves every 6 seconds, and a ping
    every 5 minutes (section 2).
12. **Goals or spells:** goals run in a human town below level 35, the
    spell box otherwise. *Built: `goalsRun` in `client/src/rules/goals.ts`,
    `client/src/main.ts`.*
13. **The tutorial check.** In the first town of a player who hasn't
    finished it, the tutorial starts and the map is locked; many of the
    steps below are then skipped. Otherwise, unless it was already shown
    today (by the computer's date), a 5-minute timer is set for the "add
    neighbours" window. *Tutorial: built (`client/src/lessons.ts`; the map
    isn't locked, DECISIONS.md); the neighbours window: not needed (it
    invited Facebook friends).*
14. **Attacks received while away:** if any is marked as not yet seen, the
    attack history window opens at once and `clean_attacks` is sent.
    *Not yet (attacks on players come with the switch).*
15. **The tidy-up:** the player's buildings that overlap something go to
    storage (`store_item_frombug`); others off the map are sold free
    ("OUTOB"); as the drawing finishes, units on a taken tile move to the
    nearest free one (`move` ... "Colisio #n"). *Built, with small
    differences: ours also moves a unit off a gate, and keeps one on the
    player's land (`client/src/rules/cleanup.ts`, [town.md](rules/town.md)).*
16. **Drawing,** 150 things a frame behind a progress bar; then the top
    bar's clock is added and the game loop starts. *Built
    (`client/src/view/townView.ts`); the top bar's clock: not yet (section
    2).*

**The first frame at home** (`UpdateGame3`, `MapInitializer.Init`)

17. **Units back inside** buildings, from the save's lists; a building
    that holds units but lists none is stopped, and work in progress on a
    tree or rock resumes. *Built: `client/src/rules/town.ts`.*
18. **Animals on the player's land become theirs;** the rest are wild.
    *Built: `markWild`, `client/src/rules/animals.ts`.*
19. **Three lost things** are put on random tiles anywhere on the 25
    blocks (an injured animal, a knight, a crate and the like); tapping one
    opens a window. Not saved. Not in the tutorial. *Not yet.*
20. **A free villager** when the town has none on the map or working
    (`buy`, free), on a random free tile near (54, 54). Not in the
    tutorial. *Built, with small differences: `oneVillager`,
    `client/src/rules/cleanup.ts` ([town.md](rules/town.md)).*
21. **Villagers' speed and line** are set from the town hall and the
    Academy. *Built: `client/src/rules/villagers.ts`.*
22. **The troll camp.** A camp is due 4 hours after the last chest was
    opened (`map.timestampLastTreasure`). If it's due and no chest stands,
    a new camp comes: the wild ring is cleared (`sell` ...
    "CLEAN_<camp>"), a camp the race doesn't get is moved on to one it does
    (`collect_treasure` 0, 0, new camp), the camp is put up (free `buy`s),
    its window is readied (it opens later, step 39), and trolls are
    topped up on the border: up to 6 clusters of 3 to 5 (6 to 10 in a
    troll town), one fewer for each cluster's worth already there. If it's
    due and a chest still stands, the current camp is laid out again.
    Otherwise nothing. *Built: `client/src/homeCamps.ts`,
    `client/src/rules/camps.ts`, `client/src/homeScripted.ts`; partly for
    story camps not yet played here (they're left to the classic game).*
23. **Social buildings get a free helper:** one with no helper and a crew
    of 3 or more, or one helper and a crew of 7 or more, whose helpers
    cost something, gets one (`buy_si_help` x, y, town, item, 1) and
    glows. Only a building whose save still holds a staff list (`si`)
    counts: one still taking staff, or one of the six our server keeps a
    staff for (`social.py`). *Not yet (ours gives helpers only to the
    harbour and zeppelin, `client/src/rules/dock.ts`).*
24. **Regrowing rocks whose 3 hours are up** are sold ("REGEN") and one
    of the four rocks of their kind bought free in their place. *Built:
    `regrow`, `client/src/rules/work.ts`.*
25. **Gold and stone clumps:** 3 of each wanted, less one for every 6
    rocks of that kind already there; 5 or 6 rocks a clump. *Partly: same
    numbers, but where (rule 28).*
26. **Trees:** 10 clumps of 16 to 19 wanted, less one for every 18 trees,
    then single trees until there are 100. *Partly: same numbers, but
    where (rule 28).*
27. **Animals:** 7 sheep, 7 cows and from level 11 six horses in a human
    town, 7 boars in a troll one, less those on the map, no more than 20 of
    a kind a day (`ANIMALS_PER_DAY`, counted in `privateState.arrayAnimals`);
    `admin_add_animal` (kind, how many). *Partly: same numbers
    (`client/src/rules/nature.ts`), but where (rule 28).*
28. **Where things grow:** blocks of the wild ring and middle blocks not
    yet bought; each piece bought free (`buy` ... type). Never aimed at the
    player's own land. *Different: ours grows them on the player's land
    instead of the unbought blocks (`wildAndOwnBlocks`,
    `client/src/rules/nature.ts`).*
29. **Raids are rolled:** from level 25 one chance in 10 of a siege
    (level 25), stampede (30) or army (35); bandit bands from levels 10, 15
    and 20 that attack 7, 14 and 21 minutes later; a band is the level
    divided by 4 (by 2 in a troll town), rounded up. Not saved. *Built:
    `client/src/rules/raids.ts`, `client/src/homeDefence.ts`.*
30. **The Moroccan dealer** is put near (40, 10) for "gold members" in a
    human town. *Not needed: our pages never mark a player as one.*
31. **Offer buildings and two adverts** (Social Wars, Dragon City) are put
    on the map when the page asks for them. *Not needed: our pages don't.*
32. **Neighbours' carts** (a human town only): one donkey cart for each
    neighbour who helped, all on the map at once near (50, 50), each with
    a card to let it in or send it away (`clean_received_assists` either
    way). *Partly: ours sends them one after another with a question in
    the bar, and in a troll town too (`welcomeCarts`,
    `client/src/editor.ts`).*
33. **Page windows and a score:** the invite page or the gifts page opens
    when the page asks (our classic page asks for gifts when some wait);
    from level 5, `rt_publish_score` (experience). *Gifts page: not yet on
    the new client's page; the score: not yet, harmless
    ([progress.md](rules/progress.md)).*

**The start-up windows** (`PopupManager.checkForNextStartPopup`). Not in
the tutorial. They come in this order; each one, when shown, waits for its
window to close before the next is looked at.

34. **The daily bonus** (level 5 and up, a human town, decided at step 8):
    opens by itself, can't be closed without collecting; goals are checked
    first. *Partly: a button the player taps (recorded,
    `client/src/bonuses.ts`).*
35. **The gacha or the news** (level 5 and up, each time home opens):
    half the time the gacha window if a gacha offer is on; otherwise the
    news window (hints, latest news, cash packs), once per page. *Gacha:
    not needed (no offer runs here); news: not yet (it's mostly offers;
    the owner's call).*
36. **A tournament invitation,** when the page asks. *Not needed.*
37. **Darts** (first start): the client looks for the current darts
    round, the last one in the config's `darts_items` whose start date
    has passed. If a new round has begun since the last
    (`darts_reset` with a new seed), or the day changed and balloons are
    left (`darts_new_free`), it gives a free throw and asks whether to
    play now. On our server this never happens: the clock is today's, so
    the current round is the config's last, from 9 September 2012, and
    that one has no prizes. The client treats a round with no prizes as
    no round, so it sends nothing and shows nothing. *Not needed: the
    original does nothing here either (checked twice).*
38. **The heavy siege's warning.** *Switched off (section 4).*
39. **The camp's window,** readied at step 22. On the page's first start
    the news is still pending, so it always waits until here; later it
    opens as the camp is put up. *Built: a notice, `client/src/homeCamps.ts`.*
40. **No town hall** (first start, home): a window says so. *Not yet.*
41. **The phone app's box:** never shows (the check always says no).
    *Not needed.*
42. **The harbour and zeppelin tower** (a human town): given and opened
    as needed ([town.md](rules/town.md)). Then, on the empire's second day
    (`daysSinceRegistration` 1), below level 15, if the camp is the
    Prisoner Princess and no allied knight is on the map: allies come (rule
    63). *Harbour and zeppelin: built, with small differences
    (`client/src/rules/dock.ts`); the allies: not yet.*
43. **The server's message** (`privateState.message`): shown with OK;
    OK sends `clear_message`. *Built: `showServerMessage`,
    `client/src/editor.ts` (ours shows it before the carts; recorded).*
44. **Settings kept on the computer:** music and effects on or off; the
    zoom always starts at 0.7 and the map at its starting spot. *Built:
    `client/src/sound.ts`, `client/src/view/camera.ts`.*

## 2. Clocks while playing

45. **The building tick, every second** (`onTimerHouseTick`, not stopped
    by the pause): every building's counter goes up by one. *Built: ours
    works from the clock rather than counting, checked every second
    (`refresh`, `client/src/editor.ts`).* On each tick:
    - **Production** that reaches its time shows a ready bubble. *Built
      (`client/src/rules/production.ts`).*
    - **A tree or rock being worked** finishes at its time (4 ticks a
      tree, 7 a rock; one tick with the Forestry or Minery Academy) and is
      harvested: `collect_new`, `sell` ... "HARV", 1 experience, a stone
      or gold rock leaving a regrowing one (free `buy` of 80 or 81). *Built:
      `client/src/rules/work.ts`.*
    - **A regrowing rock** whose 10,800 seconds are up turns back into a
      rock (`sell` ... "REGEN", free `buy`), during play as on opening.
      *Built.*
    - **The Sacrifice Altar** collects itself when its time is up. *Not
      yet (no altar).*
    - **The allies' market** with no resource chosen stays idle. *Not yet
      (no market).*
    - **The attack and spying cooldowns** count down. *Not yet (the
      switch).*
46. **The frame loop, 30 a second** (stopped by the pause): units walk,
    towers and castles shoot, the Healing Spring heals. Every 61 frames
    each unit's mind runs:
    - **Looking about:** a standing unit has a 4% chance to turn to a tile
      beside it. *Built: `client/src/rules/walking.ts`.*
    - **Saying a line:** one in five of those turns tries a speech
      bubble. Only cows, sheep and four kinds of troll have lines for
      standing about, so the others stay quiet. *Not yet (CLIENT.md
      says so).*
    - **Stepping off a shared tile:** an idle unit sharing its tile with
      something (not a field) walks to a free tile nearby. *Not yet
      ([town.md](rules/town.md)).*
    - **Repairing:** a villager at a hurt building puts back 25 life.
      *Built: `repair`, `client/src/editor.ts`.*
    - **Fighting at any time:** the town is always live. The player's
      towers shoot enemies in range, enemy units pick targets within their
      reach, the Healing Spring heals the player's nearest hurt unit, all
      without a raid going on. *Partly: ours runs a fight only during a
      raid or after units are sent at a camp (`client/src/homeDefence.ts`);
      the rules of who shoots when weren't read in depth here.*
    - **Wild animals** look for the player's units within 4 tiles and are
      caught. *Built: `caught`, `client/src/rules/animals.ts`, checked every
      second.*
47. **Every 50 frames** (home): the camp's enemies are counted; with none
    left, the chest lights up and the camera flies to it (except two
    camps); the top bar shows how many are left. *Built: lit up, checked
    every second (`watch`, `client/src/homeCamps.ts`); no camera flight
    (recorded); the count on the bar: not yet.*
48. **Every 70 frames** (home): if the enemies attacking (raiders aside)
    are at least twice the player's fighting units, they all walk back
    where they came from; with no enemy attacking, the town's music comes
    back. *Built: `client/src/homeDefence.ts`.*
49. **Every 2 seconds** (home, once loaded): goals are checked and one
    is paid (`complete_mission`, `reward_mission`); the spell box is
    refreshed. *Built: `client/src/goals.ts`.*
50. **Every 6 seconds:** the queued commands go to the server (the page
    may set 3 to 60 seconds; ours sets nothing). *Different: ours sends
    every 3 seconds (`client/src/net/commands.ts`, CLIENT.md).*
51. **Every 6 seconds:** units whose stopping tile changed are sent
    (`move` ... "Unitat"). *Different: ours sends each as it stops
    (recorded, `client/src/rules/walking.ts`).*
52. **Every 5 minutes,** away from home only (a battle), not in the
    tutorial: `ping`. *Not needed.*
53. **The camp's 4 hours** count down in the top bar; when they run out
    during play, the new camp comes then (rule 22). *Built: the camp comes
    (`watch`, `client/src/homeCamps.ts`); the countdown on the bar: not
    yet.*
54. **The next building ready** is counted down, one second at a time,
    but never shown: the original makes this clock hidden and above the
    top of the screen, and nothing ever shows it. *Not needed (checked
    twice; [town.md](rules/town.md) lists it as missing).*
55. **Bandits** come 7, 14 and 21 minutes after the town opened (or after
    the last level up, rule 58). *Built for the opening:
    `client/src/rules/raids.ts`.*
56. **Training and building:** a unit appears beside its building when
    its training is done; a new building is under scaffolding for 10
    seconds. *Training built (`client/src/rules/training.ts`); the
    scaffold: not yet ([town.md](rules/town.md)).*
57. **No regrowth clock.** Two timers for trees, rocks and animals (every
    60 seconds) and for bandits (every 3 minutes) are declared but never
    started: things grow back only when the town opens. *Built, the same
    (`client/src/main.ts`).*

## 3. On an event

58. **A level up** (each time experience is added): one window per level
    with its prize, `rt_level_up`. At home it also rolls the raids again,
    as at opening (rule 29). *Window: partly, a message (recorded,
    `client/src/editor.ts`); the raids: not yet (they're rolled only on
    opening, `client/src/homeDefence.ts`).*
59. **Levels 25, 30, 35 and every 5th after** (home): an enemy orc dragon
    (item 895) is put on the border. *Not yet.*
60. **Reaching exactly level 35** (home, any race): goals stop for the
    session, the spell box appears, a Wizardry Academy is placed free
    near (59, 59) (`buy`, free; even if the town has one), and a notice
    about the spell book shows. *Not yet: our goals run on until the next
    load, and no academy is given ([progress.md](rules/progress.md)).*
61. **From level 36,** each level adds 2 mana on screen. *Built: the
    server adds it (`magic.py`), and the new client adds the same during
    the visit whenever the Academy window or a spell check looks at the
    level (`magicParts`, `client/src/ui/spells.ts`). The window's mana
    count can still show the old number until it next redraws.*
62. **Reaching level 4** in the empire's first days shows the
    welcome-back chest (switched off in the original; on here, the
    owner's call). *Built: `client/src/bonuses.ts`.*
63. **Closing level 5's window** (home, human town, no tutorial) while the
    camp is the Prisoner Princess and no allied knight is on the map, or on
    the second day (rule 42): a window says help has come; enemies more
    than 10 tiles from the princess's camp are removed (`sell`, free,
    "QUEST_HELP"); 9 allied knights (item 576) are bought free in the map
    corner away from the camp, walk to the town hall and join the player.
    *Not yet.*
64. **A goal reached:** sent at the next 2-second check, paid one a check
    (rule 49). *Built.*
65. **A tree or rock harvested:** besides the resources, now and then a
    collection piece (human towns only), sent with `add_collectable`
    (collection, piece) when it lands; with the line done, the villager
    goes on to the touching trees or rocks by itself. *Pieces: not yet; the
    next tree: built, with small differences ([town.md](rules/town.md));
    pieces from trees and rocks: built since "Collection pieces",
    `client/src/rules/collections.ts`.*
66. **Dropped rewards** (resources, experience, pieces) fall as tokens to
    tap; they collect themselves when six or more are about, and
    experience always does. *Partly: ours adds them at once, with a rising
    number.*
67. **A wild animal caught:** a "captured" mark for 5 seconds, then it
    walks to its ranch or the town hall. *Built:
    `client/src/rules/animals.ts`, `client/src/editor.ts`.*
68. **A trained unit:** counted for goals; a special unit's 24-hour life
    is reset, but nothing ever reads it. *Built (goals); the life: not
    needed.*
69. **The last enemy of a camp falls:** see rule 47.
70. **A camp's window closed** the first time this computer sees that
    camp: the camera flies to the chest. *Not needed (recorded: no camera
    flights).*
71. **Travelling to the other town:** the queued commands are sent, the
    harbour and zeppelin are forgotten, the spell box switched off and the
    other town loaded; its whole opening (section 1) runs again. *Not yet
    (no second town).*
72. **The day changing during play:** nothing happens. Everything daily
    is decided as the town opens: the daily bonus, Monday's chest, darts'
    free throw, neighbours' help (24 hours), the animals' daily count (the
    server starts it again each day), the market's trades (20 hours).
    *Built, the same: decided on opening (`client/src/bonuses.ts`,
    `animals.py`).*
73. **The page losing focus** pauses the game (not in the tutorial);
    buildings' clocks run on. *Owner-requested difference, 16 October 2026:
    tab changes keep simulation running (`client/src/gameLoop.ts`);
    explicit Pause remains (`client/src/ui/pause.ts`).*

## 4. Switched off by a setting

74. **The heavy siege** (`Config.HEAVY_SIEGE` false): would have come
    every 4 days from level 25, after a 6-hour warning
    (`start_heavy_siege`), with its own window at start-up. *Not needed.*
75. **The welcome-back chest** (`Config.COME_BACK_2ND_3RD` false). *On
    here, the owner's call (DECISIONS.md, 15 October 2026).*
76. **The speed-hack watch** (`SPEED_HACK_CONTROL` 0 in the config):
    would have paused the game with a warning when the game ran too fast
    (`system_set_count_hack`). *Not needed.*
77. **A dragon nest after the tutorial**
    (`Config.SPAWN_DRAGON_NEST_AFTER_TUTORIAL` false). *Not needed.*
78. **Paying cash to skip a goal** (`Config.CAN_PAY_FOR_GOALS` false
    unless a test page sets it). *Not needed (ours has none).*
79. **Test switches the page can set:** no graveyard, no experience in
    the shop, forced reloads after attacks or quests, a forced clock
    error, fake friends, video icons. *Not needed.*
80. **Collecting trees and rocks by themselves** (`Config.AUTO_COLLECT`
    true): on, so harvests finish on their own and villagers move on to
    the touching ones. *Built.*
81. **The dragon picker after the tutorial**
    (`Config.POPUP_CHOOSE_YOUR_DRAGON` true): on. *Built (`client/src/ui/draggy.ts`).*
82. **The Moroccan dealer** (`SPAWN_MOROCCO_DEALER` 1, but only for gold
    members) and the adverts and offer buildings (page settings): off in
    practice on our pages. *Not needed.*
83. **Dead code:** the special units' 24-hour expiry and the daily
    upgrade count are kept but never acted on. *Not needed.*

## What the new client lacks

Most serious first. "Recorded" means DECISIONS.md already has it as a
call. "(checked twice)" means a second reader went through the original's
code and ours again and found the same. That second reading removed two
claims: darts' start check (rule 37: the original does nothing on our
server) and mana per level (rule 61: ours adds it during the visit too).
It also took the next building's countdown off the top bar list (rule 54:
the original never shows it).

1. **Trees, rocks and animals grow on the player's land** (changes the
   save, rule 28). The original grows them in the wild ring and on middle
   blocks not yet bought (`client/src/rules/nature.ts`). (checked twice)
2. **Reaching level 35** (changes the save, rule 60): no free Wizardry
   Academy, and goals keep running until the next load
   (`client/src/editor.ts`, `client/src/goals.ts`). (checked twice)
3. **A level up doesn't roll the raids again, and no orc dragon comes at
   25, 30, 35...** (rules 58, 59; `client/src/homeDefence.ts`). (checked
   twice)
4. **The princess's allies** (changes the save, rules 42 and 63): 9 free
   knights on the second day or at level 5, and far enemies removed.
   (checked twice)
5. **Social buildings' free helpers on opening** (changes the save, rule
   23). (checked twice)
6. **Collection pieces** from trees, rocks and enemies (changes the save,
   rule 65). (checked twice) *Trees and rocks: fixed since "Collection pieces"; enemies
   come with the battles (Beta 2).*
7. **The town is only live during a fight** (rule 46): towers, enemies'
   reach and the Healing Spring act at home only in a raid or after units
   are sent at a camp (`client/src/homeDefence.ts`). The second reading
   confirmed that much; who shoots when, rule by rule, was still not
   compared in depth. (checked twice)
8. **Growth before the camp** (changes the save): ours grows before the
   camp clears the wild ring, the original after (rules 22 to 28;
   `client/src/main.ts`, [town.md](rules/town.md)). (checked twice)
9. **Lost things** on each opening (rule 19). (checked twice)
10. **The no-town-hall window** (rule 40). (checked twice)
11. **The top bar's camp clock:** the camp's countdown and, once it has
    run out, the enemies left (rules 47, 53). (checked twice)
12. **Carts** come one after another, and in a troll town too (rule 32;
    `client/src/editor.ts`). (checked twice)
13. **Units' speech bubbles** (only cows, sheep and some trolls have lines
    for standing about) and **stepping off shared tiles** (rule 46).
    (checked twice)
14. **The start-up windows:** the daily bonus waits for a tap (recorded),
    no news window, no gifts page on start (rules 33 to 35). (checked
    twice)
15. **Commands go every 3 seconds,** not 6 (rule 50; CLIENT.md). (checked
    twice)
16. **`rt_publish_score`** isn't sent (rule 33; harmless). (checked twice)
17. **Attacks received while away** (rule 14) and the attack and spying
    counters (rules 7, 45): with attacks on players, at the switch.
    (checked twice)
