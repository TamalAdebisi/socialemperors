"""
What a speed-up costs: food, not cash (the owner's rule, 29 October 2026).

Each speed-up keeps the original's price in cash (a nest's 3 or 15, a
dragon rider's 15, a cash an hour for the Soul Mixer and the Chained, 2 to
finish a building's work, 5 for the temple's wait) and is paid in food at
the game's own exchange: the bank gives 2,500 gold for 5 cash (the globals'
EXCHANGE_GOLD and EXCHANGE_CASH), and the market sells food at a gold each
(MARKET_BASE_COSTS: 100 for 100). The client charges the same
(client/src/rules/speedUps.ts). The graveyard's prices are graveyard.py's.

The commands keep their names and arguments (buy_step_cash and the rest),
so the Flash client still sends them; it shows cash prices, but this
server takes food.
"""

from village import take

FOOD_PER_CASH = 500
# The original's prices in cash: a nest's wait, by the one being raised (even, odd), as the Flash client has them;
NEST_STEP_CASH = {"dragon": (3, 15), "monster": (7, 7)}
# a dragon rider's recovery, when the config doesn't say (its DRAGON_RIDERS' stepCost);
RIDER_STEP_CASH = 15
# finishing a building's work at once (the Flash client's hurry up).
HURRY_CASH = 2


def in_food(cash) -> int:
    """A speed-up's original price in cash, in food."""
    return int(cash) * FOOD_PER_CASH


def pay(save: dict, map: dict, cash) -> bool:
    """Takes a speed-up's price in food from a town; False, taking nothing, when it hasn't that much."""
    food = in_food(cash)
    if int(map.get("food", 0)) < food:
        return False
    take(save, map, "f", food)
    return True
