"""
Tournaments (tournaments.py): replays the services the game client calls,
on a clock the tests move by hand.

Run from the repository folder:  python -m unittest discover tests
"""

import json
import os
import re
import tempfile
import time
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import inventory
import sessions
import tournaments
from command import do_command
from get_game_config import get_game_config

NEWBIES, ADVANCED, WEEKLY = "1", "2", "8"   # gold, cash, and the weekly tournament
WEDNESDAY_NOON = 1791979200                 # 2026-10-14 12:00 UTC
HOUR = 3600
SWORDSMEN = [643] * 10 + [0] * 10
BOTS = ["10000001", "10000002", "10000003"]
DRAGONS = [int(it["id"]) for it in get_game_config()["items"] if it.get("groups") == "dragon"][:11]


class TournamentsTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        vars(tournaments)["__tournaments"].clear()  # every test starts with no rooms
        self.now = WEDNESDAY_NOON
        self.clock, tournaments._now = tournaments._now, lambda: self.now
        self.dice = tournaments.BOT_WIN_CHANCE
        self.friends = sessions.friends
        self.me = self.player()

    def tearDown(self):
        tournaments._now = self.clock
        tournaments.BOT_WIN_CHANCE = self.dice
        sessions.friends = self.friends

    def befriend(self, *pids):
        """These players are all friends with each other, and with nobody else."""
        sessions.friends = lambda USERID: [p for p in pids if p != USERID] if USERID in pids else []

    def player(self, gold=100000, cash=100):
        pid = sessions.new_village(owner_id=None)
        save = sessions.session(pid)
        save["maps"][0]["coins"] = gold
        save["playerInfo"]["cash"] = cash
        return pid

    def ask(self, service, pid=None, **params):
        return tournaments.service(pid or self.me, service, params)

    def join(self, type_id=NEWBIES, pid=None, team=SWORDSMEN, **params):
        params = dict({"category": 1, "tournament_id": "", "flashSubResources": 1}, **params)
        return self.ask("join_tournament", pid, tournament_type_id=type_id, team=team, **params)

    def tournament(self, pid=None):
        return self.ask("get_tournament_info", pid)["tournament"]

    def play(self, victim, won=True, points="90.00", pid=None):
        tid = self.tournament(pid)["tournament_id"]
        self.assertEqual(self.ask("start_tournament_match", pid, victim_id=victim, tournament_id=tid), {"result": "OK"})
        self.now += 120
        return self.ask("finish_tournament_match", pid, victim_id=victim, attacker_won=won,
                        attacker_points=points, victim_points=0, tournament_id=tid)

    def gold(self, pid=None):
        return sessions.session(pid or self.me)["maps"][0]["coins"]

    def cash(self, pid=None):
        return sessions.session(pid or self.me)["playerInfo"]["cash"]

    def gift(self, unit, pid=None):
        return inventory._count(inventory.gifts(sessions.session(pid or self.me)), int(unit))

    # The list

    def test_the_list(self):
        info = self.ask("get_tournament_info")
        self.assertIsNone(info["tournament"])
        self.assertEqual(sorted(info["tournament_reward_id"]), ["1", "2", "3", "4", "5", "6", "7"])
        self.assertTrue(all(0 <= r < 5 for r in info["tournament_reward_id"].values()))
        week_left = 4 * 24 * HOUR + 12 * HOUR  # Wednesday noon to Monday
        self.assertEqual(info["tournament_weekly"], {WEEKLY: {"open": "1", "full": "0", "timeLeft": week_left}})
        self.assertEqual(info["tournament_friends"], [])

    def test_the_game_config(self):
        kinds = get_game_config()["tournament_type"]
        self.assertTrue(all(sorted(kind["weekly_opponent"]) == BOTS for kind in kinds.values()))  # bot pictures
        self.assertEqual([p["c"] for p in kinds[ADVANCED]["prize"]], [15] * 5)  # the fee back, with the unit
        self.assertEqual(kinds[NEWBIES]["prize"][0]["g"], 1500)  # gold prizes as in the game

    def test_browsing_and_saving_a_team_do_not_enter_or_charge(self):
        team = [643, 0, 649] + [0] * 17
        do_command(self.me, "set_attack_team", ["quest", json.dumps(SWORDSMEN)])
        do_command(self.me, "set_attack_team", ["tournament", json.dumps(team)])
        do_command(self.me, "set_help_map", ["tournamentHelp"])
        info = self.ask("get_tournament_info")
        state = sessions.session(self.me)["privateState"]
        self.assertIsNone(info["tournament"])
        self.assertEqual(state["teams"], {"quest": SWORDSMEN, "tournament": team})
        self.assertIn("tournamentHelp", state["helpMap"])
        self.assertEqual((self.gold(), self.cash()), (100000, 100))
        self.assertEqual(vars(tournaments)["__tournaments"], {})

    # Public rooms

    def test_a_room_waits_for_players(self):
        reply = self.join()
        self.assertEqual(reply["result"], "OK")
        self.assertEqual(self.gold(), 100000 - 500)
        room = reply["tournament"]
        self.assertIsNone(room["date_ready"])
        self.assertEqual([p["user_id"] for p in room["players"]], [self.me])
        self.assertEqual(room["players"][0]["team"], SWORDSMEN)
        self.assertIs(room["match_playing"], False)

        others = [self.player() for _ in range(3)]
        self.join(pid=others[0])
        self.assertEqual(len(self.tournament()["players"]), 2)
        for pid in others[1:]:
            self.join(pid=pid)
        room = self.tournament(others[2])
        self.assertEqual(room["date_ready"], self.now)
        self.assertEqual(room["players"][0]["user_id"], others[2])  # the asker first: the client's "you"
        self.assertEqual(sorted(p["user_id"] for p in room["players"]), sorted([self.me] + others))
        for player in room["players"]:
            self.assertEqual(sorted(m["victim_id"] for m in player["matches"]),
                             sorted(p["user_id"] for p in room["players"] if p is not player))
            self.assertFalse(any(m["finished"] for m in player["matches"]))

    def test_rooms_keep_to_a_type_and_level_bracket(self):
        self.join()
        self.join(pid=self.player(), category=1)
        self.join(ADVANCED, pid=self.player())
        other = self.player()
        self.ask("join_tournament", other, tournament_type_id=NEWBIES, category=3, team=SWORDSMEN, tournament_id="")
        self.assertEqual(len(self.tournament()["players"]), 2)

    def test_bots_fill_a_room_after_half_an_hour(self):
        self.join()
        self.now += 29 * 60
        self.assertIsNone(self.tournament()["date_ready"])
        self.now += 60
        room = self.tournament()
        self.assertEqual(room["date_ready"], self.now)
        me, *bots = room["players"]
        self.assertEqual([b["user_id"] for b in bots], BOTS)
        self.assertEqual([b["team"] for b in bots], [SWORDSMEN] * 3)  # the real player's army
        self.assertEqual([m["victim_id"] for m in me["matches"]], BOTS)
        for bot in bots:
            self.assertEqual(len(bot["matches"]), 3)
            for match in bot["matches"]:  # played by the server
                self.assertTrue(match["finished"])
                top = 95 if match["attacker_won"] else 18
                self.assertLessEqual(match["attacker_points"], top)
                self.assertLess(match["date_started"], match["date_finished"])

    def test_the_winner_gets_the_prize(self):
        tournaments.BOT_WIN_CHANCE = 0  # bots lose every match: at most 3 x 18 points
        self.join()
        self.now += HOUR
        room = self.tournament()
        prize = get_game_config()["tournament_type"][NEWBIES]["prize"][room["reward_id"]]
        gold = self.gold()
        for bot in BOTS[:2]:
            self.play(bot)
        self.assertIsNone(self.tournament()["date_finished"])
        self.play(BOTS[2], won=False, points="15.00")
        room = self.tournament()
        self.assertEqual(room["date_finished"], self.now)
        self.assertIs(room["match_playing"], False)
        self.assertEqual(self.gold(), gold + prize["g"])
        unit, count = next(iter(prize["u"].items()))
        self.assertEqual(self.gift(unit), count)

    def test_a_bot_can_win(self):
        tournaments.BOT_WIN_CHANCE = 1  # bots win every match: at least 3 x 50 points
        self.join()
        self.now += HOUR
        gold = self.gold()
        for bot in BOTS:
            self.play(bot, won=False, points="20.00")
        self.assertIsNotNone(self.tournament()["date_finished"])
        self.assertEqual(self.gold(), gold)

    def test_scores_the_client_could_not_have_sent(self):
        self.join()
        self.now += HOUR
        self.play(BOTS[0], won=False, points="99.00")  # a loss scores 20 at most
        self.play(BOTS[1], won=True, points="250")
        self.play(BOTS[2], won="true", points="lots")
        me = self.tournament()["players"][0]
        self.assertEqual([m["attacker_points"] for m in me["matches"]], [20, 100, 0])
        self.assertEqual([m["attacker_won"] for m in me["matches"]], [False, True, True])

    def test_one_result_a_match(self):
        tournaments.BOT_WIN_CHANCE = 0
        self.join()
        self.now += HOUR
        self.play(BOTS[0], points="30.00")
        tid = self.tournament()["tournament_id"]
        reply = self.ask("finish_tournament_match", victim_id=BOTS[0], attacker_won=True,
                         attacker_points="100.00", tournament_id=tid)
        self.assertEqual(reply, {"result": "OK"})  # anything else leaves the game paused
        self.assertEqual(self.tournament()["players"][0]["matches"][0]["attacker_points"], 30)

    def test_time_is_up_after_a_day(self):
        self.join()
        self.now += HOUR
        self.play(BOTS[0])
        self.now += 24 * HOUR
        room = self.tournament()
        self.assertIsNotNone(room["date_finished"])
        self.assertEqual([(m["finished"], m["attacker_points"]) for m in room["players"][0]["matches"]],
                         [(True, 90), (True, 0), (True, 0)])

    def test_a_match_started_and_never_finished(self):
        self.join()
        self.now += HOUR
        tid = self.tournament()["tournament_id"]
        self.ask("start_tournament_match", victim_id=BOTS[0], tournament_id=tid)
        self.assertIs(self.tournament()["match_playing"], True)
        self.now += HOUR
        room = self.tournament()
        self.assertIs(room["match_playing"], False)
        self.assertEqual(room["players"][0]["matches"][0]["finished"], True)

    def test_leaving_before_the_start_gives_the_fee_back(self):
        self.join()
        reply = self.ask("leave_tournament", tournament_id=self.tournament()["tournament_id"])
        self.assertEqual(reply, {"result": "OK", "resources": {"refund": 1, "tournament_type_id": NEWBIES}})
        self.assertEqual(self.gold(), 100000)
        self.assertIsNone(self.tournament())
        self.now += HOUR
        self.assertEqual(vars(tournaments)["__tournaments"], {})  # an empty room goes

    def test_leaving_after_the_start(self):
        others = [self.player() for _ in range(3)]
        for pid in [self.me] + others:
            self.join(pid=pid)
        tid = self.tournament()["tournament_id"]
        self.assertEqual(self.ask("leave_tournament", tournament_id=tid), {"result": "OK"})
        self.assertEqual(self.gold(), 100000 - 500)  # no refund once it started
        self.assertIsNone(self.tournament())
        room = self.tournament(others[0])
        gone = next(p for p in room["players"] if p["user_id"] == self.me)
        self.assertEqual(gone["abandonned"], 1)
        self.assertTrue(all(m["finished"] and m["attacker_points"] == 0 for m in gone["matches"]))
        self.assertEqual(self.play(self.me, pid=others[0]), {"result": "OK"})  # their army can still be beaten

    def test_a_delayed_leave_cannot_leave_the_next_room(self):
        old = self.join()["tournament"]["tournament_id"]
        self.ask("leave_tournament", tournament_id=old)
        current = self.join()["tournament"]["tournament_id"]
        for service in ("leave_tournament", "cancel_tournament"):
            self.assertEqual(self.ask(service, tournament_id=old), {"result": "OK"})
            self.assertEqual(self.tournament()["tournament_id"], current)
            self.assertEqual(self.gold(), 100000 - 500)
        # Older clients that omit the room id still retain their contract.
        self.assertEqual(self.ask("leave_tournament")["resources"]["refund"], 1)
        self.assertEqual(self.gold(), 100000)

    def test_exact_ties_report_the_paid_winner_to_every_player(self):
        players = [self.me] + [self.player() for _ in range(3)]
        for pid in players:
            self.join(pid=pid)
        initial = self.tournament()
        prize = get_game_config()["tournament_type"][NEWBIES]["prize"][initial["reward_id"]]
        unit, count = next(iter(prize["u"].items()))
        for pid in players:
            for victim in players:
                if victim != pid:
                    self.play(victim, points="70.00", pid=pid)
        for pid in players:
            view = self.tournament(pid)
            self.assertEqual(view["players"][0]["user_id"], pid)
            self.assertEqual(view["winner_id"], self.me)  # original seat, not requester's first row
            self.assertEqual(self.gold(pid), 100000 - 500 + (prize["g"] if pid == self.me else 0))
            self.assertEqual(self.gift(unit, pid), count if pid == self.me else 0)
        # A lost finish response may be retried; neither its score nor prize changes.
        self.ask("finish_tournament_match", players[-1], tournament_id=initial["tournament_id"],
                 victim_id=self.me, attacker_won=True, attacker_points="100.00")
        self.assertEqual(self.gold(), 100000 - 500 + prize["g"])
        self.assertEqual(self.gift(unit), count)
        self.assertEqual(self.tournament(players[-1])["winner_id"], self.me)

    def test_done_looking_at_the_end(self):
        self.join()
        self.now += HOUR
        for bot in BOTS:
            self.play(bot)
        self.assertEqual(self.ask("clean_tournament"), {"result": "OK"})
        self.assertIsNone(self.tournament())
        self.assertEqual(vars(tournaments)["__tournaments"], {})
        self.assertEqual(self.join()["result"], "OK")  # free for the next one

    def test_delayed_done_cannot_acknowledge_a_newer_finished_room(self):
        tournaments.BOT_WIN_CHANCE = 0
        older = self.join()["tournament"]["tournament_id"]
        self.now += HOUR
        for bot in BOTS:
            self.play(bot)
        self.assertEqual(self.ask("clean_tournament", tournament_id=older), {"result": "OK"})
        self.assertIsNone(self.tournament())

        current = self.join()["tournament"]["tournament_id"]
        self.assertNotEqual(current, older)
        # Even the correct room cannot be acknowledged before it finishes.
        self.assertEqual(self.ask("clean_tournament", tournament_id=current), {"result": "OK"})
        self.assertEqual(self.tournament()["tournament_id"], current)
        self.now += HOUR
        for bot in BOTS:
            self.play(bot)
        finished = self.tournament()
        self.assertIsNotNone(finished["date_finished"])
        saved_rewards = (self.gold(), self.cash(), inventory.gifts(sessions.session(self.me)).copy())

        # Another tab already acknowledged the old room and entered this one.
        # Retrying its stale Done must leave the newer results available.
        for _ in range(2):
            self.assertEqual(self.ask("clean_tournament", tournament_id=older), {"result": "OK"})
            self.assertEqual(self.tournament(), finished)
            self.assertEqual((self.gold(), self.cash(), inventory.gifts(sessions.session(self.me))), saved_rewards)
        self.assertEqual(self.ask("clean_tournament", tournament_id=current), {"result": "OK"})
        self.assertIsNone(self.tournament())
        self.assertEqual(self.ask("clean_tournament", tournament_id=current), {"result": "OK"})
        self.assertIsNone(self.tournament())
        self.assertEqual((self.gold(), self.cash(), inventory.gifts(sessions.session(self.me))), saved_rewards)

    # Entering

    def test_teams_the_game_does_not_allow(self):
        banned = get_game_config()["globals"]["TOURNAMENT_UNITS_NOT_ALLOWED"][0]
        for team in ([0] * 20, [643] * 21, [643, banned], [643, 1], "not a team", [643, "x"], DRAGONS):
            reply = self.join(team=team)
            self.assertEqual(reply, {"result": "NOTEAM", "resources": {"refund": 1, "tournament_type_id": NEWBIES}})
        self.assertEqual(self.gold(), 100000)
        self.assertEqual(self.join(WEEKLY, team=DRAGONS)["result"], "OK")  # the weekly tournament doesn't count them

    def test_a_fee_the_player_cannot_pay(self):
        poor = self.player(cash=10)
        reply = self.join(ADVANCED, pid=poor)
        self.assertEqual(reply, {"result": "NOK", "resources": {"refund": 1, "tournament_type_id": ADVANCED}})
        self.assertEqual(self.cash(poor), 10)
        self.assertEqual(self.join(ADVANCED)["result"], "OK")
        self.assertEqual(self.cash(), 100 - 15)

    def test_one_tournament_at_a_time(self):
        self.join()
        self.assertEqual(self.join(ADVANCED)["result"], "NOK")
        self.assertEqual(self.cash(), 100)

    def test_a_type_that_does_not_exist(self):
        self.assertEqual(self.join("99"), {"result": "NOK"})  # no refund: the client would look up the fee and fail
        self.assertEqual(self.create("99"), {"result": "NOK"})
        self.assertIsNone(tournaments.service(self.me, "no_such_service", {}))

    def test_the_client_bookkeeping_changes_nothing(self):
        do_command(self.me, "tournament_substract_resources", ["g", 500, NEWBIES, 0])
        do_command(self.me, "tournament_refund_resources", ["g", 500])
        self.assertEqual(self.gold(), 100000)

    # Friends tournaments

    def create(self, type_id=NEWBIES, pid=None, team=SWORDSMEN):
        return self.ask("create_tournament", pid, tournament_type_id=type_id, team=team,
                        usersFriends=[], flashSubResources=1)

    def join_friend(self, room, pid, type_id=NEWBIES):
        return self.join(type_id, pid=pid, tournament_id=room["tournament_id"])

    def test_a_friends_tournament(self):
        friends = [self.player() for _ in range(3)]
        stranger = self.player()
        self.befriend(self.me, *friends)
        reply = self.create()
        self.assertEqual(reply["result"], "OK")
        self.assertEqual(self.gold(), 100000 - 500)
        room = reply["tournament"]
        name = room["players"][0]["user_name"]
        self.assertEqual((room["private"], room["owner_id"], room["owner"]), ("1", self.me, name))
        self.assertIsNone(room["date_ready"])

        card = {"tournament_id": room["tournament_id"], "tournament_type_id": NEWBIES,
                "reward_id": room["reward_id"], "owner": name, "owner_id": self.me}
        self.assertEqual(self.ask("get_tournament_info", friends[0])["tournament_friends"], [card])
        self.assertEqual(self.ask("get_tournament_info", stranger)["tournament_friends"], [])
        self.assertEqual(self.join_friend(room, stranger)["result"], "NOK")
        self.assertEqual(self.gold(stranger), 100000)

        for pid in friends:
            self.assertEqual(self.join_friend(room, pid)["result"], "OK")
        room = self.tournament(friends[0])
        self.assertEqual(room["date_ready"], self.now)
        self.assertEqual(room["private"], "1")
        self.assertEqual(sorted(p["user_id"] for p in room["players"]), sorted([self.me] + friends))
        self.assertEqual(sum(len(p["matches"]) for p in room["players"]), 12)
        self.assertEqual(self.ask("get_tournament_info", stranger)["tournament_friends"], [])  # full

    def test_too_few_friends(self):
        friends = [self.player() for _ in range(2)]
        self.befriend(self.me, *friends)
        self.assertEqual(self.create(), {"result": "NOFRIENDS", "resources": {"refund": 1, "tournament_type_id": NEWBIES}})
        self.assertEqual(self.gold(), 100000)
        self.assertIsNone(self.tournament())

    def test_community_accounts_create_discover_and_join_without_friend_requests(self):
        store = sessions.storage()
        owners, players = [], []
        for index in range(4):
            owner = store.create_user(f"tournament{time.time_ns()}{index}", "unused")
            self.addCleanup(sessions.delete_account, owner)
            owners.append(owner)
            pid = sessions.new_village(owner_id=owner)
            sessions.session(pid)["maps"][0]["coins"] = 100000
            players.append(pid)
            self.assertEqual(store.friends_of(owner), [])
        host, *guests = players
        own_other = sessions.new_village(owner_id=owners[0])
        sessions.session(own_other)["maps"][0]["coins"] = 100000
        unclaimed = self.player()
        neighbours = sessions.friends(host)  # the real community lookup, not befriend's stub
        self.assertTrue(set(guests).issubset(neighbours))
        self.assertNotIn(own_other, neighbours)
        self.assertNotIn(unclaimed, neighbours)

        reply = self.create(pid=host)
        self.assertEqual(reply["result"], "OK")
        room = reply["tournament"]
        self.assertEqual(self.gold(host), 99500)
        self.assertEqual(self.ask("get_tournament_info", own_other)["tournament_friends"], [])
        self.assertEqual(self.join_friend(room, own_other)["result"], "NOK")
        self.assertEqual(self.gold(own_other), 100000)
        for guest in guests:
            cards = self.ask("get_tournament_info", guest)["tournament_friends"]
            self.assertEqual([card["tournament_id"] for card in cards], [room["tournament_id"]])
            self.assertEqual(self.join_friend(room, guest)["result"], "OK")
            self.assertEqual(self.gold(guest), 99500)
        ready = self.tournament(host)
        self.assertEqual(ready["date_ready"], self.now)
        self.assertEqual({player["user_id"] for player in ready["players"]}, set(players))
        self.assertTrue(all(store.friends_of(owner) == [] for owner in owners))

    def test_the_owner_calls_it_off(self):
        friends = [self.player() for _ in range(3)]
        self.befriend(self.me, *friends)
        room = self.create()["tournament"]
        self.join_friend(room, friends[0])
        self.assertEqual(self.gold(friends[0]), 100000 - 500)
        reply = self.ask("cancel_tournament", tournament_id=room["tournament_id"])
        self.assertEqual(reply, {"result": "OK", "resources": {"refund": 1, "tournament_type_id": NEWBIES}})
        self.assertEqual((self.gold(), self.gold(friends[0])), (100000, 100000))  # every fee back
        self.assertIsNone(self.tournament(friends[0]))
        self.assertEqual(self.ask("get_tournament_info", friends[1])["tournament_friends"], [])

    def test_a_delayed_cancel_cannot_cancel_the_owners_next_room(self):
        friends = [self.player() for _ in range(3)]
        self.befriend(self.me, *friends)
        old = self.create()["tournament"]
        self.ask("cancel_tournament", tournament_id=old["tournament_id"])
        current = self.create()["tournament"]
        self.join_friend(current, friends[0])
        self.assertEqual(self.ask("cancel_tournament", tournament_id=old["tournament_id"]), {"result": "OK"})
        self.assertEqual(self.tournament()["tournament_id"], current["tournament_id"])
        self.assertEqual(self.tournament(friends[0])["tournament_id"], current["tournament_id"])
        self.assertEqual((self.gold(), self.gold(friends[0])), (99500, 99500))

    def test_a_friend_leaves_before_the_start(self):
        friends = [self.player() for _ in range(3)]
        self.befriend(self.me, *friends)
        room = self.create()["tournament"]
        self.join_friend(room, friends[0])
        reply = self.ask("leave_tournament", friends[0], tournament_id=room["tournament_id"])
        self.assertEqual(reply["resources"], {"refund": 1, "tournament_type_id": NEWBIES})
        self.assertEqual(self.gold(friends[0]), 100000)
        self.assertEqual([p["user_id"] for p in self.tournament()["players"]], [self.me])  # still waiting

    def test_friends_get_a_day_then_bots(self):
        self.befriend(self.me, *[self.player() for _ in range(3)])
        self.create()
        self.now += 23 * HOUR
        self.assertIsNone(self.tournament()["date_ready"])
        self.now += HOUR
        room = self.tournament()
        self.assertEqual([p["user_id"] for p in room["players"][1:]], BOTS)
        self.assertEqual(room["owner_id"], self.me)

    def test_public_rooms_are_not_friends_rooms(self):
        self.befriend(self.me, *[self.player() for _ in range(3)])
        self.create()
        other = self.player()
        self.join(pid=other, category=0)
        self.assertEqual(len(self.tournament()["players"]), 1)
        self.assertEqual(self.tournament(other)["private"], "0")

    def test_friends_are_the_players_among_the_neighbours(self):
        sessions.friends = self.friends
        owner = sessions.storage().create_user(f"community{time.time_ns()}", "unused")
        other = sessions.new_village(owner_id=owner)
        sessions.session(other)["playerInfo"]["last_logged_in"] = self.now  # one of the most recently active
        friends = sessions.friends(self.me)
        self.assertIn(other, friends)
        self.assertNotIn(self.me, friends)
        self.assertTrue(all(sessions.session(pid) for pid in friends))  # players, not the villages that ship with the game

    # The weekly tournament

    def test_the_weekly_tournament(self):
        reply = self.join(WEEKLY)
        room = reply["tournament"]
        self.assertEqual(self.gold(), 100000 - 500)
        self.assertEqual(room["date_ready"], self.now)
        self.assertEqual([p["user_id"] for p in room["players"]], [self.me] + BOTS)
        bot_teams = get_game_config()["tournament_type"][WEEKLY]["weekly_opponent"]
        self.assertEqual([p["team"] for p in room["players"][1:]], [bot_teams[b]["team"] for b in BOTS])
        self.assertEqual([m["victim_id"] for m in room["players"][0]["matches"]], BOTS)
        self.assertEqual([p["matches"] for p in room["players"][1:]], [[], [], []])  # the client never shows them
        self.assertEqual(room["ranking"], {"total_user": 1, "top": {"1": {
            "user_id": self.me, "user_name": room["players"][0]["user_name"], "points": 0, "time": 0, "matches": 0}},
            "user": {"user_id": self.me, "user_name": room["players"][0]["user_name"], "points": 0, "time": 0,
                     "matches": 0, "rank": 1}})

    def test_the_weekly_ranking_and_prizes(self):
        rival = self.player()
        self.join(WEEKLY)
        self.join(WEEKLY, pid=rival)
        for bot in BOTS:
            self.play(bot, points="90.00")
        ranking = self.tournament()["ranking"]
        self.assertEqual(ranking["user"]["rank"], 1)
        self.assertEqual(ranking["total_user"], 2)
        self.assertEqual(self.gold(), 100000 - 500 + 100000)  # rank 1 of the week, so far
        self.assertEqual(self.gift(847), 1)
        for bot in BOTS:
            self.play(bot, points="50.00", pid=rival)
        ranking = self.tournament(rival)["ranking"]
        self.assertEqual(ranking["user"]["rank"], 2)
        self.assertEqual([row["points"] for row in ranking["top"].values()], [270, 150])
        self.assertEqual(self.gold(rival), 100000 - 500 + 75000)
        self.assertEqual(self.gift(777, rival), 1)

    def test_the_paid_weekly_rank_stays_frozen_and_cleaning_cannot_pay_again(self):
        rival = self.player()
        self.join(WEEKLY)
        self.join(WEEKLY, pid=rival)
        for bot in BOTS:
            self.play(bot, points="50.00")
        self.assertEqual(self.tournament()["ranking"]["user"]["rank"], 1)
        for bot in BOTS:
            self.play(bot, points="90.00", pid=rival)
        for _ in range(2):
            ranking = self.tournament()["ranking"]
            self.assertEqual(ranking["top"]["1"]["user_id"], rival)
            self.assertEqual(ranking["top"]["2"]["user_id"], self.me)
            self.assertEqual(ranking["user"]["rank"], 1)  # rank used when this prize was paid
            self.assertEqual(self.gold(), 100000 - 500 + 100000)
            self.assertEqual(self.gift(847), 1)
        for _ in range(2):
            self.assertEqual(self.ask("clean_tournament"), {"result": "OK"})
            self.assertIsNone(self.tournament())
            self.assertEqual(self.gold(), 100000 - 500 + 100000)
            self.assertEqual(self.gift(847), 1)
        self.assertEqual(self.ask("get_tournament_info")["tournament_weekly"][WEEKLY]["full"], "1")

    def test_the_eleventh_weekly_rank_has_no_prize(self):
        leaders = [self.player() for _ in range(10)]
        for pid in leaders:
            self.join(WEEKLY, pid=pid)
            for bot in BOTS:
                self.play(bot, points="90.00", pid=pid)
        self.join(WEEKLY)
        gifts_before = inventory.gifts(sessions.session(self.me)).copy()
        for bot in BOTS:
            self.play(bot, points="20.00")
        room = self.tournament()
        self.assertIsNotNone(room["date_finished"])
        self.assertEqual(room["ranking"]["user"]["rank"], 11)
        self.assertEqual(room["ranking"]["total_user"], 11)
        self.assertEqual(len(room["ranking"]["top"]), 10)
        self.assertEqual(self.gold(), 100000 - 500)
        self.assertEqual(inventory.gifts(sessions.session(self.me)), gifts_before)

    def test_once_a_week(self):
        self.join(WEEKLY)
        self.ask("leave_tournament", tournament_id=self.tournament()["tournament_id"])
        info = self.ask("get_tournament_info")
        self.assertEqual(info["tournament_weekly"][WEEKLY]["full"], "1")  # the card is hidden
        self.assertEqual(self.join(WEEKLY)["result"], "NOK")
        self.now += 5 * 24 * HOUR  # next Monday
        info = self.ask("get_tournament_info")
        self.assertEqual(info["tournament_weekly"][WEEKLY], {"open": "1", "full": "0", "timeLeft": 7 * 24 * HOUR - 12 * HOUR})
        self.assertEqual(self.join(WEEKLY)["result"], "OK")

    # Saved with the villages

    def test_saved_and_loaded(self):
        tid = self.join()["tournament"]["tournament_id"]
        sessions.flush()
        saved = {t["id"]: t for t in sessions.storage().load_all_tournaments()}
        self.assertEqual(saved[tid]["players"][0]["user_id"], self.me)
        self.ask("leave_tournament", tournament_id=tid)
        sessions.flush()
        self.assertNotIn(tid, [t["id"] for t in sessions.storage().load_all_tournaments()])


class ServerTest(unittest.TestCase):
    """The way the client calls, through the web server."""

    @classmethod
    def setUpClass(cls):
        import server
        server.app.config["TESTING"] = True
        cls.server = server

    def setUp(self):
        web = self.server.app.test_client()
        self.server.signups.seen.clear()

        def send_form(path, **fields):  # with the token from the page, as a browser does
            page = web.get("/").get_data(as_text=True)
            fields["csrf"] = re.search(r'name="csrf" value="([^"]+)"', page).group(1)
            web.post(path, data=fields)

        name = f"t{time.time_ns() % 10**15}"  # usernames are 3 to 20 characters
        send_form("/register", username=name, password=name + "-password")
        send_form("/new", PLAYER="ruffle")
        game = web.get("/ruffle.html").get_data(as_text=True)
        self.pid = re.search(r"fb_sig_user=([^&\s]+)", game).group(1)
        self.key = re.search(r"user_key=([^&\s]+)", game).group(1)
        self.web = web

    def call(self, path, data=None):
        url = f"/dynamic.flash1.dev.socialpoint.es/appsfb/socialempiresdev/srvempires/{path}"
        return self.web.post(url, query_string={"USERID": self.pid, "user_key": self.key}, data=data or {})

    def test_a_service_answers_under_data(self):
        reply = self.call("tournaments/get_tournament_info.php", {"data": "0" * 64 + ";" + json.dumps({"user_id": self.pid})})
        self.assertEqual(reply.status_code, 200)
        self.assertIsNone(reply.get_json()["data"]["tournament"])
        plain = self.call("tournaments/clean_tournament.php", {"data": json.dumps({"user_id": self.pid})})
        self.assertEqual(plain.get_json(), {"data": {"result": "OK"}})

    def test_no_such_service(self):
        self.assertEqual(self.call("tournaments/no_such_thing.php").status_code, 404)

    def test_the_invite_buttons_open_a_notice(self):
        page = self.web.get("/ruffle.html").get_data(as_text=True)
        self.assertIn('<dialog id="invite"', page)
        self.assertIn("window.showPopupInviteTournament = function", page)
        self.assertNotIn('"showPopupInviteTournament"', page)  # no longer one of the page's do-nothing calls

    def test_the_arena(self):
        reply = self.call("get_player_info.php", {"user": tournaments.ARENA})
        self.assertEqual(reply.status_code, 200)
        arena = reply.get_json()["map"]
        self.assertEqual(sorted(arena["expansions"]), [7, 8, 9, 12, 13, 14, 17, 18, 19])
        self.assertEqual((arena["items"], arena["receivedAssists"]), ([], []))


if __name__ == "__main__":
    unittest.main()
