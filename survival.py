"""
Survival mode, at the Survival Arena: hold out against waves of enemies for
as long as possible. The longer the stand, the better the unit won.

    privateState["survivalVidaTimeStamp"]  when each of the 3 lives was used;
                                           a life comes back
                                           SURVIVAL_HOURS_LIVE_REGENERATE hours later
    privateState["survivalVidasExtra"]     lives bought, used after the 3
    privateState["survivalMaps"]           {map id: {"ts": last played,
                                                     "tp": best time in seconds}};
                                           a map is open once it is here

Commands from the client:

    "start_survival"           []   uses a life
    "end_survival"             [map id, seconds held, JSON {unit: count} or null]
    "add_survival_vida_extra"  [cash]           a life for SURVIVAL_BUY_LIVE_CASH
    "buy_survival_map"         [map id, cash]   a map for SURVIVAL_UNLOCK_MAP_CASH

The prize is the unit of the longest stand reached, from the list the client
shows for each map; the server works it out from the time held rather than
from the client's list.
"""

import json

from engine import timestamp_now
from get_game_config import get_game_config
import inventory
from village import take

LIVES = 3
MAP_IDS = ["100000035", "100000036", "100000037", "100000038", "100000039"]
# (minutes held, unit won) for each map, as the client shows them.
_LATER_MAPS = [(12, 730), (15, 654), (20, 644), (25, 758)]
PRIZES = {
    "100000035": [(5, 619), (8, 577), (12, 662), (15, 629)],
    "100000036": [(5, 607), (8, 655), (12, 687), (15, 652)],
    "100000037": _LATER_MAPS,
    "100000038": _LATER_MAPS,
    "100000039": _LATER_MAPS,
}


def _globals() -> dict:
    return get_game_config()["globals"]


def _maps(save: dict) -> dict:
    pState = save["privateState"]
    if not isinstance(pState.get("survivalMaps"), dict):
        pState["survivalMaps"] = {}
    return pState["survivalMaps"]


def prize(map_id: str, seconds: int):
    """The unit won for holding out this long, or None."""
    prizes = PRIZES.get(str(map_id), [])
    if not prizes or seconds <= prizes[0][0] * 60:
        return None
    won = None
    for minutes, unit_id in prizes:
        if seconds < minutes * 60:
            break
        won = unit_id
    return won


def start(save: dict) -> str:
    pState = save["privateState"]
    now = timestamp_now()
    wait = int(_globals()["SURVIVAL_HOURS_LIVE_REGENERATE"]) * 3600
    used = pState.get("survivalVidaTimeStamp")
    used = [int(t) for t in used] if isinstance(used, list) else []
    used = [t for t in used if t + wait > now]  # lives that came back are free again
    if len(used) < LIVES:
        used.append(now)
        note = "a life"
    else:
        pState["survivalVidasExtra"] = max(int(pState.get("survivalVidasExtra") or 0) - 1, 0)
        note = "a bought life"
    pState["survivalVidaTimeStamp"] = used
    return f"Survival started with {note}."


def end(save: dict, map_id, seconds, units_json, town_id: int = 0) -> str:
    map_id, seconds = str(map_id), max(int(seconds), 0)
    won = prize(map_id, seconds)
    claimed = json.loads(units_json) if units_json else None
    if claimed and set(int(u) for u in claimed) != {won}:
        print(f"(the client listed {claimed}; the time held gives {won}) ", end="")
    if won is not None:
        inventory.add_stored(save, town_id, won)  # shown in storage by the client, which sends nothing for it
    maps = _maps(save)
    best = int((maps.get(map_id) or {}).get("tp", 0))
    maps[map_id] = {"ts": timestamp_now(), "tp": max(best, seconds)}
    return f"Survival over after {seconds} seconds; won {won}."


def buy_life(save: dict) -> str:
    pState = save["privateState"]
    take(save, None, "c", int(_globals()["SURVIVAL_BUY_LIVE_CASH"]))
    pState["survivalVidasExtra"] = int(pState.get("survivalVidasExtra") or 0) + 1
    return "A life bought."


def buy_map(save: dict, map_id) -> str:
    map_id = str(map_id)
    if map_id not in MAP_IDS:
        return f"There is no survival map {map_id}."
    maps = _maps(save)
    if map_id in maps:
        return f"Survival map {map_id} is already open."
    take(save, None, "c", int(_globals()["SURVIVAL_UNLOCK_MAP_CASH"][MAP_IDS.index(map_id)]))
    maps[map_id] = {"ts": 0, "tp": 0}
    return f"Survival map {map_id} opened."
