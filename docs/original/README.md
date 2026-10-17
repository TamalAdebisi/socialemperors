# The map of the original

What the original Flash client does, part by part, in our own words, and
how far the new client has got with each part. Made on 15 October 2026 by
reading the whole decompiled client on this computer
(`tools/decompile_client.sh`; the code itself is never committed, see
CLAUDE.md, "Never").

Beta 1 got rules wrong because each feature read only the part of the
original next to its own window. Rules that live elsewhere, or that run
with no button, were missed. This map is there so that doesn't happen
again: before building something, look it up here; after building it,
update its status here.

## What's in it

| File | What it is |
| --- | --- |
| [index/](index/) | **The index.** All 1,505 classes of the client, one line each: what it does, and the new client's status. Seven files by area (below) |
| [rules/town.md](rules/town.md) | **Rule book: running a town.** The map, land, placing and moving, construction, upgrading, production, houses, training, villagers, walking, wild animals, what grows back, tidying, special buildings, storage, the troll town. 127 rules |
| [rules/progress.md](rules/progress.md) | **Rule book: levels, goals, bonuses and the shop.** Experience, level ups, how every kind of goal is counted and paid, the three bonuses, the shop and its prices, the market, the second town. 113 rules |
| [rules/neighbours.md](rules/neighbours.md) | **Rule book: neighbours and messages.** The neighbours bar, visiting, helping, the carts, asking friends, gifts, social buildings, Arthur, and the windows that open as the game starts. 76 rules |
| [rules/tournaments.md](rules/tournaments.md) | **Rule book: tournaments.** Lists and teams, entry/fees, rooms, copied-army battles, scoring, results/prizes and friends' creation/invitation policy |
| [rules/warehouse.md](rules/warehouse.md) | **Rule book: the Unit Warehouse.** Admission, off-map population, slot pages, deployment checks, bought capacity, storing and selling |
| [no-button.md](no-button.md) | **Rules with no button.** Everything the client does by itself: the start, in order; timers; what happens on a level up or a new day; what's switched off. 83 rules |

The index, by area:

| File | Classes | Built | Partly | Not yet |
| --- | ---: | ---: | ---: | ---: |
| [index/core.md](index/core.md): the game's core (loading, the save, the start) | 42 | 19 | 12 | 7 |
| [index/engine.md](index/engine.md): the map engine, units, attacks, magic | 183 | 107 | 65 | 2 |
| [index/delegates.md](index/delegates.md): what special buildings and units do | 350 | 125 | 215 | 6 |
| [index/windows.md](index/windows.md): the windows | 136 | 65 | 11 | 32 |
| [index/interface.md](index/interface.md): bars, menus, managers, small modules | 98 | 36 | 16 | 17 |
| [index/quests.md](index/quests.md): quests and battles | 99 | 66 | 10 | 15 |
| [index/art-and-libraries.md](index/art-and-libraries.md): picture holders, others' libraries | 597 | 2 | 0 | 0 |
| **All** | **1,505** | **420** | **329** | **79** |

The rest are picture holders (508), other people's libraries (79), parts
we don't need (89: Facebook, the iPhone app, payments, adverts, Social
Point's tools) and one handled by the server alone. So of the 829
classes that hold the game's own behaviour, about 50% are built in the
new client, 40% partly and 10% not yet. "Partly" is mostly the special
buildings and units, whose plain fighting works but whose own moves
often don't yet.

## How sure it is

- **The index** was written by seven readers, one per area. Each class was
  read at least enough to say what it does; the big ones through. A
  status was decided by searching our code, not by guessing. Where a
  reader only skimmed, the file says so.
- **The rule books and the list of rules with no button** were each read
  end to end by one reader. Then a second reader went back over every
  difference claimed against the new client and tried to prove it wrong.
  Of 113 claimed, 110 held ("(checked twice)" in the files) and 3 didn't:
  they were corrected, not dropped. One is still marked "unsure".
- **What it is not:** a measurement. It's a careful reading of the code,
  not the two games played side by side. A rule here can still be wrong
  where the code is hard to follow; the parity check (PARITY.md) and the
  browser tests are where a rule gets proved.

## The rules for these notes

- Our own words: what the game does, its numbers, its conditions and
  quirks. No code, no line-by-line translation, no long quotes of the
  game's text. Class names, file paths, server commands and config keys
  are named, as references to find things by.
- Each rule says how the new client compares: same, different, missing,
  or not checked, with our file.
- When something is built or fixed, change its status here in the same
  pull request, as with CLIENT.md and ROADMAP.md.
