"""
Helping neighbours. Once a day per neighbour, a visitor may help up to 5 of
their farms, mills, mines and other working buildings. The visitor is paid on
the spot; the neighbour's share arrives later, when a donkey cart brings it
on their next visit home.

    privateState["neighborAssists"]  {"u" + neighbour: when they were last
                                      helped}; the client offers help again
                                      a day later
    map["receivedAssists"]           {"u" + helper: [[x, y, building], ...]}
                                     help waiting for the donkey cart

Commands from the client:

    "assist_neighbor_new"     [neighbour, 0, JSON [[x, y, building], ...]]
                                 sent on leaving the neighbour's village
    "assist_neighbor"         [neighbour, request, town]  the older way of
                                 helping, from a help request
    "assist_receive"          [town, building]  the cart reached a building
                                 the neighbour helped
    "clean_received_assists"  [helper, town]    that helper's cart has gone

Only real players' villages keep the help they received; the villages that
ship with the game are visited, helped and paid for, and stay as they are.
"""

import json

from engine import timestamp_now
from get_game_config import get_attribute_from_item_id, get_game_config
from sessions import neighbor_session, save_session, session
from village import give, number

ONCE_PER = 24 * 3600
MOST_HELPED = 5          # NUM_CLICKS_ASSIST in the client
HELPER_GOLD, HELPER_XP = 10, 3   # ASSIST_CLICK_REWARD_GOLD / _XP in the client
SHARE_DIVISOR = 4        # the neighbour gets a quarter of one collection
SHARE_XP = 10            # FRIENDS_ASSIST_EXPERIENCE in the client


def _last_helped(save: dict) -> dict:
    pState = save["privateState"]
    if not isinstance(pState.get("neighborAssists"), dict):
        pState["neighborAssists"] = {}
    return pState["neighborAssists"]


def _received(map: dict) -> dict:
    if not isinstance(map.get("receivedAssists"), dict):
        map["receivedAssists"] = {}
    return map["receivedAssists"]


def _may_help(save: dict, neighbour: str):
    """Why this neighbour cannot be helped now, or None."""
    if neighbour == str(save["playerInfo"]["pid"]):
        return "A village cannot help itself."
    if neighbor_session(neighbour) is None:
        return f"There is no neighbour {neighbour}."
    if timestamp_now() - int(_last_helped(save).get("u" + neighbour) or 0) < ONCE_PER:
        return f"Neighbour {neighbour} was already helped today."
    return None


def help_buildings(save: dict, neighbour, buildings_json: str) -> str:
    neighbour = str(neighbour)
    refused = _may_help(save, neighbour)
    if refused:
        return refused
    helped = [list(b[:3]) for b in json.loads(buildings_json or "[]")][:MOST_HELPED]
    if not helped:
        return "No buildings were helped."
    home = save["maps"][0]
    give(save, home, "g", HELPER_GOLD * len(helped))
    give(save, home, "x", HELPER_XP * len(helped))
    _last_helped(save)["u" + neighbour] = timestamp_now()

    their_save = session(neighbour)  # None for the villages that ship with the game
    if their_save is not None:
        _received(their_save["maps"][0])["u" + str(save["playerInfo"]["pid"])] = helped
        save_session(neighbour)
    return f"Helped {len(helped)} buildings of {neighbour}: +{HELPER_GOLD * len(helped)} gold, +{HELPER_XP * len(helped)} xp."


def help_request(save: dict, neighbour, town_id: int) -> str:
    neighbour = str(neighbour)
    refused = _may_help(save, neighbour)
    if refused:
        return refused
    config = get_game_config()["globals"]
    gold, xp = int(config["ASSIST_REWARD_GOLD"]), int(config["ASSIST_REWARD_XP"])
    home = save["maps"][town_id]
    give(save, home, "g", gold)
    give(save, home, "x", xp)
    _last_helped(save)["u" + neighbour] = timestamp_now()
    return f"Helped {neighbour}: +{gold} gold, +{xp} xp."


def receive(save: dict, town_id: int, building_id) -> str:
    map = save["maps"][town_id]
    building_id = int(building_id)
    for key, buildings in _received(map).items():
        for entry in buildings:
            if int(entry[2]) == building_id:
                buildings.remove(entry)  # each help is delivered once
                share = number(building_id, "collect") // SHARE_DIVISOR
                resource = _collect_type(building_id)
                give(save, map, resource, share)
                give(save, map, "x", SHARE_XP)
                return f"The cart from {key[1:]} brought {share} {resource} and {SHARE_XP} xp."
    return f"No help was waiting at building {building_id}."


def _collect_type(building_id) -> str:
    kind = get_attribute_from_item_id(building_id, "collect_type")
    return kind if kind in ("g", "w", "s", "f") else "g"


def clean(save: dict, helper, town_id: int) -> str:
    _received(save["maps"][town_id]).pop("u" + str(helper), None)
    return f"The cart from {helper} has gone."
