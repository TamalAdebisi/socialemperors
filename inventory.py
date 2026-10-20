"""
The player's storage: things kept off the map, to place or sell later.

The client shows two boxes together in its storage window:

    privateState["gifts"]  {item id: count}, shared by every town: gifts and
                           rewards. Placing a gift also gives its experience.
    map["store"]           {item id: count}, one per town: things the player
                           put away, or won or bought straight into storage,
                           and things a friend gave from their own storage
                           (gifts.py). Placing them gives no experience.

Either box may be a list indexed by item id (older saves) or a dict; the
client reads both the same way. Items stored before map["store"] was used
are in gifts, so placing or selling takes from the box the client names
first and falls back to the other one. Experience comes only with what
really came out of the gift box.

Commands from the client:

    "store_item"         [x, y, town, item]       put away from the map
    "store_item_frombug" [x, y, town, item]       put away by the client itself,
                                                  because it was found off the map
                                                  or on top of something on load
    "store_add_items"    [JSON list of item ids]  straight into storage
    "place_gift"         [item, x, y, orientation, town]
    "place_stored_item"  [item, x, y, orientation, town]
    "sell_gift", "sell_stored_item" [item, town]  sold for a twentieth of its
                                                  price (nothing for cash items)
"""

import json

from engine import timestamp_now
from get_game_config import get_attribute_from_item_id, get_level_from_xp, get_xp_from_level
from village import give, item_at, number
import trust

LEVEL_UP_STATUE = 1478  # placing it gives the experience missing for the next level
SOLD_FOR_NOTHING = {224, 299}  # the Dock and the Zeppelin Tower
SELL_DIVISOR = 20


def _count(box, item_id: int) -> int:
    if isinstance(box, dict):
        return int(box.get(str(item_id), 0))
    return box[item_id] if 0 <= item_id < len(box) else 0


def _change(box, item_id: int, by: int) -> None:
    if isinstance(box, dict):
        left = int(box.get(str(item_id), 0)) + by
        if left > 0:
            box[str(item_id)] = left
        else:
            box.pop(str(item_id), None)
        return
    while len(box) <= item_id:
        box.append(0)
    box[item_id] = max(box[item_id] + by, 0)
    while box and box[-1] == 0:
        box.pop()


def gifts(save: dict):
    pState = save["privateState"]
    if not isinstance(pState.get("gifts"), (list, dict)):
        pState["gifts"] = []
    return pState["gifts"]


def store(save: dict, town_id: int):
    map = save["maps"][town_id]
    if not isinstance(map.get("store"), (list, dict)):
        map["store"] = {}
    return map["store"]


def add_gift(save: dict, item_id: int, count: int = 1) -> None:
    _change(gifts(save), int(item_id), count)


def add_stored(save: dict, town_id: int, item_id: int, count: int = 1) -> None:
    _change(store(save, town_id), int(item_id), count)


def _take(save: dict, town_id: int, item_id: int, gift_first: bool) -> str:
    """One out of storage: the box it came out of ("gifts" or "store"), or "" if neither holds it."""
    boxes = [("gifts", gifts(save)), ("store", store(save, town_id))]
    if not gift_first:
        boxes.reverse()
    for name, box in boxes:
        if _count(box, item_id) > 0:
            _change(box, item_id, -1)
            return name
    return ""


def held(save: dict, town_id: int) -> dict:
    """Everything in the town's storage window, both boxes together: {item id: count}."""
    counts = {}
    for box in (gifts(save), store(save, town_id)):
        pairs = box.items() if isinstance(box, dict) else enumerate(box)
        for item_id, count in pairs:
            if int(count) > 0:
                counts[int(item_id)] = counts.get(int(item_id), 0) + int(count)
    return counts


def take(save: dict, town_id: int, item_id: int, count: int) -> bool:
    """count of an item out of the town's storage window, gifts first;
    nothing taken unless there are that many."""
    if held(save, town_id).get(int(item_id), 0) < count:
        return False
    return all(_take(save, town_id, int(item_id), gift_first=True) for _ in range(count))


def put_away(save: dict, x, y, town_id: int, item_id) -> str:
    map = save["maps"][town_id]
    item = item_at(map, item_id, x, y)
    if item is None:
        return f"Nothing to store at ({x},{y})."
    map["items"].remove(item)
    add_stored(save, town_id, item_id)
    return f"Item {item_id} stored."


def add_items(save: dict, ids_json: str, town_id: int = 0, upcoming: list = ()) -> str:
    """Prizes the client put in storage, those the game could have given (trust.py)."""
    added, refused = [], []
    for item_id in json.loads(ids_json):
        if trust.storable(save, int(item_id), list(upcoming), timestamp_now()):
            add_stored(save, town_id, int(item_id))
            added.append(int(item_id))
        else:
            refused.append(int(item_id))
    if refused and trust.seeding():
        for item_id in refused:
            add_stored(save, town_id, item_id)
        return f"Added {added + refused} to storage (test server: would refuse {refused})."
    return f"Added {added} to storage." + (f" Refused {refused}: no prize of the game's gives them now." if refused else "")


def place(save: dict, item_id, x, y, orientation, town_id: int, is_gift: bool) -> str:
    map = save["maps"][town_id]
    box = _take(save, town_id, int(item_id), gift_first=is_gift)
    if not box:
        return f"Refused: item {item_id} is not in storage."
    map["items"].append([item_id, x, y, orientation, timestamp_now(), 0])
    if is_gift and box == "gifts":  # the client gives a gift's experience when it is placed; a stored thing paid its own when built
        if int(item_id) == LEVEL_UP_STATUE:
            map["xp"] = max(int(map["xp"]), get_xp_from_level(get_level_from_xp(map["xp"])))
        else:
            give(save, map, "x", number(item_id, "xp"))
    return f"Item {item_id} placed at ({x},{y})."


def sell(save: dict, item_id, town_id: int, is_gift: bool) -> str:
    if not _take(save, town_id, int(item_id), gift_first=is_gift):
        return f"Item {item_id} is not in storage; nothing sold."
    cost_type = get_attribute_from_item_id(item_id, "cost_type")
    if cost_type == "c" or int(item_id) in SOLD_FOR_NOTHING:
        return f"Item {item_id} sold for nothing."
    price = number(item_id, "cost") // SELL_DIVISOR
    if cost_type in ("g", "w", "s", "f"):
        give(save, save["maps"][town_id], cost_type, price)
    return f"Item {item_id} sold for {price} {cost_type}."
