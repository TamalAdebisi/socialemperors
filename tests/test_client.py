"""
The new game client's page (CLIENT.md, step 2): picking it on the home page
opens it, it carries what the client needs to load the town as that empire,
and the server sends the client's files and its sprite sheets.

Run from the repository folder:  python -m unittest discover tests
"""

import json
import os
import re
import tempfile
import time
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import accounts
import config_env
import server


def send_form(web, path, **fields):
    """Send one of our forms the way a browser does: with the token from the page."""
    page = web.get("/").get_data(as_text=True)
    token = re.search(r'name="csrf" value="([^"]+)"', page).group(1)
    return web.post(path, data=dict(fields, csrf=token))


def settings_of(page):
    return json.loads(re.search(r'<script id="se-settings" type="application/json">(.*?)</script>', page, re.S).group(1))


class ClientPageTest(unittest.TestCase):

    def setUp(self):
        # A stand-in for the built client, so these tests don't need Node.
        self.saved_client_dir = server.CLIENT_DIR
        server.CLIENT_DIR = tempfile.mkdtemp(prefix="se-client-dist-")
        with open(os.path.join(server.CLIENT_DIR, "client.js"), "w") as f:
            f.write("start()")
        server.app.config["TESTING"] = True
        self.web = server.app.test_client()
        server.signups.seen.clear()  # every test signs up from the same address
        name = f"c{time.time_ns() % 10**15}"
        send_form(self.web, "/register", username=name, password=name + "-password")

    def tearDown(self):
        server.CLIENT_DIR = self.saved_client_dir

    def test_the_home_page_offers_the_new_client(self):
        self.assertIn('value="client"', self.web.get("/").get_data(as_text=True))

    def test_picking_it_opens_the_new_client(self):
        reply = send_form(self.web, "/new", PLAYER="client")
        self.assertEqual(reply.headers["Location"], "/client.html")
        # and the other choices still open theirs
        self.assertEqual(server.game_page_for("ruffle"), "/ruffle.html")
        self.assertEqual(server.game_page_for("flash"), "/play.html")

    def test_the_page_lets_the_client_load_the_town(self):
        send_form(self.web, "/new", PLAYER="client")
        page = self.web.get("/client.html").get_data(as_text=True)
        self.assertIn('src="/client/client.js"', page)
        settings = settings_of(page)
        self.assertTrue(accounts.check_game_token(settings["userId"], settings["userKey"]))
        self.assertEqual(settings["dynamicUrl"], server.DYNAMIC)
        self.assertEqual(settings["classicUrl"], "/ruffle.html")
        # The client asks for the town the way the Flash client does.
        reply = self.web.post(f"{server.DYNAMIC}/get_player_info.php",
                              data={"USERID": settings["userId"], "user_key": settings["userKey"]})
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply.get_json()["map"]["expansions"], [13])

    def test_a_server_without_the_built_client_says_so(self):
        send_form(self.web, "/new", PLAYER="client")
        os.remove(os.path.join(server.CLIENT_DIR, "client.js"))
        reply = self.web.get("/client.html")
        self.assertEqual(reply.status_code, 503)
        self.assertIn("npm run build", reply.get_data(as_text=True))

    def test_only_for_a_signed_in_player(self):
        self.web.post("/logout", data={"csrf": re.search(
            r'name="csrf" value="([^"]+)"', self.web.get("/").get_data(as_text=True)).group(1)})
        reply = self.web.get("/client.html")
        self.assertEqual(reply.status_code, 302)
        self.assertEqual(reply.headers["Location"], "/")


class ClientFilesTest(unittest.TestCase):

    def setUp(self):
        server.app.config["TESTING"] = True
        self.web = server.app.test_client()
        self.saved = server.CLIENT_DIR, server.ART_DIR
        root = tempfile.mkdtemp(prefix="se-client-")
        server.CLIENT_DIR = os.path.join(root, "dist")
        server.ART_DIR = os.path.join(root, "sheets")
        os.makedirs(os.path.join(server.CLIENT_DIR, "chunks"))
        os.makedirs(server.ART_DIR)
        for path, text in [(os.path.join(server.CLIENT_DIR, "client.js"), "start()"),
                           (os.path.join(server.CLIENT_DIR, "chunks", "init-abc123.js"), "init()"),
                           (os.path.join(server.ART_DIR, "casa1.json"), "{}")]:
            with open(path, "w") as f:
                f.write(text)

    def tearDown(self):
        server.CLIENT_DIR, server.ART_DIR = self.saved

    def get(self, path):
        """The reply and its text, with the file it was read from closed."""
        reply = self.web.get(path)
        text = reply.get_data(as_text=True)
        reply.close()
        return reply, text

    def test_the_main_file_is_checked_for_a_newer_copy_each_time(self):
        reply, text = self.get("/client/client.js")
        self.assertEqual(text, "start()")
        self.assertTrue(reply.cache_control.no_cache)

    def test_parts_named_by_their_contents_are_kept(self):
        reply, text = self.get("/client/chunks/init-abc123.js")
        self.assertEqual(text, "init()")
        self.assertEqual(reply.cache_control.max_age, 31536000)

    def test_sprite_sheets_come_from_this_server_when_it_has_them(self):
        self.assertEqual(server.art_url(), "/art")
        self.assertEqual(self.get("/art/casa1.json")[1], "{}")
        os.remove(os.path.join(server.ART_DIR, "casa1.json"))
        os.rmdir(server.ART_DIR)
        self.assertEqual(server.art_url(), f"{config_env.ASSETS_URL}/art")

    def test_nothing_outside_those_folders(self):
        self.assertEqual(self.get("/client/../../server.py")[0].status_code, 404)
        self.assertEqual(self.get("/art/missing.json")[0].status_code, 404)


if __name__ == "__main__":
    unittest.main()
