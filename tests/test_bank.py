"""
The bank (bank.py): the exchange window on the game page trades resources
for cash, a few a day, and the game's own bank trades cash for gold.

Run from the repository folder:  python -m unittest discover tests
"""

import json
import os
import re
import tempfile
import time
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import bank
import economy
import server
from command import do_command
from engine import timestamp_now
from sessions import session

GOLD = "coins"  # gold's name in a saved town


def sign_up(web):
    page = web.get("/").get_data(as_text=True)
    token = re.search(r'name="csrf" value="([^"]+)"', page).group(1)
    name = f"b{time.time_ns() % 10**15}"
    web.post("/register", data={"username": name, "password": name + "-password", "csrf": token})
    return token


class BankWindowTest(unittest.TestCase):

    def setUp(self):
        server.app.config["TESTING"] = True
        server.signups.seen.clear()  # every test signs up from the same address
        self.web = server.app.test_client()
        sign_up(self.web)
        page = self.web.get("/").get_data(as_text=True)
        token = re.search(r'name="csrf" value="([^"]+)"', page).group(1)
        self.web.post("/new", data={"PLAYER": "ruffle", "csrf": token})
        self.page = self.web.get("/ruffle.html").get_data(as_text=True)
        self.pid = re.search(r"&fb_sig_user=([^&]+)&", self.page).group(1)
        self.csrf = re.search(r'var csrf = "([^"]+)"', self.page).group(1)
        self.save = session(self.pid)
        self.town = self.save["maps"][0]
        self.save["playerInfo"]["cash"] = 0
        self.town.update({GOLD: 0, "wood": 0, "food": 0, "stone": 0})

    def ask(self, web=None, empire=None, **form):
        web = web or self.web
        url = "/bank?empire=" + (self.pid if empire is None else empire)
        reply = web.post(url, data=dict(form, csrf=form.get("csrf", self.csrf))) if form else web.get(url)
        return reply.status_code, reply.get_json()

    def trade(self, resource, cash):
        return self.ask(resource=resource, cash=str(cash))

    def test_the_game_page_opens_it(self):
        self.assertIn('<dialog id="bank"', self.page)
        self.assertIn("window.gotoBuy", self.page)
        self.assertIn("allowScriptAccess: true", self.page)  # or the game can't call the page
        self.assertIn(f'var empire = "{self.pid}"', self.page)

    def test_what_it_offers(self):
        self.town.update({GOLD: 4500, "stone": 12})
        status, reply = self.ask()
        self.assertEqual(status, 200)
        self.assertEqual(reply["cash"], 0)
        self.assertEqual(reply["resources"], {"g": 4500, "w": 0, "f": 0, "s": 12})
        self.assertEqual((reply["per_cash"], reply["per_day"], reply["left_today"]), (2000, 10, 10))
        self.assertEqual(reply["gold_for_cash"], [5, 2500])  # the game's own bank, the other way
        self.assertTrue(0 < reply["next_day_in"] <= 24 * 3600)

    def test_it_knows_when_the_game_loaded_the_town(self):
        _, before = self.ask()
        user_key = re.search(r"&user_key=([^&]+)&", self.page).group(1)
        self.web.post("/dynamic.flash1.dev.socialpoint.es/appsfb/socialempiresdev/srvempires/get_player_info.php",
                      data={"USERID": self.pid, "user_key": user_key})
        _, after = self.ask()
        self.assertGreaterEqual(after["loaded_at"], before["now"])

    def test_a_trade(self):
        self.town.update({GOLD: 5000})
        status, reply = self.trade("g", 2)
        self.assertEqual(status, 200)
        self.assertEqual(reply["ok"], "Bank: 4000 gold for 2 cash.")
        self.assertEqual((reply["cash"], reply["resources"]["g"], reply["left_today"]), (2, 1000, 8))
        self.assertEqual((self.save["playerInfo"]["cash"], self.town[GOLD]), (2, 1000))
        self.assertEqual(self.save["privateState"]["bank"], {"day": timestamp_now() // bank.DAY, "cash": 2})

    def test_a_few_cash_a_day(self):
        self.town.update(wood=30000)
        self.assertEqual(self.trade("w", 8)[0], 200)
        status, reply = self.trade("w", 3)
        self.assertEqual(status, 400)
        self.assertEqual(reply["error"], "The bank trades 10 cash a day; 2 left today.")
        self.assertEqual(self.trade("w", 2)[0], 200)
        status, reply = self.trade("w", 1)
        self.assertEqual(reply["error"], "The bank trades 10 cash a day; come back tomorrow.")
        self.assertEqual((reply["cash"], reply["left_today"], self.town["wood"]), (10, 0, 10000))
        self.save["privateState"]["bank"]["day"] -= 1  # the next day
        self.assertEqual(self.ask()[1]["left_today"], economy.BANK_CASH_PER_DAY)

    def test_trades_it_refuses(self):
        self.town.update(food=3999, stone=10**6)
        self.save["playerInfo"]["cash"] = 7
        refused = {
            ("f", 2): "Not enough food: 4,000 needed.",
            ("c", 1): "The bank doesn't take that.",  # cash for cash
            ("x", 1): "The bank doesn't take that.",  # experience
            ("s", 0): "How much cash?",
            ("s", -3): "How much cash?",
            ("s", "lots"): "How much cash?",
            ("s", 11): "The bank trades 10 cash a day; 10 left today.",
        }
        for (resource, cash), why in refused.items():
            status, reply = self.trade(resource, cash)
            self.assertEqual((status, reply["error"]), (400, why), (resource, cash))
        self.assertEqual((self.save["playerInfo"]["cash"], self.town["food"], self.town["stone"]), (7, 3999, 10**6))
        self.assertNotIn("bank", self.save["privateState"])

    def test_the_town_that_is_open_pays(self):
        self.save["maps"].append(json.loads(json.dumps(self.town)))
        self.save["maps"][1]["stone"] = 2000
        self.save["town"] = 1
        self.assertEqual(self.ask()[1]["resources"]["s"], 2000)
        self.assertEqual(self.trade("s", 1)[0], 200)
        self.assertEqual([m["stone"] for m in self.save["maps"]], [0, 0])

    def test_only_from_the_page(self):
        self.town.update({GOLD: 2000})
        status, reply = self.ask(resource="g", cash="1", csrf="")
        self.assertEqual(status, 400)
        self.assertIn("reload", reply["error"])
        self.assertEqual(self.save["playerInfo"]["cash"], 0)

    def test_only_for_the_owner(self):
        self.town.update({GOLD: 2000})
        stranger = server.app.test_client()
        self.assertEqual(self.ask(web=stranger)[0], 403)  # signed out
        token = sign_up(stranger)
        self.assertEqual(self.ask(web=stranger)[0], 403)  # someone else
        self.assertEqual(self.ask(web=stranger, resource="g", cash="1", csrf=token)[0], 403)
        self.assertEqual(self.ask(empire="")[0], 403)
        self.assertEqual(self.save["playerInfo"]["cash"], 0)


class GameBankTest(unittest.TestCase):
    """The game's own bank window: 5 cash for 2,500 gold."""

    def setUp(self):
        from sessions import new_village
        self.pid = new_village(owner_id=None)
        self.save = session(self.pid)
        self.town = self.save["maps"][0]
        self.town[GOLD] = 100

    def test_cash_for_gold(self):
        self.save["playerInfo"]["cash"] = 7
        do_command(self.pid, "exchange_cash_new", [0])
        self.assertEqual((self.save["playerInfo"]["cash"], self.town[GOLD]), (2, 2600))

    def test_not_without_the_cash(self):
        self.save["playerInfo"]["cash"] = 4
        do_command(self.pid, "exchange_cash_new", [0])
        self.assertEqual((self.save["playerInfo"]["cash"], self.town[GOLD]), (4, 100))


if __name__ == "__main__":
    unittest.main()
