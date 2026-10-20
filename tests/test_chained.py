"""Chained buildings: sold for gold, their chains break with time (or cash), then their units are freed."""

import os
import tempfile
import unittest
from unittest.mock import patch

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import sessions
from command import do_command
from get_game_config import get_game_config, get_item_from_id
import chained_units

FIRE_PAIR, FIRE_GOD, FIRE_COLOSSUS, DRAGGY_CHAIN, DRAGGY = 3094, 2075, 2077, 1470, 638
AT = [50, 50]


class ChainedTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][0]
        self.map.update(coins=500000, level=30)
        self.save["playerInfo"]["cash"] = 200

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def on_map(self, item_id):
        return [row for row in self.map["items"] if row[0] == item_id]

    def test_the_shop_sells_them_for_gold(self):
        pair = get_item_from_id(FIRE_PAIR)
        self.assertEqual((pair["in_store"], pair["cost_type"]), ("1", "g"))
        self.assertEqual(pair["chained_units"], f"{FIRE_GOD},{FIRE_COLOSSUS}")
        self.assertEqual(int(pair["cost"]), int(pair["chain_hours"]) * chained_units.GOLD_PER_CASH)
        self.assertEqual(pair["min_level"], "20")
        self.assertEqual(get_item_from_id(DRAGGY_CHAIN)["min_level"], "10")
        chests = [item for item in get_game_config()["items"] if item["name"].startswith("Chained") and "Chest" in item["name"]]
        self.assertTrue(chests and all(item["in_store"] == "0" for item in chests), "chests and offers stay out")

    def test_bought_waited_for_and_freed(self):
        with patch("chained.timestamp_now", return_value=1_000_000), patch("engine.timestamp_now", return_value=1_000_000):
            self.send("buy", FIRE_PAIR, *AT, 0, 0, 0, 1, "b")
        self.assertEqual(self.map["coins"], 500000 - int(get_item_from_id(FIRE_PAIR)["cost"]))
        hours = int(get_item_from_id(FIRE_PAIR)["chain_hours"])
        with patch("chained.timestamp_now", return_value=1_000_000 + hours * 3600 - 1):
            self.send("release_chained", *AT, 0, [[52, 50], [53, 50]])
        self.assertEqual(len(self.on_map(FIRE_PAIR)), 1, "the chains hold until the wait is over")
        with patch("chained.timestamp_now", return_value=1_000_000 + hours * 3600):
            self.send("release_chained", *AT, 0, [[52, 50], [53, 50]])
        self.assertEqual(self.on_map(FIRE_PAIR), [])
        self.assertEqual([row[:3] for row in self.on_map(FIRE_GOD)], [[FIRE_GOD, 52, 50]])
        self.assertEqual([row[:3] for row in self.on_map(FIRE_COLOSSUS)], [[FIRE_COLOSSUS, 53, 50]])

    def test_speeding_up_costs_a_cash_an_hour_left(self):
        with patch("engine.timestamp_now", return_value=1_000_000):
            self.send("buy", DRAGGY_CHAIN, *AT, 0, 0, 0, 1, "b")
        hours = int(get_item_from_id(DRAGGY_CHAIN)["chain_hours"])
        with patch("chained.timestamp_now", return_value=1_000_000 + 3600):  # an hour in
            self.send("speed_up_chained", *AT, 0)
            self.assertEqual(self.save["playerInfo"]["cash"], 200 - (hours - 1))
            self.send("release_chained", *AT, 0, [[52, 50]])
        self.assertEqual(len(self.on_map(DRAGGY)), 1)

    def test_refuses_what_it_should(self):
        with patch("engine.timestamp_now", return_value=1_000_000):
            self.send("buy", DRAGGY_CHAIN, *AT, 0, 0, 0, 1, "b")
        self.save["playerInfo"]["cash"] = 0
        with patch("chained.timestamp_now", return_value=1_000_000):
            self.send("speed_up_chained", *AT, 0)
        self.assertEqual(len(self.on_map(DRAGGY_CHAIN)), 1, "no cash, no speed-up")
        hours = int(get_item_from_id(DRAGGY_CHAIN)["chain_hours"])
        with patch("chained.timestamp_now", return_value=1_000_000 + hours * 3600):
            for spots in (None, [], [[52, 50], [53, 50]], [[100, 50]], [["52", 50]]):
                self.send("release_chained", *AT, 0, spots)
                self.assertEqual(len(self.on_map(DRAGGY_CHAIN)), 1, repr(spots))
            self.send("release_chained", 51, 51, 0, [[52, 50]])  # nothing there
            self.assertEqual(self.on_map(DRAGGY), [])


if __name__ == "__main__":
    unittest.main()
