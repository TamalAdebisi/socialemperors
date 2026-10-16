"""
Asking friends for help, as the game did through Facebook. The game's own
buttons ask: they call the page's showPopupSEHelp...() and showFeedSEHire(),
which open our window (templates/_help.html). Friends answer on their Friends
page. Their help goes into the asker's empire, which the game reads when it
loads the town, and the game's message at its next start says who helped.

What can be asked, and what a friend's answer does:

    "collect"  a building at work (its Hurry up window, Ask friends): an hour
               off its work. The game shows the friend over the building, and
               a click there spends the hour ("accept_collect_help").
                   item[ATTRS]["hc"]  {"u" + friend's empire: False}
    "nest"     the dragon nest (Hire friends): two steps for the dragon,
               without their wait, taken when the nest's window next opens.
               The game sends "next_step" for each, then "finish_dragon_help"
               with the friends it used.
                   privateState["dragonSocialHelp"]  [friend's empire, ...]
                   privateState["dragonHelpSteps"]   the steps still owed
                                                     (only the server reads it)
    "staff"    a place at a social building that keeps a staff (social.py):
               the Summit, the Allied Markets, the Recruitment camp, the
               Wonder, and the Round Table, whose own window picks neighbours
               one by one (showFeedSEHire, with the game's "assist_send_feed").
                   item[ATTRS]["si"]  [friend's empire, ...]

A friend helps as their latest empire (the one they played last). Every
empire of a friend is among the asker's neighbours (sessions.py), so the
game knows its name.

With no Facebook friends to run out of, the limits are the server's: each
friend helps a building, or the nest, once a (UTC) day; a building holds at
most MAX_COLLECT_HELP hours, the nest MAX_NEST_HELP friends; a staff takes
each friend once, while there's room. Requests go after EXPIRE.

The game's other Facebook asks have nothing to do here: asking for potions
has no button in this client, and a lost animal found (register_found_item.php)
was shared on Facebook's wall, not asked of friends.
"""

import json
import threading
import time

import friends
import sessions
import social
from engine import timestamp_now
from get_game_config import get_game_config, get_name_from_item_id
from village import ATTRS, STARTED, full, item_at

KINDS = ("collect", "nest", "staff")
DAY = 24 * 3600
EXPIRE = 3 * DAY          # a request not answered by then is gone
MAX_COLLECT_HELP = 3      # hours waiting at one building
MAX_NEST_HELP = 5         # friends waiting at the nest: 2 steps each, a whole dragon
NEST_STEPS = 2            # each friend's, as the game's text says
DRAGON_STEPS = 10         # TOTAL_STEPS_X_DRAGON in the client
MAX_WAITING = 300         # requests of one player waiting for answers, against spam

_asking = threading.Lock()  # one ask at a time, so two clicks can't both pass the checks
_forgotten_at = 0           # when old requests were last cleared


class HelpError(Exception):
    """Something to tell the player, e.g. "Alice's Farm isn't there any more"."""


def _storage():
    return sessions.storage()


def name(item_id) -> str:
    return str(get_name_from_item_id(int(item_id)) or "building")


def _today() -> int:
    return int(time.time()) // DAY * DAY


# What a request is about, in words

def what(kind: str, item, whose="their") -> str:
    """For the friend asked: "an hour off their Farm"."""
    if kind == "collect":
        return f"an hour off {whose} {name(item)}"
    if kind == "nest":
        return f"two steps for {whose} dragon"
    if int(item) == social.ROUND_TABLE:
        return f"a seat at {whose} Round Table"
    return f"a place at {whose} {name(item)}"


def did(kind: str, item, who: str, whose: str) -> str:
    """What a friend's answer did: "Bob took an hour off your Farm"."""
    if kind == "nest":
        return f"{who} moved {whose} dragon on two steps"
    return f"{who} took {what(kind, item, whose)}"


# The thing asked about, in the asker's empire

def _building(save: dict, town: int, x: int, y: int, item: int):
    maps = save["maps"]
    if not 0 <= town < len(maps):
        return None
    found = item_at(maps[town], item, x, y)
    return full(found) if found is not None else None


def _list(holder: dict, key: str) -> list:
    if not isinstance(holder.get(key), list):
        holder[key] = []
    return holder[key]


def _room(save: dict, kind: str, town: int, x: int, y: int, item: int, whose: str) -> int:
    """How many more friends can help with it now. A HelpError if there is
    nothing to help (whose: "Your", "Alice's")."""
    if kind == "nest":
        pState = save["privateState"]
        if not pState.get("dragonNestActive"):
            raise HelpError(f"{whose} dragon nest is closed.")
        return MAX_NEST_HELP - len(_list(pState, "dragonSocialHelp"))
    building = _building(save, town, x, y, item)
    if building is None:
        raise HelpError(f"{whose} {name(item)} isn't there any more: it moved, or went into storage.")
    if kind == "collect":
        hc = building[ATTRS].get("hc")
        return MAX_COLLECT_HELP - (len(hc) if isinstance(hc, dict) else 0)
    if int(item) not in social.KEEP_STAFF:
        raise HelpError(f"{whose} {name(item)} needs no friends: it opens when the town loads again.")
    return social.capacity(save, town, item) - len(_list(building[ATTRS], "si"))


def _full(kind: str, item, whose: str) -> str:
    if kind == "collect":
        return f"{whose} {name(item)} has all the help it can hold: {MAX_COLLECT_HELP} hours."
    if kind == "nest":
        return f"{whose} dragon nest has all the help it can hold."
    return f"{whose} {name(item)} is full."


def _staff(save: dict, town: int, x: int, y: int, item: int) -> set:
    building = _building(save, town, x, y, item)
    return {str(s) for s in _list(building[ATTRS], "si")} if building is not None else set()


def _same(row: dict, kind: str, town: int, x: int, y: int, item: int) -> bool:
    if row["kind"] != kind:
        return False
    return kind == "nest" or (row["town"], row["x"], row["y"], row["item"]) == (town, x, y, item)


def _states(save: dict, USERID: str, kind: str, town: int, x: int, y: int, item: int, skip=None) -> dict:
    """{friend's account: "asked" (waiting for them) or "helped" (today, or
    on the staff)} for this thing; skip: a request to leave out."""
    states = {}
    for row in _storage().help_asked_by(USERID, int(time.time()) - EXPIRE):
        if row["id"] == skip or not _same(row, kind, town, x, y, item):
            continue
        if row["answered_at"] is None:
            states.setdefault(row["to_id"], "asked")
        elif kind != "staff" and row["answered_at"] >= _today():
            states[row["to_id"]] = "helped"
    if kind == "staff":  # on the staff now, however long ago they answered
        staff = _staff(save, town, x, y, item)
        for friend_id in {f["id"] for f in friends.everybody(sessions.owner_of(USERID))}:
            if staff & set(sessions.empires_of(friend_id)):
                states[friend_id] = "helped"
    return states


# Asking (the asker's window, templates/_help.html)

def window(user: dict, USERID: str, save: dict, kind: str, town: int, x: int, y: int, item: int,
           loaded_at: float) -> dict:
    """What the asker's window shows: the friends and whether each can be
    asked, the room left, and the help answered since the town loaded."""
    reply = {"what": what(kind, item, "your"), "room": 0}
    try:
        reply["room"] = max(_room(save, kind, town, x, y, item, "Your"), 0)
        if not reply["room"]:
            reply["full"] = _full(kind, item, "Your")
    except HelpError as e:
        reply["opens" if kind == "staff" and int(item) not in social.KEEP_STAFF else "gone"] = str(e)
    states = _states(save, USERID, kind, town, x, y, item)
    reply["friends"] = [{"id": f["id"], "username": f["username"],
                         "state": states.get(f["id"]) or ("can" if sessions.empires_of(f["id"]) else "no_empire")}
                        for f in friends.everybody(user["id"])]
    reply["answered"] = [did(row["kind"], row["item"], row["helper"], "your")
                         for row in _storage().help_asked_by(USERID, int(time.time()) - EXPIRE)
                         if row["answered_at"] is not None and row["answered_at"] >= loaded_at]
    return reply


def ask(user: dict, USERID: str, save: dict, kind: str, town: int, x: int, y: int, item: int,
        friend_ids: list) -> str:
    """Ask these friends (account ids) to help with this. The caller holds sessions.LOCK."""
    if kind not in KINDS:
        raise HelpError("Please try again.")
    room = _room(save, kind, town, x, y, item, "Your")
    if room <= 0:
        raise HelpError(_full(kind, item, "Your"))
    mine = {f["id"] for f in friends.everybody(user["id"])}
    wanted = [f for f in dict.fromkeys(friend_ids) if f in mine]
    if not wanted:
        raise HelpError("Pick the players to ask.")
    with _asking:
        states = _states(save, USERID, kind, town, x, y, item)
        new = [f for f in wanted if f not in states]
        if not new:
            helped = all(states[f] == "helped" for f in wanted)
            raise HelpError("They've helped with it already." if helped else "You've asked them already.")
        if _storage().count_help_waiting(user["id"], int(time.time()) - EXPIRE) + len(new) > MAX_WAITING:
            raise HelpError(f"You have {MAX_WAITING} requests waiting for answers. Wait for some first.")
        for friend_id in new:
            _storage().add_help_request(user["id"], USERID, friend_id, kind, town, x, y, item)
    names = {f["id"]: f["username"] for f in friends.everybody(user["id"])}
    asked = [names.get(f, "a friend") for f in new]
    who = asked[0] if len(asked) == 1 else ", ".join(asked[:-1]) + " and " + asked[-1]
    return f"Asked {who}. Players answer on the Everybody page; their help shows when your town loads again."


def ask_seat(user: dict, USERID: str, save: dict, town: int, x: int, y: int, item: int, pid: str) -> str:
    """The Round Table's own window picks neighbours one by one, by their empire."""
    owner = sessions.owner_of(str(pid))
    if owner == user["id"]:
        raise HelpError("That's one of your own empires.")
    if owner is None or not friends.can_help(user["id"], owner):
        raise HelpError("Choose another player with an account for your Round Table.")
    return ask(user, USERID, save, "staff", town, x, y, item, [owner])


# Answering (the friend's Friends page)

def asked_of(user_id: int) -> list:
    """The requests waiting for this player's answer, oldest first: each
    {"id", "asker", "what", "empire_name", "created_at"}."""
    global _forgotten_at
    now = int(time.time())
    if now - _forgotten_at > 3600:  # an hour is soon enough to clear the old ones
        _forgotten_at = now
        _storage().forget_help_requests(now - EXPIRE)
    found = []
    for row in _storage().help_asked_of(user_id, now - EXPIRE):
        with sessions.LOCK:
            empire = sessions.session(row["empire"]) and sessions.save_info(row["empire"])["name"]
        found.append(dict(row, what=what(row["kind"], row["item"]), empire_name=empire))
    return found


def answer(user: dict, request_id: int) -> str:
    """A friend's help, into the asker's empire. What it did, for the friend;
    a HelpError if it can't (the request goes then)."""
    pid = sessions.latest_empire(user["id"])
    if pid is None:
        raise HelpError("Make an empire first: friends help as one.")
    with sessions.LOCK:
        request = _storage().answer_help_request(user["id"], request_id)
        if request is None:
            raise HelpError("That request was answered already.")
        try:
            done = _help(user, pid, request)
        except HelpError:
            _storage().remove_help_request(user["id"], request_id)  # nothing to help any more
            raise
        sessions.save_session(request["empire"])
    return done


def _help(user: dict, pid: str, request: dict) -> str:
    asker = (_storage().get_user(request["from_id"]) or {}).get("username", "That player")
    if not friends.can_help(user["id"], request["from_id"]):
        raise HelpError(f"{asker}'s account is no longer available.")
    save = sessions.session(request["empire"])
    if save is None:
        raise HelpError(f"{asker}'s empire is gone.")
    kind, town, x, y, item = (request[k] for k in ("kind", "town", "x", "y", "item"))
    whose = f"{asker}'s"
    if _room(save, kind, town, x, y, item, whose) <= 0:
        raise HelpError(_full(kind, item, whose))
    states = _states(save, request["empire"], kind, town, x, y, item, skip=request["id"])
    if states.get(user["id"]) == "helped":
        raise HelpError(f"You're at {asker}'s {name(item)} already." if kind == "staff"
                        else f"You've helped with {what(kind, item, whose)} today already.")

    if kind == "collect":
        waiting = _building(save, town, x, y, item)[ATTRS].setdefault("hc", {})
        if any("u" + mine in waiting for mine in sessions.empires_of(user["id"])):
            raise HelpError(f"Your help still waits at {asker}'s {name(item)}, for them to use.")
        waiting["u" + pid] = False
    elif kind == "nest":
        pState = save["privateState"]
        _list(pState, "dragonSocialHelp").append(pid)
        pState["dragonHelpSteps"] = int(pState.get("dragonHelpSteps") or 0) + NEST_STEPS
    else:
        _list(_building(save, town, x, y, item)[ATTRS], "si").append(pid)

    pState = save["privateState"]
    before = str(pState.get("message") or "")
    pState["message"] = (before + "\n" if before else "") + did(kind, item, user["username"], "your") + "."
    return did(kind, item, "You", whose) + "."


def decline(user: dict, request_id: int) -> bool:
    return _storage().remove_help_request(user["id"], request_id)


# The game's commands, in the asker's empire

def accept_collect_help(save: dict, x, y, town_id: int, item_id, helper) -> str:
    """A click on a friend over the building: an hour off its work."""
    building = _building(save, town_id, x, y, item_id)
    waiting = building[ATTRS].get("hc") if building is not None else None
    key = "u" + str(helper)
    if not isinstance(waiting, dict) or key not in waiting:
        return f"No help from {helper} waits at ({x},{y})."
    del waiting[key]  # the client marks it used under the wrong key; it goes here
    if not waiting:
        del building[ATTRS]["hc"]
    seconds = int(get_game_config()["globals"].get("COLLECT_HELP_SECONDS", 3600))
    if int(building[STARTED] or 0) > 0:
        building[STARTED] = int(building[STARTED]) - seconds  # the client counts its work from here
    return f"{helper}'s help took {seconds // 60} minutes off {name(item_id)}."


def dragon_step(save: dict, gift: bool = False) -> str:
    """"next_step": the dragon one step on. The game sends the same for a
    friend's step, which leaves the wait as it is, as for its own, which
    starts the wait again. The seven steps Arthur's lessons give at their
    end come as the text "0" (the nest window's as the number 0): no wait,
    as the Flash client showed them."""
    pState = save["privateState"]
    pState["stepNumber"] = int(pState.get("stepNumber") or 0) + 1
    if gift:
        return f"Dragon step {pState['stepNumber']}, the lessons' gift."
    owed = int(pState.get("dragonHelpSteps") or 0)
    if owed > 0:
        pState["dragonHelpSteps"] = owed - 1
        return f"Dragon step {pState['stepNumber']}, a friend's."
    pState["timeStampTakeCare"] = timestamp_now()
    return f"Dragon step {pState['stepNumber']}."


def finish_dragon_help(save: dict, used) -> str:
    """"finish_dragon_help" [JSON list]: the friends whose steps the nest took."""
    pState = save["privateState"]
    used = {str(pid) for pid in (json.loads(used) if isinstance(used, str) else used or [])}
    left = [pid for pid in _list(pState, "dragonSocialHelp") if str(pid) not in used]
    pState["dragonSocialHelp"] = left
    pState["dragonHelpSteps"] = min(int(pState.get("dragonHelpSteps") or 0), NEST_STEPS * len(left))
    if int(pState.get("stepNumber") or 0) >= DRAGON_STEPS:
        pState["timeStampTakeCare"] = 0  # as the client: the dragon is ready, no wait
    return f"The nest took the help of {len(used)} friends ({len(left)} still waiting)."


def seat_asked(save: dict, x, y, town_id: int, item_id, neighbour) -> str:
    """"assist_send_feed": the Round Table's window asked a neighbour this round."""
    building = _building(save, town_id, x, y, item_id)
    if building is None:
        return f"There is no Round Table at ({x},{y})."
    asked = building[ATTRS].get("sif")
    if not isinstance(asked, dict):
        asked = building[ATTRS]["sif"] = {}
    asked["u" + str(neighbour)] = True
    return f"Asked {neighbour} to the Round Table ({len(asked)} this round)."
