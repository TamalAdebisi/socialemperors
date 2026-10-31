"""
What the server takes on the client's word, and how far.

The Flash client decides some things on its own screen and tells the server
afterwards: a boss island's prize, a prize put in storage, the merchant's
deal. A player who edits those requests could ask for anything, so the
server checks each claim against what the game could really have given
(DECISIONS.md, 20 October 2026):

    boss prizes        only the island's own (client/src/rules/islands.json,
                       our notes on the Flash client), as many as it gives
    store_add_items    a darts prize, sent just before its throw, from the
                       board of the day; a troll camp's prize, no more of
                       each than the camps give in all; or a hero bought
                       with cash with no altar to stand by (the next command)
    the merchant       buildings his window can offer, for no less than half
                       their price (his haggling starts at 20% off and adds 5%)
    placing a stored   only what storage holds (inventory.place); experience
    item               only for what came out of the gift box
    level ups          only within a tenth of a level's experience of the
                       server's own count; the score sent at start can't
                       change that count (levels.py)
    the warehouse      a unit goes in from the map and comes out from the
                       warehouse, never from nothing (warehouse.py)

The camps' and islands' data are the new client's (client/src/rules/), our
own notes on the Flash client, read once.

The browser tests' own server (e2e/run.mjs) sets SE_E2E_SEEDING, so tests can
fill a new player's storage in one step: there an item the game couldn't
have given is still stored, and the log says "would refuse", which shows
any real feature these rules miss.

Since 31 October 2026 (DECISIONS.md), what the game places, for the things
sold for cash (an item whose price is in cash: the premium dragons and the
rest, the Supreme Bahamut among them):

    "buy", free        only where a feature gives it: the nest's dragon or
                       monster at its tenth step, the temple's dragon after
                       its twelve offerings and wait, a tamed dragon whose
                       rider and dragon just came out of Dragon Riding
    "buy", paid        a unit only where a building of that town trains it
                       (no shop sells cash units)
    "buy_cash"         a unit only where a building of that town trains it
                       (gold units, heroes among them, are sold for cash too)
    "push_unit"        only a unit standing where the game says
    "pop_unit"         only a unit the building holds
    "sell" (KILL)      to the graveyard only a unit that was on the map
    "put_graveyard"    only a phoenix, with one of its eggs in town
    the Soul Mixer     a result its two souls and the power-ups paid for can
                       reach (soul_mixer.py)

and any purchase is paid in full or not at all (village.spend). Free
placements of everything else (camps, trees, wild animals, the social
buildings' units, the riders) are still believed: none is sold for cash.
What's refused goes on the admin page's bug radar ("refused"), so a rule
that misses a real feature shows.
"""

import datetime
import json
import os
from collections import Counter
from functools import lru_cache

from constants import Constant
from get_game_config import get_game_config
import radar
import temple

RULES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "client", "src", "rules")

DEAL_LEAST_SHARE = 0.5
DEAL_MOST_ITEMS = 12


def _rules(name: str) -> dict:
    with open(os.path.join(RULES, name), encoding="utf-8") as file:
        return json.load(file)


def _each(rows) -> list:
    return list(rows.values()) if isinstance(rows, dict) else list(rows)


@lru_cache(maxsize=None)
def boss_rewards() -> dict:
    """{quest id: Counter of the most of each item its win gives, whatever the race}."""
    found = {}
    for island in _each(_rules("islands.json")["islands"]):
        rewards = island.get("itemRewards") if isinstance(island, dict) else None
        if not rewards:
            continue
        most = Counter()
        for ids in rewards.values():
            for item_id, count in Counter(int(i) for i in ids).items():
                most[item_id] = max(most[item_id], count)
        found[int(island["quest"])] = most
    return found


@lru_cache(maxsize=None)
def camp_prizes() -> Counter:
    """The most of each item the scripted troll camps give, all camps together."""
    total = Counter()
    for camp in _each(_rules("scripted-camps.json")["camps"]):
        total.update(int(i) for i in camp.get("prizes") or [])
    return total


def _item(item_id: int):
    for item in get_game_config()["items"]:
        if int(item["id"]) == item_id:
            return item
    return None


# Boss islands

def quest_rewards(quest_id: int, claimed) -> dict:
    """The part of a boss island's claimed prizes the island really gives."""
    try:
        allowed = boss_rewards().get(int(quest_id), Counter())
    except (TypeError, ValueError):
        return {}
    kept = {}
    for item_id, count in (claimed or {}).items():
        try:
            item_id, count = int(item_id), int(count)
        except (TypeError, ValueError):
            continue
        count = min(count, allowed.get(item_id, 0))
        if count > 0:
            kept[item_id] = count
    return kept


# Prizes put in storage

def darts_board(now: float) -> dict:
    """The darts board of the moment: the last one started (the config's dates are UTC)."""
    current = None
    for board in get_game_config().get("darts_items") or []:
        try:
            start = datetime.datetime.strptime(board["start_date"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=datetime.timezone.utc)
        except (KeyError, TypeError, ValueError):
            continue
        if start.timestamp() <= now and (current is None or start >= current[0]):
            current = (start, board)
    return current[1] if current else {}


def _darts_prize(save: dict, item_id: int, upcoming: list, now: float) -> bool:
    throw = next((c for c in upcoming[:2] if c.get("cmd") == Constant.CMD_DARTS_SHOOT_BALLOON), None)
    if throw is None:
        return False
    try:
        balloon = int(throw["args"][0])
    except (KeyError, IndexError, TypeError, ValueError):
        return False
    if balloon in (save["privateState"].get("dartsBalloonsShot") or []):
        return False
    board = darts_board(now)
    prizes = [int(i) for i in board.get("items") or []]
    if board.get("extra_item") is not None:
        prizes.append(int(board["extra_item"]))
    return item_id in prizes


def _camp_prize(save: dict, item_id: int) -> bool:
    taken = save["privateState"].setdefault("campPrizesTaken", {})
    if int(taken.get(str(item_id), 0)) >= camp_prizes().get(item_id, 0):
        return False
    taken[str(item_id)] = int(taken.get(str(item_id), 0)) + 1
    return True


def _hero_without_altar(item_id: int, upcoming: list) -> bool:
    after = upcoming[0] if upcoming else None
    try:
        return after is not None and after.get("cmd") == Constant.CMD_BUY_UNIT_WITH_CASH and int(after["args"][0]) == item_id
    except (KeyError, IndexError, TypeError, ValueError):
        return False


def storable(save: dict, item_id: int, upcoming: list, now: float) -> bool:
    """Whether a "store_add_items" for this item is one the game could have sent."""
    return _hero_without_altar(item_id, upcoming) or _darts_prize(save, item_id, upcoming, now) or _camp_prize(save, item_id)


def seeding() -> bool:
    """The browser tests' server, which may fill storage as a test sets up (e2e/run.mjs)."""
    return os.environ.get("SE_E2E_SEEDING") == "1"


# The merchant

def deal_price(ids: list):
    """The least the merchant takes for these, or None when he can't offer them."""
    if not 0 < len(ids) <= DEAL_MOST_ITEMS:
        return None
    total = 0
    for item_id in ids:
        item = _item(item_id)
        if item is None or item.get("race") not in ("a", "h") or item.get("cost_type") != "c" \
                or int(item.get("cost") or 0) < 5 or str(item.get("in_store")) != "1" or item.get("type") != "b":
            return None
        total += int(item["cost"])
    return round(total * DEAL_LEAST_SHARE)


# What the game places

NEST_DRAGONS = [638, 649, 651, 684, 698, 695]  # the dragon nest's, in order (client/src/rules/nest.ts)
NEST_MONSTERS = [717, 713, 742, 653]           # the monster nest's
NEST_STEPS = 10
DRAGON_RIDING = 1346                           # the taming building
RIDERS = [822, 823, 824]                       # Dragon Rider I to III
HEROES = {533, 534, 535, 550, 554, 555, 556, 557}  # the Altar of Heroes' (graveyard.py)


def _sold_for_cash(item) -> bool:
    return item is not None and item.get("cost_type") == "c"


def _trained_in(map: dict, unit_id: int) -> bool:
    """Whether a building of this town trains the unit (its config's "trains")."""
    trainers = {int(item["id"]) for item in get_game_config()["items"] if int(item.get("trains") or 0) == unit_id}
    return any(int(row[0]) in trainers for row in map["items"])


def _grown_in_a_nest(save: dict, unit_id: int) -> bool:
    pState = save["privateState"]
    for ones, number, step in ((NEST_DRAGONS, "dragonNumber", "stepNumber"),
                               (NEST_MONSTERS, "monsterNumber", "stepMonsterNumber")):
        current = int(pState.get(number) or 0)
        if 0 <= current < len(ones) and ones[current] == unit_id and int(pState.get(step) or 0) >= NEST_STEPS:
            return True
    return False


def taken_out_for_taming(save: dict, building_id: int, unit_id: int) -> None:
    """A unit taken out of Dragon Riding with no place to stand (pop_unit with
    four arguments): the rider and dragon a tamed dragon is made of."""
    if int(building_id) == DRAGON_RIDING:
        out = save["privateState"].setdefault("tamingOut", [])
        out.append(int(unit_id))
        del out[:-4]


def _tamed(save: dict, unit_id: int) -> bool:
    out = save["privateState"].get("tamingOut") or []
    for dragon, row in (get_game_config()["globals"].get("DRAGONS") or {}).items():
        if not isinstance(row, dict) or int(row.get("tamedId") or row.get("tamed_id") or 0) != unit_id:
            continue
        rider = int(row.get("rider") or 0)
        if 1 <= rider <= len(RIDERS) and int(dragon) in out and RIDERS[rider - 1] in out:
            out.remove(int(dragon))
            out.remove(RIDERS[rider - 1])
            return True
    return False


def placement_refusal(save: dict, item_id, town_id: int, free: bool, now: int):
    """Why a "buy" can't be believed, or None (see the top of this file)."""
    item_id = int(item_id)
    item = _item(item_id)
    if not _sold_for_cash(item):
        return None
    if free:
        if _grown_in_a_nest(save, item_id) or _tamed(save, item_id):
            return None
        if item_id == temple.SUPREME_BAHAMUT and temple.claim(save, now):
            return None
        return "a thing sold for cash, placed for free with no feature giving it"
    if item.get("type") != "u" or str(item.get("in_store")) == "1" or _trained_in(save["maps"][town_id], item_id):
        return None
    return "a unit sold for cash, bought where nothing sells or trains it"


def cash_buy_refusal(save: dict, unit_id, town_id: int):
    """Why a "buy_cash" can't be believed, or None. The shop, the barracks and
    the Altar of Heroes sell gold units for cash too; a unit sold only for cash
    comes this way only where a building of the town trains it."""
    unit_id = int(unit_id)
    if not _sold_for_cash(_item(unit_id)) or unit_id in HEROES or _trained_in(save["maps"][town_id], unit_id):
        return None
    return "a unit sold for cash, bought with cash where no building trains it"


def push_refusal(unit_id):
    """Why a unit that isn't where the game says can't go into a building, or None: one sold for cash can't."""
    if _sold_for_cash(_item(int(unit_id))):
        return "a unit sold for cash, into a building from where it doesn't stand"
    return None


def pop_refusal(building, unit_id):
    """Why a unit can't come out of a building, or None: one sold for cash only if it is inside."""
    if not _sold_for_cash(_item(int(unit_id))):
        return None
    inside = building[6] if building is not None and len(building) > 6 and isinstance(building[6], list) else []
    return None if int(unit_id) in inside else "a unit sold for cash, out of a building that doesn't hold it"


def refuses(save: dict, cmd: str, why, args) -> bool:
    """Whether to refuse a command for why (None: believe it). On the bug
    radar; the browser tests' server only says it would (seeding())."""
    if why is None:
        return False
    if seeding():
        print(f"(test server: would refuse: {why}) ", end="")
        return False
    radar.note(radar.REFUSED, cmd, why, example=args, player=save.get("playerInfo", {}).get("pid"))
    print(f"Refused: {why}.")
    return True
