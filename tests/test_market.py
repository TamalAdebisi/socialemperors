"""
The Market: replays the commands the game client sends.

Run from the repository folder:  python -m unittest discover tests
"""

import os
import tempfile
import time
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import sessions
from command import do_command

TOWN = 0
BUY, SELL = 0, 1


class MarketTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][TOWN]
        self.map.update(coins=10000, wood=1000, stone=1000, food=1000)

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def test_buying_makes_the_next_one_dearer(self):
        self.send("trade_resource_b", TOWN, "w", BUY, 100)
        self.send("trade_resource_b", TOWN, "w", BUY, 100)
        self.assertEqual(self.map["coins"], 10000 - 100 - 102)
        self.assertEqual(self.map["wood"], 1200)
        self.assertEqual(self.map["resourcesTraded"], {"w": 2})

    def test_selling_rounds_halves_up_like_the_client(self):
        self.map["resourcesTraded"] = {"f": 1}
        self.send("trade_resource_b", TOWN, "f", SELL, 100)
        self.assertEqual(self.map["coins"], 10000 + 77)  # 102 * 0.75 = 76.5
        self.assertEqual(self.map["food"], 900)
        self.assertEqual(self.map["resourcesTraded"], {"f": 0})

    def test_stone_is_dearer(self):
        self.send("trade_resource_b", TOWN, "s", BUY, 300)
        self.assertEqual(self.map["coins"], 10000 - 450)

    def test_twenty_trades_then_wait(self):
        self.map["wood"] = 5000
        for _ in range(21):
            self.send("trade_resource_b", TOWN, "w", SELL, 100)
        self.assertEqual(self.map["numTradesDone"], 20)
        self.assertEqual(self.map["wood"], 5000 - 20 * 100)  # the 21st was refused
        self.map["timestampLastTrade"] = int(time.time()) - 20 * 3600 - 1
        self.send("trade_resource_b", TOWN, "w", BUY, 100)
        self.assertEqual(self.map["numTradesDone"], 1)

    def test_amounts_the_market_does_not_offer(self):
        self.send("trade_resource_b", TOWN, "w", BUY, 5000)
        self.send("trade_resource_b", TOWN, "g", BUY, 100)
        self.assertEqual(self.map["coins"], 10000)


if __name__ == "__main__":
    unittest.main()
