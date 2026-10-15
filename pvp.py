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

The report is checked against itself, as the Flash client works it out
(CLIENT.md, "Attacking players"): the gold at most what the defender's
things killed are worth (a town hall its owner's level x 100, a fighter
half its gold price, an eighth of its stone price or ten times its cash
price, each at most 200), 25 for a win that found none, 20,000 in all;
the experience at most a twentieth of each kill's gold (1 for anything
else the town had, walls aside); the honour worked out again; and at
least the attacker's share of losses by its level. More attacks than
the 3 in 6 hours (4 with an Odin Statue) are recorded but pay nothing.

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
import levels
import quests
from sessions import save_session, session, username_of
from village import number
import worlds

KILL_GOLD_CAP = 200   # MAX_GOLD_FROM_ASSAULT in the client
MAX_HONOR = 10        # the most one battle gives (HonorManager)
WIN_FLOOR = 25        # a won attack that found no gold still pays this
WORTH_CAP = 1000      # an item's price counts up to this for honour
TOWN_HALL_SUBCAT = 135
WALL_SUBCAT = 132
ODIN_STATUE = 366     # one more attack in the window
HISTORY = 20          # attacks kept in each list (the client shows 10)


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


def _row_count(row, column) -> int:
    try:
        return max(int(row[column]), 0)
    except (IndexError, TypeError, ValueError):
        return 0


def _most_pay(victim_units, victim_level: int) -> tuple:
    """The most gold and experience the defender's things killed can pay."""
    gold = xp = 0
    for row in victim_units or []:
        unit_id, killed = _row_count(row, quests.UNIT_ID), _row_count(row, quests.KILLED)
        if number(unit_id, "subcat_functional") == TOWN_HALL_SUBCAT:
            each = victim_level * 100
        else:
            each = _kill_gold(unit_id)
        gold += killed * each
        if each > 0 or number(unit_id, "subcat_functional") != WALL_SUBCAT:
            xp += killed * max(math.ceil(each / 20), 1)
    return gold, xp


def _worth(rows, column) -> float:
    """An army's worth for honour: each item's price, up to 1,000, a hundredth."""
    return sum(_row_count(row, column) * min(number(_row_count(row, quests.UNIT_ID), "cost"), WORTH_CAP) / 100
               for row in rows or [])


def _honor(attacker_units, victim_units) -> int:
    """HonorManager: what each side lost against what the defender had, 1 to 10."""
    sent = _worth(victim_units, quests.SENT)
    if sent <= 0:
        return 1
    score = round(10 * (_worth(victim_units, quests.KILLED) - _worth(attacker_units, quests.KILLED)) / sent)
    return min(max(score, 1), MAX_HONOR)


def _recovered_share(level: int) -> int:
    """The share (percent) of the attacker's fallen that come home, by its level."""
    config = get_game_config()["globals"]
    if level < 10:
        return int(config["PERCENT_UNITS_RECOVERED_ATTACKER_L9"])
    if level <= 15:
        return int(config["PERCENT_UNITS_RECOVERED_ATTACKER_L10_L15"])
    return int(config["PERCENT_UNITS_RECOVERED_ATTACKER_L16"])


def _enforce_losses(rows, share: int) -> list:
    """At least killed - (killed x share, rounded up) of the fallen stay lost, as the client draws them."""
    rows = [list(row) for row in rows or []]
    killed = sum(_row_count(row, quests.KILLED) for row in rows)
    most_back = math.ceil(killed * share / 100)
    back = sum(min(_row_count(row, quests.RECOVERED), _row_count(row, quests.KILLED)) for row in rows)
    for row in rows:
        if len(row) > quests.RECOVERED:
            row[quests.RECOVERED] = min(_row_count(row, quests.RECOVERED), _row_count(row, quests.KILLED))
    for row in rows:
        if back <= most_back:
            break
        if len(row) > quests.RECOVERED:
            fewer = min(row[quests.RECOVERED], back - most_back)
            row[quests.RECOVERED] -= fewer
            back -= fewer
    return rows


def _attacks_allowed(save: dict, town_id: int) -> int:
    allowed = int(get_game_config()["globals"]["ATTACKS_PERIOD_MAX"])
    town = save["maps"][town_id] if 0 <= town_id < len(save["maps"]) else {"items": []}
    return allowed + (1 if any(item[0] == ODIN_STATUE for item in town["items"]) else 0)


def _over_the_count(save: dict, town_id: int) -> bool:
    """More attacks in the 6 hours up to the last one than the client lets a player make."""
    times = [int(entry.get("time") or 0) for entry in _list(save["privateState"], "attacksSent")]
    if not times:
        return False
    last = max(times)
    period = int(get_game_config()["globals"]["ATTACKS_PERIOD_HOURS"]) * 3600
    return sum(1 for t in times if last - period < t <= last) > _attacks_allowed(save, town_id)


def _defender_gold(attacker_units) -> int:
    """A tenth of each attacker killed, rounded up (resources_victim)."""
    gold = 0
    for row in attacker_units or []:
        gold += int(row[quests.KILLED]) * math.ceil(_kill_gold(int(row[quests.UNIT_ID])) * 0.1)
    return gold


def end(save: dict, report: dict, no_town_hall=False) -> str:
    pState = save["privateState"]
    attacker = dict(report.get("attacker") or {})
    # The defender's history shows the attacker by their username, as the neighbours list does
    # (every empire is called "Emperor" otherwise).
    attacker["name"] = username_of(save["playerInfo"]["pid"]) or attacker.get("name")
    victim = report.get("victim") or {}
    victim_id = str(victim.get("user_id", ""))
    town_id = int(attacker.get("map") or 0)
    map = save["maps"][town_id]
    won = int(report.get("win", 0)) == 1
    resources = report.get("resources") or {}

    their_town = session(victim_id) if victim_id else None
    their_map = None
    if their_town is not None:
        their_map = their_town["maps"][min(max(int(victim.get("map") or 0), 0), len(their_town["maps"]) - 1)]
    # The defender's level as their save has it (a village that ships with the game: as reported).
    victim_level = int(their_map.get("level", 1)) if their_map is not None else int(victim.get("level") or 1)
    most_gold, most_xp = _most_pay(report.get("victim_units"), victim_level)
    # Each other thing of the defender's town is worth 1 experience at most (a built-in village: a generous bound).
    most_xp += len(their_map["items"]) if their_map is not None else 500
    cap = int(get_game_config()["globals"]["MAX_GOLD_ASSAULT"])
    gold = min(max(int(resources.get("g", 0)), 0), max(most_gold, WIN_FLOOR if won else 0), cap)
    xp = min(max(int(resources.get("x", 0)), 0), most_xp)
    honor = _honor(report.get("attacker_units"), report.get("victim_units"))
    if no_town_hall or _over_the_count(save, town_id):
        gold = xp = honor = 0
    report["attacker_units"] = _enforce_losses(report.get("attacker_units"), _recovered_share(int(map.get("level", 1))))
    map["coins"] += gold
    map["xp"] += xp
    map["level"] = max(int(map.get("level", 1)), get_level_from_xp(map["xp"]))  # level ups in battle were not sent
    levels.reached(save, map, map["level"])

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
    del sent[:-HISTORY]
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
        received = _list(their_state, "attacksReceived")
        del received[:-(HISTORY - 1)]
        received.append({
            "time": timestamp_now(),
            "attacker_id": str(save["playerInfo"]["pid"]),
            "viewPending": 1,
            "description": dict(description, oponent=attacker, win=0 if won else 1),
        })
        # To the town that was attacked.
        attacked = int(victim.get("map") or 0)
        their_save["maps"][attacked if 0 <= attacked < len(their_save["maps"]) else 0]["coins"] += defender_gold
        save_session(victim_id)

    outcome = "won" if won else "lost"
    beaten = f", island {victim.get('posicion')} beaten" if island else ""
    return f"Attack on {victim_id} {outcome}: +{gold} gold, +{xp} xp, +{honor} honor, {len(lost)} units lost{beaten}."


def seen_attacks(save: dict) -> str:
    for entry in _list(save["privateState"], "attacksReceived"):
        entry.pop("viewPending", None)
    return "Attacks seen."
