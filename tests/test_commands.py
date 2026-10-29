"""
The commands no other test sends: the dragon and monster nests, the dragon
riders, moving things on the map, land, the graveyard, survival and the rest.
Replays them the way the game client sends them.

Run from the repository folder:  python -m unittest discover tests
"""

import copy
import os
import tempfile
import unittest

os.environ["SE_DATA_DIR"] = tempfile.mkdtemp(prefix="se-test-")

import sessions
import towns
from command import do_command
from engine import timestamp_now
from get_player_info import get_player_info
from get_game_config import get_game_config
from village import number

GLOBALS = get_game_config()["globals"]
EXPANSION_PRICES = get_game_config()["expansion_prices"]
TOWN = 0
DRAGGY, KING_KONG, DRAGON_RIDER = 638, 717, 822  # the first dragon, monster and rider
TOWER, GOLD_MINE, PEASANT, LIGHT_KNIGHT, SMALL_TROLL = 33, 13, 500, 512, 525
COW, SHEEP = 74, 75  # subcat_functional, as the client counts its animals
# The client's own prices to skip a 6-hour wait (the game config has none):
CARE_STEP_CASH, FEED_STEP_CASH, MONSTER_STEP_CASH = 3, 15, 7  # the original's, paid in food since 29 October 2026
FOOD_PER_CASH = 500  # speedups.py
NO_WAIT = -1  # the server's mark for a wait that is over
X, Y = 60, 60  # an empty spot in a new village


class CommandsTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        sessions.load_saved_villages()

    def setUp(self):
        self.pid = sessions.new_village(owner_id=None)
        self.save = sessions.session(self.pid)
        self.map = self.save["maps"][TOWN]
        self.pState = self.save["privateState"]
        self.save["playerInfo"]["cash"] = 200
        self.map.update(coins=200000, food=20000, xp=0)

    def send(self, cmd, *args):
        do_command(self.pid, cmd, list(args))

    def cash(self):
        return self.save["playerInfo"]["cash"]

    def at(self, item_id, x, y, town=None):
        town = self.map if town is None else town
        return [item for item in town["items"] if item[:3] == [item_id, x, y]]

    def open_second_town(self):
        town = towns.new_town(1, "t")
        town["coins"] = 200000
        self.save["maps"].append(town)
        towns.open_town(self.save, 1)
        return town

    def assertChangesNothing(self, cmd, *args):
        before = copy.deepcopy(self.save)
        self.send(cmd, *args)
        self.assertEqual(self.save, before)

    # The dragon nest

    def test_opening_the_dragon_nest_with_cash(self):
        self.pState["dragonNestActive"] = 0
        self.send("activate_dragon", "c")
        self.assertEqual(self.pState["dragonNestActive"], 1)
        self.assertEqual(self.cash(), 200 - GLOBALS["ACTIVATE_DRAGON_NEST_CASH"])
        self.assertEqual(self.map["coins"], 200000)

    def test_opening_the_dragon_nest_with_gold_from_the_town_that_is_open(self):
        self.pState["dragonNestActive"] = 0
        trolls = self.open_second_town()
        self.send("activate_dragon", "g")
        self.assertEqual(trolls["coins"], 200000 - GLOBALS["ACTIVATE_DRAGON_NEST_GOLD"])
        self.assertEqual(self.map["coins"], 200000)  # before, the first town paid
        self.assertEqual(self.cash(), 200)

    def test_a_dragon_step_starts_a_six_hour_wait(self):
        before = timestamp_now()
        self.send("next_step", 0)  # the step's price: 0 in this client
        self.assertEqual(self.pState["stepNumber"], 1)
        self.assertGreaterEqual(self.pState["timeStampTakeCare"], before)
        self.assertEqual(self.cash(), 200)

    def test_the_tutorial_gives_the_nest_seven_steps(self):
        self.pState["timeStampTakeCare"] = 0
        for _ in range(7):
            self.send("next_step", "0")
        self.assertEqual(self.pState["stepNumber"], 7)
        self.assertEqual(self.pState["timeStampTakeCare"], 0, "no wait after the lessons' gift, as the Flash client showed")

    def test_skipping_a_dragon_wait_with_food(self):
        self.send("next_step", 0)
        self.send("buy_step_cash", CARE_STEP_CASH)
        self.assertEqual(self.pState["timeStampTakeCare"], NO_WAIT)
        self.assertEqual((self.cash(), self.map["food"]), (200, 20000 - 1500))
        self.pState["dragonNumber"] = 1  # every other dragon is fed, and feeding costs more
        self.send("next_step", 1)
        self.send("buy_step_cash", 1)  # the price is the server's, whatever the client says
        self.assertEqual((self.cash(), self.map["food"]), (200, 20000 - 1500 - 7500))
        self.assertEqual(self.pState["timeStampTakeCare"], NO_WAIT)

    def test_no_dragon_speed_up_without_the_food(self):
        self.map["food"] = 1499
        self.send("next_step", 0)
        self.send("buy_step_cash", CARE_STEP_CASH)
        self.assertNotEqual(self.pState["timeStampTakeCare"], NO_WAIT, "still waiting")
        self.assertEqual((self.cash(), self.map["food"]), (200, 1499))

    def test_taking_a_dragon_home(self):
        self.pState.update(stepNumber=10, dragonNumber=0)
        self.send("buy", DRAGGY, X, Y, 0, TOWN, 1, 1, "u")  # placed by the nest, for nothing
        self.send("next_dragon", "0")
        self.assertEqual(len(self.at(DRAGGY, X, Y)), 1)
        self.assertEqual(self.cash(), 200)
        self.assertEqual((self.pState["dragonNumber"], self.pState["stepNumber"]), (1, 0))
        self.assertEqual(self.pState["timeStampTakeCare"], NO_WAIT)

    def test_after_the_last_dragon_the_nest_closes(self):
        self.pState.update(dragonNumber=6, stepNumber=0, timeStampTakeCare=timestamp_now())
        self.send("desactivate_dragon")
        self.assertEqual(self.pState["dragonNestActive"], 0)
        self.assertEqual((self.pState["dragonNumber"], self.pState["stepNumber"]), (0, 0))
        self.assertEqual(self.pState["timeStampTakeCare"], NO_WAIT)

    def test_reopening_the_dragon_nest_starts_at_the_first_egg(self):
        self.pState.update(dragonNestActive=0, dragonNumber=6, stepNumber=3)
        self.send("activate_dragon", "c")
        self.assertEqual((self.pState["dragonNumber"], self.pState["stepNumber"]), (0, 0))

    # The monster nest

    def test_opening_the_monster_nest_with_cash(self):
        self.send("activate_monster", "c")
        self.assertEqual(self.pState["monsterNestActive"], 1)
        self.assertEqual(self.cash(), 200 - GLOBALS["ACTIVATE_MONSTER_NEST_CASH"])

    def test_opening_the_monster_nest_with_gold_from_the_town_that_is_open(self):
        trolls = self.open_second_town()
        self.send("activate_monster", "g")
        self.assertEqual(trolls["coins"], 200000 - GLOBALS["ACTIVATE_MONSTER_NEST_GOLD"])
        self.assertEqual(self.map["coins"], 200000)

    def test_a_monster_step_starts_a_six_hour_wait(self):
        before = timestamp_now()
        self.send("next_monster_step", 0)
        self.assertEqual(self.pState["stepMonsterNumber"], 1)
        self.assertGreaterEqual(self.pState["timeStampTakeCareMonster"], before)

    def test_skipping_a_monster_wait_with_food(self):
        self.send("next_monster_step", 0)
        self.send("buy_monster_step_cash", MONSTER_STEP_CASH)
        self.assertEqual(self.pState["timeStampTakeCareMonster"], NO_WAIT)
        self.assertEqual((self.cash(), self.map["food"]), (200, 20000 - MONSTER_STEP_CASH * FOOD_PER_CASH))

    def test_taking_a_monster_home(self):
        self.pState.update(monsterNestActive=1, stepMonsterNumber=10, monsterNumber=0)
        self.send("buy", KING_KONG, X, Y, 0, TOWN, 1, 1, "u")
        self.send("next_monster", "0")
        self.assertEqual(len(self.at(KING_KONG, X, Y)), 1)
        self.assertEqual((self.pState["monsterNumber"], self.pState["stepMonsterNumber"]), (1, 0))
        self.assertEqual(self.pState["timeStampTakeCareMonster"], NO_WAIT)

    def test_after_the_last_monster_the_nest_closes(self):
        self.pState.update(monsterNestActive=1, monsterNumber=4, stepMonsterNumber=0)
        self.send("desactivate_monster")
        self.assertEqual(self.pState["monsterNestActive"], 0)
        # Before, "MonsterNumber" was reset instead: the client then closed a reopened nest on reload.
        self.assertEqual((self.pState["monsterNumber"], self.pState["stepMonsterNumber"]), (0, 0))
        self.assertNotIn("MonsterNumber", self.pState)

    def test_reopening_the_monster_nest_starts_at_the_first_monster(self):
        self.pState.update(monsterNestActive=0, monsterNumber=4)  # as the old desactivate_monster left it
        self.send("activate_monster", "c")
        self.assertEqual((self.pState["monsterNumber"], self.pState["stepMonsterNumber"]), (0, 0))

    # Dragon riders

    def test_choosing_a_rider_to_train(self):
        self.send("rider_select", 2)
        self.assertEqual(self.pState["riderNumber"], 2)

    def test_a_training_step_starts_a_wait(self):
        self.send("rider_select", 1)
        before = timestamp_now()
        self.send("rider_next_step", "1")
        self.assertEqual(self.pState["riderStepNumber"], 1)
        self.assertGreaterEqual(self.pState["riderTimeStamp"], before)

    def test_skipping_a_training_wait_with_food(self):
        self.send("rider_select", 1)
        self.send("rider_next_step", "1")
        price = GLOBALS["DRAGON_RIDERS"]["1"]["stepCost"]
        self.send("rider_buy_step_cash", price)
        self.assertEqual(self.pState["riderTimeStamp"], NO_WAIT)
        self.assertEqual((self.cash(), self.map["food"]), (200, 20000 - price * FOOD_PER_CASH))
        self.map["food"] = price * FOOD_PER_CASH - 1
        self.send("rider_next_step", "1")
        self.send("rider_buy_step_cash", price)  # a food short
        self.assertNotEqual(self.pState["riderTimeStamp"], NO_WAIT)
        self.assertEqual(self.map["food"], price * FOOD_PER_CASH - 1)

    def test_a_trained_rider_comes_out(self):
        self.pState.update(riderNumber=1, riderStepNumber=GLOBALS["DRAGON_RIDERS"]["1"]["steps"])
        self.send("buy", DRAGON_RIDER, X, Y, 0, TOWN, 1, 1, "u")
        self.send("rider_select", "0")
        self.assertEqual(len(self.at(DRAGON_RIDER, X, Y)), 1)
        self.assertEqual((self.pState["riderNumber"], self.pState["riderStepNumber"]), (0, 0))
        self.assertEqual(self.pState["riderTimeStamp"], NO_WAIT)

    # Moving things on the map

    def test_moving_a_building_with_the_mouse(self):
        self.map["items"].append([TOWER, X, Y, 1, 0, 0])
        self.send("move", X, Y, TOWER, 62, 64, 1, TOWN, "mouseUsed")
        self.assertEqual(self.at(TOWER, X, Y), [])
        self.assertEqual(self.at(TOWER, 62, 64)[0][3], 1)  # its orientation kept

    def test_a_building_turned_while_moved(self):
        self.map["items"].append([TOWER, X, Y, 0, 0, 0])
        self.send("move", X, Y, TOWER, 62, 64, 1, TOWN, "mouseUsed")
        self.assertEqual(self.at(TOWER, 62, 64)[0][3], 1)  # it faces the way it was turned to

    def test_a_unit_walking(self):
        self.send("move", 50, 44, LIGHT_KNIGHT, 55, 45, 2, TOWN, "Unitat")
        self.assertEqual(len(self.at(LIGHT_KNIGHT, 55, 45)), 1)
        self.assertEqual(self.at(LIGHT_KNIGHT, 50, 44), [])
        self.assertEqual(len(self.at(LIGHT_KNIGHT, 50, 42)), 1)  # the other knight stays

    def test_moving_in_the_second_town(self):
        trolls = self.open_second_town()
        for town in (self.map, trolls):
            town["items"].append([TOWER, X, Y, 0, 0, 0])
        self.send("move", X, Y, TOWER, 62, 64, 0, 1, "moveTo")
        self.assertEqual(len(self.at(TOWER, 62, 64, trolls)), 1)
        self.assertEqual(len(self.at(TOWER, X, Y)), 1)

    def test_turning_a_building(self):
        self.map["items"].append([TOWER, X, Y, 0, 0, 0])
        self.send("orient", X, Y, 1, TOWN)
        self.assertEqual(self.at(TOWER, X, Y)[0][3], 1)

    def test_killing_an_enemy(self):
        self.send("kill", 40, 40, SMALL_TROLL, TOWN, "u")  # one of Arthur's first trolls
        self.assertEqual(self.at(SMALL_TROLL, 40, 40), [])
        self.assertEqual(len(self.at(SMALL_TROLL, 39, 40)), 1)
        self.assertEqual(self.map["xp"], number(SMALL_TROLL, "collect_xp"))

    def test_a_worker_leaving_a_building(self):
        mine = [GOLD_MINE, X, Y, 0, 0, 0, [PEASANT, PEASANT]]
        self.map["items"].append(mine)
        self.send("pop_unit", X, Y, TOWN, PEASANT, 63, 61, 0)
        self.assertEqual(mine[6], [PEASANT])
        self.assertEqual(len(self.at(PEASANT, 63, 61)), 1)

    def test_a_unit_taken_out_and_not_placed(self):
        # The stables and the ranches use the unit up: four arguments, nothing placed.
        mine = [GOLD_MINE, X, Y, 0, 0, 0, [PEASANT]]
        self.map["items"].append(mine)
        self.send("pop_unit", X, Y, TOWN, PEASANT)
        self.assertEqual(mine[6], [])
        self.assertEqual([item for item in self.map["items"] if item[0] == PEASANT], [])

    def test_a_unit_the_server_did_not_have_inside_still_comes_out(self):
        # Before, this failed and the unit the client placed outside was lost on reload.
        mine = [GOLD_MINE, X, Y, 0, 0, 0, []]
        self.map["items"].append(mine)
        self.send("pop_unit", X, Y, TOWN, PEASANT, 63, 61, 0)
        self.assertEqual(mine[6], [])
        self.assertEqual(len(self.at(PEASANT, 63, 61)), 1)

    # Land

    def test_buying_land_with_gold(self):
        self.assertEqual(self.map["expansions"], [13])
        self.send("expand", 12, "gold", TOWN)
        self.assertEqual(self.map["expansions"], [13, 12])
        self.assertEqual(self.map["coins"], 200000 - EXPANSION_PRICES[0]["coins"])
        self.assertEqual(self.cash(), 200)

    def test_buying_land_with_cash(self):
        self.send("expand", 12, "gold", TOWN)
        self.send("expand", 14, "cash", TOWN)  # the second piece costs more
        self.assertEqual(self.map["expansions"], [13, 12, 14])
        self.assertEqual(self.cash(), 200 - EXPANSION_PRICES[1]["cash"])

    def test_land_already_owned_is_not_paid_again(self):
        self.send("expand", 13, "cash", TOWN)
        self.assertEqual(self.map["expansions"], [13])
        self.assertEqual(self.cash(), 200)

    # The graveyard

    def test_buying_potions(self):
        # The pack's 100 cash, at 500 gold a cash, half in gold and half in food (graveyard.py).
        potions = GLOBALS["GRAVEYARD_POTIONS"]
        self.pState["potion"] = 2
        self.map["food"] = 30000
        self.send("graveyard_buy_potions")
        self.assertEqual(self.pState["potion"], 2 + potions["amount"])
        self.assertEqual((self.cash(), self.map["coins"], self.map["food"]), (200, 200000 - 25000, 30000 - 25000))
        self.send("graveyard_buy_potions")  # 5,000 food left
        self.assertEqual((self.pState["potion"], self.map["coins"], self.map["food"]), (2 + potions["amount"], 175000, 5000))

    # Survival

    def test_opening_a_survival_map(self):
        self.assertNotIn("100000038", self.pState["survivalMaps"])
        price = GLOBALS["SURVIVAL_UNLOCK_MAP_CASH"][3]  # the fourth map
        self.send("buy_survival_map", "100000038", price)
        self.assertEqual(self.pState["survivalMaps"]["100000038"], {"ts": 0, "tp": 0})
        self.assertEqual(self.cash(), 200 - price)
        self.send("buy_survival_map", "100000038", price)  # already open: nothing more to pay
        self.assertEqual(self.cash(), 200 - price)

    # The rest

    def test_the_client_reporting_where_it_is(self):
        self.assertChangesNothing("game_status", "MapLoaded", "INIT", "")
        self.assertChangesNothing("game_status", "LOAD_MAP", "NORM", "QUEST")

    def test_choosing_how_the_town_defends(self):
        self.send("set_strategy", 10)  # the most aggressive
        self.assertEqual(self.pState["strategy"], 10)

    def test_the_animals_the_client_spawns_are_counted(self):
        self.send("admin_add_animal", SHEEP, 4)
        self.send("admin_add_animal", COW, 3)
        self.send("admin_add_animal", SHEEP, 2)
        self.assertEqual(self.pState["arrayAnimals"], {str(SHEEP): 6, str(COW): 3})

    def test_the_animals_count_starts_again_each_day(self):
        self.send("admin_add_animal", SHEEP, 20)
        self.pState["arrayAnimalsDay"] -= 1  # as if added yesterday
        self.send("admin_add_animal", COW, 2)
        self.assertEqual(self.pState["arrayAnimals"], {str(COW): 2})
        # And on opening the town, for the client to read.
        self.pState["arrayAnimalsDay"] -= 1
        get_player_info(self.pid)
        self.assertEqual(self.pState["arrayAnimals"], {})

    def test_the_client_cannot_claim_a_tournament_prize(self):
        # tournaments.py pays the prize itself when the tournament ends.
        self.assertChangesNothing("win_reward_tournament", "c", 10)


if __name__ == "__main__":
    unittest.main()
