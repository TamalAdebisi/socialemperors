"""
Collections: replays the commands the game client sends.

Run from the repository folder:  python -m unittest discover tests
"""

import os
import tempfile
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import sessions
from command import do_command
from game_collections import REWARDS, PIECES, CASH_PRICE

PYRAMID, WIZARD, GOLDEN_BAHAMUT, RED_BAHAMUT, HEART = 1, 10, 21, 22, 23
TOWN = 0


class CollectionsTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.pState = self.save["privateState"]
        self.save["playerInfo"]["cash"] = 1000

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def pick_up(self, collection, *pieces):
        for piece in pieces:
            self.send("add_collectable", collection, piece)

    def row(self, collection):
        return self.pState["collections"][collection]

    def gifts(self, item_id):
        gifts = self.pState["gifts"]
        return gifts[item_id] if item_id < len(gifts) else 0

    def test_pieces_are_saved_the_way_the_client_reads_them(self):
        self.pick_up(PYRAMID, 2, 2, 5)
        rows = self.pState["collections"]
        self.assertEqual(rows[0], [])  # the client stops reading if row 0 has anything
        self.assertEqual(len(rows), len(REWARDS) + 1)
        self.assertEqual(self.row(PYRAMID), [0, 0, 2, 0, 0, 1])
        self.assertEqual(self.pState["collectionsCompleted"], [])

    def test_exchange_gives_the_reward(self):
        self.pick_up(PYRAMID, 1, 2, 3, 4, 5, 5)
        self.send("finish_collection", PYRAMID)
        self.assertEqual(self.gifts(REWARDS[PYRAMID]), 1)
        self.assertEqual(self.row(PYRAMID), [1, 0, 0, 0, 0, 1])
        self.assertEqual(self.pState["collectionsCompleted"], [PYRAMID])

    def test_exchange_needs_every_piece(self):
        self.pick_up(PYRAMID, 1, 2, 3, 4, 4)
        self.send("finish_collection", PYRAMID)
        self.assertEqual(self.gifts(REWARDS[PYRAMID]), 0)
        self.assertEqual(self.row(PYRAMID), [0, 1, 1, 1, 2, 0])

    def test_exchange_again_with_a_second_set(self):
        self.pick_up(PYRAMID, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5)
        self.send("finish_collection", PYRAMID)
        self.send("finish_collection", PYRAMID)
        self.assertEqual(self.gifts(REWARDS[PYRAMID]), 2)
        self.assertEqual(self.pState["collectionsCompleted"], [PYRAMID])

    def test_buy_is_cheaper_for_pieces_found(self):
        self.pick_up(PYRAMID, 1, 1, 3)  # 2 different pieces: 5 - 2 = 3 cash
        self.send("finish_collection", PYRAMID, 1, 3)
        self.assertEqual(self.save["playerInfo"]["cash"], 1000 - 3)
        self.assertEqual(self.gifts(REWARDS[PYRAMID]), 1)
        self.assertEqual(self.row(PYRAMID), [1, 1, 0, 0, 0, 0])

    def test_price_comes_from_the_server(self):
        # A modified client claiming a lower price still pays the real one.
        self.send("finish_collection", WIZARD, 1, 0)
        self.assertEqual(self.save["playerInfo"]["cash"], 1000 - CASH_PRICE[WIZARD])

    def test_some_collections_have_no_discount(self):
        self.pick_up(WIZARD, 1, 2, 3, 4)
        self.send("finish_collection", WIZARD, 1, 11)
        self.assertEqual(self.save["playerInfo"]["cash"], 1000 - 15)

    def test_buy_only_once(self):
        self.send("finish_collection", PYRAMID, 1, 5)
        self.send("finish_collection", PYRAMID, 1, 5)
        self.assertEqual(self.gifts(REWARDS[PYRAMID]), 1)
        self.assertEqual(self.save["playerInfo"]["cash"], 1000 - 5)

    def test_not_enough_cash(self):
        self.save["playerInfo"]["cash"] = 399
        self.send("finish_collection", GOLDEN_BAHAMUT, 1, 400)
        self.assertEqual(self.gifts(REWARDS[GOLDEN_BAHAMUT]), 0)
        self.assertEqual(self.save["playerInfo"]["cash"], 399)

    def test_heart_is_not_for_sale(self):
        self.send("finish_collection", HEART, 1, 999)
        self.assertEqual(self.gifts(REWARDS[HEART]), 0)
        self.assertEqual(self.save["playerInfo"]["cash"], 1000)

    def test_bahamut_dragons_only_once(self):
        self.pick_up(GOLDEN_BAHAMUT, *range(1, PIECES + 1), *range(1, PIECES + 1))
        self.send("finish_collection", GOLDEN_BAHAMUT)
        self.send("finish_collection", GOLDEN_BAHAMUT)
        self.assertEqual(self.gifts(REWARDS[GOLDEN_BAHAMUT]), 1)

    def test_unknown_pieces_are_ignored(self):
        for collection, piece in [(0, 1), (24, 1), (PYRAMID, 0), (PYRAMID, 6)]:
            self.send("add_collectable", collection, piece)
        self.send("finish_collection", 24)
        self.send("finish_collection", 0, 1, 5)
        rows = self.pState.get("collections", [])
        self.assertTrue(all(row == [0] * (PIECES + 1) for row in rows[1:]))
        self.assertEqual(self.save["playerInfo"]["cash"], 1000)

    def test_road_to_the_supreme_bahamut(self):
        # The last three temple offerings: both Bahamut dragons and the Heart.
        for collection in (GOLDEN_BAHAMUT, RED_BAHAMUT, HEART):
            self.pick_up(collection, *range(1, PIECES + 1))
            self.send("finish_collection", collection)
        self.send("place_gift", REWARDS[GOLDEN_BAHAMUT], 30, 30, TOWN, 0)
        self.send("place_gift", REWARDS[RED_BAHAMUT], 32, 30, TOWN, 0)

        on_map = [item[0] for item in self.save["maps"][TOWN]["items"]]
        self.assertIn(REWARDS[GOLDEN_BAHAMUT], on_map)
        self.assertIn(REWARDS[RED_BAHAMUT], on_map)
        self.assertEqual(self.gifts(REWARDS[HEART]), 1)  # what the temple checks before summoning


if __name__ == "__main__":
    unittest.main()
