"""
Where cash comes from (economy.py): the game config shows the numbers the
server pays, and each level pays its prize once (levels.py).

Run from the repository folder:  python -m unittest discover tests
"""

import json
import os
import tempfile
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import levels
import sessions
from bundle import VILLAGES_DIR
from command import do_command
from get_game_config import get_game_config, get_xp_from_level
from version import migrate_loaded_save

TOWN = 0
ISLANDS = get_game_config()["globals"]["ISLE_ORDER"]


class ConfigTest(unittest.TestCase):
    """What the client shows, from the game config."""

    def test_level_prizes(self):
        levels = get_game_config()["levels"]
        self.assertEqual([(r["reward_type"], r["reward_amount"]) for r in levels[1:4]],
                         [("w", 50), ("f", 50), ("w", 400)])  # levels 2 to 4: the game's own
        shown = {n: levels[n - 1]["reward_amount"] for n in (5, 6, 9, 10, 15, 20, 99, 100)}
        self.assertEqual(shown, {5: 5, 6: 2, 9: 2, 10: 10, 15: 5, 20: 10, 99: 2, 100: 10})
        self.assertTrue(all(r["reward_type"] == "c" for r in levels[4:]))
        self.assertEqual(sum(r["reward_amount"] for r in levels[4:50]), 147)  # levels 5 to 50

    def test_the_daily_and_monday_bonus(self):
        globals = get_game_config()["globals"]
        self.assertEqual([(d["type"], d["qty"]) for d in globals["DAILY_BONUS_CONFIG"]],
                         [("g", 250), ("hero", 1), ("c", 2), ("hero", 1), ("c", 5)])
        self.assertIn({"type": "c", "value": 10}, globals["MONDAY_BONUS_REWARDS"])

    def test_continent_prizes_where_the_client_looks(self):
        rows = get_game_config()["level_ranking_reward"]
        for continent in range(1, 51):
            row = rows[50 - continent]  # the row the client shows on reaching it
            self.assertEqual(int(row["level"]), continent)  # the row the server pays
        cash = {n: rows[50 - n]["cash"] for n in (1, 2, 11, 12, 21, 41, 42, 50)}
        self.assertEqual(cash, {1: 0, 2: 5, 11: 5, 12: 10, 21: 10, 41: 20, 42: 25, 50: 25})

    def test_the_reload_text(self):
        texts = {t["id"]: t["text"] for t in get_game_config()["localization_strings"] if isinstance(t, dict)}
        self.assertEqual(texts[1430], "Updating your empire")

    def test_the_island_window_tells_of_the_3_star_prize(self):
        texts = {t["id"]: t["text"] for t in get_game_config()["localization_strings"] if isinstance(t, dict)}
        self.assertEqual(texts[498], "Choose difficulty (first 3 stars: 5 cash)")


class LevelsTest(unittest.TestCase):
    """What the server pays."""

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][TOWN]
        self.save["playerInfo"]["cash"] = 0
        self.map.update(wood=0, food=0)

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def cash(self):
        return self.save["playerInfo"]["cash"]

    def test_a_new_town_is_paid_up_to_level_one(self):
        self.assertEqual(self.map["levelPaid"], 1)

    def test_each_level_up_pays_its_prize_once(self):
        for level in (2, 3, 4, 5, 6):
            self.send("rt_level_up", level)
        self.send("rt_level_up", 6)  # sent twice
        self.assertEqual((self.map["wood"], self.map["food"]), (450, 50))
        self.assertEqual(self.cash(), 5 + 2)
        self.assertEqual(self.map["levelPaid"], 6)

    def test_the_score_at_start_pays_a_level_up_the_server_missed(self):
        self.map.update(level=9, levelPaid=9, xp=get_xp_from_level(8))
        self.send("rt_publish_score", get_xp_from_level(10))  # the xp where level 11 starts
        self.assertEqual(self.map["level"], 11)
        self.assertEqual(self.cash(), 10 + 2)
        self.send("rt_level_up", 10)
        self.send("rt_level_up", 11)  # the same levels again: nothing more
        self.assertEqual(self.cash(), 12)

    def test_a_score_that_goes_down_and_up_again_pays_once(self):
        self.map.update(level=9, levelPaid=9, xp=get_xp_from_level(8))
        self.send("rt_level_up", 10)
        self.send("rt_publish_score", get_xp_from_level(8))  # back to level 9
        self.send("rt_level_up", 10)
        self.assertEqual(self.cash(), 10)

    def test_levels_gained_on_a_quest(self):
        self.map.update(level=19, levelPaid=19, xp=get_xp_from_level(18))
        self.send("end_quest", json.dumps({"map": TOWN, "quest_id": 100000001, "win": 0, "units": [],
                                           "resources": {"g": 0, "x": get_xp_from_level(20) - self.map["xp"]}}))
        self.assertEqual(self.map["level"], 21)
        self.assertEqual(self.cash(), 10 + 2)

    def test_level_100_is_the_last(self):
        self.map.update(level=99, levelPaid=99)
        self.send("rt_level_up", 100)
        self.assertEqual(levels.reached(self.save, self.map, 101), "")
        self.assertEqual(self.cash(), 10)
        self.assertEqual(self.map["levelPaid"], 100)


class BackPayTest(unittest.TestCase):
    """Saves from before levels were paid get the prizes of the levels reached, once."""

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def older_save(self, *levels):
        with open(os.path.join(VILLAGES_DIR, "initial.json")) as f:
            save = json.load(f)
        save["version"] = "0.05a"
        save["playerInfo"]["cash"] = 3
        town = save["maps"][0]
        save["maps"] = [dict(json.loads(json.dumps(town)), level=level, wood=0, food=0) for level in levels]
        return save

    def test_the_levels_already_reached(self):
        save = self.older_save(12, 3)
        mana = save["privateState"].get("mana")
        self.assertTrue(migrate_loaded_save(save))
        self.assertEqual(save["playerInfo"]["cash"], 3 + 5 + 2 * 4 + 10 + 2 * 2)  # levels 5 to 12
        self.assertEqual([(m["wood"], m["food"]) for m in save["maps"]], [(450, 50), (50, 50)])
        self.assertEqual([m["levelPaid"] for m in save["maps"]], [12, 3])
        self.assertEqual(save["privateState"].get("mana"), mana)  # mana was paid already
        self.assertFalse(migrate_loaded_save(save))  # once
        self.assertEqual(save["playerInfo"]["cash"], 30)

    def test_then_only_new_levels_pay(self):
        save = self.older_save(12)
        migrate_loaded_save(save)
        pid = sessions.new_village(owner_id=None)
        village = sessions.session(pid)
        village["maps"] = save["maps"]
        village["playerInfo"]["cash"] = 0
        do_command(pid, "rt_level_up", [12])
        do_command(pid, "rt_level_up", [13])
        self.assertEqual(village["playerInfo"]["cash"], 2)


class IslandBackPayTest(unittest.TestCase):
    """Saves from before the 3 star prize get it for the islands already won on 3 stars, once."""

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def older_save(self, ranks):
        with open(os.path.join(VILLAGES_DIR, "initial.json")) as f:
            save = json.load(f)
        save["version"] = "0.06a"
        save["playerInfo"]["cash"] = 3
        save["privateState"]["questsRank"] = ranks
        return save

    def test_the_islands_already_won_on_3_stars(self):
        save = self.older_save({ISLANDS[0]: 3, ISLANDS[1]: 2, ISLANDS[2]: 3, "999999999": 3})
        self.assertTrue(migrate_loaded_save(save))
        self.assertEqual(save["playerInfo"]["cash"], 3 + 5 + 5)  # not the 2 star one, nor one that isn't an island
        self.assertFalse(migrate_loaded_save(save))  # once
        self.assertEqual(save["playerInfo"]["cash"], 13)

    def test_older_saves_with_a_list_of_ranks(self):
        save = self.older_save([])
        self.assertTrue(migrate_loaded_save(save))
        self.assertEqual(save["playerInfo"]["cash"], 3)

    def test_a_strange_rank_does_not_stop_the_server(self):
        save = self.older_save({ISLANDS[0]: None, ISLANDS[1]: "3", ISLANDS[2]: "three"})
        self.assertTrue(migrate_loaded_save(save))
        self.assertEqual(save["playerInfo"]["cash"], 3 + 5)

    def test_then_only_new_islands_pay(self):
        save = self.older_save({ISLANDS[0]: 3, ISLANDS[1]: 2})
        migrate_loaded_save(save)
        pid = sessions.new_village(owner_id=None)
        village = sessions.session(pid)
        village["privateState"]["questsRank"] = save["privateState"]["questsRank"]
        village["playerInfo"]["cash"] = 0
        for island in ISLANDS[:2]:
            result = {"map": TOWN, "resources": {}, "units": [], "win": 1, "quest_id": island, "difficulty": 3}
            do_command(pid, "end_quest", [json.dumps(result)])
        self.assertEqual(village["playerInfo"]["cash"], 5)  # only the island that had 2 stars


if __name__ == "__main__":
    unittest.main()
