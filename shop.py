"""
Paying for things: units, offer packs, deals, and what the Sacrifice Altar
and the Golden Dynasty Dragon give back.

The client takes the price and hands over what was bought on its own
screen, then tells the server. Here the server does the same to the save,
with prices from the game config wherever the config has them.

Commands from the client:

    "buy"                    [item, x, y, orientation, town, free, multiplier, type]
        anything placed on the map. Units trained in a building also cost
        food: twice their (reduced) gold price, except villagers.
    "buy_cash"               [unit, x, y, orientation, town]
        a unit trained with cash, or a hero from the hero shop. Without an
        Altar of Heroes to stand next to, the hero goes to storage instead:
        the client sends "store_add_items" just before, and the shop
        window's position as x, y, so the hero is not placed here.
    "buy_offer_pack"         [town, pack] or [town, pack, item won]
    "buy_super_offer_pack"   [town, pack, "item,item,...", cash]
    "add_items_store"        [JSON list of item ids, cash]   the merchant's deals
    "buy_stored_item_cash"   [town, unit, cash]   a unit missing from a unit collection
    "unit_collections_completed" [category]       a finished unit collection
    "pop_sell"               [x, y, town, altar, unit]   a unit given to the Sacrifice Altar
    "gold_statue_conversion" [gold]   the Golden Dynasty Dragon turned an enemy to gold
    "unlock_building"        ["item"]   a building opened before its level, for
                                        a third of that level in cash, rounded up
    "unlock_skin"            ["skin"]   a look for the island (desert, jungle...), for
                                        COST_UNLOCK_SKIN cash. The client checks
                                        unlockedSkins for the text "true", not true.

Offer packs are found by their place in the config list: pack 1 is the
first. What is bought goes to the town's storage, as the client puts it
there; unit collection rewards go with the gifts.
"""

import json
import math

from constants import Constant
from get_game_config import get_attribute_from_item_id, get_game_config
import inventory
from village import STARTED, UNITS, full, give, item_at, number, take

FOOD_PER_GOLD_IN_TRAINING = 2
RANDOM_PACK, SUPER_PACK = 1, 2
SUPER_PACK_PRICES = [60, 100, 200]  # one, two or three prizes
SUPER_PACK_PRICES_BY_PACK = {19: [30, 60, 100]}
UNIT_COLLECTION_BONUS_CASH = 1
GOLD_PER_STATUE = 10
SELL_DIVISOR = 20
UNLOCK_CASH_PER_LEVEL = 1 / 3


def _place(map: dict, item_id, x, y, orientation) -> None:
    from engine import timestamp_now
    map["items"].append([item_id, x, y, orientation, timestamp_now(), 0])


def _trained_here(map: dict, unit_id) -> bool:
    for item in map["items"]:
        if str(get_attribute_from_item_id(item[0], "trains")) == str(unit_id):
            return True
    return False


def buy(save: dict, item_id, x, y, orientation, town_id: int, free: bool, multiplier) -> str:
    map = save["maps"][town_id]
    note = ""
    if not free:
        cost_type = get_attribute_from_item_id(item_id, "cost_type")
        cost = math.ceil(number(item_id, "cost") * float(multiplier))  # the Blacksmith and University take 10% off
        take(save, map, cost_type, cost)
        food = 0
        if get_attribute_from_item_id(item_id, "type") == "u" and _trained_here(map, item_id) \
                and int(number(item_id, "subcat_functional")) != Constant.SUBCATFUNC_UNIT_PEASANT:
            food = math.ceil(cost * FOOD_PER_GOLD_IN_TRAINING)
            take(save, map, "f", food)
        give(save, map, "x", number(item_id, "xp"))
        note = f" for {cost} {cost_type}" + (f" and {food} f" if food else "")
    _place(map, item_id, x, y, orientation)
    return f"Item {item_id} placed at ({x},{y}){note}."


def buy_with_cash(save: dict, unit_id, x, y, orientation, town_id: int, already_stored: bool) -> str:
    map = save["maps"][town_id]
    cash = number(unit_id, "cost_unit_cash")
    take(save, map, "c", cash)
    give(save, map, "x", number(unit_id, "xp"))
    if already_stored:
        return f"Unit {unit_id} bought for {cash} cash, into storage."
    _place(map, unit_id, x, y, orientation)
    return f"Unit {unit_id} bought for {cash} cash."


def _pack(pack_id):
    packs = get_game_config()["offer_packs"]
    return packs[pack_id - 1] if 1 <= pack_id <= len(packs) else None


def _give_resources(save: dict, map: dict, pack: dict, with_xp: bool) -> None:
    for resource, key in (("g", "gold"), ("s", "stone"), ("f", "food"), ("w", "wood"), ("m", "mana")):
        give(save, map, resource, int(pack.get(key) or 0))
    if with_xp:
        give(save, map, "x", int(pack.get("xp") or 0))


def offer_pack(save: dict, town_id: int, pack_id: int, item_won=None) -> str:
    pack = _pack(pack_id)
    if pack is None or int(pack.get("pack_type", 0)) == SUPER_PACK:
        return f"Offer pack {pack_id} does not exist."
    map = save["maps"][town_id]
    if int(pack.get("pack_type", 0)) == RANDOM_PACK:
        prizes = [int(prize[0]) for prize in pack["items"]]
        if item_won is None or int(item_won) not in prizes:
            return f"Offer pack {pack_id}: item {item_won} is not one of its prizes."
        items = [int(item_won)]
    else:
        items = [int(i) for i in pack.get("items") or []]
    take(save, map, "c", int(pack["cost_cash"]))
    _give_resources(save, map, pack, with_xp=True)
    for item_id in items:
        inventory.add_stored(save, town_id, item_id)
    return f"Offer pack {pack_id} bought for {pack['cost_cash']} cash: {items}."


def super_offer_pack(save: dict, town_id: int, pack_id: int, items_text: str) -> str:
    pack = _pack(pack_id)
    if pack is None or int(pack.get("pack_type", 0)) != SUPER_PACK:
        return f"Super offer pack {pack_id} does not exist."
    items = [int(i) for i in str(items_text).split(",") if i.strip()]
    prices = SUPER_PACK_PRICES_BY_PACK.get(pack_id, SUPER_PACK_PRICES)
    prizes = {int(i) for row in pack["items"] for i in row}
    if not 1 <= len(items) <= len(prices) or any(i not in prizes for i in items):
        return f"Super offer pack {pack_id}: {items} are not its prizes."
    cash = prices[len(items) - 1]
    map = save["maps"][town_id]
    take(save, map, "c", cash)
    _give_resources(save, map, pack, with_xp=False)  # the client shows the xp but does not give it
    for item_id in items:
        inventory.add_stored(save, town_id, item_id)
    return f"Super offer pack {pack_id} bought for {cash} cash: {items}."


def deal(save: dict, ids_json: str, cash, town_id: int = 0) -> str:
    """The merchant's deals: a discount that grows while the window stays open."""
    ids = [int(i) for i in json.loads(ids_json)]
    take(save, save["maps"][town_id], "c", max(int(cash), 0))
    for item_id in ids:
        inventory.add_stored(save, town_id, item_id)
    return f"Deal bought for {cash} cash: {ids}."


def _unit_prices(unit_id: int) -> list:
    prices = []
    for category in get_game_config()["units_collections_categories"].values():
        units = [int(u) for u in category.get("units") or []]
        if unit_id in units:
            place = units.index(unit_id)
            costs = category.get("costs") or []
            prices.append(int(costs[place]) if len(costs) > place else int(category["cost"]))
    return prices


def collection_unit(save: dict, town_id: int, unit_id: int, cash) -> str:
    prices = _unit_prices(unit_id)
    if not prices:
        return f"Unit {unit_id} is in no unit collection."
    price = int(cash) if int(cash) in prices else max(prices)
    take(save, save["maps"][town_id], "c", price)
    inventory.add_stored(save, town_id, unit_id)
    bought = save["privateState"].setdefault("boughtUnits", [])
    if unit_id not in bought:
        bought.append(unit_id)
    return f"Unit {unit_id} bought for {price} cash, into storage."


def unit_collection_completed(save: dict, category_id: int) -> str:
    category = get_game_config()["units_collections_categories"].get(str(category_id))
    if category is None:
        return f"There is no unit collection {category_id}."
    pState = save["privateState"]
    completed = pState.get("unitCollectionsCompleted")
    if not isinstance(completed, list):
        completed = pState["unitCollectionsCompleted"] = []
    if category_id in completed:
        return f"Unit collection {category_id} was already rewarded."
    completed.append(category_id)
    give(save, save["maps"][0], "c", UNIT_COLLECTION_BONUS_CASH)
    inventory.add_gift(save, int(category["rewards"]))  # the client shows it but leaves it to the server
    return f"Unit collection {category_id} completed: unit {category['rewards']} and {UNIT_COLLECTION_BONUS_CASH} cash."


def sacrifice(save: dict, x, y, town_id: int, altar_id, unit_id) -> str:
    map = save["maps"][town_id]
    altar = item_at(map, altar_id, x, y)
    if altar is None or unit_id not in full(altar)[UNITS]:
        return f"No unit {unit_id} in the altar at ({x},{y})."
    altar[UNITS].remove(unit_id)
    gold = 0
    if get_attribute_from_item_id(unit_id, "cost_type") == "g":
        gold = number(unit_id, "cost") // SELL_DIVISOR
        give(save, map, "g", gold)
    if not altar[UNITS]:
        altar[STARTED] = 0  # as the client does when the altar is empty
    return f"Unit {unit_id} sacrificed for {gold} gold."


def gold_statue(save: dict, town_id: int = 0) -> str:
    give(save, save["maps"][town_id], "g", GOLD_PER_STATUE)
    return f"{GOLD_PER_STATUE} gold from a golden statue."


def unlock_early(save: dict, item_id) -> str:
    pState = save["privateState"]
    if not isinstance(pState.get("unlockedEarlyBuildings"), dict):
        pState["unlockedEarlyBuildings"] = {}
    unlocked = pState["unlockedEarlyBuildings"]
    if unlocked.get(str(item_id)):
        return f"Item {item_id} was already unlocked."
    cash = math.ceil(number(item_id, "min_level") * UNLOCK_CASH_PER_LEVEL)
    take(save, None, "c", cash)
    unlocked[str(item_id)] = True
    return f"Item {item_id} unlocked early for {cash} cash."


def unlock_skin(save: dict, skin_id) -> str:
    pState = save["privateState"]
    if not isinstance(pState.get("unlockedSkins"), dict):
        pState["unlockedSkins"] = {}
    unlocked = pState["unlockedSkins"]
    if unlocked.get(str(skin_id)) == "true":
        return f"Skin {skin_id} was already unlocked."
    cash = int(get_game_config()["globals"]["COST_UNLOCK_SKIN"])
    take(save, None, "c", cash)
    unlocked[str(skin_id)] = "true"
    return f"Skin {skin_id} unlocked for {cash} cash."
