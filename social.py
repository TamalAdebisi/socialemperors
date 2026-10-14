"""
Social buildings: buildings staffed by friends, or by helpers hired for cash.
The "social_items" list in the game config gives each one its staff (one name
per place) and the cash for each helper (worker_cost).

    item[ATTRS]["si"]  the staff so far: a list with one entry per helper

Most social buildings are staffed once, then open for good: the client shows
them as waiting for staff while "si" is there. Six keep a staff that fills up
again and again, and the client lets them be used at any time:

    the Summit             a full staff of 9 brings 9 allied knights
    the Allied Markets     each helper adds 125 to the next delivery
    the Recruitment camp   a full staff brings new recruits
    the Round Table        4, 6 or 8 knights bring gold, experience, a hero
    the Wonder             each fifth of the staff makes room for more people

The server keeps "si" only for those six. The others open when the page is
loaded again without "si", so they are never left waiting for friends this
server does not have; a helper bought for them is still paid for.

Commands from the client:

    "buy_si_help"          [x, y, town, building, 1 if free]  one helper
    "finish_si"            [x, y, town, building]   the building opens, or its
                                                    staff delivers; the Round
                                                    Table adds [gold, xp, hero]
    "set_resource_allies"  [resource, x, y, town, building]  what the Allied
                                                    Market delivers next ("n" for
                                                    none), a day from now
    "increase_population"  [town]   the Wonder makes room for more people
"""

from engine import timestamp_now
from get_game_config import get_game_config
import inventory
from village import ATTRS, STARTED, full, give, item_at, take

SUMMIT = 234
ALLIED_MARKETS = (266, 352)
RECRUITMENT = 387
ROUND_TABLE = 389
WONDER = 470
KEEP_STAFF = (SUMMIT, *ALLIED_MARKETS, RECRUITMENT, ROUND_TABLE, WONDER)

MARKET_PER_HELPER = 125  # RESOURCES_MARKET_PER_ALLY in the client
MARKET_RESOURCES = ("g", "w", "s", "f")
MARKET_WAIT = 24 * 3600
HURRY_CASH = 2  # COST_HURRY_UP in the client: collecting the market early
ROUND_TABLE_HEROES = (533, 534, 535, 550)  # Xena, Arthur, the Ranger, Merlin


def _staff_names(building_id) -> list:
    for social in get_game_config().get("social_items", []):
        if int(social["id"]) == int(building_id):
            return str(social["workers"]).split(",")
    return []


def _worker_cost(building_id) -> int:
    for social in get_game_config().get("social_items", []):
        if int(social["id"]) == int(building_id):
            return int(social["worker_cost"])
    return 0


def _building(save: dict, x, y, town_id: int, building_id):
    item = item_at(save["maps"][town_id], building_id, x, y)
    return full(item) if item is not None else None


def buy_helper(save: dict, x, y, town_id: int, building_id, free=False) -> str:
    building_id = int(building_id)
    item = _building(save, x, y, town_id, building_id)
    if item is None:
        return f"There is no social building {building_id} at ({x},{y})."
    names = _staff_names(building_id)
    attrs = item[ATTRS]
    staff = attrs.get("si")
    if staff is None and building_id in KEEP_STAFF:
        staff = attrs["si"] = []
    if isinstance(staff, list) and len(staff) >= len(names):
        return "The staff is already full."
    cost = 0 if free else _worker_cost(building_id)
    take(save, save["maps"][town_id], "c", cost)
    if isinstance(staff, list):
        staff.append(0)  # a hired helper; a friend would be their player id
        return f"A helper hired for {cost} cash ({len(staff)} of {len(names)})."
    return f"A helper hired for {cost} cash."


def finish(save: dict, x, y, town_id: int, building_id, hero=0) -> str:
    building_id = int(building_id)
    item = _building(save, x, y, town_id, building_id)
    if item is None:
        return f"There is no social building {building_id} at ({x},{y})."
    attrs = item[ATTRS]
    staff = attrs.get("si")
    helpers = len(staff) if isinstance(staff, list) else 0

    if building_id in ALLIED_MARKETS:
        return _market_delivers(save, item, town_id, staff)
    if building_id == ROUND_TABLE:
        attrs["si"], attrs["sif"] = [], []
        return _round_table_rewards(save, town_id, helpers, hero)
    if building_id in KEEP_STAFF:  # the Summit and the Recruitment camp start a new staff
        attrs["si"] = []
        return f"Social building {building_id} used its staff of {helpers}."
    attrs.pop("si", None)
    return f"Social building {building_id} is open."


def _market_delivers(save: dict, item: list, town_id: int, staff) -> str:
    map = save["maps"][town_id]
    resource = map.get("resourceAlliesMarket", "n")
    amount = MARKET_PER_HELPER * (len(staff) + 1 if isinstance(staff, list) else 1)
    note = ""
    if timestamp_now() - int(item[STARTED] or 0) < MARKET_WAIT:  # only allowed by paying to hurry it
        take(save, map, "c", HURRY_CASH)
        note = f", hurried for {HURRY_CASH} cash"
    item[ATTRS]["si"] = []
    if resource not in MARKET_RESOURCES:
        return "The Allied Market had nothing ordered."
    give(save, map, resource, amount)
    return f"The Allied Market delivered {amount} {resource}{note}."


def _round_table_rewards(save: dict, town_id: int, knights: int, hero) -> str:
    """The client's table: 4 knights give 1000 gold, 6 add 100 xp, 8 add a hero."""
    map = save["maps"][town_id]
    won = []
    if knights >= 4:
        give(save, map, "g", 1000)
        won.append("1000 gold")
    if knights >= 6:
        give(save, map, "x", 100)
        won.append("100 xp")
    if knights >= 8 and int(hero or 0) in ROUND_TABLE_HEROES:
        inventory.add_stored(save, town_id, int(hero))  # stored on screen with no command of its own
        won.append(f"hero {hero}")
    return f"The Round Table ({knights} knights) gave {', '.join(won) or 'nothing'}."


def set_market_resource(save: dict, resource: str, x, y, town_id: int, building_id) -> str:
    map = save["maps"][town_id]
    map["resourceAlliesMarket"] = resource
    if resource == "n":
        return "The Allied Market has nothing ordered."
    item = _building(save, x, y, town_id, int(building_id))
    if item is not None:
        item[STARTED] = timestamp_now()  # the delivery comes a day from now
    return f"The Allied Market will deliver {resource}."


def increase_population(save: dict, town_id: int) -> str:
    config = get_game_config()["globals"]
    map = save["maps"][town_id]
    most = int(config["POPULATION_INCREASE_QTY"])
    done = int(map.get("increasedPopulation") or 0)
    if done >= most:
        return "The Wonder has made all the room it can."
    map["increasedPopulation"] = done + 1  # the client counts each step's staff from this
    return f"Room for {config['POPULATION_INCREASE']} more people ({done + 1} of {most})."
