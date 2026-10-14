"""
In-memory game state plus persistence.

All villages are held in memory while the server runs (the game reads and
changes them constantly), and changes are written to storage in the
background - see storage.py for why.

IMPORTANT: because the live state is in this process's memory, run exactly ONE
server process (you can still use several threads). Two processes would each
have their own copy of every village and overwrite each other's saves.
"""

import atexit
import copy
import json
import os
import random
import signal
import threading
import uuid

import config_env
from bundle import VILLAGES_DIR, SAVES_DIR
from constants import Constant
from engine import timestamp_now
from storage import open_storage
from version import version_code, migrate_loaded_save, add_missing_fields
import radar
import tutorial

# Every request that reads or changes game state holds this lock, so two
# requests can never change the same village at the same moment.
LOCK = threading.RLock()

__villages = {}  # static neighbours shipped with the game (Arthur, quests...)
__saves = {}     # player villages: pid -> village dict
__owners = {}    # pid -> account id (None for old imported saves)
__dirty = set()  # pids changed since the last flush
__storage = None

# Held while villages are written to storage (without LOCK, so play goes on).
# Deleting a village takes it too, so a write already under way, made from a
# copy taken before the delete, can't bring the village back.
__writing = threading.Lock()

__initial_village = json.load(open(os.path.join(VILLAGES_DIR, "initial.json")))

ARTHUR_PIDS = {
    Constant.NEIGHBOUR_ARTHUR_GUINEVERE_1,
    Constant.NEIGHBOUR_ARTHUR_GUINEVERE_2,
    Constant.NEIGHBOUR_ARTHUR_GUINEVERE_3,
}


def storage():
    return __storage


# Loading

def load_saved_villages():
    """Load everything once at startup."""
    global __storage
    with LOCK:
        __villages.clear()
        __saves.clear()
        __owners.clear()

        for file in sorted(os.listdir(VILLAGES_DIR)):
            if file == "initial.json" or not file.endswith(".json"):
                continue
            village = json.load(open(os.path.join(VILLAGES_DIR, file)))
            if not is_valid_village(village):
                print(f" * Static neighbour {file}: invalid, skipped")
                continue
            pid = str(village["playerInfo"]["pid"])
            __villages.setdefault(pid, village)

        __storage = open_storage()
        for pid, owner_id, village in __storage.load_all_villages():
            __saves[pid] = village
            __owners[pid] = owner_id
            if migrate_loaded_save(village):
                __dirty.add(pid)
            add_missing_fields(village)  # fields added since the save was last migrated; saved with its next change
        print(f" * Loaded {len(__saves)} player villages and {len(__villages)} static neighbours")

        _import_legacy_saves()
    flush()


def _import_legacy_saves():
    """Bring in old saves/*.save.json files from the original single-player
    version. They have no owner until an admin assigns one (tools/assign_village.py)."""
    if not os.path.isdir(SAVES_DIR):
        return
    for file in os.listdir(SAVES_DIR):
        if not file.endswith(".save.json"):
            continue
        try:
            save = json.load(open(os.path.join(SAVES_DIR, file)))
        except json.decoder.JSONDecodeError:
            print(f" * Legacy save {file}: corrupted JSON, skipped")
            continue
        if not is_valid_village(save):
            continue
        pid = str(save["playerInfo"]["pid"])
        if pid in __saves:
            continue
        migrate_loaded_save(save)
        __saves[pid] = save
        __owners[pid] = None
        __dirty.add(pid)
        print(f" * Imported legacy save {file} (no owner yet)")


# Persistence (write-behind)

def save_session(USERID: str):
    """Mark a village as changed. The background flusher writes it soon."""
    with LOCK:
        __dirty.add(str(USERID))


def flush():
    """Write every changed village (and the bug radar's counts) to storage now."""
    if __storage is None:
        return
    with __writing:
        with LOCK:
            # Snapshot under the lock so we never write a half-applied command.
            items = [(pid, __owners.get(pid), copy.deepcopy(__saves[pid])) for pid in __dirty if pid in __saves]
            __dirty.clear()
        if items:
            try:
                __storage.save_villages(items)
            except Exception as e:
                print(f" [!] Saving failed, will retry: {e}")
                with LOCK:
                    __dirty.update(pid for pid, _, _ in items)
    radar.flush(__storage)


def start_background_saver(interval_seconds: int = 5, handle_sigterm: bool = False):
    def loop():
        stop = threading.Event()
        while not stop.wait(interval_seconds):
            flush()
    threading.Thread(target=loop, name="village-saver", daemon=True).start()

    # Save once more on a normal exit.
    atexit.register(flush)

    # Hosts send SIGTERM before shutting a server down. Python's default is to
    # die on the spot (skipping atexit), so when we run as `python server.py`
    # we catch it and save first. Under gunicorn we leave signals alone -
    # gunicorn handles them and gunicorn.conf.py saves on exit instead.
    if handle_sigterm:
        def on_sigterm(signum, frame):
            flush()
            raise SystemExit(0)
        signal.signal(signal.SIGTERM, on_sigterm)


# Creating villages

def new_village(owner_id) -> str:
    USERID = str(uuid.uuid4())
    village = copy.deepcopy(__initial_village)
    village["version"] = version_code
    village["playerInfo"]["pid"] = USERID
    village["maps"][0]["timestamp"] = timestamp_now()
    village["privateState"]["dartsRandomSeed"] = abs(int((2**16 - 1) * random.random()))
    add_missing_fields(village)
    with LOCK:
        assert USERID not in __saves and USERID not in __villages
        __saves[USERID] = village
        __owners[USERID] = owner_id
        __dirty.add(USERID)
        share_tutorial(USERID)
    flush()  # don't make a brand-new empire wait for the next batch
    return USERID


def share_tutorial(USERID: str) -> bool:
    """Arthur's tutorial is the player's, not one empire's: an empire whose
    account has been through it in another empire doesn't start it again."""
    with LOCK:
        owner = __owners.get(USERID)
        if owner is None or USERID not in __saves:
            return False
        others = [__saves[pid] for pid, other_owner in __owners.items() if other_owner == owner and pid != USERID]
        if not tutorial.carry_over(__saves[USERID], others):
            return False
        __dirty.add(USERID)
        return True


# Deleting (the admin page). Never called holding LOCK: it waits for a write
# under way, and the write waits for LOCK.

def delete_village(USERID: str) -> bool:
    """An empire gone for good. False if there is no such player empire."""
    with LOCK:
        if USERID not in __saves:
            return False
        del __saves[USERID]
        __owners.pop(USERID, None)
        __dirty.discard(USERID)
    with __writing:
        __storage.delete_village(USERID)
    return True


def delete_account(owner_id: int) -> int:
    """An account and all its empires gone for good. How many empires went."""
    with LOCK:
        pids = [pid for pid, owner in __owners.items() if owner == owner_id]
        for pid in pids:
            del __saves[pid]
            del __owners[pid]
            __dirty.discard(pid)
    with __writing:
        for pid in pids:
            __storage.delete_village(pid)
        __storage.delete_user(owner_id)  # and any village of it not loaded
    return len(pids)


def assign_owner(USERID: str, owner_id: int):
    with LOCK:
        __owners[USERID] = owner_id
        __dirty.add(USERID)


# Lookups

def owner_of(USERID: str):
    return __owners.get(str(USERID))


def villages_of(owner_id) -> list:
    with LOCK:
        return [save_info(pid) for pid, owner in __owners.items() if owner == owner_id]


def world_population(USERID: str) -> list:
    """(pid, village, built in?) for every empire this one can meet on the
    world map: the villages that ship with the game (not Arthur's) and the
    empires of every other account."""
    with LOCK:
        owner = __owners.get(USERID)
        statics = [(pid, v, True) for pid, v in __villages.items() if pid not in ARTHUR_PIDS]
        players = [(pid, v, False) for pid, v in __saves.items()
                   if pid != USERID and (owner is None or __owners.get(pid) != owner)]
        return statics + players


def all_saves_userid() -> list:
    return list(__saves.keys())


def all_userid() -> list:
    return list(__villages.keys()) + list(__saves.keys())


def save_info(USERID: str) -> dict:
    save = __saves[USERID]
    default_map = save["playerInfo"]["default_map"]
    empire_name = str(save["playerInfo"]["map_names"][default_map])
    xp = save["maps"][default_map]["xp"]
    level = save["maps"][default_map]["level"]
    tutorial_done = tutorial.step(save) > 0
    return {"userid": USERID, "name": empire_name, "xp": xp, "level": level,
            "tutorial_done": tutorial_done}


def session(USERID: str) -> dict:
    assert isinstance(USERID, str)
    return __saves.get(USERID)


def neighbor_session(USERID: str) -> dict:
    assert isinstance(USERID, str)
    return __saves.get(USERID) or __villages.get(USERID)


# Neighbours / friends
#
# The original showed every save on the computer as a neighbour. On a public
# server that would mean sending every player's village summary to everyone,
# so we show the static neighbours plus the most recently active players.

def _neighbor_villages(USERID: str) -> list:
    statics = [v for pid, v in __villages.items() if pid not in ARTHUR_PIDS]
    players = [v for pid, v in __saves.items() if pid != USERID]
    players.sort(key=lambda v: v["playerInfo"].get("last_logged_in", 0) or 0, reverse=True)
    return statics + players[:config_env.MAX_NEIGHBORS]


def fb_friends_str(USERID: str) -> list:
    friends = []
    with LOCK:
        for vill in _neighbor_villages(USERID):
            friends.append({
                "uid": vill["playerInfo"]["pid"],
                "pic_square": vill["playerInfo"].get("pic") or "/img/profile/1025.png",
            })
    return friends


def neighbors(USERID: str) -> list:
    result = []
    with LOCK:
        for vill in _neighbor_villages(USERID):
            # Copy: the original code edited the neighbour's own save here,
            # which then got written back to disk with junk fields in it.
            neigh = dict(vill["playerInfo"])
            home = vill["maps"][0]
            for key in ("coins", "xp", "level", "stone", "wood", "food"):
                neigh[key] = home[key]
            result.append(neigh)
    return result


# Validation (catches Social Wars saves loaded by mistake)

def is_valid_village(save: dict):
    if "playerInfo" not in save or "maps" not in save or "privateState" not in save:
        return False
    for map in save["maps"]:
        if "oil" in map or "steel" in map:
            return False
        if "stone" not in map or "food" not in map:
            return False
        if "items" not in map or type(map["items"]) != list:
            return False
    return True
