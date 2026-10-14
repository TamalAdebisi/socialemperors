"""
Attacking other empires, from the neighbour bar or the world map.

The battle is fought in the client, which reports it when the player leaves
the field. The attacker keeps the gold and experience won and loses the
units that did not come back; the defender's village is only scorched for
show and loses nothing, but keeps a record of the attack and earns a little
gold for each attacker its defence killed.

    privateState["attacksSent"]      [{time, victim_id, description}]  the
                                     client allows 3 attacks in 6 hours
    privateState["attacksReceived"]  [{time, attacker_id, viewPending,
                                       description}]  the history popup opens
                                     on the next visit home while viewPending
    privateState["spyings"]          [{time, victim_id}]
    privateState["honor"], ["attacksWon"], ["attacksLost"]
    map["universAttackWin"]          the world map's islands beaten: a
                                     battle won against the rival on one
                                     (worlds.py)

Commands from the client:

    "attack_player"       [victim]   the attack begins
    "end_attack"          [JSON report] or [JSON report, true] when the enemy
                          had no town hall (then nothing is won)
    "spy_player"          [victim]
    "clean_attacks"       []   the defender has seen the history popup
    "reset_world_change"  []   the client has shown the next continent
"""

import json
import math

from engine import timestamp_now
from get_game_config import get_attribute_from_item_id, get_game_config, get_level_from_xp
import magic
import quests
from sessions import save_session, session
from village import number
import worlds

KILL_GOLD_CAP = 200   # MAX_GOLD_FROM_ASSAULT in the client
MAX_HONOR = 10        # the most one battle gives (HonorManager)


def _list(state: dict, key: str) -> list:
    if not isinstance(state.get(key), list):
        state[key] = []
    return state[key]


def attack(save: dict, victim_id) -> str:
    _list(save["privateState"], "attacksSent").append({"time": timestamp_now(), "victim_id": str(victim_id)})
    return f"Attack on {victim_id} begins."


def spy(save: dict, victim_id) -> str:
    _list(save["privateState"], "spyings").append({"time": timestamp_now(), "victim_id": str(victim_id)})
    return f"Spying on {victim_id}."


def _kill_gold(unit_id) -> int:
    """The gold a fighting unit is worth when killed, as the client reckons it."""
    if number(unit_id, "attack") <= 0:
        return 0
    cost = number(unit_id, "cost")
    kind = get_attribute_from_item_id(unit_id, "cost_type")
    gold = {"g": cost // 2, "s": cost // 8, "c": cost * 10}.get(kind, 0)
    return min(gold, KILL_GOLD_CAP)


def _defender_gold(attacker_units) -> int:
    """A tenth of each attacker killed, rounded up (resources_victim)."""
    gold = 0
    for row in attacker_units or []:
        gold += int(row[quests.KILLED]) * math.ceil(_kill_gold(int(row[quests.UNIT_ID])) * 0.1)
    return gold


def end(save: dict, report: dict, no_town_hall=False) -> str:
    pState = save["privateState"]
    attacker = report.get("attacker") or {}
    victim = report.get("victim") or {}
    victim_id = str(victim.get("user_id", ""))
    town_id = int(attacker.get("map") or 0)
    map = save["maps"][town_id]
    won = int(report.get("win", 0)) == 1
    resources = report.get("resources") or {}

    gold = min(max(int(resources.get("g", 0)), 0), int(get_game_config()["globals"]["MAX_GOLD_ASSAULT"]))
    xp = max(int(resources.get("x", 0)), 0)
    honor = min(max(int(report.get("honor", 0)), 0), MAX_HONOR)
    if no_town_hall:
        gold = xp = honor = 0
    map["coins"] += gold
    map["xp"] += xp
    old_level = int(map.get("level", 1))
    map["level"] = max(old_level, get_level_from_xp(map["xp"]))  # level ups in battle were not sent
    magic.level_up(save, old_level, map["level"])

    lost = quests.lose_units(save, map, report.get("attacker_units"))

    pState["attacksWon"] = int(pState.get("attacksWon") or 0) + (1 if won else 0)
    pState["attacksLost"] = int(pState.get("attacksLost") or 0) + (0 if won else 1)
    pState["honor"] = int(pState.get("honor") or 0) + honor

    defender_gold = 0 if won else _defender_gold(report.get("attacker_units"))
    description = {
        "oponent": victim,
        "win": 1 if won else 0,
        "resources": {"g": gold, "x": xp},
        "resources_victim": {"g": defender_gold},
        "attacker_units": report.get("attacker_units") or [],
        "victim_units": report.get("victim_units") or [],
    }
    sent = _list(pState, "attacksSent")
    for entry in reversed(sent):
        if str(entry.get("victim_id")) == victim_id and "description" not in entry:
            entry["description"] = description
            break
    else:  # attack_player went missing
        sent.append({"time": timestamp_now(), "victim_id": victim_id, "description": description})

    island = won and worlds.beaten(save, town_id, victim)

    their_save = session(victim_id) if victim_id else None  # None for the villages that ship with the game
    if their_save is not None and victim_id != str(save["playerInfo"]["pid"]):
        their_state = their_save["privateState"]
        _list(their_state, "attacksReceived").append({
            "time": timestamp_now(),
            "attacker_id": str(save["playerInfo"]["pid"]),
            "viewPending": 1,
            "description": dict(description, oponent=attacker, win=0 if won else 1),
        })
        their_save["maps"][0]["coins"] += defender_gold
        save_session(victim_id)

    outcome = "won" if won else "lost"
    beaten = f", island {victim.get('posicion')} beaten" if island else ""
    return f"Attack on {victim_id} {outcome}: +{gold} gold, +{xp} xp, +{honor} honor, {len(lost)} units lost{beaten}."


def seen_attacks(save: dict) -> str:
    for entry in _list(save["privateState"], "attacksReceived"):
        entry.pop("viewPending", None)
    return "Attacks seen."
