"""Builds config/soulmixer_wiki.json: the Soul Mixer's tables, rebuilt from
the community wiki because the game's own were never preserved.

    .venv/bin/python tools/soul_mixer_wiki.py [--steps N]

The later original Soul Mixer (docs/original/rules/soul-mixer.md) ranks
every unit it can mix (breeding_order), waits a time for each result
(sm_training_time), prices its power-ups (SOUL_MIXER_POWERUPS_LEVELS) and
opens at a level (SOUL_MIXER_MIN_LEVEL). None of that survived. The owner
asked (19 and 20 October 2026) for it to be rebuilt from the Social Empires
Tips Wiki's "Soul Mixer Combinations" page, which lists recipes, the usual
waits and the power-up prices but not the ranks.

So the ranks start from each unit's strength (attack times life over the
time between attacks), the gods, colossi and the newest dragon sets above
400, where the original rolls a random result among them; then a seeded
search moves the units the wiki's recipes name until each recipe can give
its result through the original's own mixing rules (copied below from
client/src/rules/soulMixer.ts). The waits grow with the rank, from the
wiki's 3 hours for the weakest to its 5 days 10 hours for the strongest.
Every value says where it came from. DECISIONS.md lists the calls.
"""

import argparse
import contextlib
import io
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
with contextlib.redirect_stdout(io.StringIO()):
    import get_game_config

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config", "soulmixer_wiki.json")
WIKI = "Social Empires Tips Wiki, \"Soul Mixer Combinations\" (socialempirestips.fandom.com), as saved by the owner on 20 October 2026"

# The wiki's recipes: result, the two units put in, power-ups bought (its "+n").
# Left out: its "Deadly Dragon" (only the boss exists in the game's data) and
# the "NP 3rd/5th/6th time" notes, which record repeats rather than a recipe.
RECIPES = [
    ("Bull Extreme Dragon", "Golden Extreme Dragon", "Forest Extreme Dragon", 0),
    ("Frost Extreme Dragon", "Green Bahamut Dragon", "Forest Extreme Dragon", 0),
    ("3-Head Primal Dragon", "Galaxy Dragon", "Black Bahamut Dragon", 0),
    ("3-Head Primal Dragon", "Fire Extreme Dragon", "Wind Extreme Dragon", 1),
    ("Golden Extreme Dragon", "3-Head Primal Dragon", "Black Bahamut Dragon", 0),
    ("Golden Extreme Dragon", "Rainbow Dragon", "Hermes Spearman", 0),
    ("Golden Extreme Dragon", "Galaxy Dragon", "2-Head Frostfire Dragon", 0),
    ("Golden Extreme Dragon", "Bull Extreme Dragon", "2-Head Frostfire Dragon", 0),
    ("Electric Dynasty Dragon", "Galaxy Dragon", "Rainbow Dragon", 0),
    ("Electric Dynasty Dragon", "Rainbow Dragon", "2-Head Frostfire Dragon", 0),
    ("Electric Dynasty Dragon", "Rainbow Dragon", "King Kong", 0),
    ("Star Dragon", "Soul Extreme Dragon", "Soul Extreme Dragon", 3),
    ("Star Dragon", "Green Bahamut Dragon", "Rainbow Dragon", 0),
    ("Orc Dragon", "Swordsman", "Soul Extreme Dragon", 0),
    ("Orc Dragon", "Burning Tiger", "King Kong", 0),
    ("Orc Dragon", "Valkyrie", "Valkyrie", 0),
    ("Orc Dragon", "Stormy Dragon", "Furious Dragon", 0),
    ("Sky Bahamut Dragon", "Soul Extreme Dragon", "Wind Extreme Dragon", 1),
    ("Sky Bahamut Dragon", "Green Bahamut Dragon", "Fire Extreme Dragon", 2),
    ("Paladin Bahamut Dragon", "Medieval Golden Slayer", "Green Extreme Dragon", 1),
    ("Paladin Bahamut Dragon", "Galaxy Dragon", "2-Head Frostfire Dragon", 0),
    ("Paladin Bahamut Dragon", "Galaxy Dragon", "Rainbow Dragon", 0),
    ("3-Head Dragon", "Medieval Golden Slayer", "Green Extreme Dragon", 0),
    ("3-Head Dragon", "Rainbow Dragon", "Galaxy Dragon", 0),
    ("Death Warrior", "Epic 2-Head Dragon", "Rainbow Dragon", 7),
    ("Colossal Cobra", "Tiger Spider", "Medusa", 1),
    ("Colossal Cobra", "Furious Dragon", "Lightning Draggy", 0),
    ("Evil Demon", "Tiger Spider", "Medusa", 0),
    ("Mad Balrog", "Stormy Dragon", "Colossal Cobra", 1),
    ("Medieval Ether Messiah", "Golden Dragon", "Stratos Titan", 0),
    ("Medieval Ether Messiah", "Furious Dragon", "Ramses II", 0),
    ("Medieval Ether Messiah", "Forest Extreme Dragon", "Draggy", 0),
    ("Green Phoenix", "Orc Battering Ram", "Tiger Spider", 0),
    ("Green Phoenix", "Rainbow Dragon", "Tiger Spider", 0),
    ("Dragon Hunter II", "Ramses II", "Furious Dragon", 0),
    ("Necro Dark Lord", "Ramses II", "Priest Orc", 0),
    ("Golden Golem", "Draggy", "Nice Troll", 0),
    ("Monster Hunter", "Infernal Demon", "Giant Viper", 0),
    ("Advanced Catapult", "Draggy", "Nice Troll", 0),
]

# Power-ups: the wiki's "+1 = 1 cash" and "+3 = 1 cash + 2 cash", up to its "+7".
# Each one moves the result to the next unit up the ranks (an increment of 0:
# the original already steps past the result it replaces).
POWERUPS = [{"cash_cost": cash, "order_increment": 0} for cash in range(1, 8)]
MIN_LEVEL = 8          # ours: the level the shop sells it at (the wiki doesn't say)
TOP_FROM = 400         # the original rolls any unit ranked from here up
TOP_TO = 520
FASTEST = 3 * 3600     # the wiki: "if you have just started your time would usually be 3-4 Hours"
SLOWEST = (5 * 24 + 10) * 3600  # the wiki: "Usually it is 5 Days and 10 Hours for strong Units"
NEVER = {720}          # Chock Nurris, a joke unit
SKIP_SUBCATS = {"71", "73", "74", "75", "76", "88", "90"}  # villagers, animals, settlers, carts, summons: the original's picker leaves them out
NEWEST = ("Epic Dragon", "Epic Draggy", "Epic Dragon Rider", "Djinn", "Armor Dragon", "Ancient Dragon", "Night Forge")


def strength(item):
    return float(item["attack"] or 0) * float(item["life"] or 0) / max(float(item["attack_interval"] or 1), 1)


def mixable(config):
    """The units the mixer takes and gives: the player's own kinds, one id per unit."""
    items = config["items"]
    book = set()
    for category in config["units_collections_categories"].values():
        book |= {int(u) for u in category["units"]}
    key = lambda item: (item["name"].strip().lower(), item["img_name"])
    book_keys = {key(item) for item in items if int(item["id"]) in book}
    return [item for item in items if item["type"] == "u" and item["race"] in ("h", "a")
            and str(item["subcat_functional"]) not in SKIP_SUBCATS and "boss" not in item["name"].lower()
            and int(item["id"]) not in NEVER and strength(item) > 0
            and (int(item["id"]) in book or key(item) not in book_keys)]


def is_top(item):
    """The gods, the colossi (two of which the data doesn't tag: the Rodas and the Genesis Wind) and the newest dragon sets."""
    colossus = "Colossus" in item["name"] and "Minion" not in item["name"]
    return item["groups"] in ("god", "colossus") or colossus or (any(word in item["name"] for word in NEWEST) and "Epic 2-Head" not in item["name"])


class Mixer:
    """The original's rules, as client/src/rules/soulMixer.ts plays them."""

    def __init__(self, order, ranks):
        self.order = sorted(order, key=lambda unit: ranks[unit])  # stable: the config's order breaks ties
        self.ranks = ranks
        self.last = ranks[self.order[-1]]

    def index_at(self, power, excluded):
        for index, unit in enumerate(self.order):
            if self.ranks[unit] >= power and unit not in excluded:
                return index
        return len(self.order) - 1

    def results(self, a, b, powerups):
        """Every result the mix can give, with its chance: the 12 rolls, and 24 points of the top range."""
        lo, hi = sorted((self.ranks[a], self.ranks[b]))
        found = {}
        for roll in range(12):
            power = max(10, math.ceil(lo * 0.3 + hi * 0.7)) + roll
            if power == hi:
                power += 1
            powers = [power] if power <= TOP_FROM else [math.floor(TOP_FROM + (j + 0.5) / 24 * (self.last - TOP_FROM)) for j in range(24)]
            for p in powers:
                excluded = {a, b}
                index = self.index_at(p, excluded)
                for level in range(powerups):
                    unit = self.order[index]
                    excluded = excluded | {unit}
                    if self.ranks[unit] >= TOP_FROM:
                        index = self.index_at(math.floor(TOP_FROM + 0.5 * (self.last - TOP_FROM)), excluded)
                    else:
                        index = self.index_at(self.ranks[unit], excluded) + POWERUPS[min(level + 1, len(POWERUPS) - 1)]["order_increment"]
                    while index < len(self.order) and self.order[index] in excluded:
                        index += 1
                    index = min(index, len(self.order) - 1)
                unit = self.order[index]
                found[unit] = found.get(unit, 0) + 1 / 12 / len(powers)
        return found


def build(steps, seed=7):
    config = get_game_config.get_game_config()
    pool = mixable(config)
    by_name = {}
    for item in pool:
        by_name.setdefault(item["name"].strip(), int(item["id"]))
    recipes = []
    for result, a, b, powerups in RECIPES:
        recipes.append((by_name[result], by_name[a], by_name[b], powerups))
    normal = sorted((item for item in pool if not is_top(item)), key=strength)
    top = sorted((item for item in pool if is_top(item)), key=strength)
    base = {}
    for n, item in enumerate(normal):
        base[int(item["id"])] = 10 + round(389 * n / (len(normal) - 1))
    for n, item in enumerate(top):
        base[int(item["id"])] = TOP_FROM + round((TOP_TO - TOP_FROM) * n / max(len(top) - 1, 1))
    order = [int(item["id"]) for item in pool]
    named = sorted({unit for recipe in recipes for unit in recipe[:3]})

    def score(ranks):
        mixer = Mixer(order, ranks)
        chances = [mixer.results(a, b, k).get(result, 0) for result, a, b, k in recipes]
        return sum(chance > 0 for chance in chances) + sum(min(chance, 0.4) for chance in chances), chances

    ranks = dict(base)
    best, _ = score(ranks)
    rng = random.Random(seed)
    for _ in range(steps):
        unit = rng.choice(named)
        old = ranks[unit]
        lo, hi = (TOP_FROM, TOP_TO) if base[unit] >= TOP_FROM else (10, TOP_FROM - 1)
        ranks[unit] = rng.randint(lo, hi) if rng.random() < 0.3 else min(hi, max(lo, old + round(rng.gauss(0, 15))))
        now, _ = score(ranks)
        if now >= best:
            best = now
        else:
            ranks[unit] = old
    _, chances = score(ranks)

    def wait(rank):
        share = min(max(rank - 10, 0) / (TOP_TO - 10), 1)
        return round(FASTEST * (SLOWEST / FASTEST) ** share / 600) * 600  # to 10 minutes

    names = {int(item["id"]): item["name"] for item in pool}
    data = {
        "_about": ("The Soul Mixer's tables, rebuilt because the game's own were never preserved "
                   "(tools/soul_mixer_wiki.py makes this file; DECISIONS.md, 20 October 2026). Used only when the game's "
                   "config has no Soul Mixer tables of its own, so a genuine original config replaces it."),
        "sources": {
            "wiki": WIKI,
            "strength": "ours: the unit's attack times life over its attack interval, ranked from 10 to 399 (the gods, colossi and newest dragon sets from 400 to 520, where the original rolls a random result)",
            "recipe": "ours: moved by a seeded search so the wiki's recipes can give their results through the original's mixing rules",
            "wait": "the wiki's 3 hours for the weakest to its 5 days 10 hours for the strongest, growing evenly by rank (ours, between those)",
        },
        "globals": {
            "SOUL_MIXER_MIN_LEVEL": {"value": MIN_LEVEL, "source": "ours: the level the shop sells the Soul Mixer at; the wiki doesn't say"},
            "SOUL_MIXER_POWERUPS_LEVELS": {"value": POWERUPS, "source": "wiki: \"+1 = 1 Cash Powerup\", \"+3 = 1 Cash + 2 Cash\", up to \"+7\"; ours: 3 to 7 cash beyond, and each power-up one unit up"},
        },
        "recipes": [{"result": names[r], "parents": [names[a], names[b]], "powerups": k, "chance": round(c, 3), "source": "wiki"}
                    for (r, a, b, k), c in zip(recipes, chances)],
        "units": {str(unit): {"name": names[unit], "breeding_order": ranks[unit], "sm_training_time": wait(ranks[unit]),
                              "source": "recipe" if unit in named and ranks[unit] != base[unit] else "strength"}
                  for unit in sorted(ranks, key=lambda u: (ranks[u], u))},
    }
    return data, chances


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--steps", type=int, default=40000)
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--out", default=OUT)
    args = parser.parse_args()
    data, chances = build(args.steps, args.seed)
    data["sources"]["recipe"] += f" (seed {args.seed}, {args.steps} steps)"
    with open(args.out, "w") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
        f.write("\n")
    possible = sum(chance > 0 for chance in chances)
    print(f"{len(data['units'])} units; {possible} of {len(chances)} wiki recipes can give their result. Written to {args.out}")
    for recipe in data["recipes"]:
        print(f"  {recipe['chance']:>5.0%}  {recipe['result']} <- {' + '.join(recipe['parents'])} +{recipe['powerups']}")


if __name__ == "__main__":
    main()
