"""
Missions, the troll raids at home, and other small things the client asks
the server to remember: replays the commands the game client sends.

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

TRAIN_VILLAGER = 2  # a mission worth 10 gold
CASTLE_II, STABLES_III = 28, 46  # levels 10 and 20
TOWN = 0


class MissionsTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][TOWN]
        self.pState = self.save["privateState"]
        self.map.update(coins=0, xp=0, food=0, stone=0)
        self.save["playerInfo"]["cash"] = 100

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def cash(self):
        return self.save["playerInfo"]["cash"]

    def test_a_mission_reached_and_rewarded_once(self):
        self.send("complete_mission", TRAIN_VILLAGER, 0)
        self.send("complete_mission", TRAIN_VILLAGER, 0)
        self.assertEqual(self.pState["completedMissions"], [TRAIN_VILLAGER])
        self.send("reward_mission", TOWN, TRAIN_VILLAGER)
        self.send("reward_mission", TOWN, TRAIN_VILLAGER)
        self.assertEqual(self.pState["rewardedMissions"], [TRAIN_VILLAGER])
        self.assertEqual(self.map["coins"], 10)
        self.assertEqual(self.cash(), 100)

    def test_skipping_a_mission_costs_cash(self):
        self.send("complete_mission", TRAIN_VILLAGER, 1)
        self.assertEqual(self.cash(), 98)  # before, nothing

    def test_a_raid_remembers_what_it_spawned(self):
        self.send("set_quest_var", TOWN, "spawned", "true")
        self.send("set_quest_var", TOWN, "boss", json.dumps([[540, 10, 12]]))
        self.assertEqual(self.map["currentQuestVars"], {"spawned": True, "boss": [[540, 10, 12]]})

    def test_progress_sent_after_the_chest_is_not_kept_for_the_next_raid(self):
        # As the Flash client sends it for the Atlantis treasure (raid 26): the
        # chest, then the last activators.
        self.send("set_quest_var", TOWN, "spawned", "true")
        self.send("set_quest_var", TOWN, "activators", json.dumps(["1", "2", "3"]))
        self.send("collect_treasure", 750, 100, 27, 0, 0, TOWN)
        self.send("set_quest_var", TOWN, "activators", json.dumps(["1", "2", "3", "4"]))
        self.assertEqual(self.map["currentQuestVars"], {})
        # The next raid starts, and its own progress is kept.
        self.send("set_quest_var", TOWN, "spawned", "true")
        self.send("set_quest_var", TOWN, "boss", json.dumps([[540, 10, 12]]))
        self.assertEqual(self.map["currentQuestVars"], {"spawned": True, "boss": [[540, 10, 12]]})

    def test_the_treasure_at_the_end_of_a_raid(self):
        self.map["currentQuestVars"] = {"spawned": True}
        before = int(time.time())
        self.send("collect_treasure", 250, 50, 4, 0, 0, TOWN)
        self.assertEqual((self.map["coins"], self.map["xp"]), (250, 50))
        self.assertEqual(self.map["idCurrentTreasure"], 4)
        self.assertGreaterEqual(self.map["timestampLastTreasure"], before)  # the 4-hour wait
        self.assertEqual(self.map["currentQuestVars"], {})  # the next raid starts afresh

    def test_moving_the_raids_along_is_not_a_treasure(self):
        self.send("collect_treasure", 0, 0, 10, 0, 0, TOWN)
        self.assertEqual(self.map["idCurrentTreasure"], 10)
        self.assertEqual(self.map["timestampLastTreasure"], 0)

    def test_no_treasure_is_bigger_than_the_client_gives(self):
        self.send("collect_treasure", 99999, 99999, 5, 0, 0, TOWN)
        self.assertEqual((self.map["coins"], self.map["xp"]), (750, 100))

    def test_unlocking_a_building_early(self):
        self.send("unlock_building", str(CASTLE_II))
        self.send("unlock_building", str(STABLES_III))
        self.assertEqual(self.cash(), 100 - 4 - 7)  # a third of the level, rounded up
        self.assertEqual(self.pState["unlockedEarlyBuildings"], {str(CASTLE_II): True, str(STABLES_III): True})
        self.send("unlock_building", str(CASTLE_II))
        self.assertEqual(self.cash(), 89)

    def test_the_team_for_the_islands(self):
        self.send("set_attack_team", "quest", json.dumps([511, 511, 0, 0]))
        self.assertEqual(self.pState["teams"]["quest"], [511, 511, 0, 0])

    def test_tips_already_shown(self):
        self.pState["infoShowed"] = []  # as older saves have it
        self.send("set_info_showed", "market", True)
        self.send("set_help_map", "helpSurvival")
        self.send("set_help_map", "helpSurvival")
        self.assertEqual(self.pState["infoShowed"], {"market": True})
        self.assertEqual(self.pState["helpMap"], ["helpSurvival"])


if __name__ == "__main__":
    unittest.main()
