"""
Levelling up. Each level a town reaches pays its prize from the game
config's "levels" table (wood or food early on, then cash: economy.py) and,
from level 36, some mana (magic.py).

The client shows the prize in the level up window and adds it on screen,
but never tells the server; without paying it here too it was gone at the
next reload. Several commands report a new level (the level up itself, the
score sent when the game starts, the end of a quest or battle, where level
ups are not sent), so each level is paid once, by whichever comes first:

    map["levelPaid"]   the highest level this town has been paid for

A town's first level pays nothing: it is where every town starts.
"""

from get_game_config import get_game_config
import magic
from village import give


def prize(level: int) -> tuple:
    """The level up window's prize for reaching this level: (resource, amount)."""
    row = get_game_config()["levels"][int(level) - 1]
    return row["reward_type"], int(row["reward_amount"])


def _pay_prizes(save: dict, map: dict, first: int, last: int) -> dict:
    paid = {}
    for level in range(first, last + 1):
        resource, amount = prize(level)
        give(save, map, resource, amount)
        paid[resource] = paid.get(resource, 0) + amount
    return paid


def reached(save: dict, map: dict, level) -> str:
    """The town is at this level now: pay the levels not paid yet."""
    level = min(int(level), len(get_game_config()["levels"]))
    paid_up_to = int(map.get("levelPaid") or 1)
    if level <= paid_up_to:
        return ""
    paid = _pay_prizes(save, map, paid_up_to + 1, level)
    mana = magic.level_up(save, paid_up_to, level)
    if mana:
        paid["m"] = mana
    map["levelPaid"] = level
    return f"levels {paid_up_to + 1} to {level} paid {paid}"


def back_pay(save: dict) -> None:
    """Saves from before levels were paid: the prizes of the levels each
    town has reached, once. Not the mana, which was paid already."""
    for map in save["maps"]:
        level = min(int(map.get("level") or 1), len(get_game_config()["levels"]))
        paid = _pay_prizes(save, map, 2, level)
        map["levelPaid"] = max(level, 1)
        if paid:
            print(f"   > back pay for reaching level {level}: {paid}")
