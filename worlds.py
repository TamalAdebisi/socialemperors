"""
The world map: fifty continents of eight islands.

Each town of an empire has its own island on one of fifty continents (it
starts on the first) with seven rival islands around it: towns of other
players, picked nearest the town's level (the most recently active first),
and AcidCaos, the village that ships with the game, when there are not seven
players to pick. Beat all seven in battle and the town moves on to the next
continent and seven new rivals. Reaching a continent wins its prize: the cash
and units of the game config's "level_ranking_reward" row for it, given as
the town moves on (the client shows it then, and claims it again when the
player closes that window: once is all it gets, and closing the game first
loses nothing).

A town keeps its rivals until it moves on or relocates (the Relocate button:
a new island and new rivals, and the islands beaten so far are lost). A rival
that is gone (its empire was deleted) is replaced on the same island. With
fewer than seven players to pick from, the client draws the islands there are
and says it is waiting for more players; players who come later fill the
empty islands.

Kept in each town:

    map["worldMap"]          {"nivel": the continent, 1 to 50,
                              "slot": the town's own island, 0 to 7,
                              "rivals": [{"posicion": island, "user_id", "map": their town}],
                              "rewarded": the last continent whose prize was given}
    map["universAttackWin"]  the islands beaten on this continent (the
                             client's name); pvp.py adds to it
    playerInfo["world_id"]   the first town's island, as world_id below; the
                             client offers a trip to a neighbour's continent
                             when it is set

An island's world_id tells its continent: ceil(world_id / 8).

How the client asks (get_continent_ranking.php, answered by ranking()):

    map=<town>       the town's own continent; the first answer also tells the
                     client which continent is home
    level_id=<n>     browsing continent n: the towns there, or one empty island
    relocate=1       after the Relocate button
    worldChange=1    the client counted seven islands beaten: on to the next
                     continent (the server never sets privateState.worldChange
                     itself, or the client would show the prize twice)

Commands from the client:

    "modify_position_univers"  [own island, other island]  the town's island
                               swapped with another
    "reset_position_univers"   []  Relocate: the islands beaten are lost
    "apply_rewards_ranking"    [continent, cash, units]  the prize for reaching
                               a continent, as the player closes its window;
                               the client has put the units in storage itself
                               and sends no command for them. Already given
                               when the town moved on, so only a town that
                               missed it gets it here
"""

import random

from get_game_config import get_game_config
import inventory
import sessions
import towns
import tutorial

ISLANDS = 8
RIVALS = ISLANDS - 1   # all of them beaten opens the next continent
FIRST, LAST = 1, 50    # MIN_LEVEL and MAX_LEVEL in the client


def world_id(nivel: int, posicion: int) -> int:
    return (nivel - 1) * ISLANDS + posicion + 1


def _wins(map: dict) -> list:
    if not isinstance(map.get("universAttackWin"), list):
        map["universAttackWin"] = []
    return map["universAttackWin"]


def _level(town: dict) -> int:
    try:
        return int(town.get("level") or 1)
    except (TypeError, ValueError):
        return 1


def _town(pid: str, town_id):
    """A town of a player (or of a built-in village), None if it is gone."""
    village = sessions.neighbor_session(str(pid))
    if village is None or not isinstance(town_id, int) or not 0 <= town_id < len(village["maps"]):
        return None
    return village


def _island(pid: str, village: dict, town_id: int, nivel: int, posicion: int) -> dict:
    info = village["playerInfo"]
    town = village["maps"][town_id]
    names = info.get("map_names") or []
    name = names[town_id] if town_id < len(names) and names[town_id] else info.get("name")
    return {
        "posicion": posicion,
        "nivel": nivel,
        "user_id": str(pid),
        "map": town_id,
        "name": str(name or "?"),
        "level": _level(town),
        "race": town.get("race") or "h",
        "pic": info.get("pic") or "",
        "world_id": world_id(nivel, posicion),
    }


def _on_the_map(village: dict, built_in: bool) -> bool:
    """A player's empire is on the world map once Arthur's tutorial is done."""
    return built_in or tutorial.step(village) >= tutorial.LAST_LESSON


def _pick(USERID: str, level: int, taken: set, how_many: int) -> list:
    """The towns nearest this level, the most recently active first: one town
    an empire at most, and none of the empires already taken."""
    towns_found = []
    for pid, village, built_in in sessions.world_population(USERID):
        if pid in taken or not _on_the_map(village, built_in):
            continue
        last_seen = village["playerInfo"].get("last_logged_in") or 0
        for town_id, town in enumerate(village["maps"]):
            towns_found.append((abs(_level(town) - level), -last_seen, pid, town_id))
    towns_found.sort()
    picked = []
    for _, _, pid, town_id in towns_found:
        if len(picked) == how_many:
            break
        if pid not in taken:
            taken.add(pid)
            picked.append((pid, town_id))
    return picked


def _fill(USERID: str, save: dict, town_id: int, record: dict) -> bool:
    """Replace rivals that are gone and fill empty islands. True if anything changed."""
    before = len(record["rivals"])
    record["rivals"] = [r for r in record["rivals"] if _town(r["user_id"], r["map"]) is not None]
    changed = len(record["rivals"]) != before
    used = {record["slot"]} | {r["posicion"] for r in record["rivals"]}
    free = [p for p in range(ISLANDS) if p not in used]
    if free:
        taken = {USERID} | {r["user_id"] for r in record["rivals"]}
        level = _level(save["maps"][town_id])
        for posicion, (pid, their_town) in zip(free, _pick(USERID, level, taken, len(free))):
            record["rivals"].append({"posicion": posicion, "user_id": pid, "map": their_town})
            changed = True
    record["rivals"].sort(key=lambda r: r["posicion"])
    return changed


def _settle(save: dict, town_id: int, record: dict, nivel: int) -> None:
    """The town lands on a continent: a new island, rivals still to pick,
    no island beaten yet."""
    record.update(nivel=nivel, slot=random.randrange(ISLANDS), rivals=[])
    _wins(save["maps"][town_id]).clear()
    if town_id == 0:
        save["playerInfo"]["world_id"] = world_id(nivel, record["slot"])


def _record(save: dict, town_id: int) -> dict:
    """The town's place on the world map; the first continent the first time."""
    map = save["maps"][town_id]
    record = map.get("worldMap")
    if not isinstance(record, dict) or not FIRST <= int(record.get("nivel") or 0) <= LAST:
        record = map["worldMap"] = {"rewarded": FIRST}  # every town starts there: no prize for it
        _settle(save, town_id, record, FIRST)  # islands beaten before there was a map are no use now
    return record


def ranking(USERID: str, town_id=None, continent=None, relocate=False, move_on=False) -> dict:
    """The answer to get_continent_ranking.php."""
    save = sessions.session(USERID)
    if not (isinstance(town_id, int) and 0 <= town_id < len(save["maps"])):
        town_id = towns.current(save)
    map = save["maps"][town_id]
    record = _record(save, town_id)
    if relocate:
        _settle(save, town_id, record, record["nivel"])
        print(f"World map: {USERID} town {town_id} relocated on continent {record['nivel']}")
    elif move_on and len(set(_wins(map))) >= RIVALS:
        _settle(save, town_id, record, min(record["nivel"] + 1, LAST))
        print(f"World map: {USERID} town {town_id} moved on to continent {record['nivel']}: "
              + _give_prize(save, town_id, record["nivel"]))
    _fill(USERID, save, town_id, record)
    sessions.save_session(USERID)

    if continent is not None and continent != record["nivel"]:
        islands = _browse(USERID, min(max(continent, FIRST), LAST))
    else:
        islands = [_island(USERID, save, town_id, record["nivel"], record["slot"])]
        for rival in record["rivals"]:
            village = _town(rival["user_id"], rival["map"])
            islands.append(_island(rival["user_id"], village, rival["map"], record["nivel"], rival["posicion"]))
        islands.sort(key=lambda island: island["posicion"])
    return {"world_id": world_id(record["nivel"], record["slot"]), "continent": islands}


def _browse(USERID: str, nivel: int) -> list:
    """Another continent: the towns there, the most recently active first.
    With nobody there the client draws one empty island."""
    found = []
    for pid, village, built_in in sessions.world_population(USERID):
        for town_id, town in enumerate(village["maps"]):
            record = town.get("worldMap")
            if isinstance(record, dict) and record.get("nivel") == nivel:
                found.append((-(village["playerInfo"].get("last_logged_in") or 0), pid, town_id, village))
    found.sort(key=lambda f: f[:3])
    islands = [_island(pid, village, town_id, nivel, posicion)
               for posicion, (_, pid, town_id, village) in enumerate(found[:ISLANDS])]
    return islands or [{"posicion": 0, "nivel": nivel}]


def beaten(save: dict, town_id: int, victim: dict) -> bool:
    """A battle won: the island counts if the victim is the rival on it, on
    the town's own continent. True if it counted."""
    record = save["maps"][town_id].get("worldMap")
    if not isinstance(record, dict):
        return False
    try:
        posicion, nivel = int(victim.get("posicion")), int(victim.get("nivel"))
    except (TypeError, ValueError):
        return False
    rival = next((r for r in record["rivals"] if r["posicion"] == posicion), None)
    if nivel != record["nivel"] or rival is None or rival["user_id"] != str(victim.get("user_id")):
        return False
    wins = _wins(save["maps"][town_id])
    if posicion not in wins:
        wins.append(posicion)
    return True


def swap(save: dict, own_island, other_island) -> str:
    town_id = towns.current(save)
    record = _record(save, town_id)
    own_island, other_island = int(own_island), int(other_island)
    if own_island != record["slot"] or not 0 <= other_island < ISLANDS:
        return f"The town is on island {record['slot']}, not {own_island}."
    for rival in record["rivals"]:
        if rival["posicion"] == other_island:
            rival["posicion"] = own_island
    record["slot"] = other_island
    record["rivals"].sort(key=lambda r: r["posicion"])
    if town_id == 0:
        save["playerInfo"]["world_id"] = world_id(record["nivel"], other_island)
    return f"The town moved to island {other_island}."


def relocate(save: dict) -> str:
    """The Relocate button; the new island and rivals come with the client's
    next look at the map."""
    _wins(save["maps"][towns.current(save)]).clear()
    return "Relocating: the islands beaten here are lost."


def prize(save: dict, nivel) -> str:
    """The prize claimed from the client's window."""
    return _give_prize(save, towns.current(save), int(nivel))


def _give_prize(save: dict, town_id: int, nivel: int) -> str:
    """The prize for reaching a continent, once a continent."""
    record = _record(save, town_id)
    if nivel != record["nivel"] or nivel <= int(record.get("rewarded") or 0):
        return f"No prize for continent {nivel} (the town is on {record['nivel']}, prized up to {record.get('rewarded')})."
    row = next((r for r in get_game_config()["level_ranking_reward"] if int(r["level"]) == nivel), None)
    if row is None:
        return f"Continent {nivel} has no prize."
    record["rewarded"] = nivel
    cash = int(row.get("cash") or 0)
    save["playerInfo"]["cash"] = int(save["playerInfo"].get("cash") or 0) + cash
    units = row.get("units") or {}
    for unit_id, count in units.items():
        inventory.add_stored(save, town_id, int(unit_id), int(count))
    return f"Prize for continent {nivel}: {cash} cash and {sum(int(c) for c in units.values())} units in storage."


def profile(pid: str):
    """What the Profile button shows of a player, None if there is no such player."""
    village = sessions.neighbor_session(str(pid))
    if village is None:
        return None
    info, pState = village["playerInfo"], village["privateState"]
    shown = {
        "pid": str(info.get("pid", pid)),
        "name": info.get("name"),
        "level": _level(village["maps"][0]),
        "map_names": info.get("map_names") or [],
        "honor_points": int(pState.get("honor") or 0),
        "attacks_won": int(pState.get("attacksWon") or 0),
        "attacks_lost": int(pState.get("attacksLost") or 0),
    }
    if int(info.get("last_logged_in") or 0) > 0:  # the built-in villages never log in
        shown["last_logged_in"] = int(info["last_logged_in"])
    return shown
