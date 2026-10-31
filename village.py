"""
Small helpers shared by the game modules: finding things on a map, reading
numbers from the game config, and changing the player's resources.

Resources are named by the letters the game uses everywhere:

    "g" gold    "w" wood    "s" stone    "f" food     kept per town, on the map
    "c" cash    "m" mana                              kept per player
    "x" experience                                    kept on the map

A map item is a list: [item id, x, y, orientation, production started at,
level, units inside, attributes]. Older items stop after the level.
"""

import math

from get_game_config import get_attribute_from_item_id
import radar

ON_MAP = {"g": "coins", "w": "wood", "s": "stone", "f": "food", "x": "xp"}
ID, X, Y, ORIENTATION, STARTED, LEVEL, UNITS, ATTRS = range(8)


def number(item_id, attribute: str) -> int:
    """A number from the item's config, 0 if it has none."""
    try:
        return int(float(get_attribute_from_item_id(item_id, attribute)))
    except (TypeError, ValueError):
        return 0


def flash_round(value: float) -> int:
    """Rounds the way the game client does (halves go up), unlike Python's round()."""
    return int(math.floor(value + 0.5))


def item_at(map: dict, item_id, x, y):
    """The item with this id at (x, y), or None."""
    for item in map["items"]:
        if item[ID] == item_id and item[X] == x and item[Y] == y:
            return item
    return None


def full(item: list) -> list:
    """Makes sure the item has room for units inside and attributes."""
    defaults = [None, 0, 0, 0, 0, 0, [], {}]
    while len(item) < len(defaults):
        item.append(defaults[len(item)])
    if not isinstance(item[ATTRS], dict):
        item[ATTRS] = {}
    return item


def _owner(save: dict, map: dict, resource: str):
    if resource == "c":
        return save["playerInfo"], "cash"
    if resource == "m":
        return save["privateState"], "mana"
    return map, ON_MAP[resource]


def give(save: dict, map: dict, resource: str, amount: int) -> None:
    owner, key = _owner(save, map, resource)
    owner[key] = int(owner.get(key, 0)) + int(amount)


def take(save: dict, map: dict, resource: str, amount: int) -> None:
    """Takes up to amount; never leaves less than nothing."""
    owner, key = _owner(save, map, resource)
    owner[key] = max(int(owner.get(key, 0)) - int(amount), 0)


def spend(save: dict, map: dict, resource: str, amount: int) -> bool:
    """Takes the whole amount, or nothing: False when there isn't that much.

    For what the player buys. take() keeps what it can, which let a request
    naming anything be paid with whatever cash was left (31 October 2026).
    A refusal goes on the bug radar, so one the game should have allowed shows.
    """
    owner, key = _owner(save, map, resource)
    have, amount = int(owner.get(key, 0)), int(amount)
    if have < amount:
        radar.note(radar.REFUSED, f"not enough {resource}", example=f"{have} < {amount}",
                   player=save.get("playerInfo", {}).get("pid"))
        return False
    owner[key] = have - amount
    return True
