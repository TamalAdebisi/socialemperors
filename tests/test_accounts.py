"""
Accounts: changing your password signs out every other browser and game,
every form needs its token, and sign-ups and wrong passwords are limited.

Run from the repository folder:  python -m unittest discover tests
"""

import html
import os
import re
import tempfile
import time
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import server
import accounts
from itsdangerous import URLSafeTimedSerializer
import config_env


def send_form(web, path, **fields):
    """Send one of our forms the way a browser does: with the token from the page."""
    page = web.get("/").get_data(as_text=True)
    token = re.search(r'name="csrf" value="([^"]+)"', page).group(1)
    return web.post(path, data=dict(fields, csrf=token))


SIGNED_OUT = "Log in"
SIGNED_IN = "Create a new empire"


class AccountsTest(unittest.TestCase):

    def setUp(self):
        server.app.config["TESTING"] = True
        server.signups.seen.clear()
        server.failed_logins.seen.clear()
        self.name = f"u{time.time_ns() % 10**15}"
        self.password = self.name + "-password"
        self.web = server.app.test_client()
        send_form(self.web, "/register", username=self.name, password=self.password)
        self.user_id = accounts.authenticate(self.name, self.password)["id"]

    def browser(self):
        """Another browser signed in to the same account."""
        web = server.app.test_client()
        self.assertEqual(send_form(web, "/login", username=self.name, password=self.password).status_code, 302)
        return web

    def home(self, web):
        return web.get("/").get_data(as_text=True)

    def game(self, web):
        """Open a game page; its empire and game token."""
        send_form(web, "/new", PLAYER="ruffle")
        page = web.get("/ruffle.html").get_data(as_text=True)
        return re.search(r"&fb_sig_user=([^&]+)&", page).group(1), re.search(r"&user_key=([^&]+)&", page).group(1)

    def plays(self, web, pid, key) -> int:
        return web.post(f"{server.DYNAMIC}/get_player_info.php", data={"USERID": pid, "user_key": key}).status_code

    def change(self, current, new, repeat=None):
        """The password form on the Settings page; the page it ends on."""
        page = self.web.get("/settings").get_data(as_text=True)
        token = re.search(r'name="csrf" value="([^"]+)"', page).group(1)
        return self.web.post("/settings/password", follow_redirects=True,
                             data={"csrf": token, "password": current, "new_password": new,
                                   "repeat_password": new if repeat is None else repeat})

    # Changing the password

    def test_changing_the_password(self):
        other = self.browser()
        pid, key = self.game(other)
        self.assertEqual(self.plays(other, pid, key), 200)

        reply = self.change(self.password, "a-new-password")
        self.assertEqual(reply.status_code, 200)
        self.assertIn("Your password is saved", reply.get_data(as_text=True))
        self.assertIn(SIGNED_IN, self.home(self.web))   # this browser stays in
        self.assertIn(SIGNED_OUT, self.home(other))     # the other one is out
        self.assertEqual(self.plays(other, pid, key), 403)  # and so is its game
        self.assertIsNone(accounts.authenticate(self.name, self.password))
        self.assertIsNotNone(accounts.authenticate(self.name, "a-new-password"))
        # a game opened now works
        pid, key = self.game(self.web)
        self.assertEqual(self.plays(self.web, pid, key), 200)

    def test_a_change_that_isnt_right(self):
        for current, new, repeat, why in (
                ("wrong-password", "a-new-password", None, "current password isn't right"),
                (self.password, "a-new-password", "another-password", "aren't the same"),
                (self.password, "short", None, "at least 8"),
                (self.password, self.name.upper(), None, "can't be your username")):
            reply = self.change(current, new, repeat)
            self.assertEqual(reply.status_code, 400, why)
            self.assertIn(why, html.unescape(reply.get_data(as_text=True)))
        self.assertIsNotNone(accounts.authenticate(self.name, self.password))

    def test_the_settings_page_needs_signing_in(self):
        self.assertEqual(server.app.test_client().get("/settings").status_code, 302)
        self.assertIn(self.name, self.web.get("/settings").get_data(as_text=True))
        self.assertEqual(self.web.get("/account").headers["Location"], "/settings")  # its old address

    def test_an_admin_reset_signs_everyone_out(self):
        pid, key = self.game(self.web)
        accounts.new_password(self.user_id)
        self.assertIn(SIGNED_OUT, self.home(self.web))
        self.assertEqual(self.plays(self.web, pid, key), 403)

    def test_cookies_and_games_from_before_stamps(self):
        pid, key = self.game(self.web)
        with self.web.session_transaction() as cookie:
            del cookie["stamp"]
        self.assertIn(SIGNED_OUT, self.home(self.web))
        old_key = URLSafeTimedSerializer(config_env.SECRET_KEY, salt="game-token").dumps(pid)
        self.assertEqual(self.plays(self.web, pid, old_key), 403)

    # Forms

    def test_every_form_needs_its_token(self):
        for path, fields in (("/login", {"username": self.name, "password": self.password}),
                             ("/register", {"username": self.name + "x", "password": self.password}),
                             ("/new", {"PLAYER": "ruffle"}),
                             ("/play", {"USERID": "anything"}),
                             ("/settings/password", {"password": self.password, "new_password": "a-new-password",
                                                     "repeat_password": "a-new-password"}),
                             ("/settings/empire/anything/rename", {"name": "Taken over"}),
                             ("/settings/empire/anything/delete", {"confirm": "My Empire"}),
                             ("/settings/unlink/discord", {}),
                             ("/auth/discord", {}),
                             ("/logout", {})):
            self.assertEqual(self.web.post(path, data=fields).status_code, 400, path)
            reply = self.web.post(path, data=dict(fields, csrf="made-up"))
            self.assertEqual(reply.status_code, 400, path)
            self.assertIn("Please try again", reply.get_data(as_text=True), path)
        self.assertIsNotNone(accounts.authenticate(self.name, self.password))
        self.assertIn(SIGNED_IN, self.home(self.web))

    def test_logging_out(self):
        self.web.get("/logout")  # a link can't sign you out
        self.assertIn(SIGNED_IN, self.home(self.web))
        self.assertEqual(send_form(self.web, "/logout").status_code, 302)
        self.assertIn(SIGNED_OUT, self.home(self.web))

    # Limits

    def test_five_new_accounts_an_hour(self):
        web = server.app.test_client()
        for n in range(4):  # one more than setUp's
            name = f"{self.name}n{n}"
            self.assertEqual(send_form(web, "/register", username=name, password=name + "-pw").status_code, 302)
        name = self.name + "n9"
        reply = send_form(server.app.test_client(), "/register", username=name, password=name + "-pw")
        self.assertEqual(reply.status_code, 429)
        self.assertIsNone(accounts.authenticate(name, name + "-pw"))

    def test_ten_wrong_passwords_then_wait(self):
        web = server.app.test_client()
        for _ in range(10):
            self.assertEqual(send_form(web, "/login", username=self.name, password="wrong-guess").status_code, 401)
        reply = send_form(web, "/login", username=self.name, password=self.password)
        self.assertEqual(reply.status_code, 429)

    def test_guessing_on_the_settings_page_too(self):
        """A browser left signed in can't be used to guess the password."""
        for _ in range(10):
            self.assertEqual(self.change("wrong-guess", "a-new-password").status_code, 400)
        self.assertEqual(self.change(self.password, "a-new-password").status_code, 429)
        self.assertIsNotNone(accounts.authenticate(self.name, self.password))


if __name__ == "__main__":
    unittest.main()
