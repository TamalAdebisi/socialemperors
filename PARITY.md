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
      Ours offered it: removed. S
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
- [ ] **On the map when selected:** a yellow outline of its footprint,
      its name under it, a small health bar. Ours glows (a decision). S
- [ ] **The wall gate opens and closes,** for units to pass (not saved). S

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
- [ ] **Construction:** a new building stands in scaffolding for 10
      seconds, with a bar and its sounds, and can't be used meanwhile. M
- [x] **Turning while placing** (Space). S
- [ ] **On phones, seeing where a building will go** before it's bought. S
- [x] **Clean-up on load:** overlapping buildings go to storage, units on
      a taken tile step aside, a town with no villager gets one. S
- [ ] **Small things:** "for sale" signs on closed land; tapping the ready
      bubble collects; the refund rises as a number when selling; a name
      and time bar when hovering a building; a short "collecting" bar.
      S each
- [x] **Keyboard:** S, A and W both moved the map and opened a window;
      the arrow keys move it now, as in the original. S

## Windows and messages

- [ ] **Level-up window:** the new level, its prize, and up to 4 buildings
      that just became available. Ours is a short message that can be lost
      when several are waiting. M
- [x] **Messages from the server at start** ("Bob helped your farm", "a
      gift is waiting") are shown once, then cleared. Ours ignored them,
      so they piled up for the classic game. S
- [ ] **Shop:** what each item gives or houses (and a trained unit's
      numbers), shown on hover or tap; a confirmation before opening a
      building early for cash; the tabs' own pictures; "new" badges. M
- [ ] **Goals:** a window per goal with its picture, text and a help arrow;
      "New mission!" notices. M
- [ ] **Gifts and the site's bar:** the gifts window (taking gifts in,
      giving from storage, the free gift) and Empires, Friends and Log out,
      as on the classic page. M
- [ ] **Neighbours:** sorted by XP, with their XP and a mark on those you
      can help; Send gift. Friends' help on a building shows their picture
      over it; tapping takes an hour off. M
- [ ] **Hurry:** the original's window adds "Ask friends". S
- [ ] **Selecting several units** with the square tool or a double click,
      and moving them as a group. M
- [ ] **Renaming the town** from the game. S

## Your calls (15 October 2026)

- [ ] **The troll town** (a second town, from level 20): in Beta 1. L
- [ ] **The market** (trading wood, food and stone; three goals need it): in
      Beta 1. M
- **The Daily News window**: left out. It showed Social Point's news,
  offers for cash and a few tips; there's no news to show now.

## Already the same

Levels and their prizes; harvests, working times and their sizes; hurry;
training and its prices; room for people; land and its prices; opening
buildings early; the bank; goal checking and paying; the daily bonus,
Monday and welcome-back chests' prizes; helping neighbours and the donkey
carts; Arthur. These were checked against the original line by line.

## Not for Beta 1

**Beta 2:** health and fighting numbers in battle, defending the town
(raids, sieges, the enemy camp), fire and repair, spells, heroes and their
graveyard, the dock and zeppelin, pausing.

**Later:** collections, the units book, offer packs, markets for allies,
social buildings, dragons, the weather and time machines, the unit
warehouse, darts, survival, tournaments, the tutorial.

**Not needed:** what only Facebook, the iPhone app, other games' adverts or
Social Point's admin tools used.
