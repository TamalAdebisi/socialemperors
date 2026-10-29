"""The later original Soul Mixer queue.

Version 1.4.07 sends the ordinary queue commands. Its two parents remain
inside while mixing; that client returns them with pop_unit commands after
collecting, but the owner remembers the game taking their souls (28
October 2026), so collecting uses them up here and a later pop_unit of
either is refused (command.py). The
2012 config does not include its ranks, times or power-up prices; the
server fills them from config/soulmixer_wiki.json, rebuilt from the
community wiki (get_game_config.soul_mixer_from_the_wiki). Without any
tables, new mixes stay unavailable and finished old ones still collect.
"""

import math

from engine import timestamp_now
from get_game_config import get_game_config, get_item_from_id
from village import ATTRS, UNITS, full, item_at, number, take
import speedups
import towns

BUILDING = 1529
LEGACY_DRAGONS = {2048, 2037, 777, 758}


def powerups():
    rows = get_game_config().get("globals", {}).get("SOUL_MIXER_POWERUPS_LEVELS")
    if not isinstance(rows, list) or not rows:
        return None
    try:
        parsed = [(int(row["cash_cost"]), int(row["order_increment"])) for row in rows]
        return parsed if all(cash >= 0 and increment >= 0 for cash, increment in parsed) else None
    except (TypeError, KeyError, ValueError):
        return None


def available():
    units = [row for row in get_game_config()["items"] if int(row.get("breeding_order") or 0) > 0]
    minimum = int(get_game_config().get("globals", {}).get("SOUL_MIXER_MIN_LEVEL") or 0)
    return minimum > 0 and len(units) >= 3 and all(int(row.get("sm_training_time") or 0) > 0 for row in units) and powerups() is not None


def buy_powerup(save, level):
    rows = powerups()
    level = int(level)
    if not available() or not 0 <= level < len(rows):
        return "Soul Mixer: original content data is unavailable."
    price = rows[level][0]
    if save["playerInfo"]["cash"] < price:
        return "Soul Mixer: not enough cash."
    take(save, None, "c", price)
    return "Soul Mixer: power-up paid."


def _queues(save):
    queues = save["privateState"].get("barracksQueues")
    if not isinstance(queues, dict):
        queues = {}
        save["privateState"]["barracksQueues"] = queues
    return queues


def _find(save, queue_id):
    for map in save["maps"]:
        for row in map["items"]:
            if row[0] == BUILDING and len(row) > ATTRS and isinstance(row[ATTRS], dict) and str(row[ATTRS].get("bq")) == str(queue_id):
                return map, row
    return None, None


def push(save, x, y, building_id, unit_id, queue_id, _paid):
    if int(building_id) != BUILDING:
        return "Only Soul Mixer queues are supported by this command."
    if not available():
        return "Soul Mixer: original content data is unavailable."
    map = save["maps"][towns.current(save)]
    building = item_at(map, BUILDING, int(x), int(y))
    unit_id, queue_id = int(unit_id), int(queue_id)
    if not building or queue_id <= 0 or number(unit_id, "breeding_order") <= 0 or number(unit_id, "sm_training_time") <= 0:
        return "Soul Mixer: invalid building, queue or result."
    parents = full(building)[UNITS]
    if len(parents) != 2 or any(number(parent, "breeding_order") <= 0 for parent in parents):
        return "Soul Mixer: two eligible units are required."
    if int(map["level"]) < 20 and any(parent in LEGACY_DRAGONS for parent in parents):
        return "Soul Mixer: these dragons require level 20."
    qid = str(queue_id)
    queues = _queues(save)
    if qid in queues and int(queues[qid].get("amount", 0)) > 0:
        return "Soul Mixer: this queue is already occupied."
    _, existing = _find(save, qid)
    if existing is not None and existing is not building:
        return "Soul Mixer: this queue belongs to another building."
    old = building[ATTRS].get("bq")
    if old is not None and str(old) != qid and int(queues.get(str(old), {}).get("amount", 0)) > 0:
        return "Soul Mixer: mixing is already in progress."
    limit = number(unit_id, "units_limit")
    owned = sum((row[0] == unit_id) + (row[UNITS].count(unit_id) if len(row) > UNITS else 0) for row in map["items"])
    if limit and owned >= limit:
        return "Soul Mixer: the unit limit is reached."
    building[ATTRS]["bq"] = qid
    queues[qid] = {"ts": timestamp_now(), "amount": 1, "unit": unit_id}
    return "Soul Mixer: mixing started."


def _waiting(save, queue_id):
    map, building = _find(save, queue_id)
    queues = save["privateState"].get("barracksQueues")
    queue = queues.get(str(queue_id)) if isinstance(queues, dict) else None
    if building is None or not isinstance(queue, dict) or _wire_integer(queue.get("amount")) != 1:
        return None
    unit_id, started = _wire_integer(queue.get("unit")), _wire_integer(queue.get("ts"))
    if unit_id is None or unit_id <= 0 or started is None:
        return None
    unit = get_item_from_id(unit_id)
    if not unit or unit.get("type") != "u":
        return None
    seconds = number(unit["id"], "sm_training_time")
    if started > 0 and seconds <= 0:
        return None
    remaining = max(0, started + seconds - timestamp_now()) if started > 0 else 0
    return map, building, queue, unit, remaining


def _wire_integer(value):
    # Parse text exactly before any float conversion can round it to ready zero.
    if isinstance(value, str):
        if not 1 <= len(value) <= 16 or not value.isascii() or not value.isdecimal():
            return None
        value = int(value)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if isinstance(value, float) and (not math.isfinite(value) or not value.is_integer()):
        return None
    return int(value) if 0 <= value <= 2 ** 53 - 1 else None


def speed_up(save, queue_id):
    if not available():
        return "Soul Mixer: original content data is unavailable."
    waiting = _waiting(save, queue_id)
    if waiting is None:
        return "Soul Mixer: no readable mix is in progress."
    map, _, queue, _, remaining = waiting
    if not remaining:
        return "Soul Mixer: the unit is already ready."
    cost = math.ceil(remaining / 3600)  # the original's cash an hour, paid in food (speedups.py)
    if not speedups.pay(save, map, cost):
        return "Soul Mixer: not enough food."
    queue["ts"] = 0
    return f"Soul Mixer: mixing finished early for {speedups.in_food(cost)} food."


def entry_warning(save, town_id, building, unit_id, x, y):
    """The ordinary containment command shares the window's complete-data gate."""
    if not available():
        return "Soul Mixer: original content data is unavailable."
    map = save["maps"][int(town_id)]
    if number(unit_id, "breeding_order") <= 0 or item_at(map, unit_id, x, y) is None:
        return "Soul Mixer: that unit is not eligible."
    parents = building[UNITS] if len(building) > UNITS else []
    if len(parents) >= 2:
        return "Soul Mixer: both souls are selected."
    attrs = building[ATTRS] if len(building) > ATTRS and isinstance(building[ATTRS], dict) else {}
    queues = save["privateState"].get("barracksQueues")
    queue = queues.get(str(attrs.get("bq")), {}) if isinstance(queues, dict) else {}
    if queue.get("amount"):
        return "Soul Mixer: mixing is already in progress."
    return None


def locked_at(save, town_id, item_id, x, y):
    if int(item_id) != BUILDING:
        return False
    building = item_at(save["maps"][int(town_id)], BUILDING, x, y)
    if not building or len(building) <= ATTRS or not isinstance(building[ATTRS], dict):
        return False
    queues = save["privateState"].get("barracksQueues")
    queue = queues.get(str(building[ATTRS].get("bq"))) if isinstance(queues, dict) else None
    return isinstance(queue, dict) and _wire_integer(queue.get("amount")) == 1


def pop(save, queue_id, x, y, building_id):
    waiting = _waiting(save, queue_id)
    if int(building_id) != BUILDING or waiting is None:
        return "Soul Mixer: no readable mix is in progress."
    map, building, queue, unit, remaining = waiting
    if remaining:
        return "Soul Mixer: the unit is not ready yet."
    x, y = int(x), int(y)
    if not 0 <= x < 100 or not 0 <= y < 100:
        return "Soul Mixer: the output tile is outside the map."
    map["items"].append([int(unit["id"]), x, y, 0, timestamp_now(), 0])
    queue["amount"] = 0
    queue["ts"] = 0
    # The parents' souls went into it: they're gone.
    if len(building) > UNITS:
        building[UNITS] = []
    return "Soul Mixer: unit collected; its two parents' souls are used up."
