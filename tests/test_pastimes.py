"""
Darts, island skins, survival mode and the Monday bonus: replays the
commands the game client sends.

Run from the repository folder:  python -m unittest discover tests
"""

import json
import os
import tempfile
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import sessions
from command import command, do_command
from engine import timestamp_now

TOWN = 0
FIRST_MAP, SECOND_MAP = "100000035", "100000036"  # the two survival maps the client opens


class PastimesTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][TOWN]
        self.pState = self.save["privateState"]
        self.save["playerInfo"]["cash"] = 100
        self.map["coins"] = 1000

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def batch(self, *commands):
        command(self.pid, {"ts": 0, "first_number": 0, "accessToken": "", "tries": 0, "publishActions": 0,
                           "commands": [{"cmd": cmd, "args": list(args)} for cmd, *args in commands]})

    def cash(self):
        return self.save["playerInfo"]["cash"]

    # Darts

    def test_a_round_of_darts(self):
        self.send("darts_reset", 4242)
        self.assertEqual((self.pState["dartsRandomSeed"], self.pState["dartsHasFree"]), (4242, True))
        self.batch(("store_add_items", json.dumps([619])), ("darts_shoot_balloon", 3, 0, 0))  # the free throw
        self.assertEqual((self.pState["dartsBalloonsShot"], self.pState["dartsHasFree"]), ([3], False))
        self.assertEqual(self.cash(), 100)
        self.batch(("store_add_items", json.dumps([577])), ("darts_shoot_balloon", 5, 1, 1))  # paid, and the last one
        self.assertEqual(self.cash(), 80)
        self.assertEqual(self.pState["dartsBalloonsShot"], [3, 5])
        self.assertTrue(self.pState["dartsGotExtra"])
        self.assertEqual(self.map["store"], {"619": 1, "577": 1})
        self.send("darts_new_free")
        self.assertTrue(self.pState["dartsHasFree"])

    # Island skins

    def test_unlocking_and_wearing_a_skin(self):
        self.send("unlock_skin", "2")
        self.send("set_skin", TOWN, "2")
        self.assertEqual(self.pState["unlockedSkins"], {"2": "true"})  # text, as the client compares it
        self.assertEqual(self.map["skin"], 2)
        self.assertEqual(self.cash(), 80)
        self.send("unlock_skin", "2")
        self.assertEqual(self.cash(), 80)

    # Survival

    def test_three_lives_then_bought_ones(self):
        self.pState["survivalVidaTimeStamp"] = []
        self.pState["survivalVidasExtra"] = 0
        self.send("add_survival_vida_extra", 3)
        self.assertEqual((self.cash(), self.pState["survivalVidasExtra"]), (97, 1))
        for _ in range(4):
            self.send("start_survival")
        self.assertEqual(len(self.pState["survivalVidaTimeStamp"]), 3)
        self.assertEqual(self.pState["survivalVidasExtra"], 0)

    def test_lives_come_back_after_three_hours(self):
        long_ago = timestamp_now() - 3 * 3600
        self.pState["survivalVidaTimeStamp"] = [long_ago, long_ago, timestamp_now()]
        self.pState["survivalVidasExtra"] = 1
        self.send("start_survival")
        self.assertEqual(len(self.pState["survivalVidaTimeStamp"]), 2)
        self.assertEqual(self.pState["survivalVidasExtra"], 1)

    def test_the_prize_for_holding_out(self):
        self.send("end_survival", FIRST_MAP, 9 * 60, json.dumps({"577": 1}))
        self.assertEqual(self.map["store"], {"577": 1})
        self.assertEqual(self.pState["survivalMaps"][FIRST_MAP]["tp"], 9 * 60)
        self.send("end_survival", SECOND_MAP, 16 * 60, json.dumps({"652": 1}))
        self.assertEqual(self.map["store"], {"577": 1, "652": 1})

    def test_too_short_for_a_prize_but_the_best_time_stays(self):
        self.send("end_survival", FIRST_MAP, 9 * 60, "null")
        self.send("end_survival", FIRST_MAP, 5 * 60, "null")  # exactly 5 minutes is not enough
        self.assertEqual(self.map["store"], {"577": 1})
        self.assertEqual(self.pState["survivalMaps"][FIRST_MAP]["tp"], 9 * 60)

    def test_a_prize_the_time_did_not_earn(self):
        self.send("end_survival", FIRST_MAP, 6 * 60, json.dumps({"629": 1}))
        self.assertEqual(self.map["store"], {"619": 1})

    # The Monday bonus

    def test_the_monday_bonus(self):
        self.send("weekly_reward", "g", 2500)
        self.assertEqual(self.map["coins"], 3500)
        self.send("weekly_reward", "c", 5)  # only once a day
        self.assertEqual(self.cash(), 100)
        self.pState["timeStampMondayBonus"] = timestamp_now() - 7 * 24 * 3600
        self.send("weekly_reward", "u", "784")
        self.assertEqual(self.map["store"], {"784": 1})

    def test_a_monday_bonus_that_is_not_on_offer(self):
        self.send("weekly_reward", "c", 500)
        self.assertEqual(self.cash(), 105)  # the config's amount
        self.pState["timeStampMondayBonus"] = 0
        self.send("weekly_reward", "u", "608")
        self.assertEqual(self.map["store"], {})


if __name__ == "__main__":
    unittest.main()
