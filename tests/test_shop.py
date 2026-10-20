"""
Buying: replays the commands the game client sends when the player pays for
something.

Run from the repository folder:  python -m unittest discover tests
"""

import json
import os
import tempfile
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import economy
import sessions
from command import command, do_command
from get_game_config import MORE_BARRACKS, get_game_config, get_item_from_id as get_game_config_item
from paths import ASSETS_DIR as ASSETS

GRYPHON_BARRACKS, GRYPHON_KNIGHT = 1223, 700

BARRACKS_III, SWORDSMAN, VILLAGER, SPEARMAN, ROYAL_SWORDSMAN = 40, 511, 500, 509, 608
TOWER, SACRIFICE_ALTAR = 33, 225
TOWN = 0
X, Y = 60, 60  # an empty spot in a new village


class ShopTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][TOWN]
        self.pState = self.save["privateState"]
        self.map.update(coins=10000, food=10000, wood=10000, stone=10000, xp=0)
        self.save["playerInfo"]["cash"] = 500
        self.pState["mana"] = 0

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def batch(self, *commands):
        command(self.pid, {"ts": 0, "first_number": 0, "accessToken": "", "tries": 0, "publishActions": 0,
                           "commands": [{"cmd": cmd, "args": list(args)} for cmd, *args in commands]})

    def cash(self):
        return self.save["playerInfo"]["cash"]

    def on_map(self, item_id):
        return [item for item in self.map["items"] if item[0] == item_id]

    # Placing and training

    def test_a_building_keeps_its_orientation(self):
        self.send("buy", TOWER, X, Y, 1, TOWN, 0, 1, "b")
        self.assertEqual(self.on_map(TOWER)[0][:4], [TOWER, X, Y, 1])  # before, always 0
        self.assertEqual(self.map["stone"], 10000 - 625)
        self.assertEqual(self.map["xp"], 63)

    def test_training_also_costs_food(self):
        self.map["items"].append([BARRACKS_III, 40, 40, 0, 0, 0])
        self.send("buy", SWORDSMAN, X, Y, 0, TOWN, 0, 1, "u")
        self.assertEqual(self.map["coins"], 10000 - 90)
        self.assertEqual(self.map["food"], 10000 - 180)  # twice the gold; before, none
        self.assertEqual(self.map["xp"], 9)

    def test_the_blacksmith_discount_rounds_up(self):
        self.map["items"].append([BARRACKS_III, 40, 40, 0, 0, 0])
        self.send("buy", SWORDSMAN, X, Y, 0, TOWN, 0, 0.9, "u")
        self.assertEqual(self.map["coins"], 10000 - 81)
        self.assertEqual(self.map["food"], 10000 - 162)

    def test_villagers_cost_only_food(self):
        self.send("buy", VILLAGER, X, Y, 0, TOWN, 0, 1, "u")  # the Town Hall trains them
        self.assertEqual((self.map["coins"], self.map["food"]), (10000, 10000 - 50))

    def test_the_barracks_the_game_never_sold_are_in_the_shop(self):
        items = {int(item["id"]): item for item in get_game_config()["items"]}
        for barracks in MORE_BARRACKS:
            item = items[barracks]
            self.assertEqual((item["in_store"], item["type"]), ("1", "b"), item["name"])
            self.assertEqual(items[int(item["trains"])]["type"], "u", item["name"])
            self.assertTrue(os.path.exists(os.path.join(ASSETS, "buildingsprites", item["img_name"] + ".swf")), item["name"])
        self.assertEqual(items[1328]["in_store"], "0")  # Necro Shark Barracks: no picture in the game's files

    def test_a_gryphon_barracks_bought_for_cash_trains_for_gold(self):
        price = int(get_game_config_item(GRYPHON_BARRACKS)["cost"])
        self.send("buy", GRYPHON_BARRACKS, 40, 40, 0, TOWN, 0, 1, "b")
        self.assertEqual(self.cash(), 500 - price)
        self.send("buy", GRYPHON_KNIGHT, X, Y, 0, TOWN, 0, 1, "u")
        self.assertEqual(self.map["coins"], 10000 - int(get_game_config_item(GRYPHON_KNIGHT)["cost"]))
        self.assertEqual(len(self.on_map(GRYPHON_KNIGHT)), 1)

    def test_a_unit_from_elsewhere_costs_no_food(self):
        # No barracks here: the unit came from somewhere else, like a quest prize.
        self.send("buy", SWORDSMAN, X, Y, 0, TOWN, 0, 1, "u")
        self.assertEqual(self.map["food"], 10000)

    def test_free_items_cost_nothing(self):
        self.send("buy", TOWER, X, Y, 0, TOWN, 1, 1, "b")
        self.assertEqual((self.map["stone"], self.map["xp"]), (10000, 0))
        self.assertEqual(len(self.on_map(TOWER)), 1)

    # Cash

    def test_training_with_cash(self):
        self.send("buy_cash", SWORDSMAN, X, Y, 1, TOWN)
        self.assertEqual(self.cash(), 499)
        self.assertEqual(self.map["xp"], 9)
        self.assertEqual(self.on_map(SWORDSMAN)[-1][:4], [SWORDSMAN, X, Y, 1])

    def test_a_hero_with_no_altar_goes_to_storage(self):
        self.batch(("store_add_items", json.dumps([ROYAL_SWORDSMAN])),
                   ("buy_cash", ROYAL_SWORDSMAN, 300, 200, 0, TOWN))  # the shop window's position
        self.assertEqual(self.on_map(ROYAL_SWORDSMAN), [])
        self.assertEqual(self.map["store"], {str(ROYAL_SWORDSMAN): 1})
        self.assertEqual(self.cash(), 498)

    def test_an_offer_pack(self):
        self.send("buy_offer_pack", TOWN, 1)
        self.assertEqual(self.cash(), 500 - economy.cash_price(25))  # the game's 25, shrunk
        self.assertEqual([self.map[k] for k in ("coins", "stone", "food", "wood", "xp")],
                         [15000, 15000, 15000, 15000, 500])
        self.assertEqual(self.map["store"], {"27": 1, "550": 1, "555": 1})

    def test_an_offer_pack_with_mana(self):
        self.send("buy_offer_pack", TOWN, 7)
        self.assertEqual(self.pState["mana"], 50)

    def test_a_pack_with_a_prize_draw(self):
        self.send("buy_offer_pack", TOWN, 11, 662)
        self.assertEqual(self.map["store"], {"662": 1})
        self.assertEqual(self.cash(), 500 - economy.cash_price(60))

    def test_a_prize_the_pack_does_not_have(self):
        self.send("buy_offer_pack", TOWN, 11, TOWER)
        self.assertEqual((self.map["store"], self.cash()), ({}, 500))

    def test_a_super_offer_pack(self):
        self.send("buy_super_offer_pack", TOWN, 65, "2016,2042", 1)  # the client's price is not used
        self.assertEqual(self.cash(), 500 - economy.cash_price(100))  # two prizes: the second price
        self.assertEqual(self.map["store"], {"2016": 1, "2042": 1})
        self.assertEqual(self.pState["mana"], 5)
        self.assertEqual(self.map["xp"], 0)  # shown but not given, as in the client
        self.assertEqual(self.pState["gifts"], [])

    def test_a_super_offer_packs_four_prizes_cost_its_third_price(self):
        # One of the rarest row and three of the others, as the game's third choice gives.
        self.send("buy_super_offer_pack", TOWN, 65, "2016,2042,2042,2042", 1)
        self.assertEqual(self.cash(), 500 - economy.cash_price(200))
        self.assertEqual(self.map["store"], {"2016": 1, "2042": 3})

    def test_a_super_offer_pack_with_three_prizes_is_no_choice_of_the_box(self):
        self.send("buy_super_offer_pack", TOWN, 65, "2016,2042,2042", 1)
        self.assertEqual((self.map["store"], self.cash()), ({}, 500))

    def test_a_super_offer_pack_with_a_stranger(self):
        self.send("buy_super_offer_pack", TOWN, 65, f"2016,{TOWER}", 100)
        self.assertEqual((self.map["store"], self.cash()), ({}, 500))

    def test_the_merchants_deal(self):
        self.send("add_items_store", json.dumps([TOWER, SWORDSMAN]), 7)
        self.assertEqual(self.cash(), 493)
        self.assertEqual(self.map["store"], {str(TOWER): 1, str(SWORDSMAN): 1})

    # Unit collections

    def test_a_missing_unit_bought_for_a_collection(self):
        self.send("buy_stored_item_cash", TOWN, SPEARMAN, 1)
        self.assertEqual(self.cash(), 499)
        self.assertEqual(self.map["store"], {str(SPEARMAN): 1})
        self.assertIn(SPEARMAN, self.pState["boughtUnits"])

    def test_a_collection_unit_at_a_made_up_price(self):
        self.send("buy_stored_item_cash", TOWN, SPEARMAN, 0)
        self.assertEqual(self.cash(), 499)  # the config's price

    def test_a_finished_unit_collection(self):
        self.send("unit_collections_completed", 1)
        self.assertEqual(self.cash(), 501)
        self.assertEqual(self.pState["gifts"], [0] * ROYAL_SWORDSMAN + [1])
        self.send("unit_collections_completed", 1)  # only once
        self.assertEqual(self.cash(), 501)

    # Giving back

    def test_the_sacrifice_altar(self):
        altar = [SACRIFICE_ALTAR, X, Y, 0, 1234, 0, [SWORDSMAN, SPEARMAN], {}]
        self.map["items"].append(altar)
        self.send("pop_sell", X, Y, TOWN, SACRIFICE_ALTAR, SWORDSMAN)
        self.assertEqual(self.map["coins"], 10000 + 90 // 20)
        self.assertEqual(altar[6], [SPEARMAN])
        self.assertEqual(altar[4], 1234)
        self.send("pop_sell", X, Y, TOWN, SACRIFICE_ALTAR, SPEARMAN)
        self.assertEqual((altar[6], altar[4]), ([], 0))
        self.send("pop_sell", X, Y, TOWN, SACRIFICE_ALTAR, SPEARMAN)  # nothing left to give
        self.assertEqual(self.map["coins"], 10000 + 90 // 20 + 30 // 20)

    def test_the_golden_dragon(self):
        self.send("gold_statue_conversion", 10)
        self.assertEqual(self.map["coins"], 10010)


if __name__ == "__main__":
    unittest.main()
