"""
Tournaments: four players, each attacks the other three's armies, and the
best score wins a prize.

The game client draws every window, plays every match and works out each
match's score. The server keeps the rooms, says who is in them and which
matches have been played, takes the entry fees and pays the prizes. A match
is fought against the other player's chosen army, run by the client's AI,
so nobody has to be online at the same time. No units are lost.

The game config's "tournament_type" table has eight kinds:

    public   types 1 to 7: rooms of 4, matched by type and level bracket
             (the client's "category"). Real players first; a room still
             not full after BOT_WAIT gets computer players in its empty
             seats, with the armies of the real players in it. The client
             knows bots by the ids "10000001" to "10000003" and draws their
             pictures from the type's "weekly_opponent", which patch_config()
             gives the public types too. The server plays the bots' own
             matches (_bot_match()).
    weekly   type 8: the player against the 3 bots of its "weekly_opponent",
             once a week (Monday to Sunday, UTC), ranked against everyone
             else that week. The top 10 win the prize for their rank, as it
             is when their own tournament ends.
    friends  private rooms of a public type, created by a player with at
             least MIN_FRIENDS friends (the game's own rule). Friends are
             the real players among the neighbours (sessions.friends()):
             they see the room in their list and can join it. Only the
             owner can cancel it, which gives every fee back; a room still
             not full after FRIENDS_WAIT gets bots, like a public one.

A tournament ends when every match has been played, or the type's
"duration" (24 hours) after it started; matches not played by then are
lost with 0 points. The winner has the best total score, then the least
time spent in matches: the client's own rule, so both show the same winner.

How the client asks: POST tournaments/<service>.php, answered by service().

    get_tournament_info      {}                         the player's tournament, or the list
    join_tournament          {tournament_type_id, category, team, tournament_id: a friend's room, or ""}
    create_tournament        {tournament_type_id, team}  a friends tournament
    leave_tournament         {tournament_id}
    cancel_tournament        {tournament_id}            the owner, before it starts
    start_tournament_match   {victim_id, tournament_id}
    finish_tournament_match  {victim_id, attacker_won, attacker_points, tournament_id}
    clean_tournament         {}                         done looking at a finished one

Fees: the client takes the fee on screen and sends "tournament_substract_
resources", and gives it back on screen when a reply says "refund", sending
"tournament_refund_resources". The server takes the fee in join and gives it
back in the reply that says "refund", so those commands change nothing: a
client can't give itself back more than it paid. Prizes: the client shows
the prize and reloads the town, but never asks for it, so the server pays
it when the tournament ends.

Several players share a room, so tournaments live outside the villages, in
storage's "tournaments" table, written with the villages (sessions.flush):

    {"id", "type": "1" to "8", "category", "reward_id": which of the type's prizes,
     "created", "date_ready", "date_finished", "week": weekly only,
     "rank": weekly only, the rank the prize was paid for,
     "private", "owner_id", "owner": friends tournaments only,
     "players": [{"user_id", "user_name", "level", "country", "team": 20 unit ids,
                  "bot", "abandonned": left after the start (the client's spelling),
                  "cleaned": done looking at the end}],
     "matches": [{"attacker_id", "victim_id", "finished", "attacker_won",
                  "attacker_points", "date_started", "date_finished"}]}
"""

import copy
import json
import random
import uuid

from engine import timestamp_now
from get_game_config import get_attribute_from_item_id, get_game_config
import inventory
import radar
import sessions
import towns
from village import ON_MAP, give, take

ARENA = "100000040"   # the map every tournament type's "map_id" names
BOT_IDS = ("10000001", "10000002", "10000003")  # the client's own ids for computer players
BOT_WAIT = 30 * 60    # a public room waits this long for real players, then bots fill it
FRIENDS_WAIT = 24 * 3600  # a friends room waits this long for friends, then bots fill it
MIN_FRIENDS = 3       # friends a player needs to create a friends tournament (the game's message says 3)
MATCH_TIMEOUT = 3600  # a match started this long ago and never finished is lost
KEEP_FINISHED = 30 * 24 * 3600  # a finished tournament nobody came back to see goes after this
TEAM_SIZE = 20
COMPLEX_GROUPS = ("dragon", "god", "colossus")  # at most TOURNAMENT_MAX_NUMBER_COMPLEX_UNITS of these
WEEKLY_TOP = 10
DAY = 24 * 3600

# The client scores a match from the damage done and taken: 0 to 100 for a
# win, at most 20 for a loss (its point_type 1).
POINT_TYPE = 1
LOST_MAX_POINTS = 20

# The bots' own matches, played by the server: won half the time, with the
# scores a player gets for a clear win or a loss, in 2 to 10 minutes.
BOT_WIN_CHANCE = 0.5
BOT_WIN_POINTS = (50, 95)
BOT_LOST_POINTS = (2, 18)
BOT_MATCH_SECONDS = (120, 600)

__tournaments = {}  # id -> tournament
__dirty = set()     # ids changed since the last flush
__deleted = set()   # ids to delete from storage at the next flush
__loaded = False


# Storage

def _load() -> None:
    global __loaded
    storage = sessions.storage()
    if not __loaded and storage is not None:
        for tournament in storage.load_all_tournaments():
            __tournaments.setdefault(tournament["id"], tournament)
        __loaded = True


def flush(storage) -> None:
    """Write the tournaments changed since the last flush."""
    with sessions.LOCK:
        changed = [copy.deepcopy(__tournaments[i]) for i in __dirty if i in __tournaments]
        deleted = list(__deleted)
        __dirty.clear()
        __deleted.clear()
    if not changed and not deleted:
        return
    try:
        storage.save_tournaments(changed, deleted)
    except Exception as e:
        print(f" [!] Saving tournaments failed, will retry: {e}")
        with sessions.LOCK:
            __dirty.update(t["id"] for t in changed if t["id"] in __tournaments)
            __deleted.update(deleted)


sessions.also_flush(flush)


def _touch(tournament: dict) -> None:
    __dirty.add(tournament["id"])


def _delete(tournament: dict) -> None:
    __tournaments.pop(tournament["id"], None)
    __dirty.discard(tournament["id"])
    __deleted.add(tournament["id"])


# The game config

def patch_config(config: dict) -> None:
    """The client draws a bot's picture from its tournament type's
    "weekly_opponent", which only the weekly type has: give the public types
    the same bots, so that they can fill empty seats."""
    kinds = config["tournament_type"].values()
    bots = next((kind["weekly_opponent"] for kind in kinds if kind.get("weekly_opponent")), None)
    for kind in kinds:
        if bots and not kind.get("weekly_opponent"):
            kind["weekly_opponent"] = copy.deepcopy(bots)


def _types() -> dict:
    return get_game_config()["tournament_type"]


def _is_weekly(type_id) -> bool:
    return int(_types()[str(type_id)].get("weekly_tournaments") or 0) >= 1


def _seats(type_id) -> int:
    return int(_types()[str(type_id)]["num_players"])


def _hours(type_id) -> int:
    return int(_types()[str(type_id)]["duration"])


def _week(now: int) -> int:
    """Weeks since 1970, from Monday to Sunday (1 January 1970 was a Thursday)."""
    return (now // DAY + 3) // 7


def _week_ends(week: int) -> int:
    return ((week + 1) * 7 - 3) * DAY


def _prizes_today(now: int) -> dict:
    """Which of its prizes each public type offers: they take turns, a day each."""
    day = now // DAY
    return {type_id: (day + int(type_id)) % len(kind["prize"])
            for type_id, kind in _types().items() if not _is_weekly(type_id)}


# Players and armies

def _seat(tournament: dict, user_id: str):
    return next((p for p in tournament["players"] if p["user_id"] == user_id), None)


def _humans(tournament: dict) -> list:
    return [p for p in tournament["players"] if not p["bot"]]


def _current(USERID: str):
    """The tournament the player is in: joined, and not left or done looking at."""
    for tournament in __tournaments.values():
        me = _seat(tournament, USERID)
        if me and not me["abandonned"] and not me["cleaned"]:
            return tournament
    return None


def _team(team, weekly: bool):
    """The army chosen for tournaments, as the client keeps it: 20 unit ids,
    0 for an empty slot. None when it isn't one the game allows. Like the
    client, the weekly tournament doesn't count the dragons, gods and
    colossi."""
    try:
        team = json.loads(team) if isinstance(team, str) else team
        ids = [int(unit) for unit in team]
    except (TypeError, ValueError):
        return None
    units = [unit for unit in ids if unit > 0]
    globals = get_game_config()["globals"]
    if not units or len(ids) > TEAM_SIZE:
        return None
    if any(get_attribute_from_item_id(unit, "type") != "u" for unit in units):
        return None
    if set(units) & {int(unit) for unit in globals.get("TOURNAMENT_UNITS_NOT_ALLOWED", [])}:
        return None
    complex_units = [unit for unit in units if get_attribute_from_item_id(unit, "groups") in COMPLEX_GROUPS]
    if not weekly and len(complex_units) > int(globals.get("TOURNAMENT_MAX_NUMBER_COMPLEX_UNITS", TEAM_SIZE)):
        return None
    return ids + [0] * (TEAM_SIZE - len(ids))


def _entrant(USERID: str, save: dict, team: list) -> dict:
    town_id = towns.current(save)
    names = save["playerInfo"].get("map_names") or []
    name = names[town_id] if town_id < len(names) and names[town_id] else save["playerInfo"].get("name")
    return {"user_id": USERID, "user_name": str(name or "?"), "level": int(save["maps"][town_id].get("level") or 1),
            "country": "", "team": team, "bot": False, "abandonned": 0, "cleaned": 0}


def _bot(type_id, user_id: str, team=None, level=None) -> dict:
    """A computer player, with its army in the weekly tournament, or the
    army of a real player in its room."""
    bot = _types()[str(type_id)]["weekly_opponent"][user_id]
    team = list(team or bot["team"])[:TEAM_SIZE]
    return {"user_id": user_id, "user_name": bot["user_name"], "level": int(level or bot["level"]),
            "country": bot.get("country", ""), "team": team + [0] * (TEAM_SIZE - len(team)),
            "bot": True, "abandonned": 0, "cleaned": 0}


# Fees and prizes

def _fee(type_id) -> tuple:
    kind = _types()[str(type_id)]
    return kind["resource_type"], int(kind["cost"])


def _balance(save: dict, resource: str) -> int:
    if resource == "c":
        return int(save["playerInfo"].get("cash") or 0)
    return int(save["maps"][towns.current(save)].get(ON_MAP[resource]) or 0)


def _pay_fee(USERID: str, type_id) -> bool:
    save = sessions.session(USERID)
    resource, cost = _fee(type_id)
    if _balance(save, resource) < cost:
        return False
    take(save, save["maps"][towns.current(save)], resource, cost)
    sessions.save_session(USERID)
    return True


def _refund(USERID: str, type_id) -> dict:
    """Gives the fee back; the reply that tells the client to do the same on screen."""
    save = sessions.session(USERID)
    if save is not None:
        resource, cost = _fee(type_id)
        give(save, save["maps"][towns.current(save)], resource, cost)
        sessions.save_session(USERID)
    return {"refund": 1, "tournament_type_id": str(type_id)}


def _pay_prize(user_id: str, prize: dict) -> str:
    """Gold or cash in the town that is open, and the unit in the gift box:
    the client says to look for it in storage."""
    save = sessions.session(user_id)
    if save is None:
        return f"{user_id} is gone, no prize"
    town = save["maps"][towns.current(save)]
    for resource in ("g", "c"):
        if int(prize.get(resource) or 0) > 0:
            give(save, town, resource, int(prize[resource]))
    for unit, count in (prize.get("u") or {}).items():
        inventory.add_gift(save, int(unit), int(count))
    sessions.save_session(user_id)
    return f"{user_id} won {prize}"


# Rooms

def _new(type_id, now: int, **fields) -> dict:
    tournament = dict({"id": uuid.uuid4().hex[:12], "type": str(type_id), "category": 0, "reward_id": 0,
                       "created": now, "date_ready": None, "date_finished": None,
                       "players": [], "matches": []}, **fields)
    __tournaments[tournament["id"]] = tournament
    return tournament


def _public_room(type_id, category: int, me: dict, now: int) -> dict:
    """A room of this type and level bracket that is still waiting for
    players, or a new one."""
    room = next((t for t in __tournaments.values() if t["type"] == str(type_id) and t.get("week") is None
                 and not t.get("private") and t["category"] == category and t["date_ready"] is None), None)
    if room is None:
        room = _new(type_id, now, category=category, reward_id=_prizes_today(now)[str(type_id)])
    return _sit(room, me, now)


def _sit(room: dict, me: dict, now: int) -> dict:
    """A seat for the player; the last seat starts the tournament."""
    room["players"].append(me)
    if len(room["players"]) >= _seats(room["type"]):
        _start(room, now)
    return room


def _weekly_room(type_id, me: dict, now: int) -> dict:
    """The player against the weekly bots, ready at once."""
    room = _new(type_id, now, week=_week(now))
    room["players"] = [me] + [_bot(type_id, user_id) for user_id in _types()[str(type_id)]["weekly_opponent"]]
    _start(room, now)
    return room


def _fill_with_bots(room: dict) -> None:
    """The empty seats of a room that waited long enough: bots, each with
    the army of one of the real players there, in turn."""
    humans = _humans(room)
    free = [user_id for user_id in BOT_IDS if _seat(room, user_id) is None]
    while humans and free and len(room["players"]) < _seats(room["type"]):
        model = humans[(len(room["players"]) - len(humans)) % len(humans)]
        room["players"].append(_bot(room["type"], free.pop(0), model["team"], model["level"]))


def _start(room: dict, now: int) -> None:
    """Full: every player attacks every other once (in the weekly tournament
    only the player attacks; the client never shows the bots' matches). The
    server plays the bots' matches now."""
    room["date_ready"] = now
    attackers = _humans(room) if room.get("week") is not None else room["players"]
    room["matches"] = [_match(a["user_id"], v["user_id"]) for a in attackers
                       for v in room["players"] if v is not a]
    dice = random.Random(room["id"])
    for match in room["matches"]:
        if _seat(room, match["attacker_id"])["bot"]:
            _bot_match(match, now, dice)


def _match(attacker_id: str, victim_id: str) -> dict:
    return {"attacker_id": attacker_id, "victim_id": victim_id, "finished": False, "attacker_won": False,
            "attacker_points": 0, "date_started": None, "date_finished": None}


def _bot_match(match: dict, now: int, dice: random.Random) -> None:
    won = dice.random() < BOT_WIN_CHANCE
    points = dice.uniform(*(BOT_WIN_POINTS if won else BOT_LOST_POINTS))
    match.update(finished=True, attacker_won=won, attacker_points=round(points, 2),
                 date_started=now - dice.randint(*BOT_MATCH_SECONDS), date_finished=now)


def _lose(match: dict, now: int) -> None:
    """A match not played (in time): lost, with no points."""
    match.update(finished=True, attacker_won=False, attacker_points=0,
                 date_started=match["date_started"] or now, date_finished=now)


def _all_played(room: dict) -> bool:
    playing = {p["user_id"] for p in _humans(room) if not p["abandonned"]}
    return all(m["finished"] for m in room["matches"] if m["attacker_id"] in playing)


def _score(room: dict, player: dict) -> tuple:
    """(points, seconds, matches played), as the client counts them."""
    played = [m for m in room["matches"] if m["attacker_id"] == player["user_id"] and m["finished"]]
    points = round(sum(float(m["attacker_points"]) for m in played), 2)
    seconds = sum(int(m["date_finished"]) - int(m["date_started"]) for m in played)
    return points, seconds, len(played)


def _winner(room: dict):
    """The client's rule: the most points, then the least time, of the
    players still in with matches to their name. Then the first seated."""
    contenders = [p for p in room["players"] if not p["abandonned"]
                  and any(m["attacker_id"] == p["user_id"] for m in room["matches"])]
    return min(contenders, key=lambda p: (-_score(room, p)[0], _score(room, p)[1]), default=None)


def _week_table(type_id, week: int) -> list:
    """This week's weekly tournaments, best first: (tournament, player)."""
    rows = [(t, p) for t in __tournaments.values() if t["type"] == str(type_id) and t.get("week") == week
            for p in _humans(t) if not p["abandonned"]]
    return sorted(rows, key=lambda row: (-_score(*row)[0], _score(*row)[1], row[0]["date_ready"]))


def _finish(room: dict, now: int) -> None:
    """Every match played, or time is up: the ones left are lost, and the
    winner gets the prize the client shows them."""
    for match in room["matches"]:
        if not match["finished"]:
            _lose(match, now)
    room["date_finished"] = now
    prizes = _types()[room["type"]]["prize"]
    if room.get("week") is not None:
        rows = _week_table(room["type"], room["week"])
        rank = next((i + 1 for i, (t, _) in enumerate(rows) if t is room), None)
        room["rank"] = rank
        if rank is not None and rank <= min(WEEKLY_TOP, len(prizes)):
            print(f"Weekly tournament: rank {rank}, {_pay_prize(_humans(room)[0]['user_id'], prizes[rank - 1])}")
        return
    winner = _winner(room)
    if winner is not None and not winner["bot"]:
        print(f"Tournament {room['id']}: {_pay_prize(winner['user_id'], prizes[int(room['reward_id'])])}")


def _sweep(now: int) -> None:
    """Time moves on: rooms that waited long enough get bots, matches
    started and never finished are lost, tournaments whose time is up end,
    and ones everybody is done with go."""
    for room in list(__tournaments.values()):
        if room["date_ready"] is None:
            if now - int(room["created"]) >= (FRIENDS_WAIT if room.get("private") else BOT_WAIT):
                _fill_with_bots(room)
                _start(room, now)
                _touch(room)
        elif room["date_finished"] is None:
            for match in room["matches"]:
                if not match["finished"] and match["date_started"] and now - int(match["date_started"]) >= MATCH_TIMEOUT:
                    _lose(match, now)
                    _touch(room)
            if _all_played(room) or now >= int(room["date_ready"]) + _hours(room["type"]) * 3600:
                _finish(room, now)
                _touch(room)
        elif now - int(room["date_finished"]) >= KEEP_FINISHED or (
                all(p["cleaned"] or p["abandonned"] for p in _humans(room))
                and (room.get("week") is None or now >= _week_ends(room["week"]))):  # weekly ones make the week's ranking
            _delete(room)


# What the client sees

def _match_view(match: dict) -> dict:
    return dict({key: match[key] for key in ("attacker_id", "victim_id", "finished", "attacker_won",
                                             "date_started", "date_finished")},
                attacker_points=round(float(match["attacker_points"]), 2))


def _ranking(room: dict, USERID: str) -> dict:
    rows = _week_table(room["type"], room["week"])

    def row(tournament, player):
        points, seconds, played = _score(tournament, player)
        return {"user_id": player["user_id"], "user_name": player["user_name"],
                "points": points, "time": seconds, "matches": played}

    top = {str(i + 1): row(*rows[i]) for i in range(min(WEEKLY_TOP, len(rows)))}
    rank = room.get("rank") or next((i + 1 for i, (t, _) in enumerate(rows) if t is room), len(rows) + 1)
    return {"total_user": len(rows), "top": top, "user": dict(row(room, _seat(room, USERID)), rank=rank)}


def _view(room: dict, USERID: str) -> dict:
    """The tournament as the client reads it. The player comes first: the
    client takes players[0] as "you"."""
    players = sorted(room["players"], key=lambda p: p["user_id"] != USERID)
    view = {
        "tournament_id": room["id"], "tournament_type_id": room["type"], "reward_id": room["reward_id"],
        "private": "1" if room.get("private") else "0",  # the owner gets Cancel and Invite, the others Leave
        "owner_id": room.get("owner_id", ""), "owner": room.get("owner", ""), "point_type": POINT_TYPE,
        "date_ready": room["date_ready"], "date_finished": room["date_finished"],
        "match_playing": any(m["date_started"] and not m["finished"] for m in room["matches"]),
        "players": [{"user_id": p["user_id"], "user_name": p["user_name"], "level": p["level"],
                     "country": p["country"], "team": p["team"], "abandonned": p["abandonned"],
                     "matches": [_match_view(m) for m in room["matches"] if m["attacker_id"] == p["user_id"]]}
                    for p in players],
    }
    if room.get("week") is not None:
        view["ranking"] = _ranking(room, USERID)
    elif room["date_finished"] is not None:
        # Requester-first presentation loses the seat-order tie-break. Tell
        # both clients who actually won instead of asking them to guess it.
        winner = _winner(room)
        view["winner_id"] = winner["user_id"] if winner is not None else None
    return view


def _info(USERID: str, now: int) -> dict:
    room = _current(USERID)
    week = _week(now)
    return {
        "tournament": _view(room, USERID) if room else None,
        "tournament_reward_id": _prizes_today(now),
        "tournament_weekly": {type_id: {"open": "1", "timeLeft": _week_ends(week) - now,
                                        "full": "1" if _entered_this_week(USERID, type_id, week) else "0"}
                              for type_id in _types() if _is_weekly(type_id)},  # "full" hides the card
        "tournament_friends": _friends_rooms(USERID),
    }


def _friends_rooms(USERID: str) -> list:
    """The friends tournaments of the player's friends still waiting for
    players: a card each in the list, "<owner>'s tournament"."""
    waiting = [t for t in __tournaments.values() if t.get("private") and t["date_ready"] is None
               and not _seat(t, USERID) and len(t["players"]) < _seats(t["type"])]
    friends = set(sessions.friends(USERID)) if waiting else set()
    return [{"tournament_id": t["id"], "tournament_type_id": t["type"], "reward_id": t["reward_id"],
             "owner": t["owner"], "owner_id": t["owner_id"]} for t in waiting if t["owner_id"] in friends]


def _entered_this_week(USERID: str, type_id, week: int) -> bool:
    return any(t["type"] == str(type_id) and t.get("week") == week and _seat(t, USERID)
               for t in __tournaments.values())


# The services

def _get_info(USERID: str, params: dict, now: int) -> dict:
    return _info(USERID, now)


def _refused(result: str, type_id: str) -> dict:
    """No: the client gives the fee back on screen; the server never took it.
    No refund for a type the config doesn't have: the client would look its
    fee up, and fail."""
    if type_id not in _types():
        return {"result": result}
    return {"result": result, "resources": {"refund": 1, "tournament_type_id": type_id}}


def _open_to(room, USERID: str, type_id: str) -> bool:
    """A friend's room the player can still join."""
    return (room is not None and room.get("private") and room["type"] == type_id and room["date_ready"] is None
            and len(room["players"]) < _seats(type_id) and room["owner_id"] in sessions.friends(USERID))


def _join(USERID: str, params: dict, now: int) -> dict:
    type_id = str(params.get("tournament_type_id", ""))
    if type_id not in _types():
        return _refused("NOK", type_id)
    weekly = _is_weekly(type_id)
    team = _team(params.get("team"), weekly)
    if team is None:
        return _refused("NOTEAM", type_id)
    friends_room = __tournaments.get(str(params.get("tournament_id") or "")) if params.get("tournament_id") else None
    if _current(USERID) or (params.get("tournament_id") and not _open_to(friends_room, USERID, type_id)):
        return _refused("NOK", type_id)  # one at a time; a friend's room gone, full or started: "full"
    if weekly and _entered_this_week(USERID, type_id, _week(now)):
        return _refused("NOK", type_id)
    if not _pay_fee(USERID, type_id):
        return _refused("NOK", type_id)
    me = _entrant(USERID, sessions.session(USERID), team)
    if friends_room is not None:
        room = _sit(friends_room, me, now)
    elif weekly:
        room = _weekly_room(type_id, me, now)
    else:
        room = _public_room(type_id, int(params.get("category") or 0), me, now)
    _touch(room)
    return dict(_info(USERID, now), result="OK")


def _create(USERID: str, params: dict, now: int) -> dict:
    """A friends tournament: the player's own room, which their friends see."""
    type_id = str(params.get("tournament_type_id", ""))
    if type_id not in _types() or _is_weekly(type_id):
        return _refused("NOK", type_id)
    team = _team(params.get("team"), weekly=False)
    if team is None:
        return _refused("NOTEAM", type_id)
    if _current(USERID):
        return _refused("NOK", type_id)
    if len(sessions.friends(USERID)) < MIN_FRIENDS:
        return _refused("NOFRIENDS", type_id)
    if not _pay_fee(USERID, type_id):
        return _refused("NOK", type_id)
    me = _entrant(USERID, sessions.session(USERID), team)
    room = _new(type_id, now, private=1, owner_id=USERID, owner=me["user_name"],
                reward_id=_prizes_today(now)[type_id])
    _sit(room, me, now)
    _touch(room)
    return dict(_info(USERID, now), result="OK")


def _leave(USERID: str, params: dict, now: int) -> dict:
    """Before the start, the seat and the fee come back. After, the player is
    out: their matches not played are lost, and the others can still play
    against their army."""
    room = _current(USERID)
    if room is None or (params.get("tournament_id") and str(params["tournament_id"]) != room["id"]):
        # A delayed click from an older room must not leave a newer one.
        return {"result": "OK"}
    if room.get("private") and room["owner_id"] == USERID and room["date_ready"] is None:
        return _cancel(USERID, params, now)  # the owner can't leave their own room: it is called off
    me = _seat(room, USERID)
    _touch(room)
    if room["date_ready"] is None:
        room["players"].remove(me)
        if not _humans(room):
            _delete(room)
        return {"result": "OK", "resources": _refund(USERID, room["type"])}
    if room["date_finished"] is None:
        me["abandonned"] = 1
        for match in room["matches"]:
            if match["attacker_id"] == USERID and not match["finished"]:
                _lose(match, now)
        if _all_played(room):
            _finish(room, now)
    else:
        me["cleaned"] = 1
    return {"result": "OK"}


def _cancel(USERID: str, params: dict, now: int) -> dict:
    """The owner calls off a friends tournament before it starts, and every
    fee comes back. The friends' games are never told, so the server gives
    theirs back in their saves; the room is gone from their list."""
    room = _current(USERID)
    if room is not None and params.get("tournament_id") and str(params["tournament_id"]) != room["id"]:
        return {"result": "OK"}
    if room is None or not room.get("private") or room["owner_id"] != USERID or room["date_ready"] is not None:
        return _leave(USERID, params, now)
    for player in _humans(room):
        if player["user_id"] != USERID:
            _refund(player["user_id"], room["type"])
    _delete(room)
    return {"result": "OK", "resources": _refund(USERID, room["type"])}


def _my_match(USERID: str, params: dict):
    room = _current(USERID)
    if room is None or room["id"] != str(params.get("tournament_id", room["id"])):
        return None, None
    victim = str(params.get("victim_id", ""))
    match = next((m for m in room["matches"] if m["attacker_id"] == USERID and m["victim_id"] == victim), None)
    return room, match


def _start_match(USERID: str, params: dict, now: int) -> dict:
    room, match = _my_match(USERID, params)
    if match is None or match["finished"]:
        radar.note(radar.CLIENT, "tournament", "start of an unknown match", params, USERID)
    else:
        match["date_started"] = now
        _touch(room)
    return {"result": "OK"}  # exactly "OK", or the client waits forever


def _finish_match(USERID: str, params: dict, now: int) -> dict:
    """The client's score for the match: 0 to 100, at most 20 for a loss."""
    room, match = _my_match(USERID, params)
    if match is None or match["finished"]:
        radar.note(radar.CLIENT, "tournament", "end of an unknown match", params, USERID)
        return {"result": "OK"}  # anything else leaves the game paused
    won = params.get("attacker_won") in (True, 1, "1", "true")
    try:
        points = min(max(float(params.get("attacker_points") or 0), 0), 100)
    except (TypeError, ValueError):
        points = 0
    if not won:
        points = min(points, LOST_MAX_POINTS)
    match.update(finished=True, attacker_won=won, attacker_points=round(points, 2),
                 date_started=match["date_started"] or now, date_finished=now)
    if _all_played(room):
        _finish(room, now)
    _touch(room)
    return {"result": "OK"}


def _clean(USERID: str, params: dict, now: int) -> dict:
    room = _current(USERID)
    if room is not None and room["date_finished"] is not None:
        _seat(room, USERID)["cleaned"] = 1
        _touch(room)
    return {"result": "OK"}


SERVICES = {
    "get_tournament_info": _get_info,
    "join_tournament": _join,
    "create_tournament": _create,
    "leave_tournament": _leave,
    "cancel_tournament": _cancel,
    "start_tournament_match": _start_match,
    "finish_tournament_match": _finish_match,
    "clean_tournament": _clean,
}


def _now() -> int:
    return timestamp_now()


def service(USERID: str, name: str, params: dict):
    """The reply's "data" for one of the client's tournament services, or
    None when there is no such service. Call while holding sessions.LOCK."""
    if name not in SERVICES:
        return None
    _load()
    now = _now()
    _sweep(now)
    return SERVICES[name](USERID, params if isinstance(params, dict) else {}, now)


def bookkeeping(cmd: str, args: list) -> str:
    """The client's commands for fees and refunds: the server has taken
    the fee and given it back itself (see the top of this file)."""
    return f"{cmd} {args}: the server keeps the fees itself."


def arena() -> dict:
    """The field matches are fought on. The client reads only the map's
    background, land and items, and puts both armies on it itself: an empty
    field, the middle 3 x 3 squares owned, the armies starting on the edges."""
    return {
        "result": "ok", "processed_errors": 0, "timestamp": timestamp_now(),
        "playerInfo": {"pid": ARENA, "name": "Tournament", "pic": "", "default_map": 0,
                       "map_names": ["Tournament"], "map_sizes": [1]},
        "privateState": {}, "neighbors": [],
        "map": {"id": 0, "race": "h", "skin": 0, "level": 1, "xp": 0, "coins": 0, "wood": 0, "food": 0,
                "stone": 0, "expansions": [7, 8, 9, 12, 13, 14, 17, 18, 19], "items": [],
                "receivedAssists": [], "store": {}, "questTimes": {}},
    }


patch_config(get_game_config())
