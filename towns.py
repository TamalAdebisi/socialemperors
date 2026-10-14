"""
The second town: a troll town.

From level 20, the globe in the games menu opens a window that founds a troll
town for 100,000 gold or 22 cash. Those are the price and the level the client
shows and checks (its own constants; it never reads the game config's
"town_prices"). The client takes the price on its own screen, sends "buy_map"
and travels to the new town. From then on the same globe travels between the
two towns.

Commands from the client:

    "buy_map"   [town, paid with cash (1) or gold (0), race, the town paying]

Opening a town is "get_player_info" with map=<town> (and user=<the player's
own id> when travelling); without a map the client opens the default town.

Each town keeps its own gold, wood, stone, food, experience, level and story
quest; cash, mana, islands and collections belong to the player. A few
commands don't say which town they mean (a level up, the Monday bonus, a
golden statue, a prize put in storage): they count for the town the player
has open, which the server remembers as "town" in the save.

A new troll town starts the way a new empire does (the same land, trees and
resources) with each human building swapped for the troll one the client
pairs it with, and the soldiers swapped for the cheapest troll soldiers of the
same kind: Boar Riders for the Light Knights (both mounted) and Troll Archers
for the Light Archers. The two Small Trolls of a new empire are the enemies of
Arthur's first lesson; a second town has no lesson, so nobody waits there.
(The client's window only ever asks for a troll town; a human one, if asked
for, is a new empire's start without them.)
"""

import copy
import json
import os

from bundle import VILLAGES_DIR
from engine import timestamp_now
from version import add_missing_fields
from village import ID, take

TOWN_PRICE_GOLD = 100000
TOWN_PRICE_CASH = 22
LEVEL_REQUIRED = 20
TOWNS_MOST = 2         # the client only travels between town 0 and town 1
DEFAULT_NAME = "My Empire"  # the client shows its own words for this name

# What a troll town has in place of a new empire's things.
TROLL_START = {
    26: 289,    # Town Hall -> Troll Hall I
    1: 307,     # House I -> Troll House I
    29: 291,    # Tower I -> Troll Tower I
    512: 599,   # Light Knight -> Boar Rider
    516: 589,   # Light Archer -> Troll Archer
}
ARTHURS_ENEMY = 525  # the Small Trolls of Arthur's first lesson, which only the first town has

with open(os.path.join(VILLAGES_DIR, "initial.json")) as f:
    _START = json.load(f)["maps"][0]


def new_town(town_id: int, race: str) -> dict:
    town = copy.deepcopy(_START)
    town["id"] = town_id
    town["race"] = race
    town["timestamp"] = timestamp_now()
    swaps = TROLL_START if race == "t" else {}
    town["items"] = [[swaps.get(item[ID], item[ID])] + item[1:]
                     for item in town["items"] if item[ID] != ARTHURS_ENEMY]
    return town


def buy_map(save: dict, town_id, with_cash, race, paying_town) -> str:
    maps, info = save["maps"], save["playerInfo"]
    town_id, paying_town = int(town_id), int(paying_town)
    if town_id != len(maps) or town_id >= TOWNS_MOST:
        return f"Town {town_id} can't be founded: the empire has {len(maps)} town(s)."
    if not 0 <= paying_town < len(maps):
        return f"There is no town {paying_town} to pay from."
    payer = maps[paying_town]
    if int(payer.get("level") or 1) < LEVEL_REQUIRED:
        return f"A second town needs level {LEVEL_REQUIRED}."
    if str(with_cash) == "1":
        if int(info.get("cash") or 0) < TOWN_PRICE_CASH:
            return f"A second town costs {TOWN_PRICE_CASH} cash."
        take(save, payer, "c", TOWN_PRICE_CASH)
        paid = f"{TOWN_PRICE_CASH} cash"
    else:
        if int(payer.get("coins") or 0) < TOWN_PRICE_GOLD:
            return f"A second town costs {TOWN_PRICE_GOLD} gold."
        take(save, payer, "g", TOWN_PRICE_GOLD)
        paid = f"{TOWN_PRICE_GOLD} gold"
    race = race if race in ("h", "t") else "t"

    maps.append(new_town(town_id, race))
    for key, empty in (("map_names", DEFAULT_NAME), ("map_sizes", 0)):
        while len(info[key]) < len(maps):
            info[key].append(empty)
    save["privateState"]["maps"] = [{"r": m.get("race", "h")} for m in maps]  # how the client counts towns
    add_missing_fields(save)
    return f"Town {town_id} founded ({'troll' if race == 't' else 'human'}) for {paid}."


def current(save: dict) -> int:
    """The town the player has open."""
    town_id = save.get("town")
    if isinstance(town_id, int) and 0 <= town_id < len(save["maps"]):
        return town_id
    default = int(save["playerInfo"].get("default_map") or 0)
    return default if 0 <= default < len(save["maps"]) else 0


def open_town(save: dict, town_id=None) -> int:
    """The player opens a town: the one asked for, or the default one if there
    is no such town. Remembered for the commands that don't name a town."""
    if not (isinstance(town_id, int) and 0 <= town_id < len(save["maps"])):
        save.pop("town", None)
        town_id = current(save)
    save["town"] = town_id
    return town_id
