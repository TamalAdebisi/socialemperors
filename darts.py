"""
The darts game: balloons hide prizes, a throw pops one. There is one free
throw at a time, more cost DART_COST_CASH each, and popping every balloon
wins an extra prize. Prizes go to storage through "store_add_items", which
the client sends with each throw.

    privateState["dartsRandomSeed"]        where the prizes hide this round
    privateState["dartsBalloonsShot"]      the balloons popped this round
    privateState["timeStampDartsReset"]    when this round began
    privateState["timeStampDartsNewFree"]  when the last free throw was given
    privateState["dartsHasFree"]
    privateState["dartsGotExtra"]          the all-balloons prize was won

Commands from the client:

    "darts_reset"          [seed]   a new round, with a new free throw
    "darts_new_free"       []       a new free throw
    "darts_shoot_balloon"  [balloon, 1 if paid for, 1 if it won the extra prize]
"""

from engine import timestamp_now
from get_game_config import get_game_config
from village import spend, take


def reset(save: dict, seed) -> str:
    pState = save["privateState"]
    now = timestamp_now()
    pState["dartsRandomSeed"] = int(seed)
    pState["dartsBalloonsShot"] = []
    pState["timeStampDartsReset"] = now
    pState["timeStampDartsNewFree"] = now
    pState["dartsHasFree"] = True
    pState["dartsGotExtra"] = False
    return "A new round of darts."


def new_free(save: dict) -> str:
    pState = save["privateState"]
    pState["timeStampDartsNewFree"] = timestamp_now()
    pState["dartsHasFree"] = True
    return "A free dart."


def shoot(save: dict, balloon, paid, got_extra) -> str:
    pState = save["privateState"]
    if not isinstance(pState.get("dartsBalloonsShot"), list):
        pState["dartsBalloonsShot"] = []
    balloon = int(balloon)
    if balloon in pState["dartsBalloonsShot"]:
        return f"Balloon {balloon} was already popped."
    note = ""
    if int(paid):
        cash = int(get_game_config()["globals"]["DART_COST_CASH"])
        if not spend(save, None, "c", cash):
            return f"Refused: a dart costs {cash} cash."
        note = f" for {cash} cash"
    pState["dartsBalloonsShot"].append(balloon)
    pState["dartsHasFree"] = False
    if int(got_extra):
        pState["dartsGotExtra"] = True
    return f"Balloon {balloon} popped{note}."
