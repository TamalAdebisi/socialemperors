"""
Supreme Dragon Temple: replays the commands the game client sends.

Run from the repository folder:  python -m unittest discover tests
"""

import json
import os
import tempfile
import time
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import sessions
from command import do_command
from temple import STEPS, SACRIFICE, SKIP_WAIT_CASH

TEMPLE, HEART, SUPREME_BAHAMUT = 1394, 1410, 2003
TOWN = 0


def offering_json(step):
    """What the client sends as the first argument of next_temple_step."""
    kind, data = STEPS[step]
    if kind == SACRIFICE:
        return json.dumps({"u": data})
    return json.dumps(data if isinstance(data, dict) else {"collection": data})


class TempleTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][TOWN]
        self.map["items"].append([TEMPLE, 40, 40, 0, 0, 0])
        self.map.update(coins=250000, stone=250000, wood=250000, food=250000)
        self.save["playerInfo"]["cash"] = 200
        self.save["privateState"]["mana"] = 80

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def items(self, item_id):
        return [item for item in self.map["items"] if item[0] == item_id]

    def test_whole_ritual(self):
        # Every dragon the temple asks for, standing on the map.
        dragons = {}
        for n, (kind, data) in enumerate(STEPS):
            if kind == SACRIFICE:
                dragons[data] = (10 + n, 20)
                self.map["items"].append([data, 10 + n, 20, 0, 0, 0])
        # The Bahamut Heart, in the inventory.
        self.save["privateState"]["gifts"] = [0] * HEART + [1]

        for step, (kind, data) in enumerate(STEPS):
            if kind == SACRIFICE:
                x, y = dragons[data]
                self.send("sell", x, y, data, TOWN, 1, "DEBUG")
            self.send("next_temple_step", offering_json(step), step)
            self.send("buy_temple_step_cash", SKIP_WAIT_CASH)

        pState = self.save["privateState"]
        self.assertEqual(sorted(pState["templeStep"]), list(range(len(STEPS))))
        self.assertEqual(pState["timeStampTemple"], 0)
        self.assertEqual((self.map["coins"], self.map["stone"], self.map["wood"], self.map["food"]),
                         (150000, 150000, 150000, 150000))
        self.assertEqual(pState["mana"], 30)
        self.assertEqual(self.save["playerInfo"]["cash"], 200 - 50 - SKIP_WAIT_CASH * len(STEPS))
        for dragon in dragons:
            self.assertEqual(self.items(dragon), [], f"dragon {dragon} was not sacrificed")

        # Summon: the heart is used up, the dragon appears for free, the temple starts over.
        self.send("sell_stored_item", HEART, TOWN)
        self.send("buy", SUPREME_BAHAMUT, 42, 44, 0, TOWN, 1, 1, "u")
        self.send("reset_temple")

        self.assertEqual(sum(pState["gifts"]), 0)
        self.assertEqual(len(self.items(SUPREME_BAHAMUT)), 1)
        self.assertEqual(self.map["coins"], 150000)
        self.assertEqual(pState["templeStep"], [])
        self.assertEqual(pState["timeStampTemple"], 0)

    def test_offering_starts_the_wait(self):
        before = int(time.time())
        self.send("next_temple_step", offering_json(0), 0)
        self.assertGreaterEqual(self.save["privateState"]["timeStampTemple"], before)

    def test_same_step_twice_is_paid_once(self):
        self.send("next_temple_step", offering_json(0), 0)
        self.send("next_temple_step", offering_json(0), 0)
        self.assertEqual(self.save["privateState"]["templeStep"], [0])
        self.assertEqual(self.map["coins"], 150000)

    def test_unknown_step_is_ignored(self):
        self.send("next_temple_step", "{}", len(STEPS))
        self.send("next_temple_step", "{}", -1)
        self.assertEqual(self.save["privateState"]["templeStep"], [])

    def test_price_comes_from_the_server(self):
        # A modified client claiming a cheaper offering still pays the real price.
        self.send("next_temple_step", json.dumps({"s": 1}), 1)
        self.assertEqual(self.map["stone"], 150000)

    def test_resources_never_go_negative(self):
        self.map["food"] = 10
        self.send("next_temple_step", offering_json(3), 3)
        self.assertEqual(self.map["food"], 0)

    def test_selling_a_missing_item_changes_nothing(self):
        cash = self.save["playerInfo"]["cash"]
        self.send("sell_stored_item", HEART, TOWN)
        self.send("sell_gift", HEART, TOWN)
        self.assertEqual(self.save["privateState"]["gifts"], [])
        self.assertEqual(self.save["playerInfo"]["cash"], cash)


if __name__ == "__main__":
    unittest.main()
