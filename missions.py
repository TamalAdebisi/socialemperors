"""
Missions (the goals on the left of the screen) and the troll raids on the
home village that end with a treasure chest.

    privateState["completedMissions"]  ids of the goals reached
    privateState["rewardedMissions"]   ids of the goals whose gold was taken
    map["idCurrentTreasure"]           the next raid, 0 to 29, in the client's order
    map["timestampLastTreasure"]       when the last chest was opened; the
                                       client waits 4 hours for the next raid
    map["currentQuestVars"]            what the current raid has spawned, so
                                       it is not spawned again after a reload

Commands from the client:

    "complete_mission"  [mission, 1 if skipped]   skipping costs PRICE_COMPLETE_GOAL cash
    "reward_mission"    [town, mission]           the mission's gold
    "set_quest_var"     [town, key, JSON value]
    "collect_treasure"  [gold, xp, next raid, food, stone, town]
        Gold and xp depend on the player's level, at most 750 and 100; food
        and stone are always 0 in this client. The client also sends it with
        nothing to give when it only moves the raids along; that does not
        start the 4-hour wait.
"""

import json

from engine import timestamp_now
from get_game_config import get_attribute_from_mission_id, get_game_config
from village import give, spend, take

NUM_RAIDS = 30
MOST_TREASURE_GOLD, MOST_TREASURE_XP = 750, 100


def _ids(pState: dict, key: str) -> list:
    if not isinstance(pState.get(key), list):
        pState[key] = []
    return pState[key]


def complete(save: dict, mission_id, skipped: bool) -> str:
    done = _ids(save["privateState"], "completedMissions")
    if mission_id in done:
        return f"Mission {mission_id} was already complete."
    note = ""
    if skipped:
        cash = int(get_game_config()["globals"]["PRICE_COMPLETE_GOAL"])
        if not spend(save, None, "c", cash):
            return f"Refused: skipping mission {mission_id} takes {cash} cash."
        note = f", skipped for {cash} cash"
    done.append(mission_id)
    return f"Mission {mission_id} complete{note}."


def reward(save: dict, town_id: int, mission_id) -> str:
    rewarded = _ids(save["privateState"], "rewardedMissions")
    if mission_id in rewarded:
        return f"Mission {mission_id} was already rewarded."
    gold = int(get_attribute_from_mission_id(mission_id, "reward") or 0)
    give(save, save["maps"][town_id], "g", gold)
    rewarded.append(mission_id)
    return f"Mission {mission_id} rewarded with {gold} gold."


# A raid's progress, kept only once the raid has started ("spawned").
PROGRESS_KEYS = ("activators", "boss", "treasure")


def set_quest_var(save: dict, town_id: int, key: str, value: str) -> str:
    map = save["maps"][town_id]
    if not isinstance(map.get("currentQuestVars"), dict):
        map["currentQuestVars"] = {}
    # A few raids send their last progress just after their chest's
    # collect_treasure. Kept, it would count against the next raid, which
    # would then finish by itself on a reload.
    if key in PROGRESS_KEYS and not map["currentQuestVars"].get("spawned"):
        return f"Raid {key} ignored: no raid under way."
    map["currentQuestVars"][key] = json.loads(value)
    return f"Raid {key} = {value}."


def collect_treasure(save: dict, gold, xp, next_raid, food, stone, town_id: int) -> str:
    map = save["maps"][town_id]
    if not 0 <= int(next_raid) < NUM_RAIDS:
        return f"There is no raid {next_raid}."
    gold = min(max(int(gold), 0), MOST_TREASURE_GOLD)
    xp = min(max(int(xp), 0), MOST_TREASURE_XP)
    food, stone = max(int(food), 0), max(int(stone), 0)
    for resource, amount in (("g", gold), ("x", xp), ("f", food), ("s", stone)):
        give(save, map, resource, amount)
    map["idCurrentTreasure"] = int(next_raid)
    map["currentQuestVars"] = {}  # the next raid starts from nothing
    if gold or xp or food or stone:
        map["timestampLastTreasure"] = timestamp_now()
        return f"Treasure: {gold} gold, {xp} xp. Next raid {next_raid}."
    return f"Next raid {next_raid}."
