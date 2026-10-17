"""
The Unit Warehouse and the Time Machine: replays the commands the game
client sends.

Run from the repository folder:  python -m unittest discover tests
"""

import os
import tempfile
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import sessions
from command import do_command
from engine import timestamp_now

SWORDSMAN, SPEARMAN = 511, 509
TOWN = 0
X, Y = 60, 60


class WarehouseTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][TOWN]
        self.save["playerInfo"]["cash"] = 100

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def on_map(self, item_id):
        return [item for item in self.map["items"] if item[0] == item_id]

    def test_a_unit_walks_in_and_out(self):
        self.map["items"].append([SWORDSMAN, X, Y, 0, 0, 0])
        self.send("add_unit_warehouse", X, Y, TOWN, SWORDSMAN)
        self.assertEqual(self.on_map(SWORDSMAN), [])
        self.assertEqual(self.map["warehousedUnits"], {str(SWORDSMAN): 1})
        self.send("place_warehoused_item", SWORDSMAN, 30, 31, 0, TOWN)
        self.assertEqual(self.on_map(SWORDSMAN)[0][:4], [SWORDSMAN, 30, 31, 0])
        self.assertEqual(self.map["warehousedUnits"], {})

    def test_the_unit_that_walked_in_is_the_one_removed(self):
        self.map["items"] += [[SWORDSMAN, 10, 10, 0, 0, 0], [SWORDSMAN, X, Y, 0, 0, 0]]
        self.send("add_unit_warehouse", X, Y, TOWN, SWORDSMAN)
        self.assertEqual([item[1:3] for item in self.on_map(SWORDSMAN)], [[10, 10]])

    def test_a_full_warehouse_takes_no_more(self):
        self.map["warehouseAditionalCapacitySingle"] = 1
        self.map["items"] += [[SWORDSMAN, X, Y, 0, 0, 0], [SPEARMAN, X, Y, 0, 0, 0]]
        self.send("add_unit_warehouse", X, Y, TOWN, SWORDSMAN)
        self.send("add_unit_warehouse", X, Y, TOWN, SPEARMAN)
        self.assertEqual(self.map["warehousedUnits"], {str(SWORDSMAN): 1})
        self.assertEqual(len(self.on_map(SPEARMAN)), 1)

    def test_more_room_for_cash(self):
        self.send("buy_warehouse_capacity_single", TOWN)
        self.assertEqual(self.map["warehouseAditionalCapacitySingle"], 51)
        self.assertEqual(self.save["playerInfo"]["cash"], 98)
        self.map["warehouseAditionalCapacitySingle"] = 1000
        self.send("buy_warehouse_capacity_single", TOWN)
        self.assertEqual(self.map["warehouseAditionalCapacitySingle"], 1000)
        self.assertEqual(self.save["playerInfo"]["cash"], 98)

    def test_units_go_to_storage_when_the_warehouse_goes(self):
        self.map["warehousedUnits"] = {str(SWORDSMAN): 2, str(SPEARMAN): 1}
        self.send("reset_warehouse", TOWN)
        self.assertEqual(self.map["warehousedUnits"], {})
        self.assertEqual(self.map["store"], {str(SWORDSMAN): 2, str(SPEARMAN): 1})


class TimeMachineTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][TOWN]
        self.pState = self.save["privateState"]
        self.save["playerInfo"]["cash"] = 100

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def test_buying_a_jump(self):
        self.send("buy_time_packet", 1)
        self.assertEqual(self.save["playerInfo"]["cash"], 96)
        self.assertEqual(self.pState["countTimePacket"], [0, 1, 0, 0, 0, 0])

    def test_a_jump_makes_every_wait_an_hour_shorter(self):
        now = timestamp_now()
        self.pState["countTimePacket"] = [0, 1, 0, 0, 0, 0]
        self.map["items"] = [[SWORDSMAN, X, Y, 0, now, 0], [SPEARMAN, X, Y, 0, 0, 0]]
        self.map["timestampLastTreasure"] = now
        self.map["questTimes"] = {"100000001": now}
        self.pState.update(timestampLastBonus=now, timeStampTakeCare=now, timeStampTemple=0,
                           survivalVidaTimeStamp=[now], timeStampDartsReset=now)
        self.send("time_ff", 1)
        hour_ago = now - 3600
        self.assertEqual(self.pState["countTimePacket"], [0, 0, 0, 0, 0, 0])
        self.assertEqual([item[4] for item in self.map["items"]], [hour_ago, 0])  # 0: not waiting
        self.assertEqual(self.map["timestampLastTreasure"], hour_ago)
        self.assertEqual(self.map["questTimes"], {"100000001": hour_ago})
        self.assertEqual((self.pState["timestampLastBonus"], self.pState["timeStampTakeCare"]),
                         (hour_ago, hour_ago))
        self.assertEqual(self.pState["timeStampTemple"], 0)
        self.assertEqual(self.pState["survivalVidaTimeStamp"], [hour_ago])
        self.assertEqual(self.pState["timeStampDartsReset"], now)  # the season is a date

    def test_a_jump_brings_the_pvp_allowance_nearer_without_changing_other_history(self):
        now = timestamp_now()
        self.pState.update(countTimePacket=[0, 1, 0, 0, 0, 0], tsAttacksReset=now - 100,
                           attacksSent=[{"time": now, "victim_id": "42", "description": {"win": 1}}],
                           attacksReceived=[{"time": now, "attacker_id": "24"}],
                           spyings=[{"time": now, "victim_id": "84"}])
        self.send("time_ff", 1)
        self.assertEqual(self.pState["attacksSent"], [{"time": now - 3600, "victim_id": "42", "description": {"win": 1}}])
        self.assertEqual(self.pState["tsAttacksReset"], now - 3700)
        self.assertEqual(self.pState["attacksReceived"], [{"time": now, "attacker_id": "24"}])
        self.assertEqual(self.pState["spyings"], [{"time": now, "victim_id": "84"}])

    def test_a_jump_preserves_calendar_events_and_reaches_every_town(self):
        now = timestamp_now()
        self.pState.update(countTimePacket=[1, 0, 0, 0, 0, 0], timeStampMondayBonus=now,
                           timeStampDartsReset=now, timeStampDartsNewFree=now,
                           riderTimeStamp=now, timeStampTemple=now, timeStampTakeCareMonster=now)
        self.save["maps"].append({"items": [[SWORDSMAN, X, Y, 0, now, 0]], "questTimes": {"1": now}})
        self.send("time_ff", 0)
        self.assertEqual(self.save["maps"][1]["items"][0][4], now - 1800)
        self.assertEqual(self.save["maps"][1]["questTimes"], {"1": now - 1800})
        for key in ("timeStampDartsNewFree", "riderTimeStamp", "timeStampTemple", "timeStampTakeCareMonster"):
            self.assertEqual(self.pState[key], now - 1800, key)
        self.assertEqual(self.pState["timeStampMondayBonus"], now)
        self.assertEqual(self.pState["timeStampDartsReset"], now)

    def test_a_jump_advances_generic_training_queues_without_unfinishing_ready_work(self):
        now = timestamp_now()
        self.pState.update(countTimePacket=[0, 1, 0, 0, 0, 0], barracksQueues={
            "1": {"ts": now, "amount": 1, "unit": 533},
            "2": {"ts": 0, "amount": 1, "unit": 534},
            "3": {"ts": 0, "amount": 0, "unit": 535},
            "4": {"ts": 100, "amount": 1, "unit": 550},
        })
        self.send("time_ff", 1)
        self.assertEqual(self.pState["barracksQueues"], {
            "1": {"ts": now - 3600, "amount": 1, "unit": 533},
            "2": {"ts": 0, "amount": 1, "unit": 534},
            "3": {"ts": 0, "amount": 0, "unit": 535},
            "4": {"ts": 1, "amount": 1, "unit": 550},
        })

    def test_time_travel_preserves_malformed_generic_queue_starts_without_normalizing_them(self):
        malformed = [False, True, None, "", " ", "not a timestamp", 1.5, "1.5", -1, "-1",
                     float("nan"), float("inf"), [], {}, 2 ** 53, "9007199254740990.5", "1.0000000000000001",
                     "1.0", "1e0", "1e-400", "1e309", "0.0", "0e0", "1__0", "1_0", "١", "１",
                     " 1", "1 ", "+1", "-0", "00000000000000000", "9007199254740992"]
        for value in malformed:
            with self.subTest(value=repr(value)):
                self.pState.update(countTimePacket=[0, 1, 0, 0, 0, 0], barracksQueues={
                    "1": {"ts": value, "amount": 1, "unit": 533},
                })
                self.send("time_ff", 1)
                queue = self.pState["barracksQueues"]["1"]
                self.assertIs(queue["ts"], value, "an unreadable start must remain unreadable, never become ready")
                self.assertEqual((queue["amount"], queue["unit"]), (1, 533))

    def test_time_travel_accepts_whole_wire_starts_and_preserves_explicit_zero_markers(self):
        now = timestamp_now()
        self.pState.update(countTimePacket=[0, 1, 0, 0, 0, 0], barracksQueues={
            "1": {"ts": now, "amount": 1, "unit": 533},
            "2": {"ts": str(now), "amount": 1, "unit": 534},
            "3": {"ts": float(now), "amount": 1, "unit": 535},
            "4": {"ts": str(now).rjust(16, "0"), "amount": 1, "unit": 550},
            "6": {"ts": 0, "amount": 1, "unit": 555},
            "7": {"ts": "0", "amount": 1, "unit": 556},
            "8": {"ts": 0.0, "amount": 1, "unit": 557},
        })
        self.send("time_ff", 1)
        queues = self.pState["barracksQueues"]
        for key in ("1", "2", "3", "4"):
            self.assertEqual(queues[key]["ts"], now - 3600, key)
        for key, value in (("6", 0), ("7", "0"), ("8", 0.0)):
            self.assertEqual(queues[key]["ts"], value, key)
            self.assertIs(type(queues[key]["ts"]), type(value), "zero markers retain their wire type")

    def test_no_jump_left(self):
        now = timestamp_now()
        self.map["timestampLastTreasure"] = now
        self.send("time_ff", 5)
        self.assertEqual(self.map["timestampLastTreasure"], now)


if __name__ == "__main__":
    unittest.main()
