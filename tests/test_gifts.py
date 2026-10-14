"""
Gifts between friends (gifts.py): a free gift a day for each friend, from
the game's gift list by level; things given from storage; the inbox, taken
into an empire's gift box from the Friends page or the game's own window.

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
import gifts
import inventory
import sessions

HOUSE, TREE, SCORPION, COW = 1, 100, 520, 504


def send_form(web, path, page="/friends", **fields):
    token = re.search(r'name="csrf" value="([^"]+)"', web.get(page).get_data(as_text=True)).group(1)
    return web.post(path, data=dict(fields, csrf=token))


def text(reply):
    return html.unescape(reply.get_data(as_text=True))


def gift_box(pid) -> dict:
    box = inventory.gifts(sessions.session(pid))
    return {int(k): v for k, v in (box.items() if isinstance(box, dict) else enumerate(box)) if v}


class GiftsTest(unittest.TestCase):

    def setUp(self):
        server.app.config["TESTING"] = True
        server.signups.seen.clear()

    def player(self):
        """A new player with one empire: browser, username, account id, empire id."""
        web = server.app.test_client()
        name = f"g{time.time_ns() % 10**15}"
        send_form(web, "/register", page="/", username=name, password=name + "-password")
        send_form(web, "/new", page="/", PLAYER="ruffle")
        user_id = accounts.authenticate(name, name + "-password")["id"]
        return web, name, user_id, sessions.villages_of(user_id)[0]["userid"]

    def friends(self, *players):
        for i, a in enumerate(players):
            for b in players[i + 1:]:
                sessions.storage().add_friendship(a[2], b[2])
        import friends
        friends.load(sessions.storage())

    def window(self, player, **post):
        """The game's own gifts window: its JSON reply (and status)."""
        web, _, _, pid = player
        if not post:
            reply = web.get(f"/gifts/game?empire={pid}")
        else:
            web.get("/ruffle.html")  # the game page, which gives the window its form token
            with web.session_transaction() as cookie:
                token = cookie.get("csrf")
            reply = web.post(f"/gifts/game?empire={pid}", data=dict(post, csrf=token))
        return reply.get_json(), reply.status_code

    # The gift list

    def test_the_gift_list_opens_with_the_level(self):
        level1 = {g["id"] for g in gifts.free_list(1)}
        self.assertIn(HOUSE, level1)
        self.assertIn(TREE, level1)
        self.assertNotIn(SCORPION, level1)
        everything = gifts.free_list(30)
        self.assertIn(SCORPION, {g["id"] for g in everything})
        self.assertEqual(len({g["name"] for g in everything}), len(everything))  # each name once
        self.assertEqual(gifts.next_free(29)["name"], "Scorpion")
        self.assertIsNone(gifts.next_free(30))

    # Free gifts, from the Friends page

    def test_a_free_gift_a_day_for_each_friend(self):
        alice, bob, carol = self.player(), self.player(), self.player()
        self.friends(alice, bob)
        reply = send_form(alice[0], "/gifts/send", friend=bob[2], item=HOUSE)
        self.assertIn(f"House I is on its way to {bob[1]}", text(reply))
        reply = send_form(alice[0], "/gifts/send", friend=bob[2], item=TREE)
        self.assertEqual(reply.status_code, 400)
        self.assertIn("today's free gift already", text(reply))
        self.assertIn("Today's gift sent", text(alice[0].get("/friends")))

        reply = send_form(alice[0], "/gifts/send", friend=carol[2], item=HOUSE)  # not a friend
        self.assertIn("Gifts go to friends", text(reply))
        self.friends(alice, carol)
        reply = send_form(alice[0], "/gifts/send", friend=carol[2], item=SCORPION)  # level 30
        self.assertIn("isn't open to you yet", text(reply))

        with mock.patch.object(gifts, "_today", return_value=gifts._today() + gifts.DAY):  # tomorrow
            reply = send_form(alice[0], "/gifts/send", friend=bob[2], item=TREE)
        self.assertEqual(reply.status_code, 200)
        self.assertEqual([g["name"] for g in gifts.waiting(bob[2])], ["House I", "Yellow Tree"])

    def test_taking_gifts_on_the_friends_page(self):
        alice, bob, carol = self.player(), self.player(), self.player()
        self.friends(alice, bob, carol)
        send_form(alice[0], "/gifts/send", friend=bob[2], item=HOUSE)
        reply = send_form(carol[0], "/gifts/send", friend=bob[2], item=COW)  # a Cow opens at level 8
        self.assertIn("isn't open to you yet", text(reply))
        send_form(carol[0], "/gifts/send", friend=bob[2], item=TREE)
        page = text(bob[0].get("/friends"))
        self.assertIn(f"from {alice[1]}", page)
        self.assertIn('class="badge"', text(bob[0].get("/")))

        first = gifts.waiting(bob[2])[0]["id"]
        reply = send_form(bob[0], "/gifts/take", gift=first, empire=bob[3])
        self.assertIn(f"House I from {alice[1]}", text(reply))
        self.assertEqual(gift_box(bob[3]).get(HOUSE), 1)
        self.assertIn(f"House I from {alice[1]} is in your Gifts and Storage",
                      sessions.session(bob[3])["privateState"]["message"])  # the game says so when it starts
        self.assertEqual(send_form(bob[0], "/gifts/take", gift=first, empire=bob[3]).status_code, 400)  # once

        reply = send_form(bob[0], "/gifts/take", gift="all", empire=alice[3])  # not his empire
        self.assertIn("Pick one of your empires", text(reply))
        send_form(bob[0], "/gifts/take", gift="all", empire=bob[3])
        self.assertEqual(gift_box(bob[3]).get(TREE), 1)
        self.assertEqual(gifts.waiting(bob[2]), [])

    def test_a_gift_from_a_player_who_left(self):
        alice, bob = self.player(), self.player()
        self.friends(alice, bob)
        send_form(alice[0], "/gifts/send", friend=bob[2], item=HOUSE)
        sessions.delete_account(alice[2])
        self.assertEqual([g["sender"] for g in gifts.waiting(bob[2])], ["A player who left"])
        send_form(bob[0], "/gifts/take", gift="all", empire=bob[3])
        self.assertEqual(gift_box(bob[3]).get(HOUSE), 1)

    def test_a_gift_taken_twice_at_once_is_taken_once(self):
        alice, bob = self.player(), self.player()
        sessions.storage().add_friend_gift(alice[2], bob[2], HOUSE, 1, free=True)
        gift_id = gifts.waiting(bob[2])[0]["id"]
        self.assertIsNotNone(sessions.storage().take_friend_gift(bob[2], gift_id))
        self.assertIsNone(sessions.storage().take_friend_gift(bob[2], gift_id))
        self.assertIsNone(sessions.storage().take_friend_gift(alice[2], gift_id))  # nor by someone else

    # The game's own window

    def test_the_game_window(self):
        alice, bob = self.player(), self.player()
        self.friends(alice, bob)
        state, status = self.window(alice)
        self.assertEqual(status, 200)
        self.assertEqual([f["username"] for f in state["friends"]], [bob[1]])
        self.assertIn("House I", [g["name"] for g in state["free"]])

        state, _ = self.window(alice, action="free", friend=bob[2], item=TREE)
        self.assertIn("Yellow Tree is on its way", state["ok"])
        self.assertTrue(state["friends"][0]["sent_today"])
        state, status = self.window(alice, action="free", friend=bob[2], item=HOUSE)
        self.assertEqual(status, 400)
        self.assertIn("already", state["error"])

        state, _ = self.window(bob)
        self.assertEqual([(g["name"], g["sender"]) for g in state["waiting"]], [("Yellow Tree", alice[1])])
        state, _ = self.window(bob, action="take", gift="all")
        self.assertIn("Yellow Tree", state["ok"])
        self.assertEqual(state["waiting"], [])
        self.assertEqual(gift_box(bob[3]).get(TREE), 1)
        self.assertNotIn("Yellow Tree", sessions.session(bob[3])["privateState"].get("message") or "")  # seen in the window already

    def test_giving_from_storage(self):
        alice, bob = self.player(), self.player()
        self.friends(alice, bob)
        save = sessions.session(alice[3])
        inventory.add_gift(save, COW, 2)
        inventory.add_stored(save, 0, COW, 1)
        state, _ = self.window(alice)
        self.assertIn({"id": COW, "name": "Cow", "count": 3}, state["storage"])

        state, status = self.window(alice, action="give", friend=bob[2], item=COW, count=4)
        self.assertEqual(status, 400)
        self.assertIn("don't have that many", state["error"])
        state, _ = self.window(alice, action="give", friend=bob[2], item=COW, count=3)
        self.assertIn(f"3 × Cow is on its way to {bob[1]}", state["ok"])
        self.assertNotIn(COW, inventory.held(sessions.session(alice[3]), 0))
        self.assertEqual([(g["item"], g["count"], g["free"]) for g in gifts.waiting(bob[2])], [(COW, 3, 0)])

        inventory.add_gift(save, COW, 1)
        stranger = self.player()
        state, status = self.window(alice, action="give", friend=stranger[2], item=COW, count=1)
        self.assertIn("Gifts go to friends", state["error"])
        self.assertEqual(inventory.held(sessions.session(alice[3]), 0).get(COW), 1)  # still there

    def test_only_your_own_empires_window(self):
        alice, bob = self.player(), self.player()
        reply = alice[0].get(f"/gifts/game?empire={bob[3]}")
        self.assertEqual(reply.status_code, 403)

    def test_the_game_hears_when_gifts_wait(self):
        alice, bob = self.player(), self.player()
        self.friends(alice, bob)
        send_form(bob[0], "/play", page="/", USERID=bob[3], PLAYER="ruffle")
        self.assertIn("&showInitialGift=0&", bob[0].get("/ruffle.html").get_data(as_text=True))
        send_form(alice[0], "/gifts/send", friend=bob[2], item=HOUSE)
        page = bob[0].get("/ruffle.html").get_data(as_text=True)
        self.assertIn("&showInitialGift=1&", page)
        self.assertIn("window.gotoInitialGifts", page)
        self.assertNotIn('"gotoGifts"', page)  # no longer one of the calls that do nothing


if __name__ == "__main__":
    unittest.main()
