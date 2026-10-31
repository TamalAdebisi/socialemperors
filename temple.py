"""
The Supreme Dragon Temple (building 1394).

The player makes 12 offerings at the temple, one at a time, with a 48 hour
wait after each (or 2,500 food to skip it: speedups.py). Once all 12 are made, the temple
summons the Supreme Bahamut Dragon (unit 2003).

The game client runs the temple screen and keeps the progress in
privateState. The server stores it, so it survives a reload:

    privateState["templeStep"]       offerings made so far (indexes into STEPS)
    privateState["timeStampTemple"]  when the last one was made; 0 means no wait

The client also sends separate commands for the rest of the ritual, which
command.py already handles:

    "sell"              removes a sacrificed dragon from the map
    "sell_stored_item"  removes the Bahamut Heart when the dragon is summoned
    "buy"               places the Supreme Bahamut Dragon, free of charge

Like the rest of the server, this trusts the client on whether the player
could afford an offering, because the server does not follow every resource
change yet (mana, for example). The amounts come from our own table, not
from what the client sends.
"""

from engine import timestamp_now
from village import spend, take
import speedups

TEMPLE_ID = 1394
SUPREME_BAHAMUT = 2003
WAIT = 48 * 3600  # after each offering, the twelfth too
CLOCK_SLACK = 300  # the client's clock is the server's, give or take a few minutes
SKIP_WAIT_CASH = 5  # the original's price; paid in food (speedups.py)

RESOURCES, SACRIFICE, COLLECTION = "resources", "sacrifice", "collection"

# The offerings in the order the temple shows them.
STEPS = [
    (RESOURCES, {"g": 100000}),
    (RESOURCES, {"s": 100000}),
    (RESOURCES, {"w": 100000}),
    (RESOURCES, {"f": 100000}),
    (RESOURCES, {"m": 50}),
    (RESOURCES, {"c": 50}),
    (SACRIFICE, 649),   # Furious Dragon      (dragon nest)
    (SACRIFICE, 684),   # Stormy Dragon       (dragon nest)
    (SACRIFICE, 695),   # Sayan Dragon        (dragon nest)
    (SACRIFICE, 853),   # Red Bahamut Dragon    (collection 22)
    (SACRIFICE, 875),   # Golden Bahamut Dragon (collection 21)
    (COLLECTION, 23),   # Bahamut Heart
]


def _progress(save: dict) -> list:
    pState = save["privateState"]
    if not isinstance(pState.get("templeStep"), list):
        pState["templeStep"] = []
    return pState["templeStep"]


def _temple_map(save: dict) -> dict:
    """The map with the temple on it; resources are paid from there."""
    for map in save["maps"]:
        if any(item[0] == TEMPLE_ID for item in map["items"]):
            return map
    return save["maps"][save["playerInfo"]["default_map"]]


def next_step(save: dict, step: int) -> str:
    """Record one offering. Returns what happened, for the server log."""
    done = _progress(save)
    if not 0 <= step < len(STEPS):
        return f"Temple: there is no step {step}."
    if step in done:
        return f"Temple: step {step} was already done."
    kind, data = STEPS[step]
    if kind == RESOURCES:
        map = _temple_map(save)
        for resource, amount in data.items():
            if resource == "c":  # cash, the server's own count: paid in full or not at all
                if not spend(save, map, "c", amount):
                    return f"Temple: refused, step {step} takes {amount} cash."
            else:
                take(save, map, resource, amount)
    done.append(step)
    save["privateState"]["timeStampTemple"] = timestamp_now()
    return f"Temple: step {step} done ({len(done)}/{len(STEPS)})."


def skip_wait(save: dict) -> str:
    if not speedups.pay(save, _temple_map(save), SKIP_WAIT_CASH):
        return "Temple: not enough food to skip the wait."
    save["privateState"]["timeStampTemple"] = 0
    return f"Temple: wait skipped for {speedups.in_food(SKIP_WAIT_CASH)} food."


def claim(save: dict, now: int) -> bool:
    """The Supreme Bahamut summoned (the client's free "buy" of it): only
    once all twelve offerings are made and the last wait is over. The ritual
    starts over then, so it gives one; the client's reset_temple follows."""
    since = int(save["privateState"].get("timeStampTemple") or 0)
    if len(set(_progress(save))) < len(STEPS) or (since and now < since + WAIT - CLOCK_SLACK):
        return False
    reset(save)
    return True


def reset(save: dict) -> str:
    save["privateState"]["templeStep"] = []
    save["privateState"]["timeStampTemple"] = 0
    return "Temple: progress reset."
