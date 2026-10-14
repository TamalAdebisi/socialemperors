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


if __name__ == "__main__":
    unittest.main()
