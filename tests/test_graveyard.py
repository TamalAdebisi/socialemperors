"""
Graveyard: replays the commands the game client sends.

Run from the repository folder:  python -m unittest discover tests
"""

import os
import tempfile
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import graveyard
import sessions
from command import command, do_command

SWORDSMAN, PEASANT, FURIOUS_DRAGON, ARTHUR, PHOENIX = 511, 500, 649, 534, 744
TOWN = 0
KILL, TO_GRAVEYARD, NOT_TO_GRAVEYARD = "KILL", 1, 0


class GraveyardTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][TOWN]
        self.pState = self.save["privateState"]
        self.map.update(coins=10000, food=10000)
        self.save["playerInfo"]["cash"] = 100
        self.pState["potion"] = 10

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def dies(self, unit, x, y, to_graveyard):
        self.map["items"].append([unit, x, y, 0, 0, 0])
        self.send("sell", x, y, unit, TOWN, 1, KILL, to_graveyard)

    def on_map(self, unit):
        return [item for item in self.map["items"] if item[0] == unit]

    def test_fallen_units_are_remembered(self):
        self.dies(SWORDSMAN, 10, 10, TO_GRAVEYARD)
        self.dies(SWORDSMAN, 11, 10, TO_GRAVEYARD)
        self.assertEqual(self.pState["deadHeroes"], {str(SWORDSMAN): 2})
        self.assertEqual(self.on_map(SWORDSMAN), [])

    def test_heroes_are_remembered_although_the_client_sends_0(self):
        self.dies(ARTHUR, 10, 10, NOT_TO_GRAVEYARD)
        self.assertEqual(self.pState["deadHeroes"], {str(ARTHUR): 1})

    def test_peasants_and_buildings_are_not_kept(self):
        self.dies(PEASANT, 10, 10, NOT_TO_GRAVEYARD)
        self.send("sell", 20, 20, 1, TOWN, 1, KILL)  # a building, no 7th argument
        self.assertEqual(self.pState.get("deadHeroes", {}), {})

    def test_resurrect_with_food_and_gold(self):
        self.dies(SWORDSMAN, 10, 10, TO_GRAVEYARD)
        self.send("resurrect_hero", SWORDSMAN, 30, 31, TOWN, "0")
        # By strength since 31 October 2026: 55 health x 18 attack / 8 = 124 food, half of it in gold (the game asked 90 and 45)
        self.assertEqual((self.map["food"], self.map["coins"]), (10000 - 124, 10000 - 62))
        self.assertEqual(self.pState["deadHeroes"], {})
        self.assertEqual(self.on_map(SWORDSMAN)[0][:3], [SWORDSMAN, 30, 31])

    def test_resurrect_a_cash_unit(self):
        # Never cash, and by strength: 1,600 health x 46 attack / 8 = 9,200 food, and 4,600 gold (the game asked 5 cash).
        self.dies(FURIOUS_DRAGON, 10, 10, TO_GRAVEYARD)
        self.send("resurrect_hero", FURIOUS_DRAGON, 30, 31, TOWN, "0")
        self.assertEqual((self.save["playerInfo"]["cash"], self.map["coins"], self.map["food"]), (100, 10000 - 4600, 10000 - 9200))
        self.assertEqual(len(self.on_map(FURIOUS_DRAGON)), 1)

    def test_not_without_the_gold_and_food(self):
        self.dies(FURIOUS_DRAGON, 10, 10, TO_GRAVEYARD)
        self.map["food"] = 9199
        self.send("resurrect_hero", FURIOUS_DRAGON, 30, 31, TOWN, "0")
        self.assertEqual((self.map["coins"], self.map["food"]), (10000, 9199))
        self.assertEqual(self.on_map(FURIOUS_DRAGON), [])
        self.assertEqual(self.pState["deadHeroes"], {str(FURIOUS_DRAGON): 1}, "still in the graveyard")

    def test_the_strong_cost_what_they_are_worth(self):
        # The owner's case: a Dark Shogun Epic Dragon, nearly as strong as a Supreme Bahamut, came back for 5,000 food.
        self.assertEqual(graveyard.strength_price(2278), {"f": 185_650, "g": 92_825})  # 7,900 x 188 / 8
        self.assertEqual(graveyard.strength_price(2125), {"f": 13_500, "g": 6_750})  # the Lion Soul Gladiator: was 15,000 and 7,500
        self.assertEqual(graveyard.strength_price(509), {"f": 40, "g": 20})  # a Spearman: was 30 and 15

    def test_resurrect_with_potions(self):
        self.dies(FURIOUS_DRAGON, 10, 10, TO_GRAVEYARD)
        self.send("resurrect_hero", FURIOUS_DRAGON, 30, 31, TOWN, "1")
        self.assertEqual(self.pState["potion"], 10 - 4)  # each unit has its own potion price
        self.assertEqual((self.map["food"], self.map["coins"], self.save["playerInfo"]["cash"]), (10000, 10000, 100))

    def test_resurrect_a_hero(self):
        self.dies(ARTHUR, 10, 10, NOT_TO_GRAVEYARD)
        xp = self.map["xp"]
        self.send("resurrect_hero", ARTHUR, 30, 31, TOWN)  # the hero popup sends no potion flag
        self.assertEqual(self.map["coins"], 10000 - 5 * 500)
        self.assertEqual(self.map["xp"], xp + 30)
        self.assertEqual(len(self.on_map(ARTHUR)), 1)

    def test_only_the_dead_come_back(self):
        self.send("resurrect_hero", SWORDSMAN, 30, 31, TOWN, "0")
        self.assertEqual(self.on_map(SWORDSMAN), [])
        self.assertEqual(self.map["coins"], 10000)

    def test_phoenix_egg(self):
        self.send("put_graveyard", PHOENIX)
        self.assertEqual(self.pState["deadHeroes"], {str(PHOENIX): 1})

    def test_older_saves(self):
        self.pState["deadHeroes"] = []  # what the client treats as "nobody"
        self.dies(SWORDSMAN, 10, 10, TO_GRAVEYARD)
        self.assertEqual(self.pState["deadHeroes"], {str(SWORDSMAN): 1})

    def test_resurrecting_no_longer_breaks_the_batch(self):
        # Before, resurrect_hero crashed and the commands after it were lost.
        self.dies(SWORDSMAN, 10, 10, TO_GRAVEYARD)
        command(self.pid, {"ts": 0, "first_number": 0, "accessToken": "", "tries": 0, "publishActions": 0,
                           "commands": [{"cmd": "resurrect_hero", "args": [SWORDSMAN, 30, 31, TOWN, "0"]},
                                        {"cmd": "name_map", "args": [TOWN, "After"]}]})
        self.assertEqual(self.save["playerInfo"]["map_names"][TOWN], "After")


if __name__ == "__main__":
    unittest.main()
