"""
Smaller downloads (compress.py): text goes gzip-compressed to browsers that
can unpack it, and unpacks to exactly what was meant; pictures and sounds go
as they are, and so does everything to a browser that didn't ask.

Run from the repository folder:  python -m unittest discover tests
"""

import gzip
import json
import os
import re
import tempfile
import time
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import server
from get_game_config import get_game_config
from tests.test_client import send_form, settings_of

GZIP = {"Accept-Encoding": "gzip, deflate, br"}


class CompressTest(unittest.TestCase):

    def setUp(self):
        self.saved_client_dir = server.CLIENT_DIR
        server.CLIENT_DIR = tempfile.mkdtemp(prefix="se-client-dist-")
        os.makedirs(os.path.join(server.CLIENT_DIR, "chunks"))
        self.script = "start();\n" + "const town = 'a town of many houses';\n" * 200
        with open(os.path.join(server.CLIENT_DIR, "client.js"), "w") as f:
            f.write(self.script)
        with open(os.path.join(server.CLIENT_DIR, "chunks", "click.mp3"), "wb") as f:
            f.write(b"\xff\xfb" * 2000)
        server.app.config["TESTING"] = True
        self.web = server.app.test_client()
        server.signups.seen.clear()
        name = f"z{time.time_ns() % 10**15}"
        send_form(self.web, "/register", username=name, password=name + "-password")
        send_form(self.web, "/new", PLAYER="client")
        settings = settings_of(self.web.get("/client.html").get_data(as_text=True))
        self.game = {"USERID": settings["userId"], "user_key": settings["userKey"]}

    def tearDown(self):
        server.CLIENT_DIR = self.saved_client_dir

    def test_the_config_goes_packed_and_unpacks_to_itself(self):
        reply = self.web.post(f"{server.DYNAMIC}/get_game_config.php", data=self.game, headers=GZIP)
        self.assertEqual(reply.headers["Content-Encoding"], "gzip")
        self.assertIn("Accept-Encoding", reply.headers["Vary"])
        packed = reply.get_data()
        self.assertLess(len(packed), 300_000, "about 2 MB packs to about 150 KB")
        self.assertEqual(json.loads(gzip.decompress(packed)), json.loads(json.dumps(get_game_config())))
        # The second time, the same bytes (the packed copy was kept).
        again = self.web.post(f"{server.DYNAMIC}/get_game_config.php", data=self.game, headers=GZIP)
        self.assertEqual(again.get_data(), packed)

    def test_a_browser_that_did_not_ask_gets_it_plain(self):
        reply = self.web.post(f"{server.DYNAMIC}/get_game_config.php", data=self.game)
        self.assertNotIn("Content-Encoding", reply.headers)
        self.assertIn("globals", reply.get_json())

    def test_the_client_script_goes_packed_and_can_still_be_checked_for_changes(self):
        reply = self.web.get("/client/client.js", headers=GZIP)
        self.assertEqual(reply.headers["Content-Encoding"], "gzip")
        self.assertEqual(gzip.decompress(reply.get_data()).decode(), self.script)
        etag = reply.headers["ETag"]
        self.assertTrue(etag.startswith('W/"'), etag)
        # Asking whether it changed: no, nothing to download.
        unchanged = self.web.get("/client/client.js", headers=dict(GZIP, **{"If-None-Match": etag}))
        self.assertEqual(unchanged.status_code, 304)

    def test_sounds_and_small_answers_go_as_they_are(self):
        sound = self.web.get("/client/chunks/click.mp3", headers=GZIP)
        self.assertNotIn("Content-Encoding", sound.headers)
        self.assertEqual(sound.get_data(), b"\xff\xfb" * 2000)
        town = self.web.post(f"{server.DYNAMIC}/get_player_info.php", data=self.game, headers=GZIP)
        self.assertEqual(town.status_code, 200)
        info = json.loads(gzip.decompress(town.get_data()) if town.headers.get("Content-Encoding") else town.get_data())
        self.assertEqual(info["map"]["expansions"], [13])


if __name__ == "__main__":
    unittest.main()
