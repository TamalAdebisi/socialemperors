"""
Arthur's tutorial: a reload partway through doesn't start it over, and once
an account has been through it, none of its empires starts it again.

Run from the repository folder:  python -m unittest discover tests
"""

import os
import tempfile
import time
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import sessions
from command import do_command
from get_player_info import get_player_info


def new_account():
    return sessions.storage().create_user(f"t{time.time_ns() % 10**15}", "not-a-real-hash")


class TutorialTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.account = new_account()
        self.first = sessions.new_village(self.account)

    def lessons(self, pid, upto):
        for lesson in range(1, upto + 1):  # what the client reports as Arthur moves on
            do_command(pid, "complete_tutorial", [lesson])

    def where(self, pid):
        """What the client reads when the empire opens: 0 starts the tutorial."""
        return int(get_player_info(pid)["playerInfo"]["completed_tutorial"])

    def test_a_new_empire_starts_with_arthur(self):
        self.assertEqual(self.where(self.first), 0)
        self.assertFalse(sessions.save_info(self.first)["tutorial_done"])

    def test_all_of_arthurs_lessons(self):
        self.lessons(self.first, 14)
        self.assertEqual(self.where(self.first), 14)
        do_command(self.first, "complete_tutorial", [15])  # "Congratulations" closed
        self.assertEqual(self.where(self.first), 15)
        self.assertTrue(sessions.save_info(self.first)["tutorial_done"])
        self.assertEqual(sessions.session(self.first)["privateState"]["dragonNestActive"], 1)

    def test_a_reload_partway_through_carries_on(self):
        self.lessons(self.first, 6)
        self.assertEqual(self.where(self.first), 6)  # not 0: the client doesn't start it over
        do_command(self.first, "complete_tutorial", [2])  # a late report never goes back
        self.assertEqual(self.where(self.first), 6)

    def test_a_new_empire_after_the_tutorial(self):
        self.lessons(self.first, 15)
        second = sessions.new_village(self.account)
        self.assertEqual(self.where(second), 15)
        self.assertTrue(sessions.save_info(second)["tutorial_done"])

    def test_a_new_empire_after_part_of_it(self):
        self.lessons(self.first, 3)
        self.assertEqual(self.where(sessions.new_village(self.account)), 15)

    def test_an_older_empire_of_the_same_account(self):
        second = sessions.new_village(self.account)  # made before the tutorial was done
        self.lessons(self.first, 15)
        self.assertEqual(self.where(second), 15)

    def test_other_accounts_still_get_arthur(self):
        self.lessons(self.first, 15)
        self.assertEqual(self.where(sessions.new_village(new_account())), 0)
        self.assertEqual(self.where(sessions.new_village(owner_id=None)), 0)

    def test_older_saves_keep_it_as_text(self):
        sessions.session(self.first)["playerInfo"]["completed_tutorial"] = "15"
        self.assertEqual(self.where(sessions.new_village(self.account)), 15)


    def checkpoint(self, step, trees=0):
        do_command(self.first, "complete_tutorial", [step, {"trees": trees}])

    def test_checkpoint_and_tree_count_survive_late_reports(self):
        self.checkpoint(31, 2)
        self.checkpoint(31, 1)
        self.checkpoint(15)
        self.assertEqual(sessions.session(self.first)["privateState"]["tutorial"], {"step": 31, "trees": 2})
        self.assertEqual(self.where(sessions.new_village(self.account)), 0)

    def test_reward_is_one_saved_gift_despite_retries(self):
        self.checkpoint(32, 3)
        for _ in range(3):
            do_command(self.first, "claim_tutorial_reward", [698, [53, 52], [54, 55]])
        save = sessions.session(self.first)
        self.assertEqual(sum(item[0] == 1233 for item in save["maps"][0]["items"]), 1)
        self.assertEqual(sum(item[0] == 698 for item in save["maps"][0]["items"]), 1)
        self.assertEqual(self.where(self.first), 33)
        self.assertEqual(save["privateState"]["stepNumber"], 7)
        self.checkpoint(32, 3)
        self.assertEqual(save["privateState"]["tutorial"]["step"], 33)

    def test_reward_requires_final_trees_and_valid_choice_and_positions(self):
        import copy
        self.checkpoint(31, 2)
        save = sessions.session(self.first)
        before = copy.deepcopy(save)
        do_command(self.first, "claim_tutorial_reward", [698, [53, 52], [54, 55]])
        self.assertEqual(save, before)
        self.checkpoint(32, 3)
        before = copy.deepcopy(save)
        for args in ([999, None, None], [698, [53, 52], [100, 55]], [698, [False, 52], None]):
            do_command(self.first, "claim_tutorial_reward", args)
            self.assertEqual(save, before)

    def test_full_map_rewards_go_to_storage_without_losing_existing_egg(self):
        import inventory
        save = sessions.session(self.first)
        save["maps"][0]["store"] = []
        inventory.add_stored(save, 0, 1233)
        save["privateState"]["stepNumber"] = 9
        self.checkpoint(32, 3)
        do_command(self.first, "claim_tutorial_reward", [710, None, None])
        self.assertEqual(inventory._count(inventory.store(save, 0), 1233), 1)
        self.assertEqual(inventory._count(inventory.store(save, 0), 710), 1)
        self.assertEqual(save["privateState"]["stepNumber"], 9)

    def test_reward_preserves_a_nest_already_in_gifts(self):
        import inventory
        save = sessions.session(self.first)
        inventory.add_gift(save, 1233)
        save["privateState"]["stepNumber"] = 9
        self.checkpoint(32, 3)
        do_command(self.first, "claim_tutorial_reward", [698, [53, 52], [54, 55]])
        self.assertEqual(inventory.held(save, 0).get(1233), 1)
        self.assertFalse(any(item[0] == 1233 for item in save["maps"][0]["items"]))
        self.assertEqual(save["privateState"]["stepNumber"], 9)
        self.assertEqual(self.where(self.first), 33)

    def test_missing_combat_unit_has_one_recovery_knight(self):
        from get_game_config import get_attribute_from_item_id as attr
        save = sessions.session(self.first)
        town = save["maps"][0]
        town["items"] = [item for item in town["items"] if not
            (attr(item[0], "type") == "u" and str(attr(item[0], "race")) == "h"
             and int(attr(item[0], "subcat_functional") or 0) != 71)]
        before = len(town["items"])
        do_command(self.first, "tutorial_knight", [50, 50])
        self.assertEqual(len(town["items"]), before)
        self.checkpoint(11)
        for _ in range(3):
            do_command(self.first, "tutorial_knight", [50, 50])
        self.assertEqual(sum(item[0] == 512 for item in town["items"]), 1)
        self.checkpoint(14)
        do_command(self.first, "tutorial_knight", [51, 50])
        self.assertEqual(sum(item[0] == 512 for item in town["items"]), 1)


if __name__ == "__main__":
    unittest.main()
