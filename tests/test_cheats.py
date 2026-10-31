"""
What a player who edits the game's requests can't get any more (trust.py,
31 October 2026): a unit sold for cash placed for free, bought where nothing
sells it, taken out of a building it never went into, mixed from souls that
can't reach it, or anything bought without the cash. And what the game
itself still does: the nests, the temple once, taming, trained units.

Run from the repository folder:  python -m unittest discover tests
"""

import os
import tempfile
import unittest
from unittest.mock import patch

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import radar
import sessions
import soul_mixer
import temple
from command import do_command
from engine import timestamp_now

TOWN = 0
SUPREME_BAHAMUT, DRAGGY, FURIOUS_DRAGON, STORMY_DRAGON, KING_KONG = 2003, 638, 649, 684, 717
DRAGON_RIDER, STORMY_RIDER = 822, 833  # Stormy Dragon + Dragon Rider I, tamed (the config's DRAGONS)
DRAGON_RIDING, GHOST_BARRACKS, GHOST, SWORDSMAN, TOWER = 1346, 1246, 734, 511, 33
SOUL_MIXER, VALKYRIE, SPEARMAN = 1529, 554, 509


class CheatsTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][TOWN]
        self.pState = self.save["privateState"]
        self.map.update(coins=100000, food=100000, level=40)
        self.save["playerInfo"]["cash"] = 200

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def on_map(self, item_id):
        return [row for row in self.map["items"] if row[0] == item_id]

    def refused(self):
        """The bug radar's count of refused commands (radar.py) so far."""
        return sum(seen["count"] for (kind, _, _), seen in radar.__dict__["__pending"].items() if kind == radar.REFUSED)

    # Placed for free

    def test_no_supreme_bahamut_from_nothing(self):
        before = self.refused()
        self.send("buy", SUPREME_BAHAMUT, 60, 60, 0, TOWN, 1, 1, "u")
        self.assertEqual(self.on_map(SUPREME_BAHAMUT), [])
        self.assertEqual(self.refused(), before + 1, "on the admin page's bug radar")

    def test_the_temple_gives_one_after_its_twelve_offerings_and_wait(self):
        self.pState["templeStep"] = list(range(len(temple.STEPS) - 1))
        self.send("buy", SUPREME_BAHAMUT, 60, 60, 0, TOWN, 1, 1, "u")
        self.assertEqual(self.on_map(SUPREME_BAHAMUT), [], "eleven offerings aren't enough")
        self.pState.update(templeStep=list(range(len(temple.STEPS))), timeStampTemple=timestamp_now() - 3600)
        self.send("buy", SUPREME_BAHAMUT, 60, 60, 0, TOWN, 1, 1, "u")
        self.assertEqual(self.on_map(SUPREME_BAHAMUT), [], "nor before the last wait is over")
        self.pState["timeStampTemple"] = timestamp_now() - temple.WAIT
        self.send("buy", SUPREME_BAHAMUT, 60, 60, 0, TOWN, 1, 1, "u")
        self.send("buy", SUPREME_BAHAMUT, 61, 60, 0, TOWN, 1, 1, "u")
        self.assertEqual(len(self.on_map(SUPREME_BAHAMUT)), 1, "one a ritual")
        self.assertEqual(self.pState["templeStep"], [], "which starts over")

    def test_the_nests_give_their_own_grown_one(self):
        self.pState.update(dragonNumber=1, stepNumber=9)  # the Furious Dragon, a step short
        self.send("buy", FURIOUS_DRAGON, 60, 60, 0, TOWN, 1, 1, "u")
        self.pState["stepNumber"] = 10
        self.send("buy", DRAGGY, 61, 60, 0, TOWN, 1, 1, "u")  # not the one in the nest
        self.assertEqual(self.on_map(FURIOUS_DRAGON) + self.on_map(DRAGGY), [])
        self.send("buy", FURIOUS_DRAGON, 60, 60, 0, TOWN, 1, 1, "u")
        self.assertEqual(len(self.on_map(FURIOUS_DRAGON)), 1)
        self.pState.update(monsterNumber=0, stepMonsterNumber=10)
        self.send("buy", KING_KONG, 62, 60, 0, TOWN, 1, 1, "u")
        self.assertEqual(len(self.on_map(KING_KONG)), 1)

    def test_taming_gives_the_pair_it_took(self):
        self.map["items"].append([DRAGON_RIDING, 50, 50, 0, 0, 0, [DRAGON_RIDER, STORMY_DRAGON], {}])
        self.send("buy", STORMY_RIDER, 60, 60, 0, TOWN, 1, 1, "u")
        self.assertEqual(self.on_map(STORMY_RIDER), [], "not before the pair is taken out")
        self.send("pop_unit", 50, 50, TOWN, DRAGON_RIDER)
        self.send("pop_unit", 50, 50, TOWN, STORMY_DRAGON)
        self.send("buy", STORMY_RIDER, 60, 60, 0, TOWN, 1, 1, "u")
        self.send("buy", STORMY_RIDER, 61, 60, 0, TOWN, 1, 1, "u")
        self.assertEqual(len(self.on_map(STORMY_RIDER)), 1, "one for the pair")

    def test_free_things_not_sold_for_cash_are_still_believed(self):
        self.send("buy", SWORDSMAN, 60, 60, 0, TOWN, 1, 1, "u")  # a camp's prisoner, a recruit...
        self.send("buy", TOWER, 62, 62, 0, TOWN, 1, 1, "b")
        self.assertEqual((len(self.on_map(SWORDSMAN)), len(self.on_map(TOWER))), (1, 1))

    def test_the_test_server_only_says_it_would_refuse(self):
        with patch.dict(os.environ, {"SE_E2E_SEEDING": "1"}):
            self.send("buy", SUPREME_BAHAMUT, 60, 60, 0, TOWN, 1, 1, "u")
        self.assertEqual(len(self.on_map(SUPREME_BAHAMUT)), 1)

    # Bought

    def test_a_cash_unit_only_where_a_building_trains_it(self):
        self.send("buy", SUPREME_BAHAMUT, 60, 60, 0, TOWN, 0, 1, "u")
        self.send("buy", GHOST, 61, 60, 0, TOWN, 0, 1, "u")
        self.assertEqual(self.on_map(SUPREME_BAHAMUT) + self.on_map(GHOST), [])
        self.assertEqual(self.save["playerInfo"]["cash"], 200)
        self.map["items"].append([GHOST_BARRACKS, 40, 40, 0, 0, 0])
        self.send("buy", GHOST, 61, 60, 0, TOWN, 0, 1, "u")
        self.assertEqual(len(self.on_map(GHOST)), 1)
        self.assertLess(self.save["playerInfo"]["cash"], 200, "for its price")

    def test_buying_with_cash(self):
        self.send("buy_cash", SUPREME_BAHAMUT, 60, 60, 0, TOWN)
        self.assertEqual((self.on_map(SUPREME_BAHAMUT), self.save["playerInfo"]["cash"]), ([], 200))
        self.send("buy_cash", SWORDSMAN, 61, 60, 0, TOWN)  # a gold unit, for its cash price: as before
        self.assertEqual(len(self.on_map(SWORDSMAN)), 1)

    def test_nothing_without_the_cash(self):
        self.save["playerInfo"]["cash"] = 1
        self.map["items"].append([GHOST_BARRACKS, 40, 40, 0, 0, 0])
        self.send("buy", GHOST, 61, 60, 0, TOWN, 0, 1, "u")
        self.send("buy_cash", 608, 62, 60, 0, TOWN)  # the Royal Swordsman: 2 cash
        land = self.map["expansions"][:]
        self.send("expand", 18, "cash", TOWN)
        self.send("activate_monster", "c")
        self.assertEqual(self.on_map(GHOST) + self.on_map(608), [])
        self.assertEqual(self.map["expansions"], land)
        self.assertEqual(self.save["playerInfo"]["cash"], 1, "and nothing taken")

    # Out of a building

    def test_into_a_building_only_what_stands_there(self):
        self.map["items"].append([TOWER, 50, 50, 0, 0, 0, [], {}])
        self.send("push_unit", 40, 40, SUPREME_BAHAMUT, 50, 50, TOWN)  # none stands at (40, 40)
        self.send("pop_unit", 50, 50, TOWN, SUPREME_BAHAMUT, 52, 50, 0)
        self.assertEqual(self.on_map(SUPREME_BAHAMUT), [])
        self.map["items"].append([FURIOUS_DRAGON, 40, 40, 0, 0, 0])
        self.send("push_unit", 40, 40, FURIOUS_DRAGON, 50, 50, TOWN)
        self.send("pop_unit", 50, 50, TOWN, FURIOUS_DRAGON, 52, 50, 0)
        self.assertEqual([row[:3] for row in self.on_map(FURIOUS_DRAGON)], [[FURIOUS_DRAGON, 52, 50]], "in and out again")

    def test_out_of_a_building_only_what_went_in(self):
        self.map["items"].append([TOWER, 50, 50, 0, 0, 0, [FURIOUS_DRAGON], {}])
        self.send("pop_unit", 50, 50, TOWN, SUPREME_BAHAMUT, 52, 50, 0)
        self.send("pop_unit", 70, 70, TOWN, SUPREME_BAHAMUT, 72, 70, 0)  # no building there at all
        self.assertEqual(self.on_map(SUPREME_BAHAMUT), [])
        self.send("pop_unit", 50, 50, TOWN, FURIOUS_DRAGON, 52, 50, 0)
        self.assertEqual(len(self.on_map(FURIOUS_DRAGON)), 1)
        self.send("pop_unit", 50, 50, TOWN, SWORDSMAN, 53, 50, 0)  # cheaper: one the server missed still comes out
        self.assertEqual(len(self.on_map(SWORDSMAN)), 1)

    # The Soul Mixer

    def test_a_mix_gives_only_what_its_souls_reach(self):
        self.assertTrue(soul_mixer.available(), "the wiki's tables")
        self.map["items"].append([SOUL_MIXER, 55, 55, 0, 0, 0, [SPEARMAN, SPEARMAN], {}])
        self.send("push_queue_unit", 55, 55, SOUL_MIXER, SUPREME_BAHAMUT, 1, 0)
        self.assertEqual(self.pState.get("barracksQueues") or {}, {}, "two spearmen don't make a Supreme Bahamut")
        self.map["items"][-1][6] = [VALKYRIE, VALKYRIE]
        self.send("push_queue_unit", 55, 55, SOUL_MIXER, SUPREME_BAHAMUT, 1, 0)
        self.assertEqual(self.pState.get("barracksQueues") or {}, {}, "nor two Valkyries without power-ups")
        for level in range(7):
            self.send("buy_powerups", level)
        self.send("push_queue_unit", 55, 55, SOUL_MIXER, SUPREME_BAHAMUT, 1, 0)
        self.assertEqual(self.pState["barracksQueues"]["1"]["unit"], SUPREME_BAHAMUT, "with all seven, they can")
        self.assertEqual(self.pState["soulMixerPowerups"], 0, "spent on that mix")


if __name__ == "__main__":
    unittest.main()
