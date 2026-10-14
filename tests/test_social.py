"""
Social buildings, helping neighbours and attacking other empires: replays
the commands the game client sends.

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
DAY = 24 * 3600
STONE_MINE = 16      # a social building: 2 helpers at 2 cash
MILL = 6             # makes 300 food a collection
DOCK = 224
SUMMIT = 234         # 9 allies at 3 cash
ALLIED_MARKET = 266  # 8 helpers at 2 cash; 125 for each, plus 125
ROUND_TABLE = 389
SWORDSMAN = 507      # costs 150 gold: worth 75 gold when killed
BUILT_IN_NEIGHBOUR = "1111"  # villages/AcidCaos.json


class Village:
    """A player's village, and a way to send it the client's commands."""

    def __init__(self):
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

    def build(self, item_id, x, y, attrs=None):
        item = [item_id, x, y, 0, timestamp_now(), 0, [], attrs or {}]
        self.map["items"].append(item)
        return item


class SocialBuildingsTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.me = Village()

    def test_hired_helpers_are_paid_for(self):
        mine = self.me.build(STONE_MINE, 20, 20)  # just bought: the client waits for its staff
        self.me.send("buy_si_help", 20, 20, TOWN, STONE_MINE)
        self.me.send("buy_si_help", 20, 20, TOWN, STONE_MINE)
        self.assertEqual(self.me.cash(), 96)
        self.me.send("finish_si", 20, 20, TOWN, STONE_MINE)
        self.assertNotIn("si", mine[7])  # open for good, also after a reload

    def test_an_older_save_still_waiting_for_staff(self):
        mine = self.me.build(STONE_MINE, 20, 20, {"si": [0]})
        self.me.send("buy_si_help", 20, 20, TOWN, STONE_MINE)
        self.assertEqual(mine[7]["si"], [0, 0])
        self.me.send("buy_si_help", 20, 20, TOWN, STONE_MINE)  # no third place
        self.assertEqual(self.me.cash(), 98)
        self.me.send("finish_si", 20, 20, TOWN, STONE_MINE)
        self.assertNotIn("si", mine[7])

    def test_the_dock_is_staffed_for_free(self):
        self.me.build(DOCK, 59, 59)
        self.me.batch(*[("buy_si_help", 59, 59, TOWN, DOCK, 1)] * 20, ("finish_si", 59, 59, TOWN, DOCK))
        self.assertEqual(self.me.cash(), 100)

    def test_the_summit_fills_again_after_each_use(self):
        summit = self.me.build(SUMMIT, 30, 30)
        self.me.batch(*[("buy_si_help", 30, 30, TOWN, SUMMIT)] * 10)  # one more than there is room for
        self.assertEqual((len(summit[7]["si"]), self.me.cash()), (9, 73))
        self.me.send("finish_si", 30, 30, TOWN, SUMMIT)  # 9 allied knights come out (bought by the client)
        self.assertEqual(summit[7]["si"], [])

    def test_the_allied_market_delivers_a_day_later(self):
        market = self.me.build(ALLIED_MARKET, 40, 40)
        self.me.send("set_resource_allies", "w", 40, 40, TOWN, ALLIED_MARKET)
        self.assertEqual(self.me.map["resourceAlliesMarket"], "w")
        self.me.batch(("buy_si_help", 40, 40, TOWN, ALLIED_MARKET), ("buy_si_help", 40, 40, TOWN, ALLIED_MARKET))
        market[4] -= DAY
        wood = self.me.map["wood"]
        self.me.batch(("finish_si", 40, 40, TOWN, ALLIED_MARKET), ("set_resource_allies", "n", 40, 40, TOWN, ALLIED_MARKET))
        self.assertEqual(self.me.map["wood"], wood + 375)
        self.assertEqual((market[7]["si"], self.me.map["resourceAlliesMarket"]), ([], "n"))
        self.assertEqual(self.me.cash(), 96)

    def test_hurrying_the_allied_market(self):
        self.me.build(ALLIED_MARKET, 40, 40)
        self.me.send("set_resource_allies", "s", 40, 40, TOWN, ALLIED_MARKET)
        stone = self.me.map["stone"]
        self.me.send("finish_si", 40, 40, TOWN, ALLIED_MARKET)
        self.assertEqual((self.me.map["stone"], self.me.cash()), (stone + 125, 98))

    def test_the_round_table(self):
        table = self.me.build(ROUND_TABLE, 50, 50, {"si": [1, 2, 3, 4, 5, 6, 7, 8], "sif": {"7": True}})
        gold, xp = self.me.map["coins"], self.me.map["xp"]
        self.me.batch(("finish_si", 50, 50, TOWN, ROUND_TABLE, 1000, 100, 534), ("collect_new", 50, 50, TOWN, ROUND_TABLE))
        self.assertEqual((self.me.map["coins"], self.me.map["xp"]), (gold + 1000, xp + 100))
        self.assertEqual(self.me.map["store"], {"534": 1})
        self.assertEqual((table[7]["si"], table[7]["sif"]), ([], {}))  # sif: {"u" + neighbour: True}

    def test_a_round_table_short_of_knights(self):
        self.me.build(ROUND_TABLE, 50, 50, {"si": [1, 2, 3, 4, 5]})
        gold, xp = self.me.map["coins"], self.me.map["xp"]
        self.me.send("finish_si", 50, 50, TOWN, ROUND_TABLE, 1000, 100, 534)  # claims more than 5 knights earn
        self.assertEqual((self.me.map["coins"], self.me.map["xp"]), (gold + 1000, xp))
        self.assertFalse(self.me.map.get("store"))

    def test_the_wonder_makes_room(self):
        for _ in range(6):
            self.me.send("increase_population", TOWN)
        self.assertEqual(self.me.map["increasedPopulation"], 5)


class NeighbourHelpTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.me, self.friend = Village(), Village()

    def test_helping_a_neighbour(self):
        helped = [[10, 10, MILL], [12, 10, MILL], [14, 10, STONE_MINE]]
        gold, xp = self.me.map["coins"], self.me.map["xp"]
        self.me.send("assist_neighbor_new", self.friend.pid, 0, json.dumps(helped))
        self.assertEqual((self.me.map["coins"], self.me.map["xp"]), (gold + 30, xp + 9))
        self.assertIn("u" + self.friend.pid, self.me.pState["neighborAssists"])
        self.assertEqual(self.friend.map["receivedAssists"], {"u" + self.me.pid: helped})

        self.me.send("assist_neighbor_new", self.friend.pid, 0, json.dumps(helped))  # again the same day
        self.assertEqual(self.me.map["coins"], gold + 30)

    def test_at_most_five_buildings(self):
        gold = self.me.map["coins"]
        self.me.send("assist_neighbor_new", self.friend.pid, 0, json.dumps([[i, 0, MILL] for i in range(8)]))
        self.assertEqual(self.me.map["coins"], gold + 50)

    def test_the_donkey_cart_brings_the_share(self):
        self.friend.map["receivedAssists"] = {"u" + self.me.pid: [[10, 10, MILL]]}
        food, xp = self.friend.map["food"], self.friend.map["xp"]
        self.friend.batch(("assist_receive", TOWN, MILL), ("assist_receive", TOWN, MILL))  # only one was helped
        self.assertEqual((self.friend.map["food"], self.friend.map["xp"]), (food + 75, xp + 10))
        self.friend.send("clean_received_assists", self.me.pid, TOWN)
        self.assertEqual(self.friend.map["receivedAssists"], {})

    def test_the_cart_delivers_after_it_was_let_in(self):
        # As the Flash client sends it: the cart is let in (clean) before it delivers.
        self.friend.map["receivedAssists"] = {"u" + self.me.pid: [[10, 10, MILL]]}
        food = self.friend.map["food"]
        self.friend.send("clean_received_assists", self.me.pid, TOWN)
        self.assertEqual(self.friend.map["receivedAssists"], {})
        self.friend.batch(("assist_receive", TOWN, MILL), ("assist_receive", TOWN, MILL))
        self.assertEqual(self.friend.map["food"], food + 75)  # once
        self.assertEqual(self.friend.map["assistsOnTheWay"], {}, "that cart is done")

    def test_helping_a_village_that_ships_with_the_game(self):
        built_in = sessions.neighbor_session(BUILT_IN_NEIGHBOUR)
        before = json.dumps(built_in)
        gold = self.me.map["coins"]
        self.me.send("assist_neighbor_new", BUILT_IN_NEIGHBOUR, 0, json.dumps([[10, 10, MILL]]))
        self.assertEqual(self.me.map["coins"], gold + 10)
        self.assertEqual(json.dumps(built_in), before)

    def test_no_helping_yourself(self):
        gold = self.me.map["coins"]
        self.me.send("assist_neighbor_new", self.me.pid, 0, json.dumps([[10, 10, MILL]]))
        self.assertEqual(self.me.map["coins"], gold)

    def test_the_older_help_request(self):
        gold, xp = self.me.map["coins"], self.me.map["xp"]
        self.me.send("assist_neighbor", self.friend.pid, 7, TOWN)
        self.assertEqual((self.me.map["coins"], self.me.map["xp"]), (gold + 10, xp + 3))


class AttackTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.me, self.enemy = Village(), Village()
        for x in range(3):
            self.me.build(SWORDSMAN, 30 + x, 30)

    def report(self, win, gold=0, xp=0, honor=0, killed=0, recovered=0, victim=None):
        return json.dumps({
            "attacker": {"name": "Me", "level": 5, "user_id": self.me.pid, "world_id": 0, "map": TOWN, "race": "h"},
            "victim": victim or {"user_id": self.enemy.pid, "name": "Enemy", "level": 5, "map": "0", "race": "h"},
            "resources": {"g": gold, "x": xp},
            "resources_victim": {"g": 0},
            "attacker_units": [[SWORDSMAN, 3, killed, recovered]],
            "victim_units": [],
            "win": win, "duration": 60, "voluntary_end": 0, "townhall_gold": 500, "honor": honor,
        })

    def swordsmen(self):
        return sum(1 for item in self.me.map["items"] if item[0] == SWORDSMAN)

    def test_a_won_attack(self):
        gold, xp = self.me.map["coins"], self.me.map["xp"]
        self.me.batch(("attack_player", self.enemy.pid), ("end_attack", self.report(1, 25000, 40, 4, killed=2, recovered=1)))
        self.assertEqual((self.me.map["coins"], self.me.map["xp"]), (gold + 20000, xp + 40))  # at most 20000 gold
        self.assertEqual(self.swordsmen(), 2)
        self.assertEqual(self.me.pState["deadHeroes"], {str(SWORDSMAN): 1})
        self.assertEqual((self.me.pState["attacksWon"], self.me.pState["honor"]), (1, 4))
        sent = self.me.pState["attacksSent"][-1]
        self.assertEqual((sent["victim_id"], sent["description"]["win"]), (self.enemy.pid, 1))

        received = self.enemy.pState["attacksReceived"][-1]
        self.assertEqual((received["attacker_id"], received["viewPending"]), (self.me.pid, 1))
        self.assertEqual(received["description"]["win"], 0)
        self.assertEqual(received["description"]["oponent"]["name"], "Me")
        self.enemy.send("clean_attacks")
        self.assertNotIn("viewPending", self.enemy.pState["attacksReceived"][-1])

    def test_a_lost_attack_pays_the_defender(self):
        coins = self.enemy.map["coins"]
        self.me.batch(("attack_player", self.enemy.pid), ("end_attack", self.report(0, 150, 8, 2, killed=3)))
        self.assertEqual(self.enemy.map["coins"], coins + 3 * 8)  # a tenth of 75 gold each, rounded up
        self.assertEqual(self.me.pState["attacksLost"], 1)
        self.assertEqual(self.swordsmen(), 0)

    def test_an_enemy_without_a_town_hall(self):
        gold = self.me.map["coins"]
        self.me.send("end_attack", self.report(1, 500, 25, 3), True)
        self.assertEqual((self.me.map["coins"], self.me.pState["honor"]), (gold, 0))

    def test_an_island_counts_only_for_its_rival(self):
        # Before the town has rivals on the world map (tests/test_worlds.py), no battle beats an island.
        victim = {"user_id": BUILT_IN_NEIGHBOUR, "posicion": 3, "nivel": 1, "name": "AcidCaos", "level": 5}
        self.me.send("end_attack", self.report(1, 100, 5, 1, victim=victim))
        self.assertEqual(self.me.map["universAttackWin"], [])
        self.assertEqual(self.me.pState["worldChange"], 0)
        self.me.pState["worldChange"] = 1
        self.me.send("reset_world_change")
        self.assertEqual(self.me.pState["worldChange"], 0)

    def test_spying_messages_and_pings(self):
        self.me.send("spy_player", self.enemy.pid)
        self.assertEqual(self.me.pState["spyings"][-1]["victim_id"], self.enemy.pid)
        self.me.pState["message"] = "Welcome back!"
        self.me.send("clear_message")
        self.assertEqual(self.me.pState["message"], "")
        self.me.send("ping", 2)


if __name__ == "__main__":
    unittest.main()
