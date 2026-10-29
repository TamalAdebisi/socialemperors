"""Freeing a Chained building's units (chained_units.py says which and how long).

The chains break chain_hours after the building was placed (the map item's
"started" time); speeding that up costs a cash an hour left. Then the
building goes and its units stand where the client puts them, beside it.
Our own commands (the original sold these as packs, so it has none):

    "speed_up_chained"  [x, y, town]
    "release_chained"   [x, y, town, [[unit x, unit y], ...]]
"""

import math

from engine import timestamp_now
from village import ID, STARTED, X, Y, number
from get_game_config import get_item_from_id
import speedups


def _chained(save: dict, x, y, town) -> tuple:
    """The town, the Chained building at (x, y) and its units, or Nones."""
    try:
        map = save["maps"][int(town)]
    except (IndexError, TypeError, ValueError):
        return None, None, None
    for row in map["items"]:
        if row[X] == int(x) and row[Y] == int(y):
            units = str((get_item_from_id(row[ID]) or {}).get("chained_units") or "")
            if units:
                return map, row, [int(unit) for unit in units.split(",")]
    return map, None, None


def seconds_left(row: list) -> int:
    hours = number(row[ID], "chain_hours")
    started = row[STARTED] if isinstance(row[STARTED], (int, float)) and not isinstance(row[STARTED], bool) else 0
    return max(0, int(started + hours * 3600 - timestamp_now()))


def speed_up(save: dict, x, y, town) -> str:
    map, row, _ = _chained(save, x, y, town)
    if row is None:
        return "Chained: no Chained building there."
    left = seconds_left(row)
    if not left:
        return "Chained: the chains are already broken."
    cost = math.ceil(left / 3600)  # the original's cash an hour, paid in food (speedups.py)
    if not speedups.pay(save, map, cost):
        return "Chained: not enough food."
    row[STARTED] = timestamp_now() - number(row[ID], "chain_hours") * 3600
    return f"Chained: the chains broken for {speedups.in_food(cost)} food."


def release(save: dict, x, y, town, spots) -> str:
    map, row, units = _chained(save, x, y, town)
    if row is None:
        return "Chained: no Chained building there."
    if seconds_left(row):
        return "Chained: the chains aren't broken yet."
    if not isinstance(spots, list) or len(spots) != len(units) or not all(
            isinstance(spot, list) and len(spot) == 2 and all(isinstance(n, int) and 0 <= n < 100 for n in spot)
            for spot in spots):
        return "Chained: a place for each unit is needed."
    map["items"].remove(row)
    now = timestamp_now()
    for unit, (ux, uy) in zip(units, spots):
        map["items"].append([unit, ux, uy, 0, now, 0])
    return f"Chained: freed {units}."
