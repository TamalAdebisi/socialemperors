"""
The Time Machine: jumps the player's empire forward in time, so whatever is
waiting finishes sooner. Jumps are bought with cash, kept, and used later.

    privateState["countTimePacket"]  how many of each jump the player keeps, in
                                     the order of the TIME_MACHINE list in the
                                     game config (half an hour up to a day)

Commands from the client:

    "buy_time_packet"  [jump]
    "time_ff"          [jump]

After a jump the client loads the village again and reads afresh the troll
raid timer, the dragon, monster and rider timers and the daily bonus. So the
server moves the jump into the past: every wait below is made to have started
that much earlier. Dates on the calendar (events, Mondays, the darts game's
season) are not waits and stay as they are.
"""

from decimal import Decimal, InvalidOperation

from get_game_config import get_game_config
from village import STARTED, take

# Waits kept for the whole player, and in each town.
PLAYER_WAITS = ("timestampLastBonus", "timeStampTakeCare", "timeStampTakeCareMonster",
                "riderTimeStamp", "timeStampTemple", "timeStampDartsNewFree", "tsAttacksReset")
TOWN_WAITS = ("timestampLastTreasure",)


def _jumps() -> list:
    return get_game_config()["globals"]["TIME_MACHINE"]


def _counts(save: dict) -> list:
    pState = save["privateState"]
    counts = pState.get("countTimePacket")
    if not isinstance(counts, list):
        counts = []
    pState["countTimePacket"] = counts + [0] * (len(_jumps()) - len(counts))
    return pState["countTimePacket"]


def _earlier(when, seconds: int):
    """A moment moved into the past; 'never' (0) stays never."""
    try:
        when = int(when)
    except (TypeError, ValueError):
        return when
    return max(when - seconds, 1) if when > 0 else when


def _queue_start(value):
    """A readable wire timestamp, never a coerced ready marker.

    Like the Soul Mixer reader, only finite safe nonnegative whole numbers
    and numeric text are valid. Parse text exactly so a fractional value
    cannot round into an integer before this check.
    """
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return None
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
    if not number.is_finite() or number != number.to_integral_value() or not 0 <= number <= 2 ** 53 - 1:
        return None
    return int(number)


def buy(save: dict, jump: int) -> str:
    if not 0 <= jump < len(_jumps()):
        return f"There is no time jump {jump}."
    take(save, None, "c", int(_jumps()[jump]["price"]))
    _counts(save)[jump] += 1
    return f"Bought a {_jumps()[jump]['hours']} hour jump."


def jump(save: dict, jump: int) -> str:
    if not 0 <= jump < len(_jumps()):
        return f"There is no time jump {jump}."
    counts = _counts(save)
    if counts[jump] <= 0:
        return f"No {_jumps()[jump]['hours']} hour jumps left."
    counts[jump] -= 1
    seconds = int(float(_jumps()[jump]["hours"]) * 3600)

    pState = save["privateState"]
    for key in PLAYER_WAITS:
        if key in pState:
            pState[key] = _earlier(pState[key], seconds)
    # The original help explicitly includes PvP: the next attack allowance is
    # calculated from the attacks the player sent, not received history.
    for attack in pState.get("attacksSent", []) or []:
        if isinstance(attack, dict) and "time" in attack:
            attack["time"] = _earlier(attack["time"], seconds)
    queues = pState.get("barracksQueues")
    if isinstance(queues, dict):
        for queue in queues.values():
            started = _queue_start(queue.get("ts")) if isinstance(queue, dict) else None
            if started is not None and started > 0:
                # Generic queues keep the work's start here instead of on
                # the building. Never turn malformed data into ready work;
                # an explicit zero is the existing speed-up completion mark.
                queue["ts"] = _earlier(started, seconds)
    if isinstance(pState.get("survivalVidaTimeStamp"), list):  # survival lives come back sooner
        pState["survivalVidaTimeStamp"] = [_earlier(t, seconds) for t in pState["survivalVidaTimeStamp"]]

    for map in save["maps"]:
        for item in map.get("items", []):  # building, training and producing
            if len(item) > STARTED:
                item[STARTED] = _earlier(item[STARTED], seconds)
        for key in TOWN_WAITS:
            if key in map:
                map[key] = _earlier(map[key], seconds)
        if isinstance(map.get("questTimes"), dict):  # islands that can be attacked again
            for quest_id, when in map["questTimes"].items():
                map["questTimes"][quest_id] = _earlier(when, seconds)
    return f"Jumped {_jumps()[jump]['hours']} hours ahead."
