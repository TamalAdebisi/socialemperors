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

The server keeps its own count of the experience, and a level the game
reports must agree with it (trust.py). The level up is sent when the
experience on the game's screen crosses a level; it may be a little ahead
of the server's count (XP_MARGIN), which the server then takes on, as it
may have missed some action's experience. The score is sent as the town
starts, so it can only repeat the server's count. Before, both were taken
on the game's word, and an edited request could claim any level and its
prizes (DECISIONS.md, 20 October 2026).
"""

from get_game_config import get_game_config
import magic
import trust
from village import give

XP_MARGIN = 10  # percent of a level's experience a level up may be ahead of the server's count


def of_xp(xp) -> int:
    """The level this much experience reaches."""
    return max(1, sum(1 for row in get_game_config()["levels"] if int(row["exp_required"]) <= int(xp)))


def need(level: int) -> int:
    """The experience a town needs to be at this level."""
    return int(get_game_config()["levels"][max(int(level), 1) - 1]["exp_required"])


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


def level_up(save: dict, map: dict, level) -> str:
    """The game says the town reached this level ("rt_level_up"). Believed
    when the server's experience is there or within the margin, which it
    then takes on; further ahead, refused, and the level stays where the
    server's experience puts it. The test server believes it and says so."""
    level = min(int(level), len(get_game_config()["levels"]))
    xp, note = int(map.get("xp") or 0), ""
    if xp < need(level):
        margin = (need(level) - need(level - 1)) * XP_MARGIN // 100
        if need(level) - xp > margin:
            if not trust.seeding():
                return f"refused: level {level} needs {need(level)} xp, the town has {xp}"
            note = f" (test server: would refuse, {xp} of {need(level)} xp)"
        map["xp"] = need(level)
    map["level"] = of_xp(map["xp"])
    return (reached(save, map, map["level"]) or "already paid") + note


def score(save: dict, map: dict, xp) -> str:
    """The experience on the game's screen as the town starts
    ("rt_publish_score"): the server's own, just sent, so the server keeps
    its count whatever the score says. Levels that count reaches and that
    were never paid are paid. The test server takes the score, to set a
    town's experience in one step, and says what it would refuse."""
    xp, note = int(xp), ""
    if xp != int(map.get("xp") or 0):
        if not trust.seeding():
            note = f"kept {map.get('xp')} xp, not the game's {xp}; "
        else:
            note = f"test server: would keep {map.get('xp')} xp, not {xp}; "
            map["xp"] = xp
    map["level"] = of_xp(map["xp"])
    return note + (reached(save, map, map["level"]) or "nothing to pay")


def back_pay(save: dict) -> None:
    """Saves from before levels were paid: the prizes of the levels each
    town has reached, once. Not the mana, which was paid already."""
    for map in save["maps"]:
        level = min(int(map.get("level") or 1), len(get_game_config()["levels"]))
        paid = _pay_prizes(save, map, 2, level)
        map["levelPaid"] = max(level, 1)
        if paid:
            print(f"   > back pay for reaching level {level}: {paid}")
