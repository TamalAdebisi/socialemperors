from sessions import session, neighbor_session, neighbors, save_session
from engine import timestamp_now


def get_player_info(USERID):
    ts_now = timestamp_now()
    save = session(USERID)
    save["playerInfo"]["last_logged_in"] = ts_now
    save_session(USERID)  # remember the login time (used to rank active neighbours)
    return {
        "result": "ok",
        "processed_errors": 0,
        "timestamp": ts_now,
        "playerInfo": save["playerInfo"],
        "map": save["maps"][0],
        "privateState": save["privateState"],
        "neighbors": neighbors(USERID),
    }


def get_neighbor_info(userid, map_number):
    """Another player's (or a built-in) village, for visiting. Returns None if
    it doesn't exist or the map number is out of range."""
    village = neighbor_session(userid)
    if village is None:
        return None
    map_number = map_number or 0
    if not (0 <= map_number < len(village["maps"])):
        return None
    return {
        "result": "ok",
        "processed_errors": 0,
        "timestamp": timestamp_now(),
        "playerInfo": village["playerInfo"],
        "map": village["maps"][map_number],
        "privateState": village["privateState"],
        "neighbors": neighbors(userid),
    }
