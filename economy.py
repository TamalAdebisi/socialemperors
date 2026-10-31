"""
Where cash comes from.

Cash was bought with real money on Facebook. This server is free and has
nothing to sell, so cash is earned by playing, and stays worth saving for:
small amounts often (every level, every day), bigger ones for milestones
(every 5th and 10th level, each continent conquered, a 5 day login streak).
Every number is here, to tweak in one place.

Most sources are the game's own: the client draws their windows from the
game config and shows what it says, so patch_config() rewrites those
numbers and the server pays from the same config. What the player sees is
what they get.

    Levels         the level up window's prize (the "levels" table): 2 cash
                   from level 5, 5 every 5th level, 10 every 10th. Paid by
                   levels.py, once a level per town. Levels 2 to 4 keep the
                   game's wood and food.
    Daily bonus    a streak of 5 days (daily_bonus.py): day 3 and day 5 pay
                   cash; a missed day starts the streak over.
    Monday bonus   the cash chest, one of three (monday_bonus.py).
    Welcome back   a chest on a new empire's 2nd and 3rd day
                   (comeback_bonus.py). The game client draws it from the
                   Monday chest's list, so it holds the same: 2,500 gold,
                   a unit, or MONDAY_BONUS_CASH.
    Continents     the world map's prize for reaching a continent
                   (worlds.py): more cash the further the continent.
    The bank       2,000 of one resource (gold, wood, food or stone) for 1
                   cash, a few cash a day (bank.py). The game's own trade
                   the other way, 5 cash for 2,500 gold, stays.
    Tournaments    a cash tournament's prize is the entry fee back with
                   its unit (tournaments.py), not twice the fee as in the
                   game: computer players fill the empty seats, so a good
                   player could win over and over, and print cash.
    Islands        the first win of a quest island on 3 stars, the
                   hardest difficulty (quests.py). The game has no window
                   for it, so the island window's "Choose difficulty"
                   says so, and the cash shows when the player is home.
    Cash Wonder    already in the game: 50 cash, then 1 cash a day.

What it adds up to, roughly: about 150 cash by level 50 and 300 by level
100 from levels; 13 every 5 days from the daily bonus; 5 to 25 a continent;
5 an island won on 3 stars (165 over the 33 islands); up to 10 a day from
the bank. Someone who plays every day earns about 10 cash a day.

What cash buys. The game's cash prices were set for real money, so the big
ones were out of reach without paying: a units-book dragon cost up to 260
cash, the Diamond Castle 450. cash_price() keeps every price up to 10 as it
was and shrinks the bigger ones (30 becomes 19, 120 becomes 44, 260
becomes 71, 450 becomes 98), so the best things cost about a week of
playing, not months. It applies to the units book, everything the shop
sells for cash, the two Bahamut collections bought outright, and the offer
packs, mystery boxes and darts. Speeding up a wait (about 1 cash an hour)
keeps the game's price: waiting stays free.
"""

# Levels: the cash for reaching a level (levels below FIRST_CASH_LEVEL keep the game's prize)
FIRST_CASH_LEVEL = 5
CASH_PER_LEVEL = 2
CASH_EVERY_5TH_LEVEL = 5
CASH_EVERY_10TH_LEVEL = 10

# Daily bonus: the cash on these days of the 5 day streak (the game gave 1 and 3)
DAILY_BONUS_CASH = {3: 3, 5: 10}

# Monday bonus: the cash chest (the game gave 5)
MONDAY_BONUS_CASH = 15

# World map: continents 2 to 11 pay this much cash, 12 to 21 twice as much,
# and so on up to continent 50 (the game gave 1 for every continent)
CONTINENT_CASH = 5

# The bank (bank.py): resources for cash
BANK_RESOURCES = ("g", "w", "f", "s")  # gold, wood, food, stone
BANK_RESOURCE_PER_CASH = 2000
BANK_CASH_PER_DAY = 10

# Quest islands: the cash for the first win of an island on 3 stars (quests.py)
ISLAND_THREE_STAR_CASH = 5

# Tournaments: a cash tournament's prize, in entry fees (the game gave 2)
TOURNAMENT_CASH_PRIZE_IN_FEES = 1

# The super mystery box: one, two or four prizes, at these game prices (its own for pack 19),
# shrunk like every cash price and kept in globals.SUPER_PACK_PRICES for both the server and the client
SUPER_PACK_PRICES = [60, 100, 200]
SUPER_PACK_PRICES_BY_PACK = {19: [30, 60, 100]}

# Cash prices: kept up to CASH_PRICE_KEPT, above it shrunk along a curve (cash_price)
CASH_PRICE_KEPT = 10
CASH_PRICE_CURVE = 0.6

# The units book (the owner's rules, 31 October 2026): no unit for less than
# this, and none of these, which come from elsewhere (the Supreme Bahamut:
# the temple, the Soul Mixer).
UNIT_BOOK_LEAST_CASH = 51
UNIT_BOOK_LEFT_OUT = {2003}

# Texts the game shows, by their id in the config's localization_strings
TEXTS = {
    498: f"Choose difficulty (first 3 stars: {ISLAND_THREE_STAR_CASH} cash)",  # POPUP_QUEST_ELIGE_DIFICULTAD, over the island's stars once one is won
    1430: "Updating your empire",  # RELOADING_PLAYER_INFO_TEXT, shown while the bank reloads the town (was "Reloading Gifts")
}


def level_cash(level: int) -> int:
    """The cash for reaching this level, 0 below FIRST_CASH_LEVEL."""
    if level < FIRST_CASH_LEVEL:
        return 0
    if level % 10 == 0:
        return CASH_EVERY_10TH_LEVEL
    if level % 5 == 0:
        return CASH_EVERY_5TH_LEVEL
    return CASH_PER_LEVEL


def cash_price(original) -> int:
    """What the game's cash price costs here: the same up to CASH_PRICE_KEPT,
    then shrunk, so a price ten times higher costs about four times more."""
    price = int(original)
    if price <= CASH_PRICE_KEPT:
        return price
    return round(CASH_PRICE_KEPT * (price / CASH_PRICE_KEPT) ** CASH_PRICE_CURVE)


def unit_book_price(original) -> int:
    """What a unit costs in the units book: the game's price shrunk (cash_price), at least UNIT_BOOK_LEAST_CASH."""
    return max(UNIT_BOOK_LEAST_CASH, cash_price(original))


def continent_cash(nivel: int) -> int:
    """The cash for reaching continent `nivel`; 0 for continent 1, where every town starts."""
    return CONTINENT_CASH * (1 + (int(nivel) - 2) // 10)


def patch_config(config: dict) -> None:
    """Put this module's numbers into the game config, which the client
    shows and the server pays from."""
    levels = config["levels"]
    for index, row in enumerate(levels):
        level = index + 1  # the client shows levels[n - 1] on reaching level n
        if level >= FIRST_CASH_LEVEL:
            row["reward_type"], row["reward_amount"] = "c", level_cash(level)

    globals = config["globals"]
    for day, cash in DAILY_BONUS_CASH.items():
        prize = globals["DAILY_BONUS_CONFIG"][day - 1]
        assert prize["type"] == "c", f"day {day} of the daily bonus is not cash"
        prize["qty"] = cash
    for chest in globals["MONDAY_BONUS_REWARDS"]:
        if chest["type"] == "c":
            chest["value"] = MONDAY_BONUS_CASH

    # The client shows continent n's prize from row 50 - n, so the rows go
    # from continent 50 down to 1. The game's own table had 24 out of place,
    # which showed the wrong units for continents 19 to 24.
    rows = sorted(config["level_ranking_reward"], key=lambda row: -int(row["level"]))
    for row in rows:
        row["cash"] = continent_cash(row["level"])
    config["level_ranking_reward"] = rows

    # Cash prices: the units book's and everything priced in cash
    for category in config["units_collections_categories"].values():
        costs = category.get("costs") or []
        kept = [i for i, unit in enumerate(category["units"]) if int(unit) not in UNIT_BOOK_LEFT_OUT]
        if len(kept) < len(category["units"]):
            category["units"] = [category["units"][i] for i in kept]
            if costs:
                category["costs"] = [costs[i] if i < len(costs) else None for i in kept]
        category["cost"] = unit_book_price(category["cost"])
        if category.get("costs"):
            category["costs"] = [unit_book_price(cost) if cost is not None else None for cost in category["costs"]]
    for item in config["items"]:
        if item.get("cost_type") == "c":
            item["cost"] = str(cash_price(item["cost"]))
    for pack in config["offer_packs"]:
        pack["cost_cash"] = cash_price(pack["cost_cash"])
    globals["SUPER_PACK_PRICES"] = {"default": [cash_price(p) for p in SUPER_PACK_PRICES]} | {
        str(pack): [cash_price(p) for p in prices] for pack, prices in SUPER_PACK_PRICES_BY_PACK.items()}
    globals["DART_COST_CASH"] = cash_price(globals["DART_COST_CASH"])

    for kind in config["tournament_type"].values():
        if kind["resource_type"] == "c":
            for prize in kind["prize"]:
                prize["c"] = int(kind["cost"]) * TOURNAMENT_CASH_PRIZE_IN_FEES

    for text in config["localization_strings"]:
        if isinstance(text, dict) and text.get("id") in TEXTS:
            text["text"] = TEXTS[text["id"]]
