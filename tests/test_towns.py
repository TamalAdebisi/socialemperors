"""
The second town (the troll town): founding it, travelling between the towns,
and the commands that count for whichever town is open.

Run from the repository folder:  python -m unittest discover tests
"""

import os
import tempfile
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import sessions
from command import do_command
from get_player_info import get_player_info

HOME, TROLLS = 0, 1
TROLL_HALL, TROLL_HOUSE, TROLL_TOWER, BOAR_RIDER, TROLL_ARCHER = 289, 307, 291, 599, 589
TOWN_HALL, LIGHT_KNIGHT, SMALL_TROLL, TREE = 26, 512, 525, 19


class TownsTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.home = self.save["maps"][HOME]
        self.home["level"], self.home["coins"] = 20, 150000
        self.save["playerInfo"]["cash"] = 30

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def count(self, town, item_id):
        return sum(1 for item in town["items"] if item[0] == item_id)

    def found(self, with_cash=0):
        self.send("buy_map", TROLLS, with_cash, "t", HOME)  # what the race window sends
        return self.save["maps"][TROLLS]

    def test_founding_the_troll_town_with_gold(self):
        trolls = self.found()
        self.assertEqual(self.home["coins"], 50000)
        self.assertEqual(self.save["playerInfo"]["cash"], 30)
        self.assertEqual((trolls["id"], trolls["race"], trolls["level"]), (TROLLS, "t", 1))
        self.assertEqual([trolls[r] for r in ("coins", "wood", "stone", "food")], [250, 850, 250, 700])
        self.assertEqual(self.save["privateState"]["maps"], [{"r": "h"}, {"r": "t"}])
        self.assertEqual(len(self.save["playerInfo"]["map_names"]), 2)
        self.assertEqual(len(self.save["playerInfo"]["map_sizes"]), 2)
        self.assertEqual(trolls["store"], {})  # everything else a town needs is there too
        self.assertIn([TROLL_HALL, 52, 52], [item[:3] for item in trolls["items"]])
        counts = {i: self.count(trolls, i) for i in (TROLL_HOUSE, TROLL_TOWER, BOAR_RIDER, TROLL_ARCHER)}
        self.assertEqual(counts, {TROLL_HOUSE: 2, TROLL_TOWER: 2, BOAR_RIDER: 2, TROLL_ARCHER: 2})
        self.assertEqual(self.count(trolls, TREE), self.count(self.home, TREE))
        for human_or_enemy in (TOWN_HALL, LIGHT_KNIGHT, SMALL_TROLL):
            self.assertEqual(self.count(trolls, human_or_enemy), 0)
        self.assertEqual(self.count(self.home, TOWN_HALL), 1)  # the first town is untouched

    def test_founding_it_with_cash(self):
        self.found(with_cash=1)
        self.assertEqual(self.save["playerInfo"]["cash"], 8)
        self.assertEqual(self.home["coins"], 150000)

    def test_a_second_human_town_if_asked_for(self):
        self.send("buy_map", TROLLS, 0, "h", HOME)  # the client's window only asks for trolls
        second = self.save["maps"][TROLLS]
        self.assertEqual(second["race"], "h")
        self.assertEqual(self.save["privateState"]["maps"], [{"r": "h"}, {"r": "h"}])
        self.assertEqual((self.count(second, TOWN_HALL), self.count(second, LIGHT_KNIGHT)), (1, 2))
        self.assertEqual(self.count(second, SMALL_TROLL), 0)  # Arthur's lesson is in the first town only

    def test_what_stops_a_second_town(self):
        self.home["level"] = 19
        self.send("buy_map", TROLLS, 0, "t", HOME)
        self.home["level"], self.home["coins"] = 20, 99999
        self.send("buy_map", TROLLS, 0, "t", HOME)
        self.save["playerInfo"]["cash"] = 21
        self.send("buy_map", TROLLS, 1, "t", HOME)
        self.assertEqual(len(self.save["maps"]), 1)
        self.assertEqual((self.home["coins"], self.save["playerInfo"]["cash"]), (99999, 21))

    def test_only_one_more_town(self):
        self.found()
        self.found()
        self.send("buy_map", 2, 0, "t", HOME)
        self.assertEqual(len(self.save["maps"]), 2)
        self.assertEqual(self.home["coins"], 50000)

    def test_travelling_between_the_towns(self):
        self.found()
        there = get_player_info(self.pid, TROLLS)
        self.assertEqual(there["map"]["race"], "t")
        self.assertEqual(self.save["town"], TROLLS)
        back = get_player_info(self.pid)  # a reload opens the default town
        self.assertEqual(back["map"]["race"], "h")
        self.assertEqual(self.save["town"], HOME)
        self.assertEqual(get_player_info(self.pid, 5)["map"]["id"], HOME)  # no such town

    def test_commands_without_a_town_count_where_the_player_is(self):
        self.found()
        trolls = self.save["maps"][TROLLS]
        get_player_info(self.pid, TROLLS)
        self.send("gold_statue_conversion", 10)
        self.send("weekly_reward", "g", 2500)
        self.send("rt_level_up", 2)
        self.assertEqual(trolls["coins"], 250 + 10 + 2500)
        self.assertEqual(trolls["level"], 2)
        self.assertEqual((self.home["coins"], self.home["level"]), (50000, 20))
        get_player_info(self.pid, HOME)
        self.send("gold_statue_conversion", 10)
        self.assertEqual(self.home["coins"], 50010)

    def test_naming_the_troll_town(self):
        self.found()
        self.send("name_map", TROLLS, "Grumblehold")
        self.assertEqual(self.save["playerInfo"]["map_names"][TROLLS], "Grumblehold")
        self.assertNotEqual(self.save["playerInfo"]["map_names"][HOME], "Grumblehold")


if __name__ == "__main__":
    unittest.main()
