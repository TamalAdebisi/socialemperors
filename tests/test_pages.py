"""
The web pages around the game: everybody plays the one working client, and
the page knows when an account has already been through Arthur's tutorial,
and the page loads our own copy of Ruffle.

Run from the repository folder:  python -m unittest discover tests
"""

import base64
import hashlib
import os
import re
import tempfile
import time
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import config_env
import server
from command import do_command

GAME_CLIENT = "SocialEmpires0926bsec_comeback.swf"
FULL_SCREEN_LOCKED = "Available after the tutorial"


def send_form(web, path, **fields):
    """Send one of our forms the way a browser does: with the token from the page."""
    page = web.get("/").get_data(as_text=True)
    token = re.search(r'name="csrf" value="([^"]+)"', page).group(1)
    return web.post(path, data=dict(fields, csrf=token))


class PagesTest(unittest.TestCase):

    def setUp(self):
        server.app.config["TESTING"] = True
        self.web = server.app.test_client()
        server.signups.seen.clear()  # every test signs up from the same address
        name = f"p{time.time_ns() % 10**15}"
        send_form(self.web, "/register", username=name, password=name + "-password")

    def new_empire(self):
        send_form(self.web, "/new", PLAYER="ruffle")
        page = self.web.get("/ruffle.html").get_data(as_text=True)
        return re.search(r"&fb_sig_user=([^&]+)&", page).group(1), page

    def test_no_game_version_to_pick(self):
        self.new_empire()
        home = self.web.get("/").get_data(as_text=True)
        self.assertNotIn("GAMEVERSION", home)
        self.assertNotIn("1.4.07", home)
        self.assertNotIn("alpha", home)  # nor our own release name: players don't need it

    def test_everybody_plays_the_working_client(self):
        pid, page = self.new_empire()
        self.assertIn(f"/flash/{GAME_CLIENT}", page)
        # an old form that still asks for another client gets the working one
        reply = send_form(self.web, "/play", USERID=pid, GAMEVERSION="SocialEmpires1.4.07sec.swf", PLAYER="ruffle")
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

    def test_ruffle_comes_from_our_own_files(self):
        _, page = self.new_empire()
        self.assertNotIn("unpkg.com", page)
        src, integrity = re.search(r'<script src="([^"]+/ruffle\.js)"\s+integrity="([^"]+)"', page).groups()
        self.assertTrue(src.startswith(config_env.ASSETS_URL + "/ruffle/"), src)
        folder = os.path.join(server.ASSETS_DIR, "ruffle", src.split("/")[-2])
        # The hash in the page must be our copy's, or browsers refuse to run it.
        with open(os.path.join(folder, "ruffle.js"), "rb") as f:
            digest = base64.b64encode(hashlib.sha384(f.read()).digest()).decode()
        self.assertEqual(integrity, "sha384-" + digest)
        self.assertTrue(os.path.isfile(os.path.join(folder, "LICENSE_MIT")))
        self.assertTrue(os.path.isfile(os.path.join(folder, "LICENSE_APACHE")))
        # A server without R2 hands out the files itself, labelled so browsers can start them.
        self.assertEqual(self.web.get(src).status_code, 200)
        wasm = [name for name in os.listdir(folder) if name.endswith(".wasm")]
        self.assertEqual(len(wasm), 2)  # Ruffle picks the one the browser can run
        self.assertEqual(self.web.get(src.replace("ruffle.js", wasm[0])).mimetype, "application/wasm")


if __name__ == "__main__":
    unittest.main()
