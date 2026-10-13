"""
Collections: 23 sets of 5 pieces each.

Pieces drop in battles, harvests and treasure chests. The game client decides
when a piece drops and tells the server. A finished set can be exchanged for
its reward, or the reward can be bought with cash (cheaper for every piece
already found). Rewards go to the inventory (privateState["gifts"]), from
where the player places them.

The client loads the progress from privateState:

    privateState["collections"]           one row per collection, row 0 unused
                                          and kept empty:
                                          [finished once (0/1), pieces of 1, ..., pieces of 5]
    privateState["collectionsCompleted"]  collections finished at least once

Commands the client sends:

    add_collectable    [collection, piece]       a piece was picked up
    finish_collection  [collection]              exchange the 5 pieces
    finish_collection  [collection, 1, price]    buy the reward with cash

The server checks that the pieces or the cash are really there and takes
prices from its own table, not from the client.
"""

import inventory

PIECES = 5

# Reward for each collection, from 1 to 23.
REWARDS = {
    1: 176,     # Pyramid
    2: 177,     # Treasure Chest
    3: 178,     # Garden
    4: 179,     # Golden Fountain
    5: 180,     # Frozen Mammoth
    6: 551,     # Axethrower
    7: 546,     # Penguin
    8: 544,     # Yeti
    9: 552,     # War Troll
    10: 553,    # Wizard
    11: 206,    # Crocodile Pit
    12: 207,    # Life Tree
    13: 208,    # Guillotine
    14: 209,    # Prison
    15: 124,    # Soldier Statue
    16: 561,    # Fly
    17: 562,    # Mishy
    18: 563,    # Skeleton
    19: 564,    # Ravager Troll
    20: 565,    # High Elf
    21: 875,    # Golden Bahamut Dragon  (pieces from hardcore and god islands)
    22: 853,    # Red Bahamut Dragon     (pieces from hardcore and god islands)
    23: 1410,   # Bahamut Heart          (pieces from hardcore and god islands)
}

# Cash price of each reward, before the discount for pieces already found.
CASH_PRICE = {c: 5 for c in REWARDS} | {10: 15, 20: 20, 21: 400, 22: 400}
NO_DISCOUNT = {10, 20}
ONCE_ONLY = {21, 22}    # the two Bahamut dragons can be earned one time
NOT_FOR_SALE = {23}     # the Bahamut Heart can only be exchanged


def _rows(save: dict) -> list:
    pState = save["privateState"]
    rows = pState.get("collections")
    if not isinstance(rows, list):
        rows = pState["collections"] = []
    while len(rows) <= len(REWARDS):
        rows.append([0] * (PIECES + 1))
    rows[0] = []  # the client stops reading the list if row 0 has anything in it
    if not isinstance(pState.get("collectionsCompleted"), list):
        pState["collectionsCompleted"] = []
    return rows


def _finish(save: dict, rows: list, collection: int) -> None:
    """Hand out the reward and use up one of each piece."""
    inventory.add_gift(save, REWARDS[collection])
    row = rows[collection]
    row[0] = 1
    for piece in range(1, PIECES + 1):
        row[piece] = max(row[piece] - 1, 0)
    completed = save["privateState"]["collectionsCompleted"]
    if collection not in completed:
        completed.append(collection)


def price(save: dict, collection: int) -> int:
    row = _rows(save)[collection]
    full = CASH_PRICE[collection]
    if collection in NO_DISCOUNT:
        return full
    found = sum(1 for piece in range(1, PIECES + 1) if row[piece] > 0)
    return max(full - found, 1)


def add_piece(save: dict, collection: int, piece: int) -> str:
    if collection not in REWARDS or not 1 <= piece <= PIECES:
        return f"Collections: there is no piece {piece} in collection {collection}."
    rows = _rows(save)
    rows[collection][piece] += 1
    return f"Collections: piece {piece} of collection {collection} found."


def exchange(save: dict, collection: int) -> str:
    if collection not in REWARDS:
        return f"Collections: there is no collection {collection}."
    rows = _rows(save)
    if any(rows[collection][piece] <= 0 for piece in range(1, PIECES + 1)):
        return f"Collections: collection {collection} is missing pieces."
    if collection in ONCE_ONLY and collection in save["privateState"]["collectionsCompleted"]:
        return f"Collections: collection {collection} can only be finished once."
    _finish(save, rows, collection)
    return f"Collections: collection {collection} exchanged for item {REWARDS[collection]}."


def buy(save: dict, collection: int) -> str:
    if collection not in REWARDS or collection in NOT_FOR_SALE:
        return f"Collections: collection {collection} is not for sale."
    rows = _rows(save)
    if rows[collection][0]:
        return f"Collections: collection {collection} was already finished."
    cost = price(save, collection)
    player = save["playerInfo"]
    if player["cash"] < cost:
        return f"Collections: not enough cash for collection {collection} ({cost} needed)."
    player["cash"] -= cost
    _finish(save, rows, collection)
    return f"Collections: collection {collection} bought for {cost} cash."
