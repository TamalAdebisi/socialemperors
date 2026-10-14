"""
The daily bonus: once a day the player collects the next of five prizes
(DAILY_BONUS_CONFIG in the game config: 250 gold, a hero, 1 cash, a hero,
3 cash), then the five start again. Missing a day starts them again too.

The client decides the day the way the server does here: a new day (UTC; the
page gives the client no time zone) since the last one collected, and the day
after the last one collected unless a day was missed. It draws the hero
itself, from DAILY_BONUS_CONFIG_HEROES, and puts it in storage on screen.

    privateState["bonusNextId"]         the day collected last, plus one (0: never)
    privateState["timestampLastBonus"]  when; the time machine moves it back

Command from the client:

    "win_bonus"  [gold, town, hero, day 1 to 5, cash]   the prize is the
                 config's for that day, not the client's numbers
"""

from engine import timestamp_now
from get_game_config import get_game_config
import inventory
from village import give

DAYS = 5
DAY = 24 * 3600
HERO = "hero"


def _day_number(timestamp: int) -> int:
    return int(timestamp) // DAY


def _next_day(pState: dict) -> int:
    """The day of the five that comes next, 1 to 5, if no day was missed."""
    after = int(pState.get("bonusNextId") or 0) - 1
    return after % DAYS + 1 if after > 0 else 1


def collect(save: dict, town_id, hero, day) -> str:
    pState = save["privateState"]
    now = timestamp_now()
    if _day_number(now) <= _day_number(pState.get("timestampLastBonus") or 0):
        return "The daily bonus was already collected today."
    day = int(day)
    # Day 1 is always allowed: the client starts again when a day was missed,
    # and a page opened before midnight may not have noticed one just missed.
    if day not in (_next_day(pState), 1):
        return f"Day {day} of the daily bonus is not next (day {_next_day(pState)} is)."
    config = get_game_config()["globals"]
    prize = config["DAILY_BONUS_CONFIG"][day - 1]
    town_id = int(town_id) if 0 <= int(town_id) < len(save["maps"]) else 0
    if prize["type"] == HERO:
        if int(hero) not in [int(h) for h in config["DAILY_BONUS_CONFIG_HEROES"]]:
            return f"Unit {hero} is not a daily bonus hero."
        inventory.add_stored(save, town_id, int(hero))
        won = f"hero {hero}"
    else:
        give(save, save["maps"][town_id], prize["type"], int(prize["qty"]))
        won = f"{prize['qty']} {prize['type']}"
    pState["bonusNextId"] = day + 1
    pState["timestampLastBonus"] = now
    return f"Daily bonus day {day}: {won}."
