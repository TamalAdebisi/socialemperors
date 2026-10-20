"""
The admin page and the bug radar: only admins get in, the radar counts what
players' games ask that the server can't do, and an admin can reset a
password, delete an account or an empire for good, and give or take an
empire's cash.

Run from the repository folder:  python -m unittest discover tests
"""

import json
import os
import re
import tempfile
import threading
import time
import unittest
from unittest import mock

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import server
import accounts
import admin
import config_env
import radar
import sessions
import storage
from command import command


def batch(*commands):
    """A batch of commands, as the game client sends them."""
    return {"ts": 0, "first_number": 1, "accessToken": "", "tries": 1, "publishActions": 0,
            "commands": [{"cmd": cmd, "args": args} for cmd, args in commands]}


def send_form(web, path, **fields):
    """Send one of our forms the way a browser does: with the token from the page."""
    page = web.get("/").get_data(as_text=True)
    token = re.search(r'name="csrf" value="([^"]+)"', page).group(1)
    return web.post(path, data=dict(fields, csrf=token))


class AdminTest(unittest.TestCase):

    def setUp(self):
        server.app.config["TESTING"] = True
        server.signups.seen.clear()  # every test signs up from the same address
        self.admin, self.admin_name = self.sign_up("a")
        patch = mock.patch.object(config_env, "ADMINS", {self.admin_name.lower()})
        patch.start()
        self.addCleanup(patch.stop)
        self.player, self.player_name = self.sign_up("p")
        send_form(self.player, "/new", PLAYER="ruffle")
        self.pid = self.player.get("/ruffle.html").get_data(as_text=True).split("&fb_sig_user=")[1].split("&")[0]
        self.player_id = sessions.owner_of(self.pid)

    def sign_up(self, prefix):
        web = server.app.test_client()
        name = f"{prefix}{time.time_ns() % 10**15}"
        send_form(web, "/register", username=name, password=name + "-password")
        return web, name

    def form(self, path, **fields):
        """Send an admin form the way the page does, with its token."""
        page = self.admin.get("/admin/").get_data(as_text=True)
        token = re.search(r'name="csrf" value="([^"]+)"', page).group(1)
        return self.admin.post(path, data=dict(fields, csrf=token))

    def problems(self, **where):
        radar.flush(sessions.storage())
        return [p for p in sessions.storage().list_problems(1000)
                if all(p[key] == value for key, value in where.items())]

    def stored_village(self, pid):
        return sessions.storage()._query("SELECT pid FROM villages WHERE pid = ?", (pid,))

    # Who gets in

    def test_only_admins_see_it(self):
        self.assertEqual(self.player.get("/admin/").status_code, 404)
        self.assertEqual(server.app.test_client().get("/admin/").status_code, 404)  # signed out
        page = self.admin.get("/admin/")
        self.assertEqual(page.status_code, 200)
        self.assertIn("Bug radar", page.get_data(as_text=True))
        self.assertEqual(page.headers["Cache-Control"], "no-store")
        # the player's pages too
        self.assertEqual(self.player.get(f"/admin/empire/{self.pid}").status_code, 404)
        self.assertEqual(self.player.post(f"/admin/account/{self.player_id}/password").status_code, 404)

    def test_nobody_is_an_admin_by_default(self):
        with mock.patch.object(config_env, "ADMINS", set()):
            self.assertEqual(self.admin.get("/admin/").status_code, 404)

    def test_a_form_without_its_token_is_refused(self):
        reply = self.admin.post(f"/admin/account/{self.player_id}/delete", data={"confirm": self.player_name})
        self.assertEqual(reply.status_code, 400)
        reply = self.admin.post(f"/admin/account/{self.player_id}/delete",
                                data={"confirm": self.player_name, "csrf": "made-up"})
        self.assertEqual(reply.status_code, 400)
        self.assertIsNotNone(sessions.session(self.pid))

    # The bug radar

    def test_the_radar_counts_what_the_server_cant_do(self):
        unknown = f"made_up_{time.time_ns()}"
        command(self.pid, batch((unknown, [1, 2])))
        command(self.pid, batch((unknown, [3]), ("buy", [])))
        found = self.problems(name=unknown)
        self.assertEqual(len(found), 1)
        self.assertEqual((found[0]["kind"], found[0]["count"]), (radar.UNHANDLED, 2))
        self.assertEqual((found[0]["last_player"], found[0]["example"]), (self.pid, "[3]"))
        failed = self.problems(kind=radar.FAILED, name="buy", last_player=self.pid)
        self.assertEqual(len(failed), 1)
        self.assertRegex(failed[0]["detail"], r"^IndexError at \w+\.py:\d+$")

        page = self.admin.get("/admin/").get_data(as_text=True)
        self.assertIn(unknown, page)
        self.form("/admin/problems/clear", kind=radar.UNHANDLED, name=unknown, detail="")
        self.assertEqual(self.problems(name=unknown), [])
        self.assertEqual(len(self.problems(kind=radar.FAILED, name="buy", last_player=self.pid)), 1)
        self.form("/admin/problems/clear", all="1")
        self.assertEqual(self.problems(), [])

    def test_the_same_bug_counts_once_whatever_the_values(self):
        for args in ([], [None]):
            command(self.pid, batch(("buy", args)))
        details = {p["detail"] for p in self.problems(kind=radar.FAILED, name="buy", last_player=self.pid)}
        self.assertEqual(len(details), 2)  # an IndexError and a TypeError: two different bugs
        for _ in range(3):
            command(self.pid, batch(("buy", [])))
        index_errors = [p for p in self.problems(kind=radar.FAILED, name="buy", last_player=self.pid)
                        if p["detail"].startswith("IndexError")]
        self.assertEqual(index_errors[0]["count"], 4)

    def test_sync_errors_from_a_real_game(self):
        dynamic = server.DYNAMIC + "/sync_error_track.php"
        web = server.app.test_client()
        web.post(f"{dynamic}?USERID={self.pid}&user_key=forged", data={"error": "made_up"})
        self.assertEqual(self.problems(kind=radar.CLIENT, last_player=self.pid), [])
        key = accounts.make_game_token(self.pid)
        web.post(f"{dynamic}?USERID={self.pid}&user_key={key}", data={"error": "timeout", "tries": "3"})
        found = self.problems(kind=radar.CLIENT, last_player=self.pid)
        self.assertEqual([(p["name"], p["detail"]) for p in found], [("sync_error", "timeout")])

    def test_a_flood_cant_fill_the_server(self):
        radar.flush(sessions.storage())
        with mock.patch.object(radar, "MAX_PENDING", 5):
            for n in range(20):
                radar.note(radar.UNHANDLED, f"flood_{n}")
            radar.note(radar.UNHANDLED, "flood_0")  # one already counted still counts
        flood = sorted((p["name"], p["count"]) for p in self.problems() if p["name"].startswith("flood_"))
        self.assertEqual(flood, [("flood_0", 2), ("flood_1", 1), ("flood_2", 1), ("flood_3", 1), ("flood_4", 1)])

    def test_storage_keeps_a_thousand_at_most(self):
        store = storage.SQLiteStorage(os.path.join(tempfile.mkdtemp(), "radar.db"))
        self.addCleanup(store._conn().close)
        rows = [(radar.UNHANDLED, f"c{n}", "", 1, 0, 0, None, "") for n in range(storage.MAX_PROBLEMS + 5)]
        store.save_problems(rows)
        store.save_problems(rows[:1])  # one already there still counts up
        kept = store.list_problems(10**4)
        self.assertEqual(len(kept), storage.MAX_PROBLEMS)
        self.assertEqual(kept[0]["name"], "c0")
        self.assertEqual(kept[0]["count"], 2)

    # Accounts

    def test_finding_an_account(self):
        page = self.admin.get(f"/admin/?q={self.player_name[3:].upper()}").get_data(as_text=True)
        self.assertIn(f'/admin/account/{self.player_id}"', page)
        page = self.admin.get(f"/admin/account/{self.player_id}").get_data(as_text=True)
        self.assertIn(self.player_name, page)
        self.assertIn(f"/admin/empire/{self.pid}", page)
        self.assertEqual(self.admin.get("/admin/account/999999999").status_code, 404)

    def test_resetting_a_password(self):
        page = self.form(f"/admin/account/{self.player_id}/password").get_data(as_text=True)
        password = re.search(r'class="secret">([^<]+)<', page).group(1)
        self.assertGreaterEqual(len(password), accounts.MIN_PASSWORD)
        self.assertIsNone(accounts.authenticate(self.player_name, self.player_name + "-password"))
        web = server.app.test_client()
        self.assertEqual(send_form(web, "/login", username=self.player_name, password=password).status_code, 302)
        self.assertIn("Your empires", web.get("/").get_data(as_text=True))

    def test_deleting_an_account(self):
        reply = self.form(f"/admin/account/{self.player_id}/delete", confirm="someone else")
        self.assertEqual(reply.status_code, 400)
        self.assertIsNotNone(sessions.session(self.pid))

        reply = self.form(f"/admin/account/{self.player_id}/delete", confirm=self.player_name.upper())
        self.assertEqual(reply.status_code, 302)
        self.assertIsNone(sessions.session(self.pid))
        self.assertIsNone(sessions.storage().get_user(self.player_id))
        self.assertEqual(self.stored_village(self.pid), [])
        sessions.flush()
        self.assertEqual(self.stored_village(self.pid), [])
        # the player's browser is signed out, and their game stops
        self.assertIn("Log in", self.player.get("/").get_data(as_text=True))
        self.assertEqual(self.player.get("/ruffle.html").status_code, 302)
        key = accounts.make_game_token(self.pid)
        reply = self.player.post(f"{server.DYNAMIC}/get_player_info.php?USERID={self.pid}&user_key={key}")
        self.assertEqual(reply.status_code, 404)
        self.assertIsNone(accounts.authenticate(self.player_name, self.player_name + "-password"))

    def test_not_your_own_account(self):
        admin_id = accounts.authenticate(self.admin_name, self.admin_name + "-password")["id"]
        reply = self.form(f"/admin/account/{admin_id}/delete", confirm=self.admin_name)
        self.assertEqual(reply.status_code, 400)
        self.assertIsNotNone(sessions.storage().get_user(admin_id))

    # Empires

    def test_looking_inside_an_empire(self):
        page = self.admin.get(f"/admin/empire/{self.pid}").get_data(as_text=True)
        self.assertIn(self.player_name, page)
        self.assertIn("&#34;privateState&#34;", page)  # the save, escaped
        self.assertIn("never", page)  # a new empire's login time is -1 until it is played
        self.assertNotIn("days ago", page)
        self.assertEqual(self.admin.get("/admin/empire/no-such-empire").status_code, 404)

    def test_deleting_an_empire(self):
        send_form(self.player, "/new", PLAYER="ruffle")
        other = [v["userid"] for v in sessions.villages_of(self.player_id) if v["userid"] != self.pid][0]
        sessions.flush()
        self.form(f"/admin/empire/{self.pid}/delete")  # not ticked "I'm sure"
        self.assertIsNotNone(sessions.session(self.pid))
        reply = self.form(f"/admin/empire/{self.pid}/delete", sure="1")
        self.assertEqual(reply.status_code, 302)
        self.assertIsNone(sessions.session(self.pid))
        self.assertEqual(self.stored_village(self.pid), [])
        # the account and its other empire stay
        self.assertEqual([v["userid"] for v in sessions.villages_of(self.player_id)], [other])
        self.assertIn("Your empires", self.player.get("/").get_data(as_text=True))

    def cash(self):
        return sessions.session(self.pid)["playerInfo"]["cash"]

    def test_giving_and_taking_cash(self):
        before = self.cash()
        reply = self.form(f"/admin/empire/{self.pid}/cash", amount="50", way="give")
        self.assertEqual(reply.status_code, 302)  # back to the empire's page, so a reload can't give it twice
        self.assertEqual(self.cash(), before + 50)
        page = self.admin.get(reply.headers["Location"]).get_data(as_text=True)
        self.assertIn(f"Gave 50 cash: {before} → {before + 50}.", page)
        # The server's own copy changed, so it's the one saved: no restart, nothing written over.
        sessions.flush()
        stored = sessions.storage()._query("SELECT data FROM villages WHERE pid = ?", (self.pid,))
        self.assertEqual(json.loads(stored[0]["data"])["playerInfo"]["cash"], before + 50)

        self.form(f"/admin/empire/{self.pid}/cash", amount="30", way="take")
        self.assertEqual(self.cash(), before + 20)
        # what the game loads next
        key = accounts.make_game_token(self.pid)
        reply = self.player.post(f"{server.DYNAMIC}/get_player_info.php?USERID={self.pid}&user_key={key}")
        self.assertEqual(reply.get_json()["playerInfo"]["cash"], before + 20)

    def test_cash_slips_are_refused(self):
        before = self.cash()
        for fields in ({"amount": "0", "way": "give"}, {"amount": "-5", "way": "give"},
                       {"amount": "lots", "way": "give"}, {"amount": "2.5", "way": "give"},
                       {"amount": str(admin.CASH_LIMIT + 1), "way": "give"},
                       {"amount": str(before + 1), "way": "take"},
                       {"amount": "5", "way": "steal"}, {"amount": "5"}):
            reply = self.form(f"/admin/empire/{self.pid}/cash", **fields)
            self.assertEqual(reply.status_code, 400, fields)
            self.assertIn('class="error"', reply.get_data(as_text=True))
        self.assertEqual(self.cash(), before)
        self.assertIn(f"has only {before} cash", self.form(f"/admin/empire/{self.pid}/cash", amount=str(before + 1),
                                                           way="take").get_data(as_text=True))
        self.form(f"/admin/empire/{self.pid}/cash", amount=str(admin.CASH_LIMIT), way="give")
        self.assertEqual(self.cash(), before + admin.CASH_LIMIT)  # the limit itself will do

    def test_only_admins_change_cash(self):
        before = self.cash()
        page = self.player.get("/").get_data(as_text=True)
        token = re.search(r'name="csrf" value="([^"]+)"', page).group(1)
        reply = self.player.post(f"/admin/empire/{self.pid}/cash", data={"amount": "50", "way": "give", "csrf": token})
        self.assertEqual(reply.status_code, 404)
        reply = self.admin.post(f"/admin/empire/{self.pid}/cash", data={"amount": "50", "way": "give"})  # no token
        self.assertEqual(reply.status_code, 400)
        self.assertEqual(self.cash(), before)
        self.assertEqual(self.form("/admin/empire/no-such-empire/cash", amount="5", way="give").status_code, 404)

    def test_a_save_under_way_cant_bring_it_back(self):
        """The background saver copies the empire, then writes it: if the
        delete came in between, the write would put it back."""
        sessions.save_session(self.pid)
        store = sessions.storage()
        writing, go_on = threading.Event(), threading.Event()
        save_villages = store.save_villages

        def slow_save(items):
            if any(pid == self.pid for pid, _, _ in items) and not writing.is_set():
                writing.set()
                go_on.wait(5)
            save_villages(items)

        with mock.patch.object(store, "save_villages", side_effect=slow_save):
            saver = threading.Thread(target=sessions.flush)
            saver.start()
            self.assertTrue(writing.wait(5))
            deleting = threading.Thread(target=sessions.delete_village, args=(self.pid,))
            deleting.start()
            deleting.join(0.3)
            self.assertTrue(deleting.is_alive())  # waits for the write under way
            go_on.set()
            saver.join(5)
            deleting.join(5)
        self.assertFalse(deleting.is_alive())
        self.assertIsNone(sessions.session(self.pid))
        self.assertEqual(self.stored_village(self.pid), [])


if __name__ == "__main__":
    unittest.main()
