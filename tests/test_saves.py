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
from paths import VILLAGES_DIR
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
        self.assertEqual(map["universAttackWin"], [])
        self.assertEqual(map["levelPaid"], 1)

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

    def test_a_save_of_this_version_made_before_a_field_was_added(self):
        pid = sessions.new_village(owner_id=None)
        save = sessions.session(pid)
        del save["maps"][0]["resourceAlliesMarket"]
        save["maps"][0]["universAttackWin"] = {}
        sessions.save_session(pid)
        sessions.flush()
        sessions.load_saved_villages()  # the server starts again
        self.check_fields(sessions.session(pid))


    # The monster nest (version.py, open_untouched_monster_nest)

    def test_a_new_empire_can_raise_its_first_monster(self):
        save = sessions.session(sessions.new_village(owner_id=None))
        self.assertEqual(save["privateState"]["monsterNestActive"], 1)
        self.assertEqual(save["privateState"]["monsterNumber"], 0)

    def older_save(self, **nest):
        with open(os.path.join(VILLAGES_DIR, "initial.json")) as f:
            save = json.load(f)
        save["version"] = "0.07a"
        save["privateState"].update({"monsterNestActive": 0, "monsterNumber": 0, "stepMonsterNumber": 0,
                                     "timeStampTakeCareMonster": 0, **nest})
        self.assertTrue(migrate_loaded_save(save))
        return save["privateState"]

    def test_an_older_saves_unused_monster_nest_opens(self):
        self.assertEqual(self.older_save()["monsterNestActive"], 1)

    def test_a_monster_nest_that_raised_all_four_stays_closed(self):
        # desactivate_monster resets the nest with its wait at -1.
        self.assertEqual(self.older_save(timeStampTakeCareMonster=-1)["monsterNestActive"], 0)

    def test_a_monster_nest_in_use_is_left_alone(self):
        pState = self.older_save(monsterNestActive=1, monsterNumber=2, stepMonsterNumber=4, timeStampTakeCareMonster=1760000000)
        self.assertEqual((pState["monsterNestActive"], pState["monsterNumber"], pState["stepMonsterNumber"]), (1, 2, 4))


if __name__ == "__main__":
    unittest.main()
