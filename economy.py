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
100 from levels; 7 every 5 days from the daily bonus; 5 to 25 a continent;
5 an island won on 3 stars (165 over the 33 islands); up to 5 a day from the
bank. Prices for comparison: heroes 3 to 9 cash, dragons 10, packs 20 to
200, spells 30 to 80, the Supreme Bahamut Dragon 200, the Diamond Castle
450.
"""

# Levels: the cash for reaching a level (levels below FIRST_CASH_LEVEL keep the game's prize)
FIRST_CASH_LEVEL = 5
CASH_PER_LEVEL = 2
CASH_EVERY_5TH_LEVEL = 5
CASH_EVERY_10TH_LEVEL = 10

# Daily bonus: the cash on these days of the 5 day streak (the game gave 1 and 3)
DAILY_BONUS_CASH = {3: 2, 5: 5}

# Monday bonus: the cash chest (the game gave 5)
MONDAY_BONUS_CASH = 10

# World map: continents 2 to 11 pay this much cash, 12 to 21 twice as much,
# and so on up to continent 50 (the game gave 1 for every continent)
CONTINENT_CASH = 5

# The bank (bank.py): resources for cash
BANK_RESOURCES = ("g", "w", "f", "s")  # gold, wood, food, stone
BANK_RESOURCE_PER_CASH = 2000
BANK_CASH_PER_DAY = 5

# Quest islands: the cash for the first win of an island on 3 stars (quests.py)
ISLAND_THREE_STAR_CASH = 5

# Tournaments: a cash tournament's prize, in entry fees (the game gave 2)
TOURNAMENT_CASH_PRIZE_IN_FEES = 1

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

    for kind in config["tournament_type"].values():
        if kind["resource_type"] == "c":
            for prize in kind["prize"]:
                prize["c"] = int(kind["cost"]) * TOURNAMENT_CASH_PRIZE_IN_FEES

    for text in config["localization_strings"]:
        if isinstance(text, dict) and text.get("id") in TEXTS:
            text["text"] = TEXTS[text["id"]]
