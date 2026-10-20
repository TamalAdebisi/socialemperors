"""The Chained buildings that show a unit, and what freeing them costs.

In the original, a Chained building (a god, colossus or dragon in chains)
was an advert: clicking it opened a pack sold for real money. The owner's
call (DECISIONS.md, 20 October 2026): the shop sells each one that shows a
unit for gold, in New, Limited Edition, its own tab. Once built, its chains
take a while to break (chained.py); then Free puts its unit beside it, or
both units for a god and colossus pair, and the building goes.

    gold    by the units' strength: 5 gold for each point of health
            times attack, rounded up to 10,000. The owner found the first
            prices (by the units book's price) far too low for the
            strongest units (DECISIONS.md, 20 October 2026): a Draggy
            costs 30,000, a 3-Head Dragon 1.25 million, a Genesis god about
            3 million, a god and colossus pair 3.6 to 4.2 million (the owner
            halved the first rate of 10, DECISIONS.md).
    once    each Chained building can be bought once per empire, ever
            (shop.py keeps the list in privateState.chainedBought)
    wait    an hour for each cash of the units' units-book price (the
            price economy.py sets); speeding it up costs a cash an hour,
            as every wait in the game
    level   20 when it frees a god, colossus or other top unit, else 10

Left out: the chests, discounts and cash offers (no unit), names too vague
to match a unit ("Chained Dragon", "Chained Troll", "Chained Balrogs"),
those with no picture in the game's files, and repeats of the same units.
"""

import economy

# Chained building id: the units it frees.
CHAINED = {
    1288: (778,), 1289: (775,), 1294: (781,), 1295: (785,), 1296: (786,), 1297: (788,),
    1298: (787,), 1333: (748,), 1334: (798,), 1335: (793,), 1336: (794,), 1337: (816,),
    1338: (815,), 1339: (806,), 1340: (812,), 1341: (807,), 1351: (830,), 1352: (847,),
    1353: (831,), 1354: (846,), 1355: (853,), 1356: (856,), 1377: (862,), 1378: (875,),
    1389: (872,), 1390: (894,), 1392: (891,), 1393: (873,), 1395: (896,), 1411: (886,),
    1412: (2000,), 1417: (2013,), 1419: (2016,), 1431: (877,), 1446: (837,), 1447: (883,),
    1450: (709,), 1451: (2035,), 1452: (860,), 1453: (2037,), 1460: (828,), 1461: (757,),
    1462: (2039,), 1464: (637,), 1466: (2043,), 1468: (742,), 1469: (829,), 1470: (638,),
    1471: (2053,), 1473: (2048,), 1476: (2052,), 1477: (838,), 1480: (762,), 3002: (2055,),
    3003: (2057,), 3007: (717,), 3008: (2059,), 3009: (2060,), 3010: (2063,), 3012: (776,),
    3015: (2066,), 3016: (2067,), 3017: (2069,), 3020: (2072,), 3022: (2073,), 3025: (2075,),
    3027: (2077,), 3028: (2079, 2080), 3030: (2080,), 3031: (2081,), 3034: (2087,), 3035: (2085,),
    3036: (2086,), 3037: (2089,), 3038: (2090,), 3039: (2093,), 3040: (2094,), 3043: (2098,),
    3044: (2097,), 3046: (2099,), 3047: (2101,), 3048: (2102,), 3055: (2113,), 3056: (2114,),
    3057: (2085, 2086), 3061: (2121,), 3063: (2129,), 3065: (2127,), 3067: (2132,), 3068: (2137,),
    3070: (2138,), 3072: (2140,), 3073: (2145,), 3077: (2148,), 3078: (2152,), 3080: (2153,),
    3082: (2155,), 3083: (2156,), 3084: (2093, 2094), 3087: (2160,), 3090: (2089, 2090), 3091: (2167,),
    3093: (842,), 3094: (2075, 2077), 3096: (853, 875), 3097: (2169,), 3098: (2171,), 3100: (2174,),}

GOLD_PER_STRENGTH = 5   # gold for each point of health times attack
ROUND_TO = 10_000
VALUE_OUTSIDE_THE_BOOK = 150   # the units book's most common price, before economy.cash_price
TOP_LEVEL, OTHER_LEVEL = 20, 10


def is_top(item: dict) -> bool:
    """A god or colossus (two colossi aren't tagged so), or the newest dragon sets."""
    name = item["name"]
    return item.get("groups") in ("god", "colossus") or ("Colossus" in name and "Minion" not in name) \
        or any(word in name for word in ("Epic", "Extreme", "Djinn", "Supreme"))


def strength(item: dict) -> int:
    """Health times attack: what makes a unit worth having."""
    return int(item.get("life") or 0) * int(item.get("attack") or 0)


def gold_price(items: dict, units) -> int:
    gold = sum(strength(items[unit]) for unit in units) * GOLD_PER_STRENGTH
    return max(ROUND_TO, -(-gold // ROUND_TO) * ROUND_TO)


def unit_value(config: dict, unit_id: int) -> int:
    """The unit's units-book cash price, as economy.py sets it."""
    for category in config["units_collections_categories"].values():
        units = [int(u) for u in category["units"]]
        if unit_id in units:
            costs = category.get("costs") or []
            place = units.index(unit_id)
            raw = costs[place] if place < len(costs) and costs[place] is not None else category["cost"]
            return economy.cash_price(raw)
    return economy.cash_price(VALUE_OUTSIDE_THE_BOOK)


def prepare(config: dict) -> None:
    """Puts the Chained buildings in the human shop, for gold, with what they free and how long it takes."""
    items = {int(item["id"]): item for item in config["items"]}
    for building, units in CHAINED.items():
        item = items[building]
        value = sum(unit_value(config, unit) for unit in units)
        item["in_store"] = "1"
        item["cost"], item["cost_type"] = str(gold_price(items, units)), "g"
        item["min_level"] = str(TOP_LEVEL if any(is_top(items[unit]) for unit in units) else OTHER_LEVEL)
        item["chained_units"] = ",".join(str(unit) for unit in units)
        item["chain_hours"] = str(value)
