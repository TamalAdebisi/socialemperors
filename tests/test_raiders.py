"""
Raiders killed at home: replays the "kill" the game client sends for a
bandit or a siege soldier, who was never in the save.

Run from the repository folder:  python -m unittest discover tests
"""

import os
import tempfile
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import raiders
import sessions
from command import do_command

SMALL_TROLL, BIG_TROLL, HOUSE, TROLL_TOWER, TOWER_IV = 525, 527, 1, 291, 32
TOWN = 0


class RaidersTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][TOWN]
        self.map.update(coins=100, xp=0)

    def kill(self, unit, kind="u"):
        do_command(self.pid, "kill", [3, 50, unit, TOWN, kind])

    def test_a_raider_pays_5_gold_and_its_experience(self):
        self.kill(SMALL_TROLL)
        self.kill(BIG_TROLL)
        self.assertEqual(self.map["coins"], 110)
        self.assertGreater(self.map["xp"], 0)
        self.assertEqual(self.map["raiderKills"]["count"], 2)

    def test_buildings_pay_nothing_but_camp_towers(self):
        self.kill(HOUSE, "b")
        self.assertEqual(self.map["coins"], 100)
        self.map["items"].append([TROLL_TOWER, 3, 50, 0, 0, 0])
        self.kill(TROLL_TOWER, "b")
        self.assertEqual((self.map["coins"], self.map["xp"]), (105, 1), "5 gold and a little experience, as the original shows")
        self.assertEqual([raiders.tower_xp(c) for c in (125, 250, 375, 500)], [1, 2, 2, 3])

    def test_a_saved_enemy_is_removed_and_pays_5_gold_and_its_experience_once(self):
        self.map["items"].append([SMALL_TROLL, 3, 50, 0, 0, 0])
        self.kill(SMALL_TROLL)
        xp = self.map["xp"]
        self.assertFalse([i for i in self.map["items"] if i[0] == SMALL_TROLL and i[1] == 3])
        self.assertEqual(self.map["coins"], 105)
        self.kill(SMALL_TROLL)  # now a raider: never saved
        self.assertEqual(self.map["xp"], 2 * xp, "the experience once each")

    def test_at_most_300_a_day(self):
        self.map["raiderKills"] = {"day": raiders._today(), "count": raiders.MOST_A_DAY}
        self.kill(SMALL_TROLL)
        self.assertEqual(self.map["coins"], 100)
        self.map["raiderKills"] = {"day": "2000-01-01", "count": raiders.MOST_A_DAY}
        self.kill(SMALL_TROLL)
        self.assertEqual(self.map["coins"], 105, "a new day")


if __name__ == "__main__":
    unittest.main()
