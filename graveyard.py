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
    "put_graveyard" [unit]                   a phoenix egg was destroyed: its
                                             phoenix, if an egg stands in the
                                             town (it goes)
    "resurrect_hero" [unit, x, y, town, potion]
        from the graveyard: potion is "1" when paid with potions, "0" otherwise
    "resurrect_hero" [hero, x, y, town]
        from the hero popup

Prices are worked out here from the game config rather than taken from the
request. The owner's rules: nothing here costs cash (29 October 2026), and a
unit comes back for what it's worth in battle (31 October 2026): a food for
each 8 points of its health times attack, and half that in gold, whether it
was bought with gold or cash. 8 is how the game prices its own gold units,
at the median, so an ordinary unit costs about what it did (the original
asked its whole price in food and half in gold, half its price for a cash
unit); a strong dragon costs in proportion. Heroes keep their price, 500
gold a cash of theirs, and potions their count. The potion pack costs
25,000 gold and 25,000 food (its 100 cash at 500 gold a cash, split between
the two). The Flash client still shows its own prices, but this server takes
these.

    "graveyard_buy_potions" []                 a pack of potions
"""

from engine import timestamp_now
from get_game_config import get_attribute_from_item_id, get_game_config

HEROES = {533, 534, 535, 550, 554, 555, 556, 557}  # Xena, Arthur, Ranger, Merlin, Valkyrie, Wallace, Thor, High Elf
HERO_GOLD_PER_CASH = 500  # a hero costs its cash price times this, in gold; so does a potion's cash
STRENGTH_PER_FOOD = 8  # a unit's health times attack, for each food it takes to bring back


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


PHOENIXES = {744, 775, 856, 2097}  # the Phoenix, Blue, Green and Black
PHOENIX_EGGS = {1254, 1282}  # what a phoenix leaves when it falls


def phoenix_refusal(map: dict, unit_id):
    """Why "put_graveyard" can't bury this, or None: only a phoenix, and only with an egg in town (trust.py)."""
    if int(unit_id) not in PHOENIXES:
        return "a unit that isn't a phoenix, buried as one"
    if not any(int(item[0]) in PHOENIX_EGGS for item in map["items"]):
        return "a phoenix buried with no egg in town"
    return None


def phoenix_died(save: dict, map: dict, unit_id) -> str:
    """Its egg destroyed: the egg goes from the map (the client sends nothing else for it), the phoenix to the graveyard."""
    egg = next(item for item in map["items"] if int(item[0]) in PHOENIX_EGGS)
    map["items"].remove(egg)
    return bury(save, int(unit_id))


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
    if get_attribute_from_item_id(unit_id, "cost_type") in ("g", "c"):
        return strength_price(unit_id)
    return {}  # the client asks nothing for the other kinds


def strength_price(unit_id: int) -> dict:
    """A unit's price to come back, by what it's worth in battle (rules/graveyard.ts, revivalPrice)."""
    strength = _attr(unit_id, "life") * max(_attr(unit_id, "attack"), 1)  # a few, like eggs, don't attack
    food = -(-strength // STRENGTH_PER_FOOD)
    return {"f": food, "g": (food + 1) // 2}


def potion_pack() -> tuple:
    """The potion pack: (potions, its price as {resource: amount})."""
    pack = get_game_config()["globals"].get("GRAVEYARD_POTIONS") or {}
    cash = int((pack.get("price") or {}).get("c", 0))
    gold = cash * HERO_GOLD_PER_CASH // 2
    return int(pack.get("amount", 0)), {"g": gold, "f": cash * HERO_GOLD_PER_CASH - gold}


def _pay(save: dict, map: dict, price: dict) -> None:
    for resource, amount in price.items():
        if resource == "potion":
            owner, key = save["privateState"], "potion"
        else:
            owner, key = map, {"g": "coins", "f": "food"}[resource]
        owner[key] = max(int(owner.get(key, 0)) - amount, 0)


def _short(save: dict, map: dict, price: dict) -> list:
    """The resources the town hasn't enough of for a price."""
    have = {"g": map.get("coins", 0), "f": map.get("food", 0), "potion": save["privateState"].get("potion", 0)}
    return [resource for resource, amount in price.items() if int(have.get(resource, 0)) < amount]


def buy_potions(save: dict, map: dict) -> str:
    amount, price = potion_pack()
    short = _short(save, map, price)
    if short:
        return f"Graveyard: not enough {' and '.join('gold' if r == 'g' else 'food' for r in short)} for potions."
    _pay(save, map, price)
    pState = save["privateState"]
    pState["potion"] = int(pState.get("potion", 0)) + amount
    return f"Graveyard: {amount} potion(s) bought for {price['g']} gold and {price['f']} food."


def resurrect(save: dict, unit_id: int, x: int, y: int, town_id: int, used_potion: bool) -> str:
    dead = _dead(save)
    key = str(unit_id)
    if dead.get(key, 0) <= 0:
        return f"Graveyard: unit {unit_id} is not in the graveyard."
    map = save["maps"][town_id]
    price = _price(save, unit_id, used_potion)
    if _short(save, map, price):
        return f"Graveyard: not enough to bring unit {unit_id} back ({price})."  # the Flash client checks cash, not these
    _pay(save, map, price)
    dead[key] -= 1
    if dead[key] == 0:
        del dead[key]
    if unit_id in HEROES:
        map["xp"] = map.get("xp", 0) + _attr(unit_id, "xp")  # the client gives the hero's xp back too
    map["items"].append([unit_id, x, y, 0, timestamp_now(), 0])
    return f"Graveyard: unit {unit_id} resurrected at ({x},{y})."
