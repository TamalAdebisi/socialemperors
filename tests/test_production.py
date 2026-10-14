"""
Collecting from buildings and their production timers: replays the commands
the game client sends.

Run from the repository folder:  python -m unittest discover tests
"""

import os
import tempfile
import time
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import sessions
from command import command, do_command

GOLD_MINE, MILL, FARM_LAND, ROUND_TABLE, PEASANT = 13, 5, 10, 389, 500
TOWN = 0
LONG_AGO = 1000
X, Y = 60, 60  # an empty spot in a new village


class ProductionTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][TOWN]
        self.map.update(coins=0, wood=1000, food=0, xp=0)

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def building(self, item_id, x, y, *rest):
        item = [item_id, x, y, 0, LONG_AGO, 0, *rest]
        self.map["items"].append(item)
        return item

    def test_collecting_starts_the_work_over(self):
        mine = self.building(GOLD_MINE, X, Y, [PEASANT])
        before = int(time.time())
        self.send("collect_new", X, Y, TOWN, GOLD_MINE, 1, 1, 0)
        # Before, the timer stayed where it was, so after a reload the mine was ready again.
        self.assertGreaterEqual(mine[4], before)

    def test_each_extra_worker_adds_a_fifth(self):
        self.building(GOLD_MINE, X, Y, [PEASANT, PEASANT])
        self.send("collect_new", X, Y, TOWN, GOLD_MINE, 2, 1, 0)
        self.assertEqual(self.map["coins"], 200 + 40)  # one worker: 200, the second adds a fifth
        self.assertEqual(self.map["xp"], 7)

    def test_the_level_bonus(self):
        self.building(GOLD_MINE, X, Y, [PEASANT])
        self.send("collect_new", X, Y, TOWN, GOLD_MINE, 1, 3, 0)
        self.assertEqual(self.map["coins"], 600)

    def test_working_time(self):
        mill = self.building(MILL, X, Y, [PEASANT])
        before = int(time.time())
        self.send("activate", X, Y, TOWN, MILL, 4)  # 8 hours: three times the harvest
        self.assertEqual(mill[7], {"cp": 4})
        self.assertGreaterEqual(mill[4], before)
        self.send("collect_new", X, Y, TOWN, MILL, 1, 1, 0)
        self.assertEqual(self.map["food"], 250 * 3)
        self.send("activate", X, Y, TOWN, MILL, 0)  # the client clears it after collecting
        self.assertEqual(mill[7], {"cp": 0})

    def test_farms_use_wood(self):
        self.building(FARM_LAND, X, Y, [PEASANT])
        self.send("collect_new", X, Y, TOWN, FARM_LAND, 1, 1, 0)
        self.assertEqual((self.map["food"], self.map["wood"]), (15, 1000 - 5))

    def test_hurrying_costs_cash(self):
        self.save["playerInfo"]["cash"] = 10
        self.building(GOLD_MINE, X, Y, [PEASANT])
        self.send("collect_new", X, Y, TOWN, GOLD_MINE, 1, 1, 3)
        self.assertEqual(self.save["playerInfo"]["cash"], 7)

    def test_the_round_table_sends_a_shorter_collect(self):
        # [x, y, town, item] only. Before, this crashed and lost the rest of the batch.
        self.building(ROUND_TABLE, X, Y)
        command(self.pid, {"ts": 0, "first_number": 0, "accessToken": "", "tries": 0, "publishActions": 0,
                           "commands": [{"cmd": "collect_new", "args": [X, Y, TOWN, ROUND_TABLE]},
                                        {"cmd": "name_map", "args": [TOWN, "After"]}]})
        self.assertEqual(self.save["playerInfo"]["map_names"][TOWN], "After")

    def test_an_idle_building_starts_when_a_worker_walks_in(self):
        mine = self.building(GOLD_MINE, X, Y, [])
        self.map["items"].append([PEASANT, 30, 30, 0, 0, 0])
        before = int(time.time())
        self.send("push_unit", 30, 30, PEASANT, X, Y, TOWN)
        self.assertGreaterEqual(mine[4], before)
        self.assertEqual(mine[6], [PEASANT])

    def test_a_second_worker_does_not_restart_the_work(self):
        mine = self.building(GOLD_MINE, X, Y, [PEASANT])
        self.map["items"].append([PEASANT, 30, 30, 0, 0, 0])
        self.send("push_unit", 30, 30, PEASANT, X, Y, TOWN)
        self.assertEqual(mine[4], LONG_AGO)

    def test_one_failing_command_does_not_lose_the_others(self):
        command(self.pid, {"ts": 0, "first_number": 0, "accessToken": "", "tries": 0, "publishActions": 0,
                           "commands": [{"cmd": "name_map", "args": []},  # broken on purpose
                                        {"cmd": "name_map", "args": [TOWN, "Still saved"]}]})
        self.assertEqual(self.save["playerInfo"]["map_names"][TOWN], "Still saved")


if __name__ == "__main__":
    unittest.main()
