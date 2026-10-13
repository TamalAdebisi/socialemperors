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

    def test_no_jump_left(self):
        now = timestamp_now()
        self.map["timestampLastTreasure"] = now
        self.send("time_ff", 5)
        self.assertEqual(self.map["timestampLastTreasure"], now)


if __name__ == "__main__":
    unittest.main()
