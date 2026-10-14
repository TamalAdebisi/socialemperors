"""
The web pages around the game: everybody plays the one working client, and
the page knows when an account has already been through Arthur's tutorial.

Run from the repository folder:  python -m unittest discover tests
"""

import os
import re
import tempfile
import time
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import server
from command import do_command

GAME_CLIENT = "SocialEmpires0926bsec.swf"
FULL_SCREEN_LOCKED = "Available after the tutorial"


class PagesTest(unittest.TestCase):

    def setUp(self):
        server.app.config["TESTING"] = True
        self.web = server.app.test_client()
        name = f"p{time.time_ns() % 10**15}"
        self.web.post("/register", data={"username": name, "password": name + "-password"})

    def new_empire(self):
        self.web.post("/new", data={"PLAYER": "ruffle"})
        page = self.web.get("/ruffle.html").get_data(as_text=True)
        return re.search(r"&fb_sig_user=([^&]+)&", page).group(1), page

    def test_no_game_version_to_pick(self):
        self.new_empire()
        home = self.web.get("/").get_data(as_text=True)
        self.assertNotIn("GAMEVERSION", home)
        self.assertNotIn("1.4.07", home)
        self.assertIn("alpha", home)  # our own release name stays

    def test_everybody_plays_the_working_client(self):
        pid, page = self.new_empire()
        self.assertIn(f"/flash/{GAME_CLIENT}", page)
        # an old form that still asks for another client gets the working one
        reply = self.web.post("/play", data={"USERID": pid, "GAMEVERSION": "SocialEmpires1.4.07sec.swf",
                                             "PLAYER": "ruffle"})
        self.assertEqual(reply.status_code, 302)
        page = self.web.get("/ruffle.html").get_data(as_text=True)
        self.assertIn(f"/flash/{GAME_CLIENT}", page)
        self.assertNotIn("1.4.07", page)

    def test_the_page_knows_the_account_did_the_tutorial(self):
        first, page = self.new_empire()
        self.assertIn(FULL_SCREEN_LOCKED, page)
        do_command(first, "complete_tutorial", [15])
        second, page = self.new_empire()
        self.assertNotIn(FULL_SCREEN_LOCKED, page)


if __name__ == "__main__":
    unittest.main()
