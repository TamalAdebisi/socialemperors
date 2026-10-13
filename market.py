"""
The Market: trading wood, stone and food for gold.

Every purchase of a resource makes the next one dearer (2% of the base price
each, for up to 200 purchases) and every sale makes it cheaper again (down
to 25 below the start). Sales pay three quarters of the price. A player may
trade 20 times; the count starts over 20 hours after the last trade.

    map["resourcesTraded"]     {resource: purchases minus sales}
    map["numTradesDone"]
    map["timestampLastTrade"]

Command from the client:

    "trade_resource_b"  [town, "w" | "s" | "f", 1 sell | 0 buy, amount]
"""

from engine import timestamp_now
from village import flash_round, give, take

BASE_PRICES = {"f": 100, "s": 150, "w": 100}  # gold for 100
AMOUNTS = (100, 200, 300)
INCREMENT = 0.02
MOST_PURCHASES, MOST_SALES = 200, 25
SALE_SHARE = 0.75
MOST_TRADES = 20
TRADE_PERIOD = 20 * 3600


def _traded(map: dict) -> dict:
    if not isinstance(map.get("resourcesTraded"), dict):
        map["resourcesTraded"] = {}
    return map["resourcesTraded"]


def price(map: dict, resource: str, amount: int, sell: bool) -> int:
    """The same sum the client shows on the button."""
    base = BASE_PRICES[resource] * (amount / 100)
    cost = flash_round(base + base * int(_traded(map).get(resource, 0)) * INCREMENT)
    if sell:
        cost = flash_round(cost * SALE_SHARE)
    return cost


def trade(save: dict, town_id: int, resource: str, sell, amount) -> str:
    sell, amount = bool(int(sell)), int(amount)
    if resource not in BASE_PRICES or amount not in AMOUNTS:
        return f"The market does not trade {amount} {resource}."
    map = save["maps"][town_id]
    now = timestamp_now()
    if now - int(map.get("timestampLastTrade") or 0) > TRADE_PERIOD:
        map["numTradesDone"] = 0
    if int(map.get("numTradesDone") or 0) >= MOST_TRADES:
        return "No trades left today."
    cost = price(map, resource, amount, sell)
    if sell:
        take(save, map, resource, amount)
        give(save, map, "g", cost)
    else:
        take(save, map, "g", cost)
        give(save, map, resource, amount)
    traded = _traded(map)
    count = int(traded.get(resource, 0)) + (-1 if sell else 1)
    traded[resource] = min(max(count, -MOST_SALES), MOST_PURCHASES)
    map["numTradesDone"] = int(map.get("numTradesDone") or 0) + 1
    map["timestampLastTrade"] = now
    return f"{'Sold' if sell else 'Bought'} {amount} {resource} for {cost} gold."
