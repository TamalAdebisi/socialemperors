import json
import os
import jsonpatch
import economy
from paths import MODS_DIR, CONFIG_DIR, CONFIG_PATCH_DIR

__game_config = json.load(open(os.path.join(CONFIG_DIR, "game_config_20120826.json"), 'r', encoding='utf-8'))

def remove_duplicate_items():
    indexes = {}
    items = __game_config["items"]
    num_duplicate = 0

    while True:
        index = 0
        duplicate = False
        for item in items:
            if item["id"] in indexes:
                del items[indexes[item["id"]]]
                indexes.clear()
                duplicate = True
                num_duplicate += 1
                break

            indexes[item["id"]] = index
            index += 1

        if duplicate:
            continue
        
        if num_duplicate:
            print(f" * Removed {num_duplicate} duplicate items from config patches")
        break

def apply_config_patch(filename):
    patch = json.load(open(filename, 'r'))
    jsonpatch.apply_patch(__game_config, patch, in_place=True)

def patch_game_config():

    # Apply patches

    for patch_file in os.listdir(CONFIG_PATCH_DIR):
        if patch_file.endswith(".json"):
            f = os.path.join(CONFIG_PATCH_DIR, patch_file)
            apply_config_patch(f)
            patch = patch_file.replace(".json", "")
            print(" * Patch applied:", patch)

    # Apply mods

    if os.path.exists(MODS_DIR + "/mods.txt"):
        with open(MODS_DIR + "/mods.txt", "r") as f:
            lines = f.readlines()
            f.close()

        for line in lines:
            mod = line.strip()
            if mod.startswith("#"):
                continue
            if mod != "":
                mod.replace(".json", "")
                mod_path = f"{MODS_DIR}/{mod}.json"
                if os.path.exists(mod_path):
                    apply_config_patch(mod_path)
                    print(" * Mod applied:", mod)

    remove_duplicate_items()
    sell_more_barracks(__game_config)
    soul_mixer_from_the_wiki(__game_config)
    economy.patch_config(__game_config)  # where cash comes from: economy.py
    villagers_take_no_room(__game_config)


VILLAGERS = "71"  # subcat_functional of the workers: the villagers and the trolls' Mr. and Mrs. Troll


def villagers_take_no_room(config: dict) -> None:
    """The owner's rule (DECISIONS.md, 20 October 2026): the population cap is
    for fighting units, so workers take no room. Both game clients count a
    town's people from each unit's population in this config, and only train
    or place a unit while it fits, so a population of 0 does it for both."""
    for item in config["items"]:
        if str(item.get("subcat_functional")) == VILLAGERS and item.get("type") == "u":
            item["population"] = "0"

# Barracks the game's data has but its shop never sold (the original handed
# them out in events and offers), so their units couldn't be earned. The
# owner's call (DECISIONS.md, 20 October 2026): the shop sells them, in New,
# Limited Edition, beside the barracks it already sells, at their own price
# and level. Left out: the Zeus, Dwarf Axe and Dwarf Priest barracks, which
# train what another barracks here trains, and the Necro Shark Barracks,
# which has no picture in the game's files.
MORE_BARRACKS = (
    410, 423, 424, 468, 484, 1223, 1224, 1225, 1235, 1243, 1244, 1245, 1250, 1275, 1280, 1281, 1290, 1291,
    1303, 1305, 1306, 1310, 1321, 1322, 1325, 1329, 1342, 1343, 1347, 1348, 1364, 1380, 1382, 1400, 1401,
    1414, 1416, 1421, 1424, 1435, 1436, 1437, 1474, 1482, 1484, 1486, 1492, 1494, 1495, 1509, 1512, 1516,
    1517, 1518, 1519, 1520, 1521,
)


def sell_more_barracks(config: dict) -> None:
    """Puts MORE_BARRACKS in the human shop (in_store 1), as both clients read it."""
    wanted = set(MORE_BARRACKS)
    for item in config["items"]:
        if int(item["id"]) in wanted:
            item["in_store"] = "1"


SOUL_MIXER_WIKI = os.path.join(CONFIG_DIR, "soulmixer_wiki.json")


def soul_mixer_from_the_wiki(config: dict) -> None:
    """The Soul Mixer's tables, rebuilt from the community wiki (the owner's
    call, 19 October 2026; tools/soul_mixer_wiki.py makes the file). Only
    when the config has none of its own: a genuine original config, with
    breeding_order on its units, replaces all of it."""
    if any(item.get("breeding_order") for item in config["items"]) or not os.path.exists(SOUL_MIXER_WIKI):
        return
    with open(SOUL_MIXER_WIKI) as f:
        tables = json.load(f)
    units = tables["units"]
    for item in config["items"]:
        unit = units.get(str(item["id"]))
        if unit and item["type"] == "u":
            item["breeding_order"] = str(unit["breeding_order"])
            item["sm_training_time"] = str(unit["sm_training_time"])
    for name, row in tables["globals"].items():
        config["globals"].setdefault(name, row["value"])


print (" [+] Applying config patches and mods...")
patch_game_config()

def get_game_config() -> dict:
    return __game_config

def game_config() -> dict:
    return get_game_config()

##########
# PLAYER #
##########

def get_xp_from_level(level: int) -> int:
    return __game_config["levels"][int(level)]["exp_required"]

def get_level_from_xp(xp: int) -> int:
    i = 0
    for lvl in __game_config["levels"]:
        if lvl["exp_required"] > int(xp):
            return i
        i += 1
    return 0

#########
# ITEMS #
#########

# ID

items_dict_id_to_items_index = {int(item["id"]): i for i, item in enumerate(__game_config["items"])}

def get_item_from_id(id: int) -> dict:
    items_index = items_dict_id_to_items_index[int(id)] if int(id) in items_dict_id_to_items_index else None
    return __game_config["items"][items_index] if items_index is not None else None

def get_attribute_from_item_id(id: int, attribute_name: str) -> str:
    item = get_item_from_id(id)
    return item[attribute_name] if item and attribute_name in item else None

def get_name_from_item_id(id: int) -> str:
    return get_attribute_from_item_id(id, "name")

# subcat_functional

items_dict_subcat_functional_to_items_index = {int(item["subcat_functional"]): i for i, item in enumerate(__game_config["items"])}

def get_item_from_subcat_functional(subcat_functional: int) -> dict:
    items_index = items_dict_subcat_functional_to_items_index[int(subcat_functional)] if int(subcat_functional) in items_dict_subcat_functional_to_items_index else None
    return __game_config["items"][items_index] if items_index is not None else None

############
# MISSIONS #
############

missions_dict_id_to_missions_index = {int(item["id"]): i for i, item in enumerate(__game_config["missions"])}

def get_mission_from_id(id: int) -> dict:
    items_index = missions_dict_id_to_missions_index[int(id)] if int(id) in missions_dict_id_to_missions_index else None
    return __game_config["missions"][items_index] if items_index is not None else None

def get_attribute_from_mission_id(id: int, attribute_name: str) -> str:
    mission = get_mission_from_id(id)
    return mission[attribute_name] if mission and attribute_name in mission else None