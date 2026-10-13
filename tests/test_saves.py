"""
Saves: new villages and older saves have every field the game client reads.

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


if __name__ == "__main__":
    unittest.main()
