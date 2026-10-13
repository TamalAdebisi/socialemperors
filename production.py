"""
Buildings that produce: collecting from them, and their production timers.

A map item keeps the moment its work started in item[4]. The client works
out how long a building has been working as "server time now minus item[4]",
and only lets the player collect once that reaches the building's
activation time. So whenever the client starts a building's work over, the
server moves item[4] to now as well; otherwise, after a reload, a building
that was just collected looks ready again:

    collecting                             its work starts over
    the first worker walks into it         an idle building starts working
    choosing how long a farm works         ("activate", farms and mills)

Commands from the client:

    "collect_new" [x, y, town, item, workers inside, multiplier, cash]
        from a building, a mine, a tree, a rock...  The multiplier is the
        client's level bonus for gold mines; cash is paid to hurry it.
    "collect_new" [x, y, town, item]
        from the few things that are not buildings, such as the Round Table
    "activate" [x, y, town, item, choice]
        choice 1-4 picks how long a farm or mill works (5 minutes to 8
        hours, for half to three times the harvest); 0 clears it after
        collecting

What a collect gives, as the client works it out:

    harvest = the item's "collect" x the multiplier
    each worker after the first adds a fifth of that (buildings only)
    farms and mills multiply it by their chosen working time
    farms use up a third of their harvest in wood
    and the item's "collect_xp" is added as experience
"""

import math

from engine import timestamp_now
from get_game_config import get_attribute_from_item_id, get_game_config
from village import ATTRS, STARTED, UNITS, flash_round, full, give, item_at, number, take

EXTRA_PER_WORKER = 0.2
FARM = "122"  # subcat_functional of farms
HATCHERY = 226  # needs two units inside before it works


def _working_time_multiplier(item_id, item) -> float:
    g = get_game_config()["globals"]
    if int(item_id) not in [int(i) for i in g.get("COLLECT_VARIABLE_IDS", [])]:
        return 1
    choice = int((item[ATTRS] or {}).get("cp", 0)) if item is not None and len(item) > ATTRS else 0
    multipliers = g.get("COLLECT_MULTIPLIER", [0.5, 1, 2, 3])
    return multipliers[choice - 1] if 1 <= choice <= len(multipliers) else 1


def harvest(item_id, item, workers=None, multiplier=1) -> int:
    """How much one collect gives. workers is None for things that are not buildings."""
    base = math.floor(number(item_id, "collect")) * multiplier
    if workers is None:
        return int(base)
    time_multiplier = _working_time_multiplier(item_id, item)
    if workers > 1:
        return int(math.floor(math.floor(base + (workers - 1) * base * EXTRA_PER_WORKER) * time_multiplier))
    return int(math.floor(base * time_multiplier))


def collect(save: dict, x, y, town_id: int, item_id, workers=None, multiplier=1, cash=0) -> str:
    map = save["maps"][town_id]
    item = item_at(map, item_id, x, y)
    multiplier = min(max(int(multiplier), 1), 5)  # the client's bonus goes from 1 to 5 with the level
    amount = harvest(item_id, item, workers, multiplier)
    resource = get_attribute_from_item_id(item_id, "collect_type")
    if str(get_attribute_from_item_id(item_id, "subcat_functional")) == FARM:
        take(save, map, "w", flash_round(number(item_id, "collect") / 3))
    if resource in ("g", "w", "s", "f", "c"):
        give(save, map, resource, amount)
    give(save, map, "x", number(item_id, "collect_xp"))
    take(save, map, "c", int(cash or 0))
    if item is not None:
        item[STARTED] = timestamp_now()  # its work starts over
    return f"Collected {amount} {resource} (+{number(item_id, 'collect_xp')} xp)."


def choose_working_time(save: dict, x, y, town_id: int, item_id, choice) -> str:
    item = item_at(save["maps"][town_id], item_id, x, y)
    if item is None:
        return "Nothing there."
    full(item)[ATTRS]["cp"] = int(choice)
    if int(choice) > 0:
        item[STARTED] = timestamp_now()  # the farm starts working now
    return f"Working time {choice} chosen."


def worker_entered(building: list, workers_before: int) -> None:
    """Called after a unit walks into a building."""
    starts_now = workers_before == 1 if building[0] == HATCHERY else workers_before == 0
    if starts_now:
        building[STARTED] = timestamp_now()
