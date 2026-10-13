"""
The graveyard: units that fell in battle, and bringing them back.

When one of the player's units dies, the game client keeps a count of it and
the server stores the same count, so it survives a reload:

    privateState["deadHeroes"]  {unit id: how many are dead}

Despite the name it holds every fallen unit. On load the client splits it in
two: the eight heroes go to the hero resurrection popup, the rest to the
graveyard building. Peasants and summoned units are never kept.

Commands from the client:

    "sell" [x, y, unit, town, 1, "KILL", 1]  a unit died and goes to the graveyard
    "sell" [x, y, hero, town, 1, "KILL", 0]  a hero died (the client sends 0 for
                                             heroes, but still remembers them)
    "put_graveyard" [unit]                   a phoenix egg was destroyed
    "resurrect_hero" [unit, x, y, town, potion]
        from the graveyard: potion is "1" when paid with potions, "0" otherwise
    "resurrect_hero" [hero, x, y, town]
        from the hero popup

Prices are the client's, worked out here from the game config rather than
taken from the request.
"""

from engine import timestamp_now
from get_game_config import get_attribute_from_item_id

HEROES = {533, 534, 535, 550, 554, 555, 556, 557}  # Xena, Arthur, Ranger, Merlin, Valkyrie, Wallace, Thor, High Elf
HERO_GOLD_PER_CASH = 500  # a hero costs its cash price times this, in gold


def _dead(save: dict) -> dict:
    pState = save["privateState"]
    if not isinstance(pState.get("deadHeroes"), dict):
        pState["deadHeroes"] = {}  # older saves may have [] or nothing
    return pState["deadHeroes"]


def _attr(unit_id: int, name: str) -> int:
    try:
        return int(get_attribute_from_item_id(unit_id, name))
    except (TypeError, ValueError):
        return 0


def bury(save: dict, unit_id: int) -> str:
    dead = _dead(save)
    key = str(unit_id)
    dead[key] = dead.get(key, 0) + 1
    return f"Graveyard: unit {unit_id} buried ({dead[key]} now)."


def unit_died(save: dict, unit_id: int, to_graveyard) -> str:
    """Called for every "sell" with the reason "KILL"."""
    if unit_id in HEROES or str(to_graveyard) == "1":
        return bury(save, unit_id)
    return "Graveyard: not kept (peasant, summoned unit or building)."


def _price(save: dict, unit_id: int, used_potion: bool) -> dict:
    """What bringing this unit back costs, as {resource: amount}."""
    if unit_id in HEROES:
        return {"g": _attr(unit_id, "cost_unit_cash") * HERO_GOLD_PER_CASH}
    if used_potion:
        return {"potion": _attr(unit_id, "potion")}
    cost = _attr(unit_id, "cost")
    half = (cost + 1) // 2  # the client rounds halves up
    cost_type = get_attribute_from_item_id(unit_id, "cost_type")
    if cost_type == "c":
        return {"c": half}
    if cost_type == "g":
        return {"f": cost, "g": half}
    return {}  # the client asks nothing for the other kinds


def _pay(save: dict, map: dict, price: dict) -> None:
    for resource, amount in price.items():
        if resource == "c":
            owner, key = save["playerInfo"], "cash"
        elif resource == "potion":
            owner, key = save["privateState"], "potion"
        else:
            owner, key = map, {"g": "coins", "f": "food"}[resource]
        owner[key] = max(int(owner.get(key, 0)) - amount, 0)


def resurrect(save: dict, unit_id: int, x: int, y: int, town_id: int, used_potion: bool) -> str:
    dead = _dead(save)
    key = str(unit_id)
    if dead.get(key, 0) <= 0:
        return f"Graveyard: unit {unit_id} is not in the graveyard."
    map = save["maps"][town_id]
    _pay(save, map, _price(save, unit_id, used_potion))
    dead[key] -= 1
    if dead[key] == 0:
        del dead[key]
    if unit_id in HEROES:
        map["xp"] = map.get("xp", 0) + _attr(unit_id, "xp")  # the client gives the hero's xp back too
    map["items"].append([unit_id, x, y, 0, timestamp_now(), 0])
    return f"Graveyard: unit {unit_id} resurrected at ({x},{y})."
