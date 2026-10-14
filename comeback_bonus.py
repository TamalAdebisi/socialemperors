"""
The welcome-back bonus: a new player who comes back on their 2nd and 3rd
day opens a chest, which holds gold, cash or a unit.

The client we serve had it switched off inside the game file;
tools/patch_client.py makes the copy with it switched on that the page
loads (config_env.GAME_CLIENT). The client knows the day only from the page:
the "daysSinceRegistration" flashvar (page_days()), 0 on the day the empire
was made. From level 4, on days 0 to 2 it shows an icon: day 0 only says
"come back tomorrow", days 1 and 2 hold a chest each.

The client draws the prize itself, at random, from MONDAY_BONUS_REWARDS (the
Monday chest's list: this client never reads COMEBACK_BONUS_REWARDS), adds
gold or cash on screen and puts a unit in storage with no command of its own
(COMEBACK_BONUS_UNITS: the first on day 1, the second on day 2). So the
server pays here, the config's amounts, which economy.py sets.

    maps[0]["timestamp"]                     when the empire was made (sessions.new_village)
    privateState["comebackBonusCollected"]   the days collected, 1 and/or 2; the
                                             client reads it, and breaks if it is
                                             missing (version.add_missing_fields)

Command from the client:

    "comeback_reward"  ["g" | "c" | "u", amount or the unit won, day 1 or 2]
"""

from engine import timestamp_now
from get_game_config import get_game_config
import inventory
from village import give

DAY = 24 * 3600
DAYS = (1, 2)  # the 2nd and 3rd day, counting the first as day 0


def days_since_registration(save: dict, now: int = None) -> int:
    """Calendar days (UTC, like the daily bonus) since the empire was made;
    an empire with no date is an old one."""
    made = int(save["maps"][0].get("timestamp") or 0)
    if made <= 0:
        return 1000
    now = timestamp_now() if now is None else now
    return max(now // DAY - made // DAY, 0)


def page_days(save: dict) -> int:
    """The flashvar. Never 3: the client shows the icon at the level up to
    level 4 up to day 3, where everything else stops at day 2, so a player
    reaching level 4 on day 3 would get chests with nothing behind them."""
    days = days_since_registration(save)
    return days if days <= max(DAYS) else max(days, max(DAYS) + 2)


def collected(save: dict) -> list:
    pState = save["privateState"]
    if not isinstance(pState.get("comebackBonusCollected"), list):
        pState["comebackBonusCollected"] = []
    return pState["comebackBonusCollected"]


def collect(save: dict, kind: str, value, day, town_id: int = 0) -> str:
    day = int(day)
    today = days_since_registration(save)
    if day not in DAYS:
        return f"Day {day} has no welcome-back chest."
    if not today - 1 <= day <= today:  # a page left open past midnight is a day behind
        return f"The day {day} chest is not on offer (this is day {today})."
    if day in collected(save):
        return f"The day {day} chest was already opened."
    config = get_game_config()["globals"]
    if kind == "u":
        unit = int(config["COMEBACK_BONUS_UNITS"][day - 1])
        if int(value) != unit:
            return f"Unit {value} is not the day {day} unit ({unit})."
        inventory.add_stored(save, town_id, unit)
        won = f"unit {unit}"
    else:
        amounts = {r["type"]: int(r["value"]) for r in config["MONDAY_BONUS_REWARDS"] if r["type"] != "u"}
        if kind not in amounts:
            return f"There is no welcome-back prize '{kind}'."
        give(save, save["maps"][town_id], kind, amounts[kind])  # the config's amount, not the client's
        won = f"{amounts[kind]} {kind}"
    collected(save).append(day)
    return f"Welcome-back chest, day {day}: {won}."
