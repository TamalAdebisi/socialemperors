"""
Quest progress: replays the commands the game client sends.

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
from get_game_config import get_game_config

ISLE_ORDER = get_game_config()["globals"]["ISLE_ORDER"]
FIRST, SECOND, THIRD = ISLE_ORDER[0], ISLE_ORDER[1], ISLE_ORDER[2]
GOLEM_ISLAND = "100000003"
SWORDSMAN, ARCHER, HIGH_ELF, GOLEM = 511, 516, 557, 537
TOWN = 0


class QuestsTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][TOWN]
        self.pState = self.save["privateState"]

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def play(self, quest_id, win=True, difficulty=1, gold=0, xp=0, units=(), **extra):
        """A whole quest, the way the client reports it."""
        self.send("start_quest", quest_id, TOWN)
        result = {"map": TOWN, "resources": {"g": gold, "x": xp}, "units": [list(u) for u in units],
                  "win": 1 if win else 0, "duration": 95, "voluntary_end": 0,
                  "quest_id": quest_id, "difficulty": difficulty, **extra}
        self.send("end_quest", json.dumps(result))

    def army(self, unit, count):
        for n in range(count):
            self.map["items"].append([unit, 20 + n, 20, 0, 0, 0])

    def on_map(self, unit):
        return len([item for item in self.map["items"] if item[0] == unit])

    def test_islands_open_one_at_a_time(self):
        self.assertEqual(self.pState["unlockedQuestIndex"], 0)
        self.play(FIRST)
        self.assertEqual(self.pState["unlockedQuestIndex"], 1)  # the second island, not all of them
        self.play(SECOND)
        self.assertEqual(self.pState["unlockedQuestIndex"], 2)

    def test_losing_opens_nothing(self):
        self.play(FIRST, win=False)
        self.assertEqual(self.pState["unlockedQuestIndex"], 0)
        self.assertEqual(self.pState["questsRank"], {})

    def test_replaying_an_old_island_keeps_progress(self):
        self.play(FIRST)
        self.play(SECOND)
        self.play(FIRST, difficulty=2)
        self.assertEqual(self.pState["unlockedQuestIndex"], 2)

    def test_stars(self):
        self.play(FIRST, difficulty=1)
        self.assertEqual(self.pState["questsRank"], {FIRST: 1})
        self.play(FIRST, difficulty=3)
        self.play(FIRST, difficulty=2)  # a lower difficulty never takes stars away
        self.assertEqual(self.pState["questsRank"], {FIRST: 3})

    def test_four_hour_wait_starts_with_the_attack(self):
        before = int(time.time())
        self.send("start_quest", THIRD, TOWN)
        self.assertGreaterEqual(self.map["questTimes"][THIRD], before)

    def test_older_saves_with_a_list_of_times(self):
        self.map["questTimes"] = []
        self.play(FIRST)
        self.assertIn(FIRST, self.map["questTimes"])

    def test_gold_and_xp(self):
        coins, xp = self.map["coins"], self.map["xp"]
        self.play(FIRST, gold=2500, xp=250)
        self.assertEqual((self.map["coins"], self.map["xp"]), (coins + 2500, xp + 250))

    def test_level_follows_xp(self):
        # Level ups during a quest are not sent, so the level is worked out from xp.
        self.map["level"], self.map["xp"] = 1, 0
        self.play(FIRST, xp=1000)
        self.assertGreater(self.map["level"], 1)

    def test_lost_units_leave_the_empire_and_go_to_the_graveyard(self):
        self.army(SWORDSMAN, 5)
        self.army(ARCHER, 3)
        swordsmen, archers = self.on_map(SWORDSMAN), self.on_map(ARCHER)  # the starting village has a few already
        # [unit, sent, killed, recovered]: 4 swordsmen fell and 2 were saved; every archer lived
        self.play(FIRST, units=[(SWORDSMAN, 5, 4, 2), (ARCHER, 3, 0, 0)])
        self.assertEqual(self.on_map(SWORDSMAN), swordsmen - 2)
        self.assertEqual(self.on_map(ARCHER), archers)
        self.assertEqual(self.pState["deadHeroes"], {str(SWORDSMAN): 2})

    def test_free_units_lent_by_the_quest_are_not_lost(self):
        # The client counts lent units as recovered, so killed - recovered comes out at 0 or less.
        self.army(HIGH_ELF, 1)
        elves = self.on_map(HIGH_ELF)
        self.play(FIRST, units=[(HIGH_ELF, 2, 1, 2)])
        self.assertEqual(self.on_map(HIGH_ELF), elves)

    def test_boss_rewards_reach_the_storage(self):
        self.play(GOLEM_ISLAND, item_rewards={str(GOLEM): 1}, activators_left=0)
        self.assertEqual(self.pState["gifts"][GOLEM], 1)

    def test_a_whole_campaign(self):
        for difficulty in (1, 2, 3):
            for quest_id in ISLE_ORDER:
                self.play(quest_id, difficulty=difficulty)
        self.assertEqual(self.pState["unlockedQuestIndex"], len(ISLE_ORDER))
        self.assertEqual(set(self.pState["questsRank"].values()), {3})


if __name__ == "__main__":
    unittest.main()
