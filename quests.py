"""
Quest islands: the map files the client asks for, and the player's progress.

The client never keeps quest progress itself. It reads it from the save every
time it loads a map (including the trip home after a quest), so the server's
copy is what the player sees:

    privateState["unlockedQuestIndex"]  how far along globals.ISLE_ORDER the
                                        player may go (index 0 is open from
                                        the start, each win opens the next)
    privateState["questsRank"]          {quest id: highest difficulty won, 1-3},
                                        shown as stars; each star opens the
                                        next difficulty. The first win on 3
                                        stars pays cash (economy.py)
    map["questTimes"]                   {quest id: when it was last attacked};
                                        the client waits 4 hours before the
                                        same island can be attacked again

Commands from the client:

    "start_quest" [quest id, town]
    "end_quest"   [JSON: map, resources {g, x}, units, win, duration,
                   voluntary_end, quest_id, difficulty, and for boss islands
                   item_rewards {item id: count}]

While a quest runs, the client sends no other commands (deaths, level ups
and so on are dropped until the player is home), so "end_quest" carries the
whole outcome. Each row of "units" is [unit id, sent, killed, recovered];
units killed and not recovered are lost from the player's empire and go to
the graveyard. Boss rewards appear in the player's storage on screen, but
only reach the save through item_rewards.
"""

import json
import os

from bundle import QUESTS_DIR
from engine import timestamp_now
from get_game_config import get_game_config, get_level_from_xp
import economy
import graveyard
import inventory
import levels
from village import give

UNIT_ID, SENT, KILLED, RECOVERED = 0, 1, 2, 3


def is_island(questid) -> bool:
    """A quest island the game has a map for. Quest ids are plain numbers:
    rejecting anything else stops requests like "100000/../../something"
    from reading files outside the quests folder."""
    questid = str(questid)
    return questid.isdigit() and os.path.exists(os.path.join(QUESTS_DIR, questid + ".json"))


def get_quest_map(questid):
    if not is_island(questid):
        return ("", 404)
    with open(os.path.join(QUESTS_DIR, str(questid) + ".json"), "r") as f:
        return (json.load(f), 200)


def _quest_times(map: dict) -> dict:
    if not isinstance(map.get("questTimes"), dict):
        map["questTimes"] = {}  # older saves have []
    return map["questTimes"]


def _ranks(save: dict) -> dict:
    pState = save["privateState"]
    if not isinstance(pState.get("questsRank"), dict):
        pState["questsRank"] = {}
    return pState["questsRank"]


def lose_units(save: dict, map: dict, rows) -> list:
    """Takes the units lost in a quest or an attack out of the empire. Returns their ids."""
    lost = []
    for row in rows or []:
        unit_id = int(row[UNIT_ID])
        missing = int(row[KILLED]) - int(row[RECOVERED])  # free units lent by the quest come out at 0 or less
        for item in reversed(list(map["items"])):
            if missing <= 0:
                break
            if item[0] == unit_id:
                map["items"].remove(item)
                graveyard.bury(save, unit_id)
                lost.append(unit_id)
                missing -= 1
    return lost


def start(save: dict, quest_id, town_id: int) -> str:
    _quest_times(save["maps"][town_id])[str(quest_id)] = timestamp_now()
    return f"Quest {quest_id} started."


def end(save: dict, result: dict) -> str:
    town_id = int(result.get("map", 0))
    map = save["maps"][town_id]
    pState = save["privateState"]
    quest_id = str(result["quest_id"])
    won = int(result.get("win", 0)) == 1

    resources = result.get("resources", {})
    map["coins"] += max(int(resources.get("g", 0)), 0)
    map["xp"] += max(int(resources.get("x", 0)), 0)
    map["level"] = max(int(map.get("level", 1)), get_level_from_xp(map["xp"]))  # level ups during the quest were not sent
    levels.reached(save, map, map["level"])  # nor were their prizes

    _quest_times(map).setdefault(quest_id, timestamp_now())  # normally set by start_quest

    prize = 0
    if won:
        difficulty = min(max(int(result.get("difficulty", 1)), 1), 3)
        ranks = _ranks(save)
        stars = int(ranks.get(quest_id, 0))
        ranks[quest_id] = max(stars, difficulty)
        if stars < 3 <= difficulty and is_island(quest_id):  # stars never go down, so once an island
            prize = economy.ISLAND_THREE_STAR_CASH
            give(save, map, "c", prize)
        order = get_game_config()["globals"]["ISLE_ORDER"]
        if quest_id in order:
            pState["unlockedQuestIndex"] = max(int(pState.get("unlockedQuestIndex", 0)), order.index(quest_id) + 1)

    lost = lose_units(save, map, result.get("units"))

    for item_id, count in (result.get("item_rewards") or {}).items():
        inventory.add_gift(save, int(item_id), int(count))

    outcome = "won" if won else "lost"
    first_three_stars = f", first 3 stars: +{prize} cash" if prize else ""
    return (f"Quest {quest_id} {outcome}: +{resources.get('g', 0)} gold, +{resources.get('x', 0)} xp, "
            f"{len(lost)} units lost{first_three_stars}.")


def back_pay(save: dict) -> None:
    """Saves from before the 3 star prize: the islands already won on 3
    stars pay it, once. Runs on every save at startup, so a strange value
    is skipped rather than stopping the server."""
    islands = [quest_id for quest_id, stars in _ranks(save).items()
               if str(stars).isdigit() and int(stars) >= 3 and is_island(quest_id)]
    if islands:
        cash = economy.ISLAND_THREE_STAR_CASH * len(islands)
        give(save, save["maps"][0], "c", cash)
        print(f"   > back pay for {len(islands)} islands won on 3 stars: {cash} cash")
