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
    placing a stored   only what storage holds (inventory.place)
    item

The camps' and islands' data are the new client's (client/src/rules/), our
own notes on the Flash client, read once.

The browser tests' own server (e2e/run.mjs) sets SE_E2E_SEEDING, so tests can
fill a new player's storage in one step: there an item the game couldn't
have given is still stored, and the log says "would refuse", which shows
any real feature these rules miss.

Not yet checked: a "buy" the game makes for free (dragons hatching, the
temple's dragons, riders, camps, trees growing back). Each comes from a
feature with its own state, so each needs its own check.
"""

import datetime
import json
import os
from collections import Counter
from functools import lru_cache

from constants import Constant
from get_game_config import get_game_config

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
