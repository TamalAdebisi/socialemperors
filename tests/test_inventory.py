"""
Storage: replays the commands the game client sends.

Run from the repository folder:  python -m unittest discover tests
"""

import json
import os
import tempfile
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import sessions
from command import do_command
from get_game_config import get_level_from_xp

TOWER, WAREHOUSE, LEVEL_UP_STATUE, DOCK, SWORDSMAN = 33, 1284, 1478, 224, 511  # Tower V: not in a new village
TOWN = 0


class InventoryTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][TOWN]
        self.pState = self.save["privateState"]
        self.map.update(coins=0, wood=0, stone=0, xp=0)

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def on_map(self, item_id):
        return [item for item in self.map["items"] if item[0] == item_id]

    def test_put_away_and_place_again(self):
        self.map["items"].append([TOWER, 40, 40, 0, 0, 0])
        self.send("store_item", 40, 40, TOWN, TOWER)
        self.assertEqual(self.on_map(TOWER), [])
        self.assertEqual(self.map["store"], {str(TOWER): 1})
        self.send("place_stored_item", TOWER, 50, 51, 1, TOWN)
        self.assertEqual(self.on_map(TOWER)[0][:4], [TOWER, 50, 51, 1])  # with its orientation
        self.assertEqual(self.map["store"], {})
        self.assertEqual(self.map["xp"], 0)  # only gifts give experience

    def test_put_away_by_the_client_on_load(self):
        # Sent for items found off the map; it must not leave a copy behind.
        self.map["items"].append([TOWER, 200, 200, 0, 0, 0])
        self.send("store_item_frombug", 200, 200, TOWN, TOWER)
        self.assertEqual(self.on_map(TOWER), [])
        self.assertEqual(self.map["store"], {str(TOWER): 1})

    def test_placing_a_gift(self):
        self.pState["gifts"] = [0] * TOWER + [1]
        self.send("place_gift", TOWER, 50, 51, 1, TOWN)
        self.assertEqual(len(self.on_map(TOWER)), 1)
        self.assertEqual(self.pState["gifts"], [])
        self.assertEqual(self.map["xp"], 63)  # the tower's experience

    def test_a_gift_goes_to_the_town_it_was_placed_in(self):
        # [item, x, y, orientation, town]: before, the orientation was read as the town.
        self.save["maps"].append({"items": [], "xp": 0})
        self.pState["gifts"] = {str(TOWER): 1}
        self.send("place_gift", TOWER, 50, 51, 0, 1)
        self.assertEqual(self.save["maps"][1]["items"][0][:3], [TOWER, 50, 51])
        self.assertEqual(self.on_map(TOWER), [])

    def test_older_saves_kept_stored_items_with_the_gifts(self):
        self.pState["gifts"] = {str(TOWER): 1}
        self.send("place_stored_item", TOWER, 50, 51, 0, TOWN)
        self.assertEqual(self.pState["gifts"], {})
        self.assertEqual(len(self.on_map(TOWER)), 1)

    def test_level_up_statue(self):
        self.map["xp"] = 30
        level = get_level_from_xp(30)
        self.pState["gifts"] = {str(LEVEL_UP_STATUE): 1}
        self.send("place_gift", LEVEL_UP_STATUE, 50, 51, 0, TOWN)
        self.assertEqual(get_level_from_xp(self.map["xp"]), level + 1)

    def test_prizes_go_straight_to_storage(self):
        self.send("store_add_items", json.dumps([SWORDSMAN, SWORDSMAN, TOWER]))
        self.assertEqual(self.map["store"], {str(SWORDSMAN): 2, str(TOWER): 1})

    def test_selling_from_storage(self):
        self.map["store"] = {str(TOWER): 2}
        self.send("sell_stored_item", TOWER, TOWN)
        self.assertEqual(self.map["stone"], 625 // 20)
        self.assertEqual(self.map["store"], {str(TOWER): 1})

    def test_some_things_sell_for_nothing(self):
        self.map["store"] = {str(WAREHOUSE): 1, str(DOCK): 1}
        cash = self.save["playerInfo"]["cash"]
        self.send("sell_stored_item", WAREHOUSE, TOWN)  # bought with cash
        self.send("sell_stored_item", DOCK, TOWN)
        self.assertEqual((self.save["playerInfo"]["cash"], self.map["coins"]), (cash, 0))
        self.assertEqual(self.map["store"], {})

    def test_nothing_to_sell(self):
        self.send("sell_gift", TOWER, TOWN)
        self.assertEqual(self.map["stone"], 0)


if __name__ == "__main__":
    unittest.main()
