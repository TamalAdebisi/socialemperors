"""
The world map: a town's island and its seven rivals, beating them, moving on
to the next continent and its prize, relocating, and looking at other
continents.

Run from the repository folder:  python -m unittest discover tests
"""

import json
import math
import os
import re
import tempfile
import time
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import sessions
import worlds
from command import do_command
from get_player_info import get_player_info
from engine import timestamp_now
from get_game_config import get_game_config

LEVEL = 60          # far from the other tests' empires, so the rivals here are this test's
WEEK = 7 * 24 * 3600
BUILT_IN_NEIGHBOUR = "100000030"  # villages/Arthur30.json: Arthur, a village that ships with the game


def new_account():
    return sessions.storage().create_user(f"w{time.time_ns() % 10**15}", "not-a-real-hash")


class WorldMapTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.made = []
        self.account = new_account()
        self.me = self.empire(LEVEL, self.account)
        self.save = sessions.session(self.me)
        self.map = self.save["maps"][0]

    def tearDown(self):
        for pid in self.made:  # off the map, so the next test picks its own rivals
            sessions.session(pid)["playerInfo"]["completed_tutorial"] = 0
            sessions.save_session(pid)
        sessions.flush()

    def empire(self, level, account=None, done=True, seen=None):
        pid = sessions.new_village(account if account is not None else new_account())
        save = sessions.session(pid)
        save["maps"][0]["level"] = level
        save["playerInfo"]["completed_tutorial"] = 15 if done else 0
        save["playerInfo"]["last_logged_in"] = timestamp_now() if seen is None else seen
        self.made.append(pid)
        return pid

    def crowd(self, levels=(-3, -2, -1, 0, 1, 2, 3)):
        return [self.empire(LEVEL + d) for d in levels]

    def look(self, **asked):
        return worlds.ranking(self.me, 0, **asked)

    def rivals(self, answer):
        return [island for island in answer["continent"] if island["user_id"] != self.me]

    def fight(self, island, win=1):
        report = {"attacker": {"user_id": self.me, "map": 0, "level": LEVEL, "race": "h"},
                  "victim": island, "resources": {"g": 0, "x": 0}, "honor": 0,
                  "attacker_units": [], "victim_units": [], "win": win}
        do_command(self.me, "end_attack", [json.dumps(report)])

    def test_a_town_lands_on_the_first_continent(self):
        crowd = self.crowd()
        answer = self.look()
        islands = answer["continent"]
        self.assertEqual([island["posicion"] for island in islands], list(range(8)))
        self.assertEqual({island["nivel"] for island in islands}, {1})
        mine = [island for island in islands if island["user_id"] == self.me]
        self.assertEqual(len(mine), 1)
        self.assertEqual(mine[0]["world_id"], answer["world_id"])
        self.assertEqual(self.save["playerInfo"]["world_id"], answer["world_id"])
        self.assertEqual({island["user_id"] for island in self.rivals(answer)}, set(crowd))
        for island in islands:  # what the client needs to draw an island it can click
            self.assertTrue(island["name"] and island["race"] in ("h", "t"))
            self.assertEqual(math.ceil(island["world_id"] / 8), 1)
            self.assertEqual(island["map"], 0)
        self.assertEqual(self.look(), answer)  # the rivals stay

    def test_the_nearest_levels_first_then_the_most_active(self):
        near = [self.empire(LEVEL) for _ in range(6)]
        long_gone = self.empire(LEVEL + 1, seen=timestamp_now() - WEEK)
        lately = self.empire(LEVEL + 1)
        self.empire(LEVEL + 20)
        picked = {island["user_id"] for island in self.rivals(self.look())}
        self.assertEqual(picked, set(near) | {lately})

    def test_who_is_not_a_rival(self):
        crowd = self.crowd((-3, -2, -1, 1, 2, 3))
        own_other_empire = self.empire(LEVEL, self.account)
        still_with_arthur = self.empire(LEVEL, done=False)
        picked = {island["user_id"] for island in self.rivals(self.look())}
        self.assertTrue(set(crowd) <= picked)
        self.assertNotIn(own_other_empire, picked)
        self.assertNotIn(still_with_arthur, picked)
        self.assertFalse(picked & set(sessions.ARTHUR_PIDS))

    def test_a_battle_won_beats_the_island(self):
        self.crowd()
        first, second, third = self.rivals(self.look())[:3]
        self.fight(first)
        self.fight(second, win=0)
        self.fight(dict(third, nivel=2))                   # not this continent
        self.fight(dict(third, user_id=BUILT_IN_NEIGHBOUR))  # not the rival on that island
        self.assertEqual(self.map["universAttackWin"], [first["posicion"]])
        self.fight(first)
        self.assertEqual(self.map["universAttackWin"], [first["posicion"]])
        self.assertEqual(self.save["privateState"]["worldChange"], 0)  # the client counts to seven itself

    def test_on_to_the_next_continent(self):
        self.crowd()
        rivals = self.rivals(self.look())
        for island in rivals[:6]:
            self.fight(island)
        self.assertEqual(self.look(move_on=True)["continent"][0]["nivel"], 1)  # one still to beat
        self.fight(rivals[6])
        answer = self.look(move_on=True)
        self.assertEqual({island["nivel"] for island in answer["continent"]}, {2})
        self.assertEqual(len(answer["continent"]), 8)
        self.assertEqual(math.ceil(answer["world_id"] / 8), 2)
        self.assertEqual(self.save["playerInfo"]["world_id"], answer["world_id"])
        self.assertEqual(self.map["universAttackWin"], [])
        self.assertEqual(self.look(move_on=True)["continent"][0]["nivel"], 2)  # once only

    def beat_them_all(self):
        self.crowd()
        for island in self.rivals(self.look()):
            self.fight(island)
        return next(r for r in get_game_config()["level_ranking_reward"] if r["level"] == 2)

    def assertPrized(self, cash, row):
        self.assertEqual(self.save["playerInfo"]["cash"], cash + row["cash"])
        self.assertEqual(self.map["store"], {unit: count for unit, count in row["units"].items()})

    def test_the_prize_for_a_continent(self):
        row = self.beat_them_all()
        cash = self.save["playerInfo"]["cash"]
        self.look(move_on=True)
        self.assertEqual(self.save["playerInfo"]["cash"], cash)  # the client shows the window first
        do_command(self.me, "apply_rewards_ranking", [2, row["cash"], json.dumps(row["units"])])  # claimed
        self.assertPrized(cash, row)
        do_command(self.me, "apply_rewards_ranking", [2, row["cash"], json.dumps(row["units"])])  # once
        do_command(self.me, "apply_rewards_ranking", [3, 1, "{}"])  # not there yet
        get_player_info(self.me)
        self.assertPrized(cash, row)

    def test_home_from_the_last_battle(self):
        row = self.beat_them_all()
        cash = self.save["playerInfo"]["cash"]
        loaded = get_player_info(self.me)  # every battle ends with the client loading the town again
        self.assertEqual(self.map["worldMap"]["nivel"], 2)
        self.assertEqual(loaded["map"]["universAttackWin"], [])  # nothing beaten on the new continent
        self.assertEqual(loaded["privateState"]["worldChange"], 1)  # the client owes the prize window
        self.assertEqual(self.save["playerInfo"]["cash"], cash)
        self.assertEqual(get_player_info(self.me)["privateState"]["worldChange"], 1)  # until the map opens
        self.assertEqual({i["nivel"] for i in self.look(move_on=True)["continent"]}, {2})  # once only
        do_command(self.me, "reset_world_change", [])  # the window opens
        do_command(self.me, "apply_rewards_ranking", [2, row["cash"], json.dumps(row["units"])])
        self.assertPrized(cash, row)
        get_player_info(self.me)
        self.assertEqual(self.map["worldMap"]["nivel"], 2)
        self.assertPrized(cash, row)

    def test_a_prize_window_closed_without_claiming(self):
        row = self.beat_them_all()
        cash = self.save["playerInfo"]["cash"]
        get_player_info(self.me)
        do_command(self.me, "reset_world_change", [])  # the window opens; the game is closed
        get_player_info(self.me)  # the next visit home
        self.assertPrized(cash, row)
        self.assertEqual(self.save["privateState"]["worldChange"], 0)

    def test_the_last_continent(self):
        self.beat_them_all()
        self.map["worldMap"].update(nivel=worlds.LAST, rewarded=worlds.LAST)
        cash = self.save["playerInfo"]["cash"]
        get_player_info(self.me)
        self.assertEqual(self.map["worldMap"]["nivel"], worlds.LAST)
        self.assertEqual(self.map["universAttackWin"], [])  # seven new rivals
        self.assertEqual(self.save["privateState"]["worldChange"], 0)  # no prize window: nothing new to win
        self.assertEqual(self.save["playerInfo"]["cash"], cash)

    def test_a_prize_missed_is_claimed_from_the_window(self):
        self.crowd()
        self.look()
        self.map["worldMap"].update(nivel=2)  # a town that moved on before prizes were given that way
        row = next(r for r in get_game_config()["level_ranking_reward"] if r["level"] == 2)
        cash = self.save["playerInfo"]["cash"]
        do_command(self.me, "apply_rewards_ranking", [2, 999, json.dumps({"712": 50})])
        self.assertEqual(self.save["playerInfo"]["cash"], cash + row["cash"])  # the config's, not the client's
        self.assertEqual(self.map["store"], {unit: count for unit, count in row["units"].items()})

    def test_no_prize_on_the_first_continent(self):
        self.look()
        cash = self.save["playerInfo"]["cash"]
        do_command(self.me, "apply_rewards_ranking", [1, 1, "{}"])
        self.assertEqual(self.save["playerInfo"]["cash"], cash)

    def test_relocating(self):
        self.crowd()
        first = self.rivals(self.look())[0]
        self.fight(first)
        do_command(self.me, "reset_position_univers", [])
        self.assertEqual(self.map["universAttackWin"], [])
        answer = self.look(relocate=True)
        self.assertEqual(answer["continent"][0]["nivel"], 1)
        self.assertEqual(len(answer["continent"]), 8)

    def test_a_rival_gone_is_replaced_on_its_island(self):
        self.crowd()
        gone = self.rivals(self.look())[2]
        for rival in self.map["worldMap"]["rivals"]:
            if rival["user_id"] == gone["user_id"]:
                rival["user_id"] = "an-empire-deleted"
        sessions.session(gone["user_id"])["playerInfo"]["completed_tutorial"] = 0  # so it isn't picked again
        newcomer = self.empire(LEVEL + 4)
        island = next(i for i in self.look()["continent"] if i["posicion"] == gone["posicion"])
        self.assertEqual(island["user_id"], newcomer)

    def test_players_who_come_later_fill_empty_islands(self):
        crowd = self.crowd((0, 1, 2, 3, 4, 5))
        self.look()
        record = self.map["worldMap"]
        record["rivals"] = [r for r in record["rivals"] if r["user_id"] in crowd]  # as if there were only six
        newcomer = self.empire(LEVEL)
        picked = {island["user_id"] for island in self.rivals(self.look())}
        self.assertEqual(picked, set(crowd) | {newcomer})

    def test_swapping_islands(self):
        self.crowd()
        self.look()
        record = self.map["worldMap"]
        mine = record["slot"]
        other = (mine + 1) % 8
        neighbour = next(r["user_id"] for r in record["rivals"] if r["posicion"] == other)
        do_command(self.me, "modify_position_univers", [mine, other])
        self.assertEqual(record["slot"], other)
        self.assertEqual(next(r["posicion"] for r in record["rivals"] if r["user_id"] == neighbour), mine)
        do_command(self.me, "modify_position_univers", [mine, (mine + 2) % 8])  # not where the town is
        self.assertEqual(record["slot"], other)

    def test_looking_at_another_continent(self):
        someone = self.empire(LEVEL)
        worlds.ranking(someone, 0)
        sessions.session(someone)["maps"][0]["worldMap"]["nivel"] = 2
        answer = self.look(continent=2)
        self.assertIn(someone, [island["user_id"] for island in answer["continent"]])
        self.assertEqual({island["nivel"] for island in answer["continent"]}, {2})
        self.assertEqual(math.ceil(answer["world_id"] / 8), 1)  # still at home
        self.assertEqual(self.look(continent=37)["continent"], [{"posicion": 0, "nivel": 37}])
        self.assertEqual(self.look(continent=1), self.look())

    def test_a_second_town_has_its_own_island(self):
        self.crowd()
        self.save["maps"].append(json.loads(json.dumps(self.map)))
        self.save["maps"][1].pop("worldMap", None)
        self.save["maps"][1]["id"] = 1
        home, second = self.look(), worlds.ranking(self.me, 1)
        self.assertIn(1, [island["map"] for island in second["continent"] if island["user_id"] == self.me])
        self.assertEqual(self.save["playerInfo"]["world_id"], home["world_id"])  # the first town's


def send_form(web, path, **fields):
    """Send one of our forms the way a browser does: with the token from the page."""
    page = web.get("/").get_data(as_text=True)
    token = re.search(r'name="csrf" value="([^"]+)"', page).group(1)
    return web.post(path, data=dict(fields, csrf=token))


class WorldMapPagesTest(unittest.TestCase):
    """What the game asks over the web."""

    def setUp(self):
        import server
        self.web = server.app.test_client()
        server.signups.seen.clear()  # every test signs up from the same address
        name = f"w{time.time_ns() % 10**15}"
        send_form(self.web, "/register", username=name, password=name + "-password")
        send_form(self.web, "/new", PLAYER="ruffle")
        page = self.web.get("/ruffle.html").get_data(as_text=True)
        self.pid = re.search(r"&fb_sig_user=([^&]+)&", page).group(1)
        self.key = re.search(r"&user_key=([^&]+)&", page).group(1)
        self.dynamic = server.DYNAMIC

    def test_the_continent(self):
        reply = self.web.get(f"{self.dynamic}/get_continent_ranking.php",
                             query_string={"USERID": self.pid, "user_key": self.key, "map": 0, "worldChange": 0})
        self.assertEqual(reply.status_code, 200)
        islands = reply.get_json()["continent"]
        self.assertEqual(islands[0]["nivel"], 1)
        self.assertIn(self.pid, [island["user_id"] for island in islands])
        forged = self.web.get(f"{self.dynamic}/get_continent_ranking.php",
                              query_string={"USERID": self.pid, "user_key": "forged", "map": 0})
        self.assertEqual(forged.status_code, 403)

    def test_a_profile(self):
        do_command(self.pid, "end_attack", [json.dumps({"attacker": {"map": 0}, "victim": {"user_id": BUILT_IN_NEIGHBOUR},
                                                        "win": 1, "honor": 3})])
        asked = {"USERID": BUILT_IN_NEIGHBOUR, "user_key": self.key}  # the one looked at, the viewer's key
        reply = self.web.get(f"{self.dynamic}/get_public_player_info.php", query_string=asked)
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply.get_json()["pid"], BUILT_IN_NEIGHBOUR)
        mine = self.web.get(f"{self.dynamic}/get_public_player_info.php",
                            query_string={"USERID": self.pid, "user_key": self.key}).get_json()
        self.assertEqual((mine["attacks_won"], mine["honor_points"]), (1, 1))  # honour worked out from the armies: none here, 1
        self.assertNotIn("privateState", mine)
        self.assertEqual(self.web.get(f"{self.dynamic}/get_public_player_info.php",
                                      query_string=dict(asked, user_key="forged")).status_code, 403)
        self.assertEqual(self.web.get(f"{self.dynamic}/get_public_player_info.php",
                                      query_string=dict(asked, USERID="nobody")).status_code, 404)


if __name__ == "__main__":
    unittest.main()
