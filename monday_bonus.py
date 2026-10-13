"""
The Monday bonus: on Mondays the player picks one of three chests, which
holds gold, cash or a unit (MONDAY_BONUS_REWARDS and MONDAY_BONUS_UNITS in
the game config). The client draws the prize and shows it; a unit goes to
storage on screen with no command of its own, so the server stores it here.

    privateState["timeStampMondayBonus"]  when it was last collected; the
                                          client offers it again on another day

Command from the client:

    "weekly_reward"  ["g" | "c" | "u", amount, or the unit won]
"""

from engine import timestamp_now
from get_game_config import get_game_config
import inventory
from village import give

ONCE_PER = 24 * 3600


def collect(save: dict, kind: str, value) -> str:
    pState = save["privateState"]
    now = timestamp_now()
    if now - int(pState.get("timeStampMondayBonus") or 0) < ONCE_PER:
        return "The Monday bonus was already collected."
    config = get_game_config()["globals"]
    if kind == "u":
        if int(value) not in [int(u) for u in config["MONDAY_BONUS_UNITS"]]:
            return f"Unit {value} is not a Monday prize."
        inventory.add_stored(save, 0, int(value))
        won = f"unit {value}"
    else:
        amounts = {r["type"]: int(r["value"]) for r in config["MONDAY_BONUS_REWARDS"]}
        if kind not in amounts:
            return f"There is no Monday prize '{kind}'."
        give(save, save["maps"][0], kind, amounts[kind])  # the config's amount, not the client's
        won = f"{amounts[kind]} {kind}"
    pState["timeStampMondayBonus"] = now
    return f"Monday bonus: {won}."
