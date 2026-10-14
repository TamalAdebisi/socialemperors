import json
import traceback

from sessions import session, save_session
from get_game_config import get_game_config, get_level_from_xp, get_name_from_item_id, get_attribute_from_mission_id, get_xp_from_level, get_attribute_from_item_id, get_item_from_subcat_functional
from constants import Constant
from engine import apply_cost, apply_collect, apply_collect_xp, timestamp_now
import bank
import temple
import game_collections
import graveyard
import inventory
import production
import quests
import shop
import levels
import magic
import market
import missions
import warehouse
import time_machine
import darts
import survival
import monday_bonus
import daily_bonus
import social
import assists
import pvp
import radar
import tournaments
import towns
import tutorial
import worlds


def get_strategy_type(id):
    if id == 8:
        return "Defensive"
    if id == 9:
        return "Mid Defensive"
    if id == 7:
        return "Mid Aggressive"
    if id == 10:
        return "Aggressive"
    return "Unknown Strategy"

def command(USERID, data):
    timestamp = data["ts"]
    first_number = data["first_number"]
    accessToken = data["accessToken"]
    tries = data["tries"]
    publishActions = data["publishActions"]
    commands = data["commands"]
    
    previous = None
    for i, comm in enumerate(commands):
        cmd = comm["cmd"]
        args = comm["args"]
        try:
            do_command(USERID, cmd, args, previous)
        except Exception as e:
            # One command the server gets wrong must not cost the player the rest of the batch.
            print(f"\n [!] Command failed: {cmd} {args}")
            traceback.print_exc()
            radar.failure(cmd, e, args, USERID)
        previous = comm
    save_session(USERID) # Save session

def do_command(USERID, cmd, args, previous=None):
    save = session(USERID)
    print (" [+] COMMAND: ", cmd, "(", args, ") -> ", sep='', end='')

    if cmd == Constant.CMD_GAME_STATUS:
        print(" ".join(args))

    elif cmd == Constant.CMD_BUY:
        id = args[0]
        x = args[1]
        y = args[2]
        orientation = args[3]
        town_id = int(args[4])
        free = bool(args[5]) # 1 if the game "buys" for you, so does not substract whatever the item cost is.
        price_multiplier = args[6]
        print("Add", str(get_name_from_item_id(id)), end=": ")
        print(shop.buy(save, id, x, y, orientation, town_id, free, price_multiplier))

    elif cmd == Constant.CMD_BUY_UNIT_WITH_CASH:
        id = args[0]
        x = args[1]
        y = args[2]
        orientation = args[3]
        town_id = int(args[4])
        # A hero with no Altar of Heroes to stand by goes to storage: the client stores it just before.
        already_stored = previous is not None and previous.get("cmd") == Constant.CMD_STORE_ADD_ITEMS \
            and [int(i) for i in json.loads(previous["args"][0])] == [int(id)]
        print("Buy", str(get_name_from_item_id(id)), "with cash", end=": ")
        print(shop.buy_with_cash(save, id, x, y, orientation, town_id, already_stored))

    elif cmd == Constant.CMD_BUY_OFFER_PACK:
        item_won = args[2] if len(args) > 2 else None
        print(shop.offer_pack(save, int(args[0]), int(args[1]), item_won))

    elif cmd == Constant.CMD_ADD_ITEMS_TO_STORE:
        print(shop.deal(save, args[0], args[1], towns.current(save)))

    elif cmd == Constant.CMD_BUY_STORED_ITEM_CASH:
        print(shop.collection_unit(save, int(args[0]), int(args[1]), args[2]))

    elif cmd == Constant.CMD_UNIT_COLLECTION_COMPLETED:
        print(shop.unit_collection_completed(save, int(args[0])))

    elif cmd == Constant.CMD_POP_SELL:
        print(shop.sacrifice(save, args[0], args[1], int(args[2]), args[3], args[4]))

    elif cmd == Constant.CMD_GOLD_STATUE_CONVERSION:
        print(shop.gold_statue(save, towns.current(save)))

    elif cmd == Constant.CMD_COMPLETE_TUTORIAL:
        print(tutorial.reached(save, args[0]))
    
    elif cmd == Constant.CMD_MOVE:
        ix = args[0]
        iy = args[1]
        id = args[2]
        newx = args[3]
        newy = args[4]
        frame = args[5]
        town_id = args[6]
        reason = args[7] # "Unitat", "moveTo", "colisio", "MouseUsed"
        print("Move", str(get_name_from_item_id(id)), "from", f"({ix},{iy})", "to", f"({newx},{newy})")
        map = save["maps"][town_id]
        for item in map["items"]:
            if item[0] == id and item[1] == ix and item[2] == iy:
                item[1] = newx
                item[2] = newy
                break
    
    elif cmd == Constant.CMD_COLLECT:
        x = args[0]
        y = args[1]
        town_id = int(args[2])
        id = args[3]
        print("Collect", str(get_name_from_item_id(id)), end=": ")
        if len(args) > 4: # a building: [..., workers inside, multiplier, cash to hurry]
            print(production.collect(save, x, y, town_id, id, workers=int(args[4]), multiplier=args[5], cash=args[6]))
        else: # not a building, or the Round Table
            print(production.collect(save, x, y, town_id, id))

    elif cmd == Constant.CMD_ACTIVATE:
        x = args[0]
        y = args[1]
        town_id = int(args[2])
        id = args[3]
        choice = args[4] # how long a farm or mill works, 1-4; 0 after collecting
        print(production.choose_working_time(save, x, y, town_id, id, choice))
    
    elif cmd == Constant.CMD_SELL:
        x = args[0]
        y = args[1]
        id = args[2]
        town_id = args[3]
        bool_dont_modify_resources = args[4]
        reason = args[5]
        print("Remove", str(get_name_from_item_id(id)), "from", f"({x},{y}). Reason: {reason}")
        map = save["maps"][town_id]
        for item in map["items"]:
            if item[0] == id and item[1] == x and item[2] == y:
                map["items"].remove(item)
                break
        if not bool_dont_modify_resources:
            price_multiplier = -0.05
            if get_attribute_from_item_id(id, "cost_type") != "c":
                apply_cost(save["playerInfo"], save["maps"][town_id], id, price_multiplier)
        if reason == 'KILL':
            print(graveyard.unit_died(save, id, args[6] if len(args) > 6 else 0))
    
    elif cmd == Constant.CMD_KILL:
        x = args[0]
        y = args[1]
        id = args[2]
        town_id = args[3]
        type = args[4]
        print("Kill", str(get_name_from_item_id(id)), "from", f"({x},{y}).")
        map = save["maps"][town_id]
        for item in map["items"]:
            if item[0] == id and item[1] == x and item[2] == y:
                apply_collect_xp(map, id)
                map["items"].remove(item)
                break
    
    elif cmd == Constant.CMD_COMPLETE_MISSION:
        mission_id = args[0]
        skipped_with_cash = bool(args[1])
        print(str(get_attribute_from_mission_id(mission_id, "title")), end=": ")
        print(missions.complete(save, mission_id, skipped_with_cash))

    elif cmd == Constant.CMD_REWARD_MISSION:
        town_id = int(args[0])
        mission_id = args[1]
        print(str(get_attribute_from_mission_id(mission_id, "title")), end=": ")
        print(missions.reward(save, town_id, mission_id))

    elif cmd == Constant.CMD_PUSH_UNIT:
        unit_x = args[0]
        unit_y = args[1]
        unit_id = args[2]
        b_x = args[3]
        b_y = args[4]
        town_id = args[5]
        print("Push", str(get_name_from_item_id(unit_id)), "to", f"({b_x},{b_y}).")
        map = save["maps"][town_id]
        # Unit into building
        for item in map["items"]:
            if item[1] == b_x and item[2] == b_y:
                if len(item) < 7:
                    item += [[]]
                workers_before = len(item[6])
                item[6] += [unit_id]
                production.worker_entered(item, workers_before)
                break
        # Remove unit
        for item in map["items"]:
            if item[0] == unit_id and item[1] == unit_x and item[2] == unit_y:
                map["items"].remove(item)
                break
    
    elif cmd == Constant.CMD_POP_UNIT:
        b_x = args[0]
        b_y = args[1]
        town_id = args[2]
        unit_id = args[3]
        place_popped_unit = len(args) > 4
        if place_popped_unit:
            unit_x = args[4]
            unit_y = args[5]
            unit_frame = args[6] # unknown use
        print("Pop", str(get_name_from_item_id(unit_id)), "from", f"({b_x},{b_y}).")
        map = save["maps"][town_id]
        # Remove unit from building
        for item in map["items"]:
            if item[1] == b_x and item[2] == b_y:
                if len(item) < 7:
                    break
                if unit_id in item[6]: # one the server didn't know was inside still comes out
                    item[6].remove(unit_id)
                break
        if place_popped_unit:
            # Spawn unit outside
            collected_at_timestamp = timestamp_now()
            level = 0 # TODO 
            orientation = 0
            map["items"] += [[unit_id, unit_x, unit_y, orientation, collected_at_timestamp, level]]
    
    elif cmd == Constant.CMD_RT_LEVEL_UP:
        new_level = args[0]
        print("Level Up!:", new_level, end="")
        map = save["maps"][towns.current(save)]  # the client sends no town: the one open
        map["level"] = args[0]
        current_xp = map["xp"]
        min_expected_xp = get_xp_from_level(max(0, new_level - 1))
        map["xp"] = max(min_expected_xp, current_xp) # try to fix problems with not counting XP... by keeping up with client-side level counting
        paid = levels.reached(save, map, new_level)  # the level up window's prize, and mana
        print(f" ({paid})" if paid else "")

    elif cmd == Constant.CMD_RT_PUBLISH_SCORE:
        new_xp = args[0]
        print("xp set to", new_xp)
        map = save["maps"][towns.current(save)]
        map["xp"] = new_xp
        map["level"] = get_level_from_xp(new_xp)
        paid = levels.reached(save, map, map["level"])  # a level up the server missed
        if paid:
            print("Level up:", paid)

    elif cmd == Constant.CMD_EXPAND:
        land_id = args[0]
        resource = args[1]
        town_id = int(args[2])
        print("Expansion", land_id, "purchased")
        map = save["maps"][town_id]
        if land_id in map["expansions"]:
            return
        # Substract resources
        expansion_prices = get_game_config()["expansion_prices"]
        exp = expansion_prices[len(map["expansions"]) - 1]
        if resource == "gold":
            to_substract = exp["coins"]
            save["maps"][town_id]["coins"] = max(save["maps"][town_id]["coins"] - to_substract, 0)
        elif resource == "cash":
            to_substract = exp["cash"]
            save["playerInfo"]["cash"] = max(save["playerInfo"]["cash"] - to_substract, 0)
        # Add expansion
        map["expansions"].append(land_id)

    elif cmd == Constant.CMD_NAME_MAP:
        town_id =int(args[0])
        new_name = args[1]
        print(f"Map name changed to '{new_name}'.")
        save["playerInfo"]["map_names"][town_id] = new_name

    elif cmd == Constant.CMD_EXCHANGE_CASH:
        print(bank.buy_gold(save, args[0]))

    elif cmd == Constant.CMD_STORE_ITEM or cmd == Constant.CMD_STORE_ITEM_FROMBUG:
        x = args[0]
        y = args[1]
        town_id = int(args[2])
        item_id = args[3]
        print("Store", str(get_name_from_item_id(item_id)), "from", f"({x},{y})", end=": ")
        print(inventory.put_away(save, x, y, town_id, item_id))

    elif cmd == Constant.CMD_STORE_ADD_ITEMS:
        ids = args[0] # JSON list of item ids: prizes, and heroes bought without an altar
        print(inventory.add_items(save, ids, towns.current(save)))

    elif cmd == Constant.CMD_PLACE_GIFT or cmd == Constant.CMD_PLACE_STORED_ITEM:
        item_id = args[0]
        x = args[1]
        y = args[2]
        orientation = args[3]
        town_id = int(args[4])
        print("Add", str(get_name_from_item_id(item_id)), "at", f"({x},{y})", end=": ")
        print(inventory.place(save, item_id, x, y, orientation, town_id, is_gift=(cmd == Constant.CMD_PLACE_GIFT)))

    elif cmd == Constant.CMD_SELL_GIFT or cmd == Constant.CMD_SELL_STORED:
        item_id = args[0]
        town_id = int(args[1])
        print("Sell", str(get_name_from_item_id(item_id)), "from storage", end=": ")
        print(inventory.sell(save, item_id, town_id, is_gift=(cmd == Constant.CMD_SELL_GIFT)))
    
    elif cmd == Constant.CMD_ACTIVATE_DRAGON:
        currency = args[0]
        print("Dragon nest activated.")
        prices = get_game_config()["globals"]
        if currency == 'c':
            save["playerInfo"]["cash"] = max(int(save["playerInfo"]["cash"] - int(prices["ACTIVATE_DRAGON_NEST_CASH"])), 0)
        elif currency == 'g':
            map = save["maps"][towns.current(save)]  # the client takes the gold of the town that is open
            map["coins"] = max(int(map["coins"] - int(prices["ACTIVATE_DRAGON_NEST_GOLD"])), 0)
        pState = save["privateState"]
        pState["dragonNestActive"] = 1
        # start again at the first egg, as the client does
        pState["stepNumber"] = 0
        pState["dragonNumber"] = 0
        pState["timeStampTakeCare"] = -1 # remove timer if any
    
    elif cmd == Constant.CMD_DESACTIVATE_DRAGON:
        print("Dragon nest deactivated.")
        pState = save["privateState"]
        pState["dragonNestActive"] = 0
        # reset step and dragon numbers
        pState["stepNumber"] = 0
        pState["dragonNumber"] = 0
        pState["timeStampTakeCare"] = -1 # remove timer if any

    elif cmd == Constant.CMD_NEXT_DRAGON_STEP:
        unknown = args[0]
        print("Dragon step increased.")
        pState = save["privateState"]
        pState["stepNumber"] += 1
        pState["timeStampTakeCare"] = timestamp_now()

    elif cmd == Constant.CMD_NEXT_DRAGON:
        print("Dragon step reset and dragonNumber increased.")
        pState = save["privateState"]
        pState["stepNumber"] = 0
        pState["dragonNumber"] += 1
        pState["timeStampTakeCare"] = -1 # remove timer

    elif cmd == Constant.CMD_DRAGON_BUY_STEP_CASH:
        price = args[0]
        print("Buy dragon step with cash.")
        save["playerInfo"]["cash"] = max(int(save["playerInfo"]["cash"] - price), 0)
        save["privateState"]["timeStampTakeCare"] = -1 # remove timer

    elif cmd == Constant.CMD_RIDER_BUY_STEP_CASH:
        price = args[0]
        print("Buy rider step with cash.")
        save["playerInfo"]["cash"] = max(int(save["playerInfo"]["cash"] - price), 0)
        save["privateState"]["riderTimeStamp"] = -1 # remove timer

    elif cmd == Constant.CMD_NEXT_RIDER_STEP:
        print("Rider step increased.")
        pState = save["privateState"]
        pState["riderStepNumber"] += 1
        pState["riderTimeStamp"] = timestamp_now()
    
    elif cmd == Constant.CMD_SELECT_RIDER:
        number = int(args[0])
        pState = save["privateState"]
        if number == 1 or number == 2 or number == 3:
            pState["riderNumber"] = number
            print("Rider", number, "Selected.")
        else:
            pState["riderNumber"] = 0
            pState["riderStepNumber"] = 0
            pState["riderTimeStamp"] = -1 # remove timer
            print("Rider reset.")
    
    elif cmd == Constant.CMD_ORIENT:
        x = args[0]
        y = args[1]
        new_orientation = args[2]
        town_id = args[3]
        print("Item at", f"({x},{y})", "changed to orientation", new_orientation)
        map = save["maps"][town_id]
        for item in map["items"]:
            if item[1] == x and item[2] == y:
                item[3] = new_orientation
                break
    
    elif cmd == Constant.CMD_MONSTER_BUY_STEP_CASH:
        price = args[0]
        print("Buy monster step with cash.")
        save["playerInfo"]["cash"] = max(int(save["playerInfo"]["cash"] - price), 0)
        save["privateState"]["timeStampTakeCareMonster"] = -1 # remove timer
    
    elif cmd == Constant.CMD_ACTIVATE_MONSTER:
        currency = args[0]
        print("Monster nest activated.")
        prices = get_game_config()["globals"]
        if currency == 'c':
            save["playerInfo"]["cash"] = max(int(save["playerInfo"]["cash"] - int(prices["ACTIVATE_MONSTER_NEST_CASH"])), 0)
        elif currency == 'g':
            map = save["maps"][towns.current(save)]  # the client takes the gold of the town that is open
            map["coins"] = max(int(map["coins"] - int(prices["ACTIVATE_MONSTER_NEST_GOLD"])), 0)
        pState = save["privateState"]
        pState["monsterNestActive"] = 1
        # start again at the first monster, as the client does (this also mends saves left on the last one)
        pState["stepMonsterNumber"] = 0
        pState["monsterNumber"] = 0
        pState["timeStampTakeCareMonster"] = -1 # remove timer if any
    
    elif cmd == Constant.CMD_DESACTIVATE_MONSTER: # cmd called too late
        print("Monster nest deactivated.")
        pState = save["privateState"]
        pState["monsterNestActive"] = 0
        pState["stepMonsterNumber"] = 0
        pState["monsterNumber"] = 0
        pState["timeStampTakeCareMonster"] = -1 # remove timer if any


    elif cmd == Constant.CMD_NEXT_MONSTER_STEP:
        print("Monster Step increased.")
        pState = save["privateState"]
        pState["stepMonsterNumber"] += 1
        pState["timeStampTakeCareMonster"] = timestamp_now()

    elif cmd == Constant.CMD_NEXT_MONSTER:
        print("Monster Step reset and Monster Number increased.")
        pState = save["privateState"]
        pState["stepMonsterNumber"] = 0
        pState["monsterNumber"] += 1
        pState["timeStampTakeCareMonster"] = -1 # remove timer

    elif cmd == Constant.CMD_WIN_BONUS:
        print(daily_bonus.collect(save, args[1], args[2], args[3]))

    elif cmd == Constant.CMD_ADMIN_ADD_ANIMAL:
        subcatFunc = str(args[0])
        toBeAdded = int(args[1])
        print("Added", toBeAdded, get_item_from_subcat_functional(subcatFunc)["name"])

        # TODO
        oAnimals: dict = save["privateState"]["arrayAnimals"]
        oAnimals[subcatFunc] = toBeAdded + (oAnimals[subcatFunc] if subcatFunc in oAnimals else 0)
    
    elif cmd == Constant.CMD_GRAVEYARD_BUY_POTIONS:
        # no args
        print("Graveyard buy potion")
        # info from config
        graveyard_potions = get_game_config()["globals"]["GRAVEYARD_POTIONS"]
        amount = graveyard_potions["amount"]
        price_cash = graveyard_potions["price"]["c"]
        # pay
        save["playerInfo"]["cash"] = max(int(save["playerInfo"]["cash"] - price_cash), 0)
        # add potion
        save["privateState"]["potion"] += amount

    elif cmd == Constant.CMD_RESURRECT_HERO:
        unit_id = args[0]
        x = args[1]
        y = args[2]
        town_id = args[3]
        used_potion = len(args) > 4 and str(args[4]) == "1"
        print("Resurrect", str(get_name_from_item_id(unit_id)), "from graveyard")
        print(graveyard.resurrect(save, unit_id, x, y, town_id, used_potion))

    elif cmd == Constant.CMD_PUT_GRAVEYARD:
        unit_id = args[0] # a phoenix whose egg was destroyed
        print(graveyard.bury(save, unit_id))

    elif cmd == Constant.CMD_BUY_SUPER_OFFER_PACK:
        items = args[2] # "item,item,..."; the price comes from shop.py, not args[3]
        print(shop.super_offer_pack(save, int(args[0]), int(args[1]), items))

    elif cmd == Constant.CMD_SET_STRATEGY:
        strategy_type = args[0]
        type_name = get_strategy_type(strategy_type)
        save["privateState"]["strategy"] = strategy_type
        print(f"Set defense strategy type to {type_name}")

    elif cmd == Constant.CMD_START_QUEST:
        quest_id = args[0]
        town_id = int(args[1])
        print(quests.start(save, quest_id, town_id))

    elif cmd == Constant.CMD_END_QUEST:
        result = json.loads(args[0]) # gold, xp, units sent/killed/recovered, win, difficulty, boss rewards
        print(quests.end(save, result))

    elif cmd == Constant.CMD_ADD_COLLECTABLE:
        collection_id = int(args[0])
        collectible_id = int(args[1])
        print(game_collections.add_piece(save, collection_id, collectible_id))

    elif cmd == Constant.CMD_FINISH_COLLECTION:
        collection_id = int(args[0])
        if len(args) > 1: # [collection, 1, price]: bought with cash; game_collections.py has its own prices
            print(game_collections.buy(save, collection_id))
        else:
            print(game_collections.exchange(save, collection_id))

    elif cmd == Constant.CMD_UNLOCK_BUILDING:
        print(shop.unlock_early(save, int(args[0])))

    elif cmd == Constant.CMD_SET_QUEST_VAR:
        print(missions.set_quest_var(save, int(args[0]), args[1], args[2]))

    elif cmd == Constant.CMD_COLLECT_TREASURE:
        gold, xp, next_raid, food, stone, town_id = args
        print(missions.collect_treasure(save, gold, xp, next_raid, food, stone, int(town_id)))

    elif cmd == Constant.CMD_BUY_MAGIC:
        print(magic.learn(save, args[0], int(args[1]), args[2]))

    elif cmd == Constant.CMD_USE_MAGIC:
        print(magic.cast(save, args[0]))

    elif cmd == Constant.CMD_BUY_MANA:
        print(magic.buy_mana(save, int(args[0]), args[1]))

    elif cmd == Constant.CMD_TRADE_RESOURCE:
        print(market.trade(save, int(args[0]), args[1], args[2], args[3]))

    elif cmd == Constant.CMD_SET_ATTACK_TEAM:
        mode = args[0] # "quest" or "tournament"
        pState = save["privateState"]
        if not isinstance(pState.get("teams"), dict):
            pState["teams"] = {}
        pState["teams"][mode] = json.loads(args[1])
        print("Team for", mode, "saved.")

    elif cmd in (Constant.CMD_TOURNAMENT_SUBSTRACT_RESOURCES, Constant.CMD_TOURNAMENT_REFUND_RESOURCES,
                 Constant.CMD_TOURNAMENT_WIN_REWARD):
        print(tournaments.bookkeeping(cmd, args))

    elif cmd == Constant.CMD_SET_INFO_SHOWED:
        pState = save["privateState"]
        if not isinstance(pState.get("infoShowed"), dict):
            pState["infoShowed"] = {}
        pState["infoShowed"][args[0]] = args[1]
        print("Info", args[0], "shown.")

    elif cmd == Constant.CMD_SET_HELP_MAP:
        pState = save["privateState"]
        if not isinstance(pState.get("helpMap"), list):
            pState["helpMap"] = []
        if args[0] not in pState["helpMap"]:
            pState["helpMap"].append(args[0])
        print("Help", args[0], "shown.")

    elif cmd == Constant.CMD_ADD_UNIT_WAREHOUSE:
        x, y, town_id, unit_id = args
        print(warehouse.add_unit(save, x, y, int(town_id), unit_id))

    elif cmd == Constant.CMD_PLACE_WAREHOUSED_ITEM:
        unit_id, x, y, orientation, town_id = args
        print(warehouse.place_unit(save, unit_id, x, y, orientation, int(town_id)))

    elif cmd == Constant.CMD_BUY_WAREHOUSE_CAPACITY_NEW:
        print(warehouse.buy_capacity(save, int(args[0])))

    elif cmd == Constant.CMD_RESET_WAREHOUSE:
        print(warehouse.empty(save, int(args[0])))

    elif cmd == Constant.CMD_TIME_MACHINE_BUY:
        print(time_machine.buy(save, int(args[0])))

    elif cmd == Constant.CMD_TIME_MACHINE_USE:
        print(time_machine.jump(save, int(args[0])))

    elif cmd == Constant.CMD_DARTS_RESET:
        print(darts.reset(save, args[0]))

    elif cmd == Constant.CMD_DARTS_NEW_FREE:
        print(darts.new_free(save))

    elif cmd == Constant.CMD_DARTS_SHOOT_BALLOON:
        print(darts.shoot(save, args[0], args[1], args[2]))

    elif cmd == Constant.CMD_UNLOCK_SKIN:
        print(shop.unlock_skin(save, args[0]))

    elif cmd == Constant.CMD_SET_SKIN:
        town_id, skin_id = int(args[0]), int(args[1])
        save["maps"][town_id]["skin"] = skin_id
        print("Island skin set to", skin_id)

    elif cmd == Constant.CMD_SURVIVAL_START:
        print(survival.start(save))

    elif cmd == Constant.CMD_SURVIVAL_END:
        print(survival.end(save, args[0], args[1], args[2], towns.current(save)))

    elif cmd == Constant.CMD_SURVIVAL_BUY_LIFE:
        print(survival.buy_life(save))

    elif cmd == Constant.CMD_BUY_MAP:
        print(towns.buy_map(save, *args[:4]))

    elif cmd == Constant.CMD_SURVIVAL_BUY_MAP:
        print(survival.buy_map(save, args[0]))

    elif cmd == Constant.CMD_COLLECT_MONDAY_BONUS:
        print(monday_bonus.collect(save, args[0], args[1], towns.current(save)))

    elif cmd == Constant.CMD_BUY_SI_HELP:
        x, y, town_id, building_id = args[:4]
        free = len(args) > 4 and str(args[4]) == "1"
        print(social.buy_helper(save, x, y, int(town_id), building_id, free))

    elif cmd == Constant.CMD_FINISH_SI:
        x, y, town_id, building_id = args[:4]
        hero = args[6] if len(args) > 6 else 0 # the Round Table also sends [gold, xp, hero]; social.py has its own table
        print(social.finish(save, x, y, int(town_id), building_id, hero))

    elif cmd == Constant.CMD_SET_RESOURCE_ALLIES:
        resource, x, y, town_id, building_id = args
        print(social.set_market_resource(save, resource, x, y, int(town_id), building_id))

    elif cmd == Constant.CMD_INCREASE_POPULATION:
        print(social.increase_population(save, int(args[0])))

    elif cmd == Constant.CMD_ASSIST_NEIGHBOUR_NEW:
        print(assists.help_buildings(save, args[0], args[2]))

    elif cmd == Constant.CMD_ASSIST_NEIGHBOUR:
        neighbour, request, town_id = args
        print(assists.help_request(save, neighbour, int(town_id)))

    elif cmd == Constant.CMD_ASSIST_RECEIVE:
        print(assists.receive(save, int(args[0]), args[1]))

    elif cmd == Constant.CMD_CLEAN_RECEIVED_ASSISTS:
        print(assists.clean(save, args[0], int(args[1])))

    elif cmd == Constant.CMD_ATTACK_PLAYER:
        print(pvp.attack(save, args[0]))

    elif cmd == Constant.CMD_END_ATTACK:
        no_town_hall = len(args) > 1 and bool(args[1])
        print(pvp.end(save, json.loads(args[0]), no_town_hall))

    elif cmd == Constant.CMD_SPY:
        print(pvp.spy(save, args[0]))

    elif cmd == Constant.CMD_CLEAN_ATTACKS:
        print(pvp.seen_attacks(save))

    elif cmd == Constant.CMD_RESET_ISLAND_CHANGE:
        save["privateState"]["worldChange"] = 0
        print("On to the new world.")

    elif cmd == Constant.CMD_MODIFY_POSITION_UNIVERSE:
        print(worlds.swap(save, args[0], args[1]))

    elif cmd == Constant.CMD_RESET_POSITION_UNIVERSE:
        print(worlds.relocate(save))

    elif cmd == Constant.CMD_APPLY_REWARDS_RANKING:
        print(worlds.prize(save, args[0]))  # the client's cash and units are its copy of the config's

    elif cmd == Constant.CMD_CLEAR_MSG:
        save["privateState"]["message"] = ""
        print("Message read.")

    elif cmd == Constant.CMD_PING:
        print("Still here, in game mode", args[0] if args else "?")

    elif cmd == Constant.CMD_BAHAMUT_SUPREME_INVOCATION_TEMPLE_NEXT_STEP:
        offering = args[0] # JSON of what the client paid; temple.py has its own table
        print(temple.next_step(save, int(args[1])))

    elif cmd == Constant.CMD_BAHAMUT_SUPREME_INVOCATION_TEMPLE_BUY_TIME:
        print(temple.skip_wait(save))

    elif cmd == Constant.CMD_BAHAMUT_SUPREME_INVOCATION_TEMPLE_RESET:
        print(temple.reset(save))

    else:
        print(f"Unhandled command '{cmd}' -> args", args)
        radar.note(radar.UNHANDLED, cmd, example=args, player=USERID)
        return
    
