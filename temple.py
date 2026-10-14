"""
The Supreme Dragon Temple (building 1394).

The player makes 12 offerings at the temple, one at a time, with a 48 hour
wait after each (or 5 cash to skip it). Once all 12 are made, the temple
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
from village import take

TEMPLE_ID = 1394
SKIP_WAIT_CASH = 5

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
            take(save, map, resource, amount)
    done.append(step)
    save["privateState"]["timeStampTemple"] = timestamp_now()
    return f"Temple: step {step} done ({len(done)}/{len(STEPS)})."


def skip_wait(save: dict) -> str:
    take(save, None, "c", SKIP_WAIT_CASH)
    save["privateState"]["timeStampTemple"] = 0
    return "Temple: wait skipped with cash."


def reset(save: dict) -> str:
    save["privateState"]["templeStep"] = []
    save["privateState"]["timeStampTemple"] = 0
    return "Temple: progress reset."
