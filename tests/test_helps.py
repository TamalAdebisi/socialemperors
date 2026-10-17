"""
Asking friends for help (helps.py): the game's buttons ask, from the game
page's window; friends answer on the Friends page; their help goes into the
asker's empire, where the game's own commands use it: an hour off a
building's work, steps for the dragon, a place on a social building's staff.

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
import command
import friends
import helps
import sessions
from village import ATTRS, STARTED

GOLD_MINE, SUMMIT, ROUND_TABLE, WONDER, CHURCH = 13, 234, 389, 470, 24


def send_form(web, path, page="/friends", **fields):
    token = re.search(r'name="csrf" value="([^"]+)"', web.get(page).get_data(as_text=True)).group(1)
    return web.post(path, data=dict(fields, csrf=token))


def text(reply):
    return html.unescape(reply.get_data(as_text=True))


class HelpsTest(unittest.TestCase):

    def setUp(self):
        server.app.config["TESTING"] = True
        server.signups.seen.clear()

    def player(self, empire=True):
        """A new player: browser, username, account id, empire id (or None)."""
        web = server.app.test_client()
        name = f"h{time.time_ns() % 10**15}"
        send_form(web, "/register", page="/", username=name, password=name + "-password")
        if empire:
            send_form(web, "/new", page="/", PLAYER="ruffle")
        user_id = accounts.authenticate(name, name + "-password")["id"]
        empires = sessions.villages_of(user_id)
        return web, name, user_id, empires[0]["userid"] if empires else None

    def befriend(self, *players):
        for i, a in enumerate(players):
            for b in players[i + 1:]:
                sessions.storage().add_friendship(a[2], b[2])
        friends.load(sessions.storage())

    def build(self, player, item_id, x, y, started=None):
        """A building in the player's home town; the item list it is."""
        building = [item_id, x, y, 0, started or int(time.time()) - 600, 0, [], {}]
        sessions.session(player[3])["maps"][0]["items"].append(building)
        return building

    def window(self, player, target, **post):
        """The game's Ask friends window, about target: its JSON reply and status."""
        web, _, _, pid = player
        target = {key: str(value) for key, value in target.items()}
        if not post:
            reply = web.get("/help/game", query_string=dict(target, empire=pid))
        else:
            web.get("/ruffle.html")  # the game page, which gives the window its form token
            with web.session_transaction() as cookie:
                token = cookie.get("csrf")
            reply = web.post(f"/help/game?empire={pid}", data=dict(target, csrf=token, **post))
        return reply.get_json(), reply.status_code

    def asked_of(self, player) -> list:
        return helps.asked_of(player[2])

    def answer(self, player, request_id="all"):
        return text(send_form(player[0], "/help/answer", help=request_id))

    def run_command(self, player, cmd, args):
        command.do_command(player[3], cmd, args)

    # An hour off a building's work

    def test_help_to_collect_sooner(self):
        alice, bob = self.player(), self.player()
        self.befriend(alice, bob)
        mine = self.build(alice, GOLD_MINE, 30, 30)
        target = dict(kind="collect", town=0, x=30, y=30, item=GOLD_MINE)

        state, status = self.window(alice, target)
        self.assertEqual(status, 200)
        self.assertEqual(state["what"], "an hour off your Gold Mine I")
        self.assertIn((bob[1], "can"), [(f["username"], f["state"]) for f in state["friends"]])

        state, status = self.window(alice, target, friend=str(bob[2]))
        self.assertEqual(status, 200, state)
        self.assertIn(f"Asked {bob[1]}", state["ok"])
        self.assertEqual(next(f for f in state["friends"] if f["username"] == bob[1])["state"], "asked")
        self.assertIn("asked them already", self.window(alice, target, friend=str(bob[2]))[0]["error"])

        page = text(bob[0].get("/friends"))
        self.assertIn(f"<b>{alice[1]}</b> asks for an hour off their Gold Mine I", page)
        self.assertIn('class="badge"', text(bob[0].get("/")))

        done = self.answer(bob, self.asked_of(bob)[0]["id"])
        self.assertIn(f"You took an hour off {alice[1]}'s Gold Mine I.", done)
        self.assertEqual(mine[ATTRS]["hc"], {"u" + bob[3]: False})
        save = sessions.session(alice[3])
        self.assertIn(f"{bob[1]} took an hour off your Gold Mine I.", save["privateState"]["message"])
        state, _ = self.window(alice, target)
        self.assertEqual(next(f for f in state["friends"] if f["username"] == bob[1])["state"], "helped")
        self.assertEqual(state["answered"], [f"{bob[1]} took an hour off your Gold Mine I"])
        self.assertIn("helped with it already", self.window(alice, target, friend=str(bob[2]))[0]["error"])

        # The game: a click on Bob over the mine spends the hour, once
        started = mine[STARTED]
        self.run_command(alice, "accept_collect_help", [30, 30, 0, GOLD_MINE, bob[3]])
        self.assertEqual(mine[STARTED], started - 3600)
        self.assertNotIn("hc", mine[ATTRS])
        self.run_command(alice, "accept_collect_help", [30, 30, 0, GOLD_MINE, bob[3]])
        self.assertEqual(mine[STARTED], started - 3600)

    def test_a_building_holds_so_much_help(self):
        alice, bob, carol = self.player(), self.player(), self.player()
        self.befriend(alice, bob, carol)
        self.build(alice, GOLD_MINE, 31, 31)
        target = dict(kind="collect", town=0, x=31, y=31, item=GOLD_MINE)
        self.window(alice, target, friend=[str(bob[2]), str(carol[2])])
        with mock.patch.object(helps, "MAX_COLLECT_HELP", 1):
            self.assertIn("You took", self.answer(bob))
            self.assertIn("has all the help it can hold", self.answer(carol))
            self.assertIn("has all the help it can hold", self.window(alice, target)[0]["full"])
        self.assertEqual(self.asked_of(carol), [])  # nothing left to help: the request went

    # The dragon nest

    def test_help_for_the_dragon(self):
        alice, bob = self.player(), self.player()
        self.befriend(alice, bob)
        pState = sessions.session(alice[3])["privateState"]
        pState.update(dragonNestActive=1, stepNumber=3, timeStampTakeCare=1000)
        nest = dict(kind="nest", town=0, x=0, y=0, item=0)
        self.assertIn("Asked", self.window(alice, nest, friend=str(bob[2]))[0]["ok"])
        self.assertIn(f"You moved {alice[1]}'s dragon on two steps.", self.answer(bob))
        self.assertEqual(pState["dragonSocialHelp"], [bob[3]])
        self.assertEqual(pState["dragonHelpSteps"], 2)

        # The nest's window takes Bob's two steps, without their wait, then its own
        self.run_command(alice, "next_step", [0])
        self.run_command(alice, "next_step", [0])
        self.assertEqual((pState["stepNumber"], pState["timeStampTakeCare"]), (5, 1000))
        self.run_command(alice, "finish_dragon_help", [f'["{bob[3]}"]'])
        self.assertEqual((pState["dragonSocialHelp"], pState["dragonHelpSteps"]), ([], 0))
        self.run_command(alice, "next_step", [0])
        self.assertEqual(pState["stepNumber"], 6)
        self.assertGreater(pState["timeStampTakeCare"], 1000)  # its own step: the wait starts again

        pState["dragonNestActive"] = 0
        state, status = self.window(alice, nest, friend=str(bob[2]))
        self.assertEqual(status, 400)
        self.assertIn("dragon nest is closed", state["error"])

    def test_friends_bring_a_dragon_to_its_last_step(self):
        alice = self.player()
        pState = sessions.session(alice[3])["privateState"]
        pState.update(dragonNestActive=1, stepNumber=9, timeStampTakeCare=1000,
                      dragonSocialHelp=["a-friend"], dragonHelpSteps=2)
        self.run_command(alice, "next_step", [0])  # the client stops at the tenth
        self.run_command(alice, "finish_dragon_help", ['["a-friend"]'])
        self.assertEqual((pState["stepNumber"], pState["timeStampTakeCare"], pState["dragonHelpSteps"]), (10, 0, 0))

    # Places at social buildings

    def test_a_place_on_a_staff(self):
        alice, bob = self.player(), self.player()
        self.befriend(alice, bob)
        summit = self.build(alice, SUMMIT, 32, 32)
        target = dict(kind="staff", town=0, x=32, y=32, item=SUMMIT)
        state, _ = self.window(alice, target, friend=str(bob[2]))
        self.assertEqual(state["what"], "a place at your Allies Building")
        self.assertIn(f"You took a place at {alice[1]}'s Allies Building.", self.answer(bob))
        self.assertEqual(summit[ATTRS]["si"], [bob[3]])
        self.assertEqual(next(f for f in self.window(alice, target)[0]["friends"] if f["username"] == bob[1])["state"], "helped")
        self.assertIn("helped with it already", self.window(alice, target, friend=str(bob[2]))[0]["error"])

    def test_the_wonder_takes_a_fifth_at_a_time(self):
        alice = self.player()
        self.build(alice, WONDER, 33, 33)
        self.assertEqual(self.window(alice, dict(kind="staff", town=0, x=33, y=33, item=WONDER))[0]["room"], 4)
        sessions.session(alice[3])["maps"][0]["increasedPopulation"] = 2
        self.assertEqual(self.window(alice, dict(kind="staff", town=0, x=33, y=33, item=WONDER))[0]["room"], 12)

    def test_a_building_that_opens_by_itself(self):
        alice = self.player()
        self.build(alice, CHURCH, 34, 34)
        state, _ = self.window(alice, dict(kind="staff", town=0, x=34, y=34, item=CHURCH))
        self.assertIn("opens when the town loads again", state["opens"])

    def test_the_round_table(self):
        alice, bob, carol = self.player(), self.player(), self.player()
        self.befriend(alice, bob)
        table = self.build(alice, ROUND_TABLE, 35, 35)
        target = dict(kind="staff", town=0, x=35, y=35, item=ROUND_TABLE)

        choices, status = self.window(alice, target)
        self.assertEqual(status, 200, choices)
        self.assertEqual(next(f for f in choices["friends"] if f["username"] == bob[1])["pid"], bob[3])
        no_empire = self.player(empire=False)
        choices, _ = self.window(alice, target)
        self.assertIsNone(next(f for f in choices["friends"] if f["username"] == no_empire[1])["pid"])

        # Its own window picks neighbours by their empire, and tells the server
        state, status = self.window(alice, target, seat=bob[3])
        self.assertEqual(status, 200, state)
        self.assertIn(f"Asked {bob[1]}", state["ok"])
        self.run_command(alice, "assist_send_feed", [35, 35, 0, ROUND_TABLE, bob[3]])
        self.assertEqual(table[ATTRS]["sif"], {"u" + bob[3]: True})
        self.assertIn(f"Asked {carol[1]}", self.window(alice, target, seat=carol[3])[0]["ok"])
        self.assertIn("another player with an account", self.window(alice, target, seat="100000047")[0]["error"])  # a built-in village
        self.assertIn("your own empires", self.window(alice, target, seat=alice[3])[0]["error"])

        self.assertIn(f"You took a seat at {alice[1]}'s Round Table.", self.answer(bob))
        self.assertEqual(table[ATTRS]["si"], [bob[3]])
        self.run_command(alice, "finish_si", [35, 35, 0, ROUND_TABLE, 0, 0, 0])
        self.assertEqual((table[ATTRS]["si"], table[ATTRS]["sif"]), ([], {}))  # a new round

    # Answers that can't be made

    def test_answers_that_cant_be_made(self):
        alice, bob, carol = self.player(), self.player(), self.player()
        nobody = self.player(empire=False)
        self.befriend(alice, bob, carol, nobody)
        mine = self.build(alice, GOLD_MINE, 36, 36)
        target = dict(kind="collect", town=0, x=36, y=36, item=GOLD_MINE)
        self.window(alice, target, friend=[str(bob[2]), str(carol[2]), str(nobody[2])])

        self.assertIn("Make an empire first", self.answer(nobody))
        self.assertEqual(len(self.asked_of(nobody)), 1)  # still there for when they have one
        request_id = self.asked_of(bob)[0]["id"]
        self.assertIn("answered already", self.answer(carol, request_id))  # not theirs

        sessions.session(alice[3])["maps"][0]["items"].remove(mine)  # sold, or put in storage
        self.assertIn("isn't there any more", self.answer(bob))
        self.assertEqual(self.asked_of(bob), [])

        friends.unfriend({"id": carol[2]}, alice[2])
        self.assertIn("isn't there any more", self.answer(carol))  # friendship no longer gates help

    def test_dismissing(self):
        alice, bob = self.player(), self.player()
        self.befriend(alice, bob)
        self.build(alice, GOLD_MINE, 37, 37)
        self.window(alice, dict(kind="collect", town=0, x=37, y=37, item=GOLD_MINE), friend=str(bob[2]))
        reply = send_form(bob[0], "/help/dismiss", help=self.asked_of(bob)[0]["id"])
        self.assertEqual(reply.headers["Location"], "/friends?done=dismissed")
        self.assertEqual(self.asked_of(bob), [])

    def test_everybody_can_help_but_only_from_their_own_empire(self):
        alice, bob, carol = self.player(), self.player(), self.player()
        self.befriend(alice, bob)
        self.build(alice, GOLD_MINE, 38, 38)
        target = dict(kind="collect", town=0, x=38, y=38, item=GOLD_MINE)
        self.assertIn(f"Asked {carol[1]}", self.window(alice, target, friend=str(carol[2]))[0]["ok"])
        reply = carol[0].get("/help/game", query_string=dict({k: str(v) for k, v in target.items()}, empire=alice[3]))
        self.assertEqual(reply.status_code, 403)

    def test_requests_go_with_the_account_or_the_empire(self):
        alice, bob, carol = self.player(), self.player(), self.player()
        self.befriend(alice, bob, carol)
        self.build(alice, GOLD_MINE, 39, 39)
        self.window(alice, dict(kind="collect", town=0, x=39, y=39, item=GOLD_MINE), friend=[str(bob[2]), str(carol[2])])
        sessions.delete_village(alice[3])
        self.assertEqual(self.asked_of(bob), [])
        self.window(bob, dict(kind="nest", town=0, x=0, y=0, item=0), friend=str(carol[2]))
        sessions.delete_account(bob[2])
        self.assertEqual(self.asked_of(carol), [])

    def test_old_requests_go(self):
        alice, bob = self.player(), self.player()
        self.befriend(alice, bob)
        self.window(alice, dict(kind="nest", town=0, x=0, y=0, item=0), friend=str(bob[2]))
        later = time.time() + helps.EXPIRE + 60
        with mock.patch.object(helps.time, "time", return_value=later):
            self.assertEqual(self.asked_of(bob), [])

    # The game page

    def test_the_game_page_answers_the_games_calls(self):
        alice = self.player()
        page = text(alice[0].get("/ruffle.html"))
        for call in ("showPopupSEHelpCollect", "showPopupSEHelpNest", "showPopupSEHelpSocialItem", "showFeedSEHire"):
            self.assertIn(f"window.{call} = function", page)
            self.assertNotIn(f'"{call}"', page)  # not among the calls that do nothing


if __name__ == "__main__":
    unittest.main()
