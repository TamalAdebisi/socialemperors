# Parity: the new client against the Flash game

What the new client still lacks, or does differently, compared with the
original Flash client, for running a town (Beta 1). Made on 15 October 2026
from two checks: five read-throughs of the Flash client's code, one per
area (the selected building's card, the screen and its windows, the shop
and storage, the map, the rules), each checked against `client/src`; and
the same empire played side by side in both clients on this computer.

The notes are in our own words; the Flash client's code stays on this
computer (CLAUDE.md, "Never"). Each line says what the original does, then
where we stand. Sizes: **S** a few hours, **M** about a day, **L** more.
Tick a line when its fix is merged.

## Rules we get wrong

These come first: both clients play the same empire, so a wrong rule
changes the save, not just the look.

- [x] **A ranch's harvest uses up an animal.** Each collect takes one
      animal out for good (`pop_unit` with no tile); an empty ranch stops.
      Ours keeps them, so a ranch gives food forever. S
- [x] **Villagers by town hall.** Speed 3 with no town hall, 5 with I or
      II, 6 with III or IV (+2 with the Academy); renamed Villager I to
      IV; a queue of trees or rocks of 3/5/7/9/10 (+2 with the Academy),
      the queued ones glowing. Ours walk at 3 (about 40% slower) and have
      no queue. S (speed), M (queue)
- [x] **The last worker out of a mill or mine with a working time** loses
      its work: the choice goes back to none (`activate`, 0) and it asks
      again. Ours keeps the choice. S
- [x] **Skipping a goal for cash** was switched off in the original (only
      a test switch turned it on). Ours offers Skip: remove it. S
- [x] **The daily bonus** is offered only from level 5, and only in a
      human town. Ours, at any level. S
- [x] **Goals stop at level 35** in a human town, and don't run in a troll
      town. Ours carry on. S
- [x] **The welcome-back chest** was switched off inside the Flash client
      as it was built (a setting nothing turns on), so it never showed.
      Ours offered it, and was removed. But our classic game switches it on
      (`tools/patch_client.py`), so the two clients differed: the owner
      chose to keep it in both, and ours now offers it as the patched
      classic game does (from level 4, days 0 to 2, three chests). S
- [x] **Visiting shows the neighbour's** name, level, gold, wood, food and
      stone in the top bar, and the helps left. Ours shows your own
      numbers (and DECISIONS.md said, wrongly, that the original did). S
- [x] **The Great Church's room for people** is counted once; ours counts
      it twice. S
- [x] **The Sacrifice Altar** takes units, any but siege engines, and gives
      back 1/20 of their gold price; ours let a villager in as if it were
      a mine. Now it lets nobody in (the altar stays a classic-game
      building for now). **Refuges** take siege engines too, now ours as
      well. S
- [x] **The Cash Wonder** gives 1 cash every 24 hours; ours never gets
      ready. **The Forestry and Minery academies** make chopping and mining
      take about a second; ours don't. S
- [x] **Goal 44** ("Visit Arthur") and the help-your-neighbours goals can
      be done in the new client now; they still say "classic game". Goal
      44's title shows "#0#" instead of the host's name. S

## The building card

- [ ] **Upgrade.** 104 buildings upgrade to the next one (houses, farms,
      mills, ranches, towers, walls, barracks, the town hall...). It needs
      the next one's level, costs its full price, gives back 1/20 of the
      old one's (none if it cost cash), and gives its XP: `sell` (reason
      "UPGR") then `buy` on the same spot. Town Hall II to IV (levels 12,
      25 and 35) can only be had this way, so three goals can't be done
      now. The server already handles it. M
- [ ] **What it shows:** the building's picture with its health, its
      numbers (attack, speed, range; the room a house gives), what the next
      collect brings and a time bar, how full it is, the units inside (tap
      one to let it out), the unit a barracks trains with its name and
      numbers, and a short tip per kind of building. S each
- [x] **On the map when selected:** a golden ring under a unit, a golden
      outline of a building's ground, a small life bar over either. Ours
      only glowed. S
- [x] **The wall gate opens and closes,** for units to pass (not saved). S

The card's look is the owner's pick (CLIENT.md, "The menus: rail and
dock"), so these come with a mockup first.

## The living map

- [x] **Trees and rocks grow back** every time the town opens: tree
      clusters and single trees, gold and stone rocks. Ours never added
      any, so wood ran out in an empire played only here. S
- [x] **Wild animals grow back** the same way: sheep, cows and (from level
      11) horses, at most 20 of a kind a day. The server never reset the
      daily count: fixed at the same time. S
- [x] **Wild animals** become yours when a unit comes near, then walk into
      a ranch of their kind (horses to the training stable). Three early
      goals need it. M
- [x] **Farms and ranches show their state:** an empty field, the farmer
      at work, ripe crops; a ranch with the animals that are in it. Ours
      cycled through all of them, a man, a woman and ripe crops, whoever
      was there. S
- [x] **Construction:** a new building stands in scaffolding for 10
      seconds, with a bar and its sounds, and can't be used meanwhile. M
- [x] **Turning while placing** (Space). S
- [x] **On phones, seeing where a building will go** before it's bought. S
- [x] **Clean-up on load:** overlapping buildings go to storage, units on
      a taken tile step aside, a town with no villager gets one. S
- [x] **Tapping the ready bubble collects;** the refund rises as a number
      when selling. S
- [x] **"For sale" signs** on closed land. S
- [x] **Small things:** when hovering a thing, a thin white outline, its
      life bar, and a bar with its name and time; a short "collecting"
      bar. S each
- [x] **Keyboard:** S, A and W both moved the map and opened a window;
      the arrow keys move it now, as in the original. S

## Windows and messages

- [x] **Level-up window:** the new level, its prize, and up to 4 buildings
      that just became available. Ours is a short message that can be lost
      when several are waiting. M
- [x] **Messages from the server at start** ("Bob helped your farm", "a
      gift is waiting") are shown once, then cleared. Ours ignored them,
      so they piled up for the classic game. S
- [ ] **Shop:** what each item gives or houses (and a trained unit's
      numbers), shown on hover or tap; a confirmation before opening a
      building early for cash; the tabs' own pictures; "new" badges. M
- [x] **Goals:** a window per goal with its picture, text and a help arrow;
      "New mission!" notices. M
- [x] **Gifts:** the gifts window (taking gifts in, giving from storage,
      the free gift), as on the classic page. M
- [ ] **The site's bar:** Empires, Friends and Log out, as on the classic
      page (where it goes is the owner's call). S
- [x] **Neighbours:** sorted by XP, with their XP and a mark on those you
      can help; Send gift. M
- [x] **Friends' help on a building** shows their picture over it;
      tapping takes an hour off. S
- [x] **Hurry:** the original's window adds "Ask friends". S
- [x] **Selecting several units** with the square tool (or Space), a box
      or a double click, and sending them as a group. M
- [x] **The pointer's tools:** the original's pointer button opens a menu
      of tools: Remove (the bulldozer, which stays on to remove one thing
      after another) and Fast collect (the glove, collecting what it's
      swept over). S
- [x] **Renaming the town** from the game. S

## Your calls (15 October 2026)

- [x] **The troll town** (a second town, from level 20): in Beta 1. L
- [x] **The market** (trading wood, food and stone; three goals need it): in
      Beta 1. M
- **The Daily News window**: left out. It showed Social Point's news,
  offers for cash and a few tips; there's no news to show now.

## Found by the map of the original (15 October 2026)

Rules that change the save, found by reading the whole client
([docs/original/](docs/original/README.md)) and checked by a second
reader. Each links to its rule book, which has the details and our file.
The rule books list more that only look or feel different.

- [x] **Opening buildings early** is switched off in the original: the
      "Level N" tag on a shop card does nothing. Ours sells it for cash.
      ([progress](docs/original/rules/progress.md#differences)) S
- [x] **Reaching level 35** stops goals at once and places a free Wizardry
      Academy near the middle; ours keeps goals until the next load and
      gives no academy. ([progress](docs/original/rules/progress.md#differences)) S
- [x] **Goals count doings only while a goal of that kind is open;** ours
      from the page's opening, so goals can finish and pay sooner. Goal 18
      (units near the town hall) is a 3-tile circle, nearest 20, not ours
      7 by 7; the working-time goals keep the last time chosen, not the
      longest. ([progress](docs/original/rules/progress.md#differences)) M
- [x] **Moving a building** lets everybody inside out and resets its
      working time, even if the move is cancelled. ([town](docs/original/rules/town.md#differences)) S
- [x] **A unit placed from storage** obeys its kind's limit, as training
      does. ([town](docs/original/rules/town.md#differences)) S
- [x] **Where new units come out** (trained, let out, from the nursery):
      the first free ring, on the tile nearest the far corner. ([town](docs/original/rules/town.md#differences)) S
- [x] **What grows back** grows in the wild ring and on land not yet
      bought, never aimed at the player's land; and after the camp is put
      up, not before. ([town](docs/original/rules/town.md#differences)) S
- [x] **The free villager** comes when none is on the map or working
      inside farms, mills, mines, trees or rocks (refuges don't count).
      ([town](docs/original/rules/town.md#differences)) S
- [x] **The Nursery** only takes an animal of the kind already inside.
      ([town](docs/original/rules/town.md#differences)) S
- [x] **The free harbour and zeppelin tower** aren't given when one waits
      in storage or the gift box; one still waiting for its crew gets 20
      helpers. ([town](docs/original/rules/town.md#differences)) S
- [x] **Social buildings get a free helper** as the town opens, when their
      list is empty and they have 3 or more places (or one helper and 7 or
      more). ([neighbours](docs/original/rules/neighbours.md#differences)) S
- [x] **Collection pieces** now and then drop from trees and rocks in a
      human town (`add_collectable`). ([no button](docs/original/no-button.md)) M
- Kept as decided before (DECISIONS.md, "the rules the original plays
  by"): a farm collected without enough wood is kept, where the original
  destroyed it; the worker bonus counts the workers inside now, where the
  original kept the count from the first harvest until a reload.

## Already the same

Levels and their prizes; harvests, working times and their sizes; hurry;
training and its prices; room for people; land and its prices; the bank;
goal checking and paying; the daily bonus, Monday and welcome-back
chests' prizes; helping neighbours and the donkey carts; Arthur. These
were checked against the original line by line. *Corrected 15 October
2026:* this list also had "opening buildings early"; the map of the
original found it is switched off in the original (above). Goal checking
has differences too (above).

## Beta 2: battles and quests

Made on 15 October 2026 the same way: four read-throughs of the Flash
client's code (the battle, the islands, spells and special moves,
defending the town), each checked against `client/src` and the server.
Ticked lines are fixed; the rest wait, with their reasons. Calls made are
in [DECISIONS.md](DECISIONS.md).

### Rules we got wrong, now fixed

- [x] **A camp troll moved in one fight and killed in a later one** stayed
      in the save (the server knows it by the tile it was saved on), and
      came back after a reload. S
- [x] **Winning a god island early opened the island chain** up to it
      (server). S
- [x] **"Complete an island on N stars" goals** never completed: now
      counted from the stars the save keeps; with them "Build Harbor",
      "Check the map" and "Sail in another way". S
- [x] **A standing camp was put up afresh on every return home**; the
      original does it once a session. A camp due while the town is open
      now comes then. S
- [x] **Area moves** (whirls, stomps, smashes, beams) hit buildings and
      villagers; the original's pick fighting units only. M
- [x] **Button cooldowns** ran from the end of the move, not its start; a
      LIMIT now clears them, as in the original. S
- [x] **Special units:** the High Elf's and Anubis's two copies for 20
      seconds, again and again; the Halberdier's and Balrog's diagonal
      strike and stomp timings; Thor's throwing hits and square storm; the
      werewolf's throws and its victim's life; the albino werewolf; the
      Valkyrie's, Wallace's and the Valkyr's help for basic units only. S
- [x] **Mana** could be stale in a fight at home until a reload; the mana
      levels from 36 bring wasn't added here. S
- [x] **Defending the town:** the trolls' mercy (they give up when they
      outnumber the player two to one); no going into a burnt-out building;
      the stampede standing with no units to charge; the army aiming by the
      land opened; bandits not switching kinds; captains' pacing and lines;
      camp towers paying; new camp soldiers holding their ground. S each
- [x] **The battle:** the engineer mends siege engines; the healing spring
      doesn't; bosses and their adds don't answer calls for help; the
      elemental units' bonus; the monk goes for the nearest enemy; the
      Dragon Killer Fortress turns to dragons; the Ice Tower shoots units
      only; the Attack Booster Wizard; units look again by their own reach
      after a kill. S each
- [x] **The Arctic Isle's stables** were an enemy; the original leaves
      them be. **"Leave the island?"** now pauses the battle. S

### Still to do

- [ ] **Who is an enemy on some islands.** The original's civilization,
      troll, hardcore, god and Desert islands make cows, sheep, trees, gold
      and stone deposits and refuges enemies (units would wander off to
      chop the Elven Empire's 341 trees). The read-through wasn't sure how
      it played: to check in the Flash game before copying. S
- [ ] **The team of 20** for the last islands may take units inside
      buildings, in the unit warehouse and in storage; ours, units standing
      in town. Units in a refuge sail with the army in the original. M
- [ ] **Domes:** the Protection Dome halves hits within 9 tiles; the Tower
      Enhancer doubles nearby towers' rate (shop, levels 42 and 47). M
- [x] **The Wall Door** can be opened and shut by its owner in the
      original. M
- [ ] **Squads:** units sent together re-form round a walking target, and
      archers step back from closer than 3 tiles. M
- [ ] **Collection pieces** from kills on islands and at home, and the Blue
      Phoenix's egg: with the collections, in the last stop. M
- [ ] **Smaller:** old-style shots fly up to 40% faster in ours; enemy
      towers wake up a little late in the original; the original's nearest-
      target search can miss a house in range; a camp chest can't open
      while raiders are on the map (DECISIONS.md, "Bandits appear when they
      attack"). S each

### Kept as ours (DECISIONS.md)

The Ether Shield protects its marker's square (the original's protected
nothing at rank 3), Fire Havoc falls inside its marker, the Arctic Isle's
lent units are counted rightly, nothing counts after an island is decided,
units on the border walk home rather than being sold, a walled-off order
frees its unit.

## Not for Beta 1

**Later:** collections, the units book, offer packs, markets for allies,
social buildings, dragons, the weather and time machines, the unit
warehouse, darts, survival, tournaments, the tutorial.

**Not needed:** what only Facebook, the iPhone app, other games' adverts or
Social Point's admin tools used.
