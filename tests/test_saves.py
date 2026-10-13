"""
Saves: new villages and older saves have every field the game client reads,
and a finished tutorial stays finished.

Run from the repository folder:  python -m unittest discover tests
"""

import copy
import json
import os
import tempfile
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import sessions
from bundle import VILLAGES_DIR
from command import do_command
from version import migrate_loaded_save, version_code


class SavesTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def check_fields(self, save):
        pState, map = save["privateState"], save["maps"][0]
        self.assertEqual(pState["deadHeroes"], {})
        self.assertEqual(pState["countTimePacket"], [0] * 6)
        self.assertEqual(pState["maps"], [{"r": "h"}])
        self.assertIsInstance(pState["infoShowed"], dict)
        for key in ("questTimes", "store", "currentQuestVars", "warehousedUnits"):
            self.assertEqual(map[key], {}, key)
        self.assertEqual(map["warehouseAditionalCapacitySingle"], 50)
        self.assertEqual(map["resourceAlliesMarket"], "n")

    def test_a_new_village(self):
        self.check_fields(sessions.session(sessions.new_village(owner_id=None)))

    def test_an_older_save(self):
        with open(os.path.join(VILLAGES_DIR, "initial.json")) as f:
            save = json.load(f)
        save["version"] = "0.04a"
        save["privateState"]["countTimePacket"] = [1, 2]
        keep = copy.deepcopy(save["maps"][0]["items"])
        self.assertTrue(migrate_loaded_save(save))
        self.assertEqual(save["version"], version_code)
        self.assertEqual(save["privateState"]["countTimePacket"], [1, 2, 0, 0, 0, 0])
        save["privateState"]["countTimePacket"] = [0] * 6
        self.check_fields(save)
        self.assertEqual(save["maps"][0]["items"], keep)


class TutorialTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)

    def done(self):
        return int(self.save["playerInfo"]["completed_tutorial"])

    def test_arthurs_lessons_then_the_end(self):
        for step in range(15):  # each lesson Arthur gives
            do_command(self.pid, "complete_tutorial", [step])
            self.assertEqual(self.done(), 0, step)  # a reload now starts it again
        do_command(self.pid, "complete_tutorial", [15])  # "Congratulations" closed
        self.assertEqual(self.done(), 15)
        self.assertTrue(sessions.save_info(self.pid)["tutorial_done"])

    def test_a_reload_partway_through(self):
        for step in range(6):
            do_command(self.pid, "complete_tutorial", [step])
        self.assertEqual(self.done(), 0)  # the client starts again from the first lesson
        for step in range(16):
            do_command(self.pid, "complete_tutorial", [step])
        self.assertEqual(self.done(), 15)


if __name__ == "__main__":
    unittest.main()
