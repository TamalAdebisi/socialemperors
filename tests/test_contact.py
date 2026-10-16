"""
Where players reach the people running the game (SE_DISCORD_URL): with it
set, the pages around the game, the classic game's bar, the new client's
Menu and the sign-up form ("No code? Ask for one on Discord") link to it;
unset, none of them shows anything.

Run from the repository folder:  python -m unittest discover tests
"""

import json
import os
import re
import tempfile
import time
import unittest
from unittest import mock

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import config_env
import server

DISCORD = "https://discord.gg/example"


def send_form(web, path, **fields):
    """Send one of our forms the way a browser does: with the token from the page."""
    page = web.get("/").get_data(as_text=True)
    token = re.search(r'name="csrf" value="([^"]+)"', page).group(1)
    return web.post(path, data=dict(fields, csrf=token))


def settings_of(page):
    return json.loads(re.search(r'<script id="se-settings" type="application/json">(.*?)</script>', page, re.S).group(1))


def links_to_discord(page):
    """The links to the Discord address, each opening in a new tab."""
    return re.findall(rf'<a[^>]*href="{re.escape(DISCORD)}"[^>]*>', page)


class ContactSettingTest(unittest.TestCase):

    def test_only_https_links_are_used(self):
        cases = {
            "https://discord.gg/abc": "https://discord.gg/abc",
            "  https://discord.com/users/123  ": "https://discord.com/users/123",
            "http://discord.gg/abc": None,
            "javascript:alert(1)": None,
            "": None,
        }
        for value, expected in cases.items():
            with mock.patch.dict(os.environ, {"SE_DISCORD_URL": value}):
                self.assertEqual(config_env._https("SE_DISCORD_URL"), expected, value)
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertIsNone(config_env._https("SE_DISCORD_URL"))


class ContactLinkTest(unittest.TestCase):

    def setUp(self):
        # A stand-in for the built client, so these tests don't need Node.
        self.saved_client_dir = server.CLIENT_DIR
        server.CLIENT_DIR = tempfile.mkdtemp(prefix="se-client-dist-")
        with open(os.path.join(server.CLIENT_DIR, "client.js"), "w") as f:
            f.write("start()")
        server.app.config["TESTING"] = True
        server.signups.seen.clear()  # every test signs up from the same address
        self.web = server.app.test_client()
        self.stranger = server.app.test_client()

    def tearDown(self):
        server.CLIENT_DIR = self.saved_client_dir

    def sign_up(self, player="ruffle"):
        name = f"d{time.time_ns() % 10**15}"
        send_form(self.web, "/register", username=name, password=name + "-password")
        send_form(self.web, "/new", PLAYER=player)

    def page(self, web, path):
        reply = web.get(path)
        self.assertEqual(reply.status_code, 200, path)
        return reply.get_data(as_text=True)

    def test_nothing_shows_without_a_link(self):
        with mock.patch.object(config_env, "DISCORD_URL", None):
            with mock.patch.object(config_env, "INVITE_CODE", "letmein"):
                front = self.page(self.stranger, "/")
            self.assertIn('name="invite"', front)
            self.assertNotIn('class="contact"', front)
            self.assertNotIn("Ask for one on Discord", front)
            self.sign_up()
            self.assertNotIn('class="contact"', self.page(self.web, "/"))
            self.assertNotIn('id="discord-button"', self.page(self.web, "/ruffle.html"))
            send_form(self.web, "/new", PLAYER="client")
            self.assertIsNone(settings_of(self.page(self.web, "/client.html"))["discord"])

    def test_the_front_page_says_where_to_ask(self):
        with mock.patch.object(config_env, "DISCORD_URL", DISCORD):
            front = self.page(self.stranger, "/")
            self.assertIn('class="contact"', front)
            self.assertNotIn("Ask for one on Discord", front)  # no code needed, no hint
            with mock.patch.object(config_env, "INVITE_CODE", "letmein"):
                front = self.page(self.stranger, "/")
            self.assertIn("No code?", front)
            self.assertIn("Ask for one on Discord", front)
            with mock.patch.object(config_env, "ALLOW_REGISTRATION", False):
                front = self.page(self.stranger, "/")
            self.assertIn("Sign-ups are closed right now. Questions?", front)
            for link in links_to_discord(front):
                self.assertIn('target="_blank"', link)
                self.assertIn('rel="noopener"', link)

    def test_the_pages_and_the_bars_link_to_it(self):
        with mock.patch.object(config_env, "DISCORD_URL", DISCORD):
            self.sign_up()
            for path in ("/", "/settings", "/friends"):
                self.assertEqual(len(links_to_discord(self.page(self.web, path))), 1, path)
            bar = self.page(self.web, "/ruffle.html")
            self.assertIn('id="discord-button"', bar)
            self.assertEqual(len(links_to_discord(bar)), 1)
            send_form(self.web, "/new", PLAYER="client")
            self.assertEqual(settings_of(self.page(self.web, "/client.html"))["discord"], DISCORD)

    def test_the_link_is_written_safely(self):
        """The address goes into the page as text, never as markup."""
        odd = 'https://discord.gg/x"><script>alert(1)</script>'
        with mock.patch.object(config_env, "DISCORD_URL", odd):
            front = self.page(self.stranger, "/")
        self.assertNotIn("<script>alert(1)</script>", front)
        self.assertIn("https://discord.gg/x&#34;&gt;&lt;script&gt;", front)


if __name__ == "__main__":
    unittest.main()
