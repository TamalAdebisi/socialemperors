"""
Enemy units killed in the player's own town: the bandits and sieges the
client sends at the town (rolled by the client each time the town opens, and
never saved, as in the original game), and the troll camps' and the border's
trolls (saved).

The Flash client shows 5 gold and the raider's experience (its collect_xp)
for each enemy unit killed at home, but only ever sends

    "kill"  [x, y, unit, town, "u" | "b"]

so the original server never saw that gold. Here the server pays it, so
what the player saw is what they keep (DECISIONS.md, "Defending the
town"), up to MOST_A_DAY kills a day:

    map["raiderKills"]  {"day": "2026-10-15", "count": n}
"""

import time

from get_game_config import get_attribute_from_item_id

KILL_GOLD = 5
MOST_A_DAY = 300


def _today() -> str:
    return time.strftime("%Y-%m-%d", time.gmtime())


def killed(map: dict, unit_id, kind, with_xp: bool = True) -> str:
    """An enemy unit killed at home: 5 gold and its experience, within the day's
    limit. A unit that was in the save (a camp's, the border's) has had its
    experience already: `with_xp` False."""
    if kind != "u":
        return "not a unit"
    try:
        attack = int(get_attribute_from_item_id(unit_id, "attack") or 0)
        xp = int(get_attribute_from_item_id(unit_id, "collect_xp") or 0)
        is_unit = get_attribute_from_item_id(unit_id, "type") == "u"
    except Exception:
        return f"no unit {unit_id}"
    if not is_unit or attack <= 0:
        return "not a fighter"
    counted = map.get("raiderKills")
    if not isinstance(counted, dict) or counted.get("day") != _today():
        counted = {"day": _today(), "count": 0}
    if counted["count"] >= MOST_A_DAY:
        return "the day's limit is reached"
    counted["count"] += 1
    map["raiderKills"] = counted
    map["coins"] = map["coins"] + KILL_GOLD
    if with_xp:
        map["xp"] = map["xp"] + xp
    return f"+{KILL_GOLD} gold" + (f", +{xp} xp" if with_xp else "")
