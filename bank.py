"""
The bank: resources for cash, and cash for gold.

The game's own bank window trades 5 cash for 2,500 gold (EXCHANGE_CASH and
EXCHANGE_GOLD in the game config). Its ADD CASH NOW! button, like every
"get more cash" button in the game, used to open Facebook's payment page;
here they open our exchange instead (templates/_bank.html), which trades
2,000 of one resource for 1 cash, a few cash a day (economy.py).

The exchange is a page window over the game, not part of it, so the game
doesn't see the trade by itself: the page asks it to load the town again
afterwards. Before trading, it does the same, so that the server has every
change the game was still holding back (it sends them every few seconds)
and the balances shown are the real ones.

    privateState["bank"]   {"day": the UTC day of the last trade (days
                            since 1970), "cash": cash bought that day}
"""

import time

from engine import timestamp_now
import economy
from get_game_config import get_game_config
import towns
from village import ON_MAP, give, take

DAY = 24 * 3600
NAMES = {"g": "gold", "w": "wood", "f": "food", "s": "stone"}

loaded_at = {}  # USERID -> when the game last loaded the player's own town (time.time())


class BankError(Exception):
    """A trade that can't be done; the message says why, for the player."""


def town_loaded(USERID: str) -> None:
    loaded_at[str(USERID)] = time.time()


def _bought_today(save: dict) -> int:
    record = save["privateState"].get("bank")
    if not isinstance(record, dict) or record.get("day") != timestamp_now() // DAY:
        return 0
    return int(record.get("cash") or 0)


def state(save: dict) -> dict:
    """What the exchange window shows."""
    map = save["maps"][towns.current(save)]
    globals = get_game_config()["globals"]
    return {
        "cash": int(save["playerInfo"].get("cash") or 0),
        "resources": {r: int(map.get(ON_MAP[r]) or 0) for r in economy.BANK_RESOURCES},
        "per_cash": economy.BANK_RESOURCE_PER_CASH,
        "per_day": economy.BANK_CASH_PER_DAY,
        "left_today": max(economy.BANK_CASH_PER_DAY - _bought_today(save), 0),
        "next_day_in": DAY - timestamp_now() % DAY,
        "gold_for_cash": [int(globals["EXCHANGE_CASH"]), int(globals["EXCHANGE_GOLD"])],
    }


def buy_cash(save: dict, resource: str, cash) -> str:
    """Trade resources of the town that is open for cash."""
    if resource not in economy.BANK_RESOURCES:
        raise BankError("The bank doesn't take that.")
    try:
        cash = int(cash)
    except (TypeError, ValueError):
        raise BankError("How much cash?")
    bought = _bought_today(save)
    left = economy.BANK_CASH_PER_DAY - bought
    if cash < 1:
        raise BankError("How much cash?")
    if cash > left:
        raise BankError(f"The bank trades {economy.BANK_CASH_PER_DAY} cash a day; "
                        + (f"{left} left today." if left > 0 else "come back tomorrow."))
    map = save["maps"][towns.current(save)]
    price = cash * economy.BANK_RESOURCE_PER_CASH
    if int(map.get(ON_MAP[resource]) or 0) < price:
        raise BankError(f"Not enough {NAMES[resource]}: {price:,} needed.")
    take(save, map, resource, price)
    give(save, map, "c", cash)
    save["privateState"]["bank"] = {"day": timestamp_now() // DAY, "cash": bought + cash}
    return f"Bank: {price} {NAMES[resource]} for {cash} cash."


def buy_gold(save: dict, town_id) -> str:
    """The game's own trade, from its bank window: cash for gold."""
    cash, gold = (int(get_game_config()["globals"][key]) for key in ("EXCHANGE_CASH", "EXCHANGE_GOLD"))
    town_id = int(town_id)
    if not 0 <= town_id < len(save["maps"]):
        return f"There is no town {town_id}."
    if int(save["playerInfo"].get("cash") or 0) < cash:
        return f"Not enough cash for gold: {cash} needed."
    map = save["maps"][town_id]
    take(save, map, "c", cash)
    give(save, map, "g", gold)
    return f"Bank: {cash} cash for {gold} gold."
