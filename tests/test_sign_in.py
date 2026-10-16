"""
Signing in with Discord or Google (sign_in.py, through Supabase Auth), the
welcome page of a first visit, and the Settings page: linking and unlinking,
a first password, renaming and deleting your own empires.

Supabase is played by fake_supabase.py, on a local port, so the real
requests go out and the PKCE secret is really checked.

Run from the repository folder:  python -m unittest discover tests
"""

import html
import os
import re
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
from unittest import mock

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import server
import accounts
import config_env
import sessions
import sign_in
from fake_supabase import FakeSupabase, KEY

SIGNED_IN = "Create a new empire"


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def token(web, path="/"):
    return re.search(r'name="csrf" value="([^"]+)"', web.get(path).get_data(as_text=True)).group(1)


def send_form(web, path, page="/", **fields):
    return web.post(path, data=dict(fields, csrf=token(web, page)))


def text(reply):
    return html.unescape(reply.get_data(as_text=True))


class SignInTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.fake = FakeSupabase()

    @classmethod
    def tearDownClass(cls):
        cls.fake.stop()

    def setUp(self):
        server.app.config["TESTING"] = True
        server.signups.seen.clear()
        server.failed_logins.seen.clear()
        settings = mock.patch.multiple(config_env, SUPABASE_URL=self.fake.url, SUPABASE_KEY=KEY)
        settings.start()
        self.addCleanup(settings.stop)
        self.fake.switched_on = {"discord": True, "google": True}
        self.ask_supabase_again()
        self.addCleanup(self.ask_supabase_again)
        self.web = server.app.test_client()

    def ask_supabase_again(self):
        sign_in._switched_on["checked"] = 0

    def name(self, start="s"):
        return f"{start}{time.time_ns() % 10**15}"

    def player(self, name="Tester"):
        """The next player Discord or Google says yes for; their id there."""
        account = str(time.time_ns())
        self.fake.next_player = {"provider_id": account, "name": name, "full_name": name}
        return account

    def approve(self, start_reply):
        """Our server sent the browser to Supabase: "Discord" says yes, and
        Supabase sends the browser back. Where to, as a path on our server."""
        self.assertEqual(start_reply.status_code, 302)
        to_supabase = start_reply.headers["Location"]
        self.assertTrue(to_supabase.startswith(self.fake.url + "/auth/v1/authorize?"), to_supabase)
        try:
            urllib.request.build_opener(_NoRedirect).open(to_supabase)
        except urllib.error.HTTPError as e:
            back = urllib.parse.urlparse(e.headers["Location"])
        self.assertEqual(back.path, "/auth/callback")
        return f"{back.path}?{back.query}"

    def sign_in_with(self, web, provider="discord", link=False):
        """Click the button, get through "Discord", come back: our server's reply."""
        fields = {"link": "1"} if link else {}
        page = "/settings" if link else "/"
        return web.get(self.approve(send_form(web, f"/auth/{provider}", page=page, **fields)))

    def new_player_with(self, provider="discord"):
        """A player who signs up with Discord: their browser, account id and id at Discord."""
        web = server.app.test_client()
        account = self.player()
        self.assertEqual(self.sign_in_with(web, provider).headers["Location"], "/welcome")
        username = self.name("d")
        self.assertEqual(send_form(web, "/welcome", page="/welcome", username=username).status_code, 302)
        return web, accounts.signed_in_with(provider, account)["id"], account

    def registered(self):
        """A player with a username and password: their browser, name and password."""
        web = server.app.test_client()
        username = self.name("p")
        send_form(web, "/register", username=username, password=username + "-password")
        return web, username, username + "-password"

    # The buttons

    def test_buttons_for_what_is_switched_on_in_supabase(self):
        page = text(self.web.get("/"))
        self.assertIn("Continue with Discord", page)
        self.assertIn("Continue with Google", page)

        self.fake.switched_on["google"] = False
        self.ask_supabase_again()
        page = text(self.web.get("/"))
        self.assertIn("Continue with Discord", page)
        self.assertNotIn("Continue with Google", page)
        reply = send_form(self.web, "/auth/google")
        self.assertEqual(reply.headers["Location"], "/")  # not sent to Supabase

        with mock.patch.object(config_env, "SUPABASE_URL", None):  # not set up: passwords only
            page = text(self.web.get("/"))
        self.assertNotIn("Continue with", page)
        self.assertIn("Log in", page)

    # New players and old ones

    def test_a_new_player_with_discord(self):
        account = self.player(name="Brave Knight")
        reply = self.sign_in_with(self.web)
        self.assertEqual(reply.headers["Location"], "/welcome")
        page = text(self.web.get("/welcome"))
        self.assertIn("Signed in with Discord as", page)
        self.assertIn('value="Brave_Knight"', page)  # a username made from their Discord name

        username = self.name("d")
        self.assertEqual(send_form(self.web, "/welcome", page="/welcome", username=username).status_code, 302)
        self.assertIn(SIGNED_IN, text(self.web.get("/")))
        user = accounts.signed_in_with("discord", account)
        self.assertEqual(user["username"], username)
        self.assertFalse(accounts.has_password(user["id"]))
        self.assertIsNone(accounts.authenticate(username, ""))

        # Next time, from another browser: straight in.
        other = server.app.test_client()
        self.player()
        self.fake.next_player["provider_id"] = account
        self.assertEqual(self.sign_in_with(other).headers["Location"], "/")
        self.assertIn(username, text(other.get("/settings")))

    def test_an_old_player_links_discord_on_the_welcome_page(self):
        _, username, password = self.registered()
        account = self.player()
        self.assertEqual(self.sign_in_with(self.web).headers["Location"], "/welcome")
        reply = send_form(self.web, "/welcome", page="/welcome", existing="1", username=username, password="wrong-password")
        self.assertEqual(reply.status_code, 401)
        reply = send_form(self.web, "/welcome", page="/welcome", existing="1", username=username.upper(), password=password)
        self.assertEqual(reply.headers["Location"], "/")
        self.assertEqual(accounts.signed_in_with("discord", account)["username"], username)
        self.assertTrue(accounts.has_password(accounts.signed_in_with("discord", account)["id"]))

    def test_sign_up_rules_count_for_discord_too(self):
        self.player()
        self.sign_in_with(self.web)
        with mock.patch.object(config_env, "ALLOW_REGISTRATION", False):
            reply = send_form(self.web, "/welcome", page="/welcome", username=self.name("d"))
        self.assertEqual(reply.status_code, 400)
        self.assertIn("Sign-ups are closed", text(reply))
        with mock.patch.object(config_env, "INVITE_CODE", "letmein"):
            reply = send_form(self.web, "/welcome", page="/welcome", username=self.name("d"), invite="nope")
            self.assertIn("invite code isn't right", text(reply))
            reply = send_form(self.web, "/welcome", page="/welcome", username=self.name("d"), invite="letmein")
        self.assertEqual(reply.status_code, 302)
        _, username, _ = self.registered()
        self.player()
        self.sign_in_with(self.web)
        reply = send_form(self.web, "/welcome", page="/welcome", username=username.lower())
        self.assertIn("That username is taken", text(reply))

    def test_the_welcome_page_says_where_to_ask_for_a_code(self):
        self.player()
        self.sign_in_with(self.web)
        with mock.patch.object(config_env, "INVITE_CODE", "letmein"), \
                mock.patch.object(config_env, "DISCORD_URL", "https://discord.gg/example"):
            page = text(self.web.get("/welcome"))
        self.assertIn('name="invite"', page)
        self.assertIn('href="https://discord.gg/example"', page)
        self.assertIn("Ask for one on Discord", page)

    # What can go wrong on the way

    def test_a_code_from_another_browser_gets_nothing(self):
        """PKCE: a code stolen on the way, or planted in someone's browser, is
        useless without the secret kept by the browser that asked for it."""
        attacker = server.app.test_client()
        self.player()
        planted = self.approve(send_form(attacker, "/auth/discord"))  # never used by the attacker

        reply = self.web.get(planted)  # this browser never started a sign-in
        self.assertEqual(reply.status_code, 400)
        self.assertIn("began in another browser", text(reply))

        mine = self.approve(send_form(self.web, "/auth/discord"))  # this one did, but gets the other code
        code = urllib.parse.parse_qs(urllib.parse.urlparse(planted).query)["code"][0]
        reply = self.web.get(mine.split("?")[0] + "?code=" + code)
        self.assertEqual(reply.status_code, 400)
        self.assertIn("didn't work", text(reply))
        self.assertNotIn(SIGNED_IN, text(self.web.get("/")))
        self.assertNotIn("Signed in with", text(self.web.get("/welcome", follow_redirects=True)))

    def test_cancelled_or_too_slow(self):
        self.player()
        send_form(self.web, "/auth/discord")
        reply = self.web.get("/auth/callback?error=access_denied&error_description=The+user+denied")
        self.assertEqual(reply.status_code, 400)
        self.assertIn("Signing in with Discord was cancelled", text(reply))

        back = self.approve(send_form(self.web, "/auth/discord"))
        with self.web.session_transaction() as cookie:
            cookie["sign_in"] = dict(cookie["sign_in"], started=int(time.time()) - server.SIGN_IN_TIME - 1)
        self.assertIn("took too long", text(self.web.get(back)))

    # Settings: ways to sign in

    def test_linking_and_unlinking_on_the_settings_page(self):
        web, username, _ = self.registered()
        account = self.player(name="Linked Knight")
        reply = self.sign_in_with(web, link=True)
        self.assertEqual(reply.headers["Location"], "/settings?done=linked-discord")
        page = text(web.get(reply.headers["Location"]))
        self.assertIn("Discord is linked", page)
        self.assertIn("Linked Knight", page)
        self.assertEqual(accounts.signed_in_with("discord", account)["username"], username)

        # The same Discord account can't be linked to a second player.
        other, _, _ = self.registered()
        self.fake.next_player["provider_id"] = account
        reply = self.sign_in_with(other, link=True)
        self.assertEqual(reply.status_code, 400)
        self.assertIn("already linked to another player", text(reply))

        reply = send_form(web, "/settings/unlink/discord", page="/settings")
        self.assertEqual(reply.headers["Location"], "/settings?done=unlinked-discord")
        self.assertIsNone(accounts.signed_in_with("discord", account))

    def test_the_last_way_in_stays_until_there_is_a_password(self):
        web, user_id, account = self.new_player_with("google")
        reply = send_form(web, "/settings/unlink/google", page="/settings")
        self.assertEqual(reply.status_code, 400)
        self.assertIn("Set a password first", text(reply))
        self.assertIn("Set a password", text(web.get("/settings")))

        # No current password to give: it has none.
        reply = send_form(web, "/settings/password", page="/settings", password="", new_password="first-password",
                          repeat_password="first-password")
        self.assertEqual(reply.headers["Location"], "/settings?done=password")
        self.assertTrue(accounts.has_password(user_id))
        self.assertIn("Change your password", text(web.get("/settings")))
        self.assertEqual(send_form(web, "/settings/unlink/google", page="/settings").status_code, 302)
        username = sessions.storage().get_user(user_id)["username"]
        self.assertEqual(accounts.authenticate(username, "first-password")["id"], user_id)

    def test_an_account_deleted_takes_its_ways_in_along(self):
        _, user_id, account = self.new_player_with()
        sessions.delete_account(user_id)
        self.assertIsNone(sessions.storage().find_sign_in("discord", account))

    # Settings: empires

    def test_renaming_and_deleting_your_empires(self):
        web, _, _ = self.registered()
        send_form(web, "/new", PLAYER="ruffle")
        pid = re.search(r'name="USERID" value="([^"]+)"', text(web.get("/"))).group(1)

        reply = send_form(web, f"/settings/empire/{pid}/rename", page="/settings", name="  The   Iron  Keep ")
        self.assertEqual(reply.headers["Location"], "/settings?done=renamed")
        self.assertEqual(sessions.save_info(pid)["name"], "The Iron Keep")
        reply = send_form(web, f"/settings/empire/{pid}/rename", page="/settings", name="x" * 25)
        self.assertEqual(reply.status_code, 400)
        self.assertEqual(sessions.save_info(pid)["name"], "The Iron Keep")

        # Someone else's empire: neither.
        stranger, _, _ = self.registered()
        reply = send_form(stranger, f"/settings/empire/{pid}/rename", page="/settings", name="Mine now")
        self.assertEqual(reply.status_code, 403)
        reply = send_form(stranger, f"/settings/empire/{pid}/delete", page="/settings", confirm="The Iron Keep")
        self.assertEqual(reply.status_code, 403)
        self.assertEqual(sessions.save_info(pid)["name"], "The Iron Keep")

        reply = send_form(web, f"/settings/empire/{pid}/delete", page="/settings", confirm="Iron Keep")
        self.assertEqual(reply.status_code, 400)
        self.assertIsNotNone(sessions.session(pid))
        reply = send_form(web, f"/settings/empire/{pid}/delete", page="/settings", confirm="the iron keep")
        self.assertEqual(reply.headers["Location"], "/settings?done=deleted")
        self.assertIsNone(sessions.session(pid))
        self.assertIn("No empires yet", text(web.get("/settings")))


if __name__ == "__main__":
    unittest.main()
