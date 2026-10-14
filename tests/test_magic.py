"""
Spells and mana: replays the commands the game client sends.

Run from the repository folder:  python -m unittest discover tests
"""

import json
import os
import tempfile
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import sessions
from command import do_command
from get_game_config import get_xp_from_level

FIRE_HAVOC = 2  # 1000 gold or 35 cash, 5 mana
TOWN = 0


class MagicTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][TOWN]
        self.pState = self.save["privateState"]
        self.map.update(coins=50000)
        self.save["playerInfo"]["cash"] = 100

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def test_learning_a_spell_with_gold(self):
        self.send("buy_magic", FIRE_HAVOC, TOWN, 0)
        self.assertEqual(self.map["coins"], 49000)
        self.assertEqual(self.pState["magics"], {str(FIRE_HAVOC): 0})
        self.assertEqual(self.pState["mana"], 5)  # the client gives the spell's mana with it

    def test_learning_a_spell_with_cash_only_once(self):
        self.send("buy_magic", FIRE_HAVOC, TOWN, 1)
        self.send("buy_magic", FIRE_HAVOC, TOWN, 1)
        self.assertEqual(self.save["playerInfo"]["cash"], 65)

    def test_casting_a_spell(self):
        self.pState.update(magics={str(FIRE_HAVOC): 24}, mana=12)
        self.send("use_magic", FIRE_HAVOC)
        self.assertEqual(self.pState["mana"], 7)
        self.assertEqual(self.pState["magics"], {str(FIRE_HAVOC): 25})  # the second star

    def test_buying_mana(self):
        self.send("buy_mana_new", TOWN, 1)
        self.send("buy_mana_new", TOWN, 0)
        self.assertEqual(self.pState["mana"], 10)
        self.assertEqual((self.save["playerInfo"]["cash"], self.map["coins"]), (99, 30000))

    def test_mana_from_level_36(self):
        self.map.update(level=34, levelPaid=34, xp=get_xp_from_level(33))
        for level in (35, 36, 37):
            self.send("rt_level_up", level)
        self.send("rt_level_up", 37)  # sent twice: counted once
        self.assertEqual(self.pState["mana"], 4)

    def test_mana_for_levels_gained_on_a_quest(self):
        self.map.update(level=36, levelPaid=36, xp=get_xp_from_level(35))  # counted from 0: the xp where level 36 starts
        self.send("end_quest", json.dumps({"map": TOWN, "quest_id": 100000001, "win": 0, "units": [],
                                           "resources": {"g": 0, "x": get_xp_from_level(37) - self.map["xp"]}}))
        self.assertEqual(self.map["level"], 38)
        self.assertEqual(self.pState["mana"], 4)


if __name__ == "__main__":
    unittest.main()
