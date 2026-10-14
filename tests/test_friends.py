"""
Friends (friends.py): asking by username, accepting, declining, taking a
request back, removing a friend, and friends' empires coming first among the
neighbours in the game.

Run from the repository folder:  python -m unittest discover tests
"""

import html
import os
import re
import tempfile
import time
import unittest
from unittest import mock

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import server
import accounts
import config_env
import friends
import sessions


def send_form(web, path, page="/friends", **fields):
    token = re.search(r'name="csrf" value="([^"]+)"', web.get(page).get_data(as_text=True)).group(1)
    return web.post(path, data=dict(fields, csrf=token))


def text(reply):
    return html.unescape(reply.get_data(as_text=True))


class FriendsTest(unittest.TestCase):

    def setUp(self):
        server.app.config["TESTING"] = True
        server.signups.seen.clear()

    def player(self, empire=True):
        """A new player: their browser, username and account id."""
        web = server.app.test_client()
        name = f"f{time.time_ns() % 10**15}"
        send_form(web, "/register", page="/", username=name, password=name + "-password")
        if empire:
            send_form(web, "/new", page="/", PLAYER="ruffle")
        return web, name, accounts.authenticate(name, name + "-password")["id"]

    def befriend(self, a, b):
        web_a, _, id_a = a
        web_b, name_b, id_b = b
        send_form(web_a, "/friends/ask", username=name_b)
        self.assertEqual(send_form(web_b, f"/friends/accept/{id_a}").status_code, 302)

    # Asking and answering

    def test_ask_then_accept(self):
        alice, bob = self.player(), self.player()
        reply = send_form(alice[0], "/friends/ask", username=bob[1].upper())  # any case
        self.assertIn(f"Asked {bob[1]}", text(reply))
        self.assertIn(alice[1], text(bob[0].get("/friends")))   # Bob sees the request
        self.assertIn('class="badge"', text(bob[0].get("/")))   # and a badge on his home page
        self.assertFalse(friends.are_friends(alice[2], bob[2]))

        reply = send_form(bob[0], f"/friends/accept/{alice[2]}")
        self.assertEqual(reply.headers["Location"], "/friends?done=accepted")
        self.assertTrue(friends.are_friends(alice[2], bob[2]))
        self.assertTrue(friends.are_friends(bob[2], alice[2]))
        page = text(alice[0].get("/friends"))
        self.assertIn(bob[1], page)
        self.assertIn("My Empire · level", page)  # their empires show
        self.assertNotIn('class="badge"', text(bob[0].get("/")))

    def test_asking_someone_who_asked_you_is_a_yes(self):
        alice, bob = self.player(), self.player()
        send_form(alice[0], "/friends/ask", username=bob[1])
        reply = send_form(bob[0], "/friends/ask", username=alice[1])
        self.assertIn("friends now", text(reply))
        self.assertTrue(friends.are_friends(alice[2], bob[2]))

    def test_decline_and_take_back(self):
        alice, bob = self.player(), self.player()
        send_form(alice[0], "/friends/ask", username=bob[1])
        self.assertEqual(send_form(bob[0], f"/friends/decline/{alice[2]}").headers["Location"], "/friends?done=declined")
        self.assertFalse(friends.are_friends(alice[2], bob[2]))
        self.assertEqual(send_form(bob[0], f"/friends/accept/{alice[2]}").status_code, 400)  # nothing left to accept

        send_form(alice[0], "/friends/ask", username=bob[1])
        send_form(alice[0], f"/friends/cancel/{bob[2]}")
        self.assertNotIn(alice[1], text(bob[0].get("/friends")))
        self.assertEqual(send_form(bob[0], f"/friends/accept/{alice[2]}").status_code, 400)

    def test_what_cant_be_asked(self):
        alice, bob = self.player(), self.player()
        for username, why in (("nobody_by_that_name", "No player is called that"), (alice[1], "That's you")):
            reply = send_form(alice[0], "/friends/ask", username=username)
            self.assertEqual(reply.status_code, 400)
            self.assertIn(why, text(reply))
        send_form(alice[0], "/friends/ask", username=bob[1])
        self.assertIn("asked " + bob[1] + " already", text(send_form(alice[0], "/friends/ask", username=bob[1])))
        send_form(bob[0], f"/friends/accept/{alice[2]}")
        self.assertIn("friends already", text(send_form(alice[0], "/friends/ask", username=bob[1])))

        with mock.patch.object(friends, "MAX_ASKED", 0):
            reply = send_form(alice[0], "/friends/ask", username=self.player()[1])
        self.assertIn("requests waiting", text(reply))

    def test_remove(self):
        alice, bob = self.player(), self.player()
        self.befriend(alice, bob)
        self.assertEqual(send_form(alice[0], f"/friends/remove/{bob[2]}").headers["Location"], "/friends?done=removed")
        self.assertFalse(friends.are_friends(bob[2], alice[2]))
        self.assertNotIn(alice[1], text(bob[0].get("/friends")))

    def test_the_friends_page_needs_signing_in(self):
        self.assertEqual(server.app.test_client().get("/friends").status_code, 302)
        self.assertEqual(server.app.test_client().get("/friends/news").status_code, 403)

    def test_the_game_bar_shows_whats_waiting(self):
        alice, bob = self.player(), self.player()
        bar = text(bob[0].get("/ruffle.html"))
        self.assertIn('href="/friends" target="_blank"', bar)  # a new tab: the game plays on
        self.assertIn("data-friends-news hidden>0<", bar)       # nothing waiting: no badge
        send_form(alice[0], "/friends/ask", username=bob[1])
        self.assertIn("data-friends-news >1<", text(bob[0].get("/ruffle.html")))
        self.assertIn('aria-label="Friends, 1 waiting"', text(bob[0].get("/ruffle.html")))
        self.assertEqual(bob[0].get("/friends/news").get_json(), {"news": 1})  # what the bar asks while the game is open

    # Friends in the game

    def test_friends_come_first_among_the_neighbours(self):
        alice, bob, carol = self.player(), self.player(), self.player()
        self.befriend(alice, bob)
        pid = sessions.villages_of(alice[2])[0]["userid"]
        bob_pid = sessions.villages_of(bob[2])[0]["userid"]
        carol_pid = sessions.villages_of(carol[2])[0]["userid"]
        with mock.patch.object(config_env, "MAX_NEIGHBORS", 1):  # room for one other player only
            players = [n for n in sessions.friends(pid)]
            neighbours = [str(n["pid"]) for n in sessions.neighbors(pid)]
        self.assertIn(bob_pid, players)          # Bob, as a friend, though not the latest to play
        self.assertIn(bob_pid, neighbours)
        self.assertNotIn(carol_pid, neighbours)  # no room left for the latest stranger
        self.assertEqual(players[0], bob_pid)
        names = {str(n["pid"]): n["name"] for n in sessions.neighbors(pid)}
        self.assertEqual(names[bob_pid], bob[1])  # their username under the portrait, not "Emperor"
        self.assertIn(bob[1], [f["first_name"] for f in sessions.fb_friends_str(pid)])

    def test_friendships_survive_a_restart(self):
        alice, bob = self.player(), self.player()
        self.befriend(alice, bob)
        friends.load(sessions.storage())  # what the server does when it starts
        self.assertTrue(friends.are_friends(alice[2], bob[2]))

    def test_a_deleted_account_leaves_no_friendship_behind(self):
        alice, bob, carol = self.player(), self.player(), self.player()
        self.befriend(alice, bob)
        send_form(alice[0], "/friends/ask", username=carol[1])
        sessions.delete_account(alice[2])
        self.assertNotIn(alice[2], friends.of(bob[2]))
        self.assertEqual(sessions.storage().friends_of(bob[2]), [])
        self.assertEqual(sessions.storage().friend_requests(carol[2])["to_me"], [])


if __name__ == "__main__":
    unittest.main()
