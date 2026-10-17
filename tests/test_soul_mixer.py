"""Soul Mixer queue protocol, with explicit synthetic content for algorithm checks."""

from contextlib import contextmanager
import copy
import os
import tempfile
import unittest
from unittest.mock import patch

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import sessions
from command import do_command
from get_game_config import get_game_config, get_item_from_id
import soul_mixer


class SoulMixerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][0]
        self.map["items"] = [[1529, 55, 55, 0, 0, 0, [509, 514], {}]]
        self.map["level"] = 25
        self.save["playerInfo"]["cash"] = 20

    def send(self, command, *args):
        do_command(self.pid, command, list(args))

    @contextmanager
    def content(self):
        # These test ranks/prices/times are never a replacement for original data.
        with patch.dict(get_game_config()["globals"], SOUL_MIXER_MIN_LEVEL=4,
                        SOUL_MIXER_POWERUPS_LEVELS=[{"cash_cost": 1, "order_increment": 0}, {"cash_cost": 2, "order_increment": 1}]), \
             patch.dict(get_item_from_id(509), breeding_order="10", sm_training_time="7201"), \
             patch.dict(get_item_from_id(514), breeding_order="20", sm_training_time="7201"), \
             patch.dict(get_item_from_id(533), breeding_order="30", sm_training_time="7201"):
            yield

    def test_archived_data_refuses_actions_without_spending_or_changing_units(self):
        self.assertFalse(soul_mixer.available())
        before = copy.deepcopy(self.save)
        self.send("buy_powerups", 0)
        self.send("push_queue_unit", 55, 55, 1529, 533, 1, 0)
        self.send("speed_up_queue", 1)
        self.send("pop_queue_unit", 1, 56, 56, 1529)
        self.assertEqual(self.save, before)

    def test_partial_rank_or_duration_data_cannot_admit_units_or_spend_cash(self):
        self.map["items"][0][6] = []
        self.map["items"].append([509, 50, 50, 0, 0, 0])
        self.map["items"][0][7]["bq"] = "1"
        self.save["privateState"]["barracksQueues"] = {"1": {"ts": 100, "amount": 1, "unit": 533}}
        with patch.dict(get_item_from_id(509), breeding_order="10"), \
             patch.dict(get_item_from_id(533), sm_training_time="7201"), \
             patch("soul_mixer.timestamp_now", return_value=100):
            before = copy.deepcopy(self.save)
            self.send("push_unit", 50, 50, 509, 55, 55, 0)
            self.send("speed_up_queue", 1)
            self.assertEqual(self.save, before)

    def test_original_protocol_retains_parents_and_collects_exactly_once_without_xp(self):
        with self.content(), patch("soul_mixer.timestamp_now", return_value=100):
            xp = self.map["xp"]
            self.send("buy_powerups", 0)
            self.send("push_queue_unit", 55, 55, 1529, 533, 1, 0)
            self.assertEqual(self.map["items"][0][6], [509, 514])
            self.assertEqual(self.map["items"][0][7], {"bq": "1"})
            self.assertEqual(self.save["privateState"]["barracksQueues"], {"1": {"ts": 100, "amount": 1, "unit": 533}})
            self.send("pop_queue_unit", 1, 56, 56, 1529)
            self.assertEqual(len(self.map["items"]), 1, "unfinished output stays queued")
            self.send("speed_up_queue", 1)
            self.assertEqual(self.save["playerInfo"]["cash"], 16)
            self.send("speed_up_queue", 1)
            self.assertEqual(self.save["playerInfo"]["cash"], 16, "no repeated speed-up charge")
            self.send("pop_queue_unit", 1, 56, 56, 1529)
            self.send("pop_queue_unit", 1, 56, 56, 1529)
            self.assertEqual([row[0] for row in self.map["items"]], [1529, 533])
            self.assertEqual(self.map["xp"], xp)
            self.send("pop_unit", 55, 55, 0, 509, 57, 56, 0)
            self.send("pop_unit", 55, 55, 0, 514, 58, 56, 0)
            self.assertEqual(self.map["items"][0][6], [])
            self.assertEqual(sorted(row[0] for row in self.map["items"]), [509, 514, 533, 1529])

    def test_elapsed_queue_restores_without_auto_collection_and_start_retry_does_not_reset_time(self):
        with self.content(), patch("soul_mixer.timestamp_now", return_value=100):
            self.send("push_queue_unit", 55, 55, 1529, 533, 1, 0)
        with self.content(), patch("soul_mixer.timestamp_now", return_value=8000):
            self.send("push_queue_unit", 55, 55, 1529, 533, 1, 0)
            queue = self.save["privateState"]["barracksQueues"]["1"]
            self.assertEqual(queue["ts"], 100)
            self.assertEqual(len(self.map["items"]), 1)
            self.send("pop_queue_unit", 1, 56, 56, 1529)
            self.assertEqual(len(self.map["items"]), 2)

    def test_no_spending_when_cash_missing_and_no_invalid_queue_or_parent(self):
        with self.content():
            self.save["playerInfo"]["cash"] = 0
            self.send("buy_powerups", 0)
            self.send("buy_powerups", 99)
            self.assertEqual(self.save["playerInfo"]["cash"], 0)
            self.send("push_queue_unit", 55, 55, 1529, 533, -1, 0)
            self.send("push_queue_unit", 55, 55, 1529, 9999999, 1, 0)
            self.send("push_queue_unit", 54, 55, 1529, 533, 1, 0)
            self.assertNotIn("barracksQueues", self.save["privateState"])
            self.map["items"][0][6] = [509]
            self.send("push_queue_unit", 55, 55, 1529, 533, 1, 0)
            self.assertNotIn("barracksQueues", self.save["privateState"])

    def test_ready_queue_is_still_claimable_when_old_content_tables_are_missing(self):
        self.map["items"][0][7]["bq"] = "1"
        self.save["privateState"]["barracksQueues"] = {"1": {"ts": 0, "amount": 1, "unit": 533}}
        self.send("pop_queue_unit", 1, 56, 56, 1529)
        self.assertEqual(self.map["items"][-1][0], 533)

    def test_ready_legacy_result_must_be_a_unit_not_building_metadata(self):
        self.assertEqual(get_item_from_id(1345)["type"], "b")
        self.map["items"][0][7]["bq"] = "1"
        self.save["privateState"]["barracksQueues"] = {"1": {"ts": 0, "amount": 1, "unit": 1345}}
        before = copy.deepcopy(self.save)
        self.send("pop_queue_unit", 1, 56, 56, 1529)
        self.assertEqual(self.save, before, "a malformed output cannot change cash, parents, queues or map items")
        self.save["privateState"]["barracksQueues"]["1"]["unit"] = 533
        self.send("pop_queue_unit", 1, 56, 56, 1529)
        self.assertEqual(self.map["items"][-1][0], 533)
        self.assertEqual(self.map["items"][0][6], [509, 514])
        self.assertEqual(self.save["playerInfo"]["cash"], 20)

    def test_unreadable_wait_never_becomes_ready_and_off_map_output_is_refused(self):
        self.map["items"][0][7]["bq"] = "1"
        self.save["privateState"]["barracksQueues"] = {"1": {"ts": 100, "amount": 1, "unit": 533}}
        before = copy.deepcopy(self.save)
        self.send("speed_up_queue", 1)
        self.send("pop_queue_unit", 1, 56, 56, 1529)
        self.assertEqual(self.save, before)
        self.save["privateState"]["barracksQueues"]["1"]["ts"] = 0
        self.send("pop_queue_unit", 1, 100, 56, 1529)
        self.assertEqual(len(self.map["items"]), 1)

    def test_malformed_timestamps_never_collect_as_zero(self):
        self.map["items"][0][7]["bq"] = "1"
        for timestamp in [None, "", " ", False, True, -1, "bad", float("inf")]:
            self.save["privateState"]["barracksQueues"] = {"1": {"ts": timestamp, "amount": 1, "unit": 533}}
            self.send("pop_queue_unit", 1, 56, 56, 1529)
            self.assertEqual(len(self.map["items"]), 1, repr(timestamp))
        self.save["privateState"]["barracksQueues"] = {"1": {"amount": 1, "unit": 533}}
        self.send("pop_queue_unit", 1, 56, 56, 1529)
        self.assertEqual(len(self.map["items"]), 1, "absent timestamp is not completed")
        self.save["privateState"]["barracksQueues"] = {"1": {"ts": "0", "amount": "1", "unit": "533"}}
        self.send("pop_queue_unit", 1, 56, 56, 1529)
        self.assertEqual(self.map["items"][-1][0], 533)

    def test_fractional_wire_text_never_rounds_into_a_collectable_legacy_queue(self):
        self.map["items"][0][7]["bq"] = "1"
        self.assertFalse(soul_mixer.available(), "this exercises the real missing-content legacy path")
        timestamps = ["1e-400", "-1e-400", "1.000000000000000001", "9007199254740991.1", "1700000000.000000001",
                      "9007199254740992", "9" * 10_000, "00000000000000000", "1.0", "1e0", "+0", " 0", "0 ", "0\n",
                      "0x0", "0_0", "０", "٠", 0.5, 5e-324, 2 ** 53, 10 ** 1000]
        bad_queues = [{"ts": timestamp, "amount": 1, "unit": 533} for timestamp in timestamps]
        bad_queues += [{"ts": 0, "amount": "1.000000000000000001", "unit": 533},
                       {"ts": 0, "amount": 1, "unit": "533.000000000000000001"}]
        for queue in bad_queues:
            with self.subTest(queue=str(queue)[:100]):
                self.save["privateState"]["barracksQueues"] = {"1": queue}
                before = copy.deepcopy(self.save)
                self.send("pop_queue_unit", 1, 56, 56, 1529)
                self.assertEqual(self.save, before)
        # Restored durations must not make rounded positive timestamp text valid either.
        with self.content(), patch("soul_mixer.timestamp_now", return_value=2 ** 53 - 1):
            for timestamp in ["1.000000000000000001", "1700000000.000000001", "9007199254740991.1"]:
                self.save["privateState"]["barracksQueues"] = {"1": {"ts": timestamp, "amount": 1, "unit": 533}}
                self.send("pop_queue_unit", 1, 56, 56, 1529)
                self.assertEqual(len(self.map["items"]), 1, timestamp)
        for timestamp in [0, 0.0, "0"]:
            self.save["privateState"]["barracksQueues"] = {"1": {"ts": timestamp, "amount": "1", "unit": "533"}}
            before = len(self.map["items"])
            self.send("pop_queue_unit", 1, 56, 56, 1529)
            self.assertEqual(len(self.map["items"]), before + 1, "explicit numeric or text zero still collects")

    def test_active_queue_rejects_late_edit_commands_but_still_allows_turning(self):
        self.map["items"][0][7]["bq"] = "1"
        self.save["privateState"]["barracksQueues"] = {"1": {"ts": 100, "amount": 1, "unit": 533}}
        before = copy.deepcopy(self.save)
        self.send("move", 55, 55, 1529, 50, 50, 0, 0, "MouseUsed")
        self.send("sell", 55, 55, 1529, 0, 0, "UI")
        self.send("store_item", 55, 55, 0, 1529)
        self.send("pop_unit", 55, 55, 0, 509, 56, 56, 0)
        self.assertEqual(self.save, before)
        self.send("move", 55, 55, 1529, 55, 55, 1, 0, "MouseUsed")
        self.assertEqual(self.map["items"][0][3], 1)

    def test_claimed_other_town_keeps_its_original_queue_identity(self):
        other = copy.deepcopy(self.map)
        other["items"] = [[1529, 40, 40, 0, 0, 0, [], {"bq": "1"}]]
        self.save["maps"].append(other)
        self.save["privateState"]["barracksQueues"] = {"1": {"ts": 0, "amount": 0, "unit": 533}}
        with self.content():
            self.send("push_queue_unit", 55, 55, 1529, 533, 1, 0)
            self.assertNotIn("bq", self.map["items"][0][7])
            self.send("push_queue_unit", 55, 55, 1529, 533, 2, 0)
        self.assertEqual(self.map["items"][0][7]["bq"], "2")
        self.assertEqual(other["items"][0][7]["bq"], "1")
        self.assertEqual(self.save["privateState"]["barracksQueues"]["1"]["amount"], 0)
        self.assertEqual(self.save["privateState"]["barracksQueues"]["2"]["amount"], 1)


if __name__ == "__main__":
    unittest.main()
