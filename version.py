import random

from engine import timestamp_now

version_name = "alpha 0.05"
version_code = "0.05a"


def _has_entries(value) -> bool:
    """A dict, or a list with something in it (the client reads both alike)."""
    return isinstance(value, dict) or (isinstance(value, list) and len(value) > 0)


def add_missing_fields(save: dict) -> None:
    """Fields the game client reads that older saves (and the starting
    village) lack, or keep in a shape the client no longer understands.
    Safe to run on any save: nothing already there is changed."""
    pState = save["privateState"]
    for key in ("deadHeroes", "infoShowed", "teams"):
        if not _has_entries(pState.get(key)):
            pState[key] = {}  # older saves have [] here
    for key in ("attacksReceived", "spyings", "helpMap"):
        pState.setdefault(key, [])
    for key in ("honor", "attacksWon", "attacksLost", "worldChange"):
        pState.setdefault(key, 0)
    packets = pState.get("countTimePacket")
    packets = packets if isinstance(packets, list) else []
    pState["countTimePacket"] = packets + [0] * (6 - len(packets))  # one count per time machine jump
    if not pState.get("maps"):
        pState["maps"] = [{"r": m.get("race", "h")} for m in save["maps"]]  # the client asks how many towns there are

    for map in save["maps"]:
        for key in ("questTimes", "store", "currentQuestVars", "warehousedUnits"):
            if not _has_entries(map.get(key)):
                map[key] = {}
        map.setdefault("warehouseAditionalCapacitySingle", 50)  # the client's name; without it the warehouse holds nothing
        map.setdefault("numTradesDone", 0)
        map.setdefault("timestampLastTrade", 0)
        map.setdefault("resourceAlliesMarket", "n")  # the Allied Market starts with no resource chosen
        if not isinstance(map.get("universAttackWin"), list):
            map["universAttackWin"] = []  # the world map's islands beaten (worlds.py)


def migrate_loaded_save(save: dict) -> bool:

    # discard current version saves
    if save["version"] == version_code:
        return False
    
    # fix 0.01a saves
    if "version" not in save or save["version"] is None:
        save["version"] = "0.01a"
    
    # 0.01a -> 0.02a
    if save["version"] == "0.01a":
        save["maps"][0]["timestamp"] = timestamp_now()
        save["privateState"]["dartsRandomSeed"] = abs(int((2**16 - 1) * random.random()))
        save["version"] = "0.02a"
        print("   > migrated to 0.02a")
    
    # 0.02a -> 0.03a
    if save["version"] == "0.02a":
        if "arrayAnimals" not in save["privateState"]:
            save["privateState"]["arrayAnimals"] = {} # fix no animal spawning
        if "strategy" not in save["privateState"]:
            save["privateState"]["strategy"] = 8 # fix crash when attacking a player
        if "universAttackWin" not in save["maps"][0]:
            save["maps"][0]["universAttackWin"] = [] # pvp current island progress
        if "questTimes" not in save["maps"][0]:
            save["maps"][0]["questTimes"] = [] # quests
        if "lastQuestTimes" not in save["maps"][0]:
            save["maps"][0]["lastQuestTimes"] = [] # 1.1.5 quests
        save["version"] = "0.03a"
        print("   > migrated to 0.03a")
    
    # 0.03a -> 0.04a
    if save["version"] == "0.03a":
        if "pic" not in save["playerInfo"].keys():
            save["playerInfo"]["pic"] = ""
        if("survivalVidaTimeStamp" not in save["privateState"]):
            save["privateState"]["survivalVidaTimeStamp"] = []
        if("survivalVidasExtra" not in save["privateState"]):
            save["privateState"]["survivalVidasExtra"] = 0
        if("survivalMaps" not in save["privateState"]):
            save["privateState"]["survivalMaps"] = {
                "100000035": {
                    "ts": 0,
                    "tp": 0
                },
                "100000036": {
                    "ts": 0,
                    "tp": 0
                },
                "100000037": {
                    "ts": 0,
                    "tp": 0
                }
            }
        save["version"] = "0.04a"
        print("   > migrated to 0.04a")

    # 0.04a -> 0.05a
    if save["version"] == "0.04a":
        add_missing_fields(save)
        save["version"] = "0.05a"
        print("   > migrated to 0.05a")

    # 0.05a -> 0.06a
    #if save["version"] == "0.05a":
    #    save["version"] = "0.06a"
    #    print("   > migrated to 0.06a")

    return True