"""
The Unit Warehouse: a building that keeps units off the map, where they do
not count towards the population, until they are called out again.

    map["warehousedUnits"]                   {unit id: count}
    map["warehouseAditionalCapacitySingle"]  how many units it holds in all
                                             (the client's spelling); 50 to start

Commands from the client:

    "add_unit_warehouse"            [x, y, town, unit]     a unit walked in from (x, y)
    "place_warehoused_item"         [unit, x, y, 0, town]  a unit called out, next
                                                           to the warehouse
    "buy_warehouse_capacity_single" [town]   one more place for
                                             WAREHOUSE_CAPACITY_INCREASE_PRICE_SINGLE
                                             cash, up to WAREHOUSE_MAX_CAPACITY
    "reset_warehouse"               [town]   the warehouse was sold or put away:
                                             the units inside go to storage
"""

from engine import timestamp_now
from get_game_config import get_game_config
import inventory
from village import ID, X, Y, take

START_CAPACITY = 50


def _globals() -> dict:
    return get_game_config()["globals"]


def _units(map: dict) -> dict:
    if not isinstance(map.get("warehousedUnits"), dict):
        map["warehousedUnits"] = {}
    return map["warehousedUnits"]


def _capacity(map: dict) -> int:
    return int(map.get("warehouseAditionalCapacitySingle") or START_CAPACITY)


def add_unit(save: dict, x, y, town_id: int, unit_id) -> str:
    map = save["maps"][town_id]
    units = _units(map)
    if sum(int(n) for n in units.values()) >= _capacity(map):
        return "The warehouse is full."
    same_kind = [item for item in map["items"] if item[ID] == unit_id]
    here = [item for item in same_kind if item[X] == x and item[Y] == y]
    note = ""
    if here or same_kind:
        map["items"].remove((here or same_kind)[0])
    else:
        note = " (it was not on the map; kept anyway so it is not lost)"
    units[str(unit_id)] = int(units.get(str(unit_id), 0)) + 1
    return f"Unit {unit_id} went into the warehouse{note}."


def place_unit(save: dict, unit_id, x, y, orientation, town_id: int) -> str:
    map = save["maps"][town_id]
    units = _units(map)
    left = int(units.get(str(unit_id), 0)) - 1
    note = ""
    if left > 0:
        units[str(unit_id)] = left
    elif left == 0:
        del units[str(unit_id)]
    else:
        note = " (it was not in the warehouse; placed anyway so it is not lost)"
    map["items"].append([unit_id, x, y, orientation, timestamp_now(), 0])
    return f"Unit {unit_id} came out of the warehouse at ({x},{y}){note}."


def buy_capacity(save: dict, town_id: int) -> str:
    map = save["maps"][town_id]
    capacity = _capacity(map)
    if capacity >= int(_globals()["WAREHOUSE_MAX_CAPACITY"]):
        return "The warehouse cannot grow any more."
    take(save, map, "c", int(_globals()["WAREHOUSE_CAPACITY_INCREASE_PRICE_SINGLE"]))
    map["warehouseAditionalCapacitySingle"] = capacity + 1
    return f"The warehouse now holds {capacity + 1} units."


def empty(save: dict, town_id: int) -> str:
    units = _units(save["maps"][town_id])
    moved = 0
    for unit_id, count in units.items():
        inventory.add_stored(save, town_id, int(unit_id), int(count))
        moved += int(count)
    units.clear()
    return f"{moved} units moved from the warehouse to storage."
