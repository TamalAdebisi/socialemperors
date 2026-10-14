"""
The welcome-back bonus (comeback_bonus.py): a chest on a new player's 2nd
and 3rd day, which the game client offers once tools/patch_client.py has
switched it on.

Run from the repository folder:  python -m unittest discover tests
"""

import hashlib
import json
import os
import re
import sys
import tempfile
import time
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import comeback_bonus
import config_env
import economy
import sessions
from paths import VILLAGES_DIR
from command import do_command
from get_game_config import get_game_config
from version import add_missing_fields

DAY = 24 * 3600
FLASH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "flash")
TOWN = 0


class ComebackBonusTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.made(days_ago=1)

    def made(self, days_ago):
        self.save["maps"][0]["timestamp"] = int(time.time()) - days_ago * DAY

    def chest(self, kind, value, day):
        do_command(self.pid, "comeback_reward", [kind, value, day])

    def opened(self):
        return self.save["privateState"]["comebackBonusCollected"]

    def test_the_day_the_page_tells_the_game(self):
        for days, shown in ((0, 0), (1, 1), (2, 2), (3, 4), (4, 4), (30, 30)):
            self.made(days)
            self.assertEqual(comeback_bonus.page_days(self.save), shown)  # never 3: see page_days()
        del self.save["maps"][0]["timestamp"]
        self.assertGreater(comeback_bonus.page_days(self.save), 3)  # an empire with no date is an old one

    def test_two_chests_once_each(self):
        cash = self.save["playerInfo"]["cash"]
        self.chest("c", 5, 1)
        self.assertEqual(self.save["playerInfo"]["cash"], cash + economy.MONDAY_BONUS_CASH)  # what the client shows
        self.chest("c", 5, 1)
        self.assertEqual(self.save["playerInfo"]["cash"], cash + economy.MONDAY_BONUS_CASH)
        self.made(days_ago=2)
        unit = get_game_config()["globals"]["COMEBACK_BONUS_UNITS"][1]
        self.chest("u", unit, 2)
        self.assertEqual(self.save["maps"][TOWN]["store"], {str(unit): 1})
        self.assertEqual(self.opened(), [1, 2])

    def test_the_config_pays_not_the_client(self):
        coins = self.save["maps"][TOWN]["coins"]
        self.chest("g", 999999, 1)
        self.assertEqual(self.save["maps"][TOWN]["coins"], coins + 2500)

    def test_chests_the_client_cannot_have(self):
        self.made(days_ago=0)
        self.chest("g", 2500, 0)  # day 0 has no chest
        self.chest("g", 2500, 1)  # not tomorrow yet
        self.made(days_ago=3)
        self.chest("g", 2500, 3)  # too late
        self.chest("g", 2500, 1)  # two days behind
        self.made(days_ago=1)
        self.chest("u", 784, 1)   # not the day's unit
        self.chest("x", 99, 1)    # not a prize
        self.assertEqual(self.opened(), [])

    def test_a_page_left_open_past_midnight(self):
        self.made(days_ago=3)
        self.chest("g", 2500, 2)
        self.assertEqual(self.opened(), [2])

    def test_every_save_has_the_list_the_client_reads(self):
        with open(os.path.join(VILLAGES_DIR, "initial.json")) as f:
            older = json.load(f)
        older["privateState"].pop("comebackBonusCollected", None)
        add_missing_fields(older)
        self.assertEqual(older["privateState"]["comebackBonusCollected"], [])
        self.assertEqual(self.opened(), [])  # a new empire too


class PatchedClientTest(unittest.TestCase):
    """The client the page loads is the original with the bonus switched on,
    made by tools/patch_client.py, and nothing else."""

    def test_the_page_loads_the_patched_client(self):
        self.assertEqual(config_env.GAME_CLIENT, "SocialEmpires0926bsec_comeback.swf")

    @unittest.skipUnless(os.path.exists(os.path.join(FLASH, "SocialEmpires0926bsec.swf")), "no assets here")
    def test_the_patched_client_is_the_tools_output(self):
        sys.path.insert(0, os.path.join(os.path.dirname(FLASH), "..", "tools"))
        import patch_client
        with open(os.path.join(FLASH, "SocialEmpires0926bsec.swf"), "rb") as f:
            patched, changes = patch_client.patch(f.read())
        self.assertEqual(len(changes), 3)  # three bytes, the one setting
        with open(os.path.join(FLASH, config_env.GAME_CLIENT), "rb") as f:
            self.assertEqual(hashlib.sha256(f.read()).hexdigest(), hashlib.sha256(patched).hexdigest())


class PageTest(unittest.TestCase):
    """The game page tells the client the empire's day."""

    def test_the_page_sends_the_day(self):
        import server
        server.app.config["TESTING"] = True
        web = server.app.test_client()
        server.signups.seen.clear()

        def send_form(path, **fields):  # with the token from the page, as a browser does
            page = web.get("/").get_data(as_text=True)
            fields["csrf"] = re.search(r'name="csrf" value="([^"]+)"', page).group(1)
            web.post(path, data=fields)

        name = f"c{time.time_ns() % 10**15}"
        send_form("/register", username=name, password=name + "-password")
        send_form("/new", PLAYER="ruffle")
        page = web.get("/ruffle.html").get_data(as_text=True)
        self.assertIn("&daysSinceRegistration=0&", page)  # made today
        self.assertIn(f"/flash/{config_env.GAME_CLIENT}", page)


if __name__ == "__main__":
    unittest.main()
