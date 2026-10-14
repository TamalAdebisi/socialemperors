"""
Friends, as Facebook friends were: players ask each other by username, and
the other accepts or declines. Friends come first among each other's
neighbours in the game (sessions.py), and can send each other gifts (gifts.py).

Friendships are kept in memory, because the neighbour lists are made from
them on every game page, under sessions.LOCK; every change is written to
storage at once. Requests are only read by the Friends page, from storage.

Friends are accounts, not empires: every empire of a friend is a neighbour.
"""

import threading

MAX_FRIENDS = 100        # each; their empires all come first among the neighbours
MAX_ASKED = 30           # requests of one player still waiting for an answer, against spam

_friends = {}            # account id -> set of friends' account ids
_lock = threading.Lock()
_storage = None


class FriendError(Exception):
    """Something to tell the player, e.g. "No player is called that"."""


def load(storage):
    """Every friendship, once at startup (sessions.load_saved_villages)."""
    global _storage
    _storage = storage
    with _lock:
        _friends.clear()
        for user_id, friend_id in storage.load_friendships():
            _friends.setdefault(user_id, set()).add(friend_id)


def of(user_id) -> set:
    """Their friends' account ids (a copy)."""
    with _lock:
        return set(_friends.get(user_id, ()))


def are_friends(a, b) -> bool:
    with _lock:
        return b in _friends.get(a, ())


def forget(user_id):
    """An account deleted (storage.delete_user removes its rows)."""
    with _lock:
        for friend_id in _friends.pop(user_id, ()):
            _friends.get(friend_id, set()).discard(user_id)


def _befriend(a: int, b: int):
    with _lock:
        if len(_friends.get(a, ())) >= MAX_FRIENDS or len(_friends.get(b, ())) >= MAX_FRIENDS:
            raise FriendError(f"Players can have at most {MAX_FRIENDS} friends.")
        _storage.add_friendship(a, b)
        _friends.setdefault(a, set()).add(b)
        _friends.setdefault(b, set()).add(a)


def ask(user: dict, username: str) -> str:
    """user asks the player called username to be friends. What happened,
    to show them; a FriendError if it can't be done."""
    other = _storage.get_user_by_name((username or "").strip())
    if other is None:
        raise FriendError("No player is called that.")
    if other["id"] == user["id"]:
        raise FriendError("That's you!")
    if are_friends(user["id"], other["id"]):
        raise FriendError(f"You and {other['username']} are friends already.")
    requests = _storage.friend_requests(user["id"])
    if any(r["id"] == other["id"] for r in requests["from_me"]):
        raise FriendError(f"You've asked {other['username']} already. They haven't answered yet.")
    if any(r["id"] == other["id"] for r in requests["to_me"]):
        accept(user, other["id"])  # they asked first: that's a yes on both sides
        return f"You and {other['username']} are friends now."
    if len(requests["from_me"]) >= MAX_ASKED:
        raise FriendError(f"You have {MAX_ASKED} requests waiting for an answer. Wait for some first.")
    try:
        _storage.add_friend_request(user["id"], other["id"])
    except Exception as e:  # asked twice at the same moment
        if "UNIQUE" not in str(e).upper():
            raise
    return f"Asked {other['username']} to be your friend."


def accept(user: dict, from_id: int):
    if not _storage.remove_friend_request(from_id, user["id"]):
        raise FriendError("That request isn't there any more.")
    _befriend(user["id"], from_id)


def decline(user: dict, from_id: int):
    if not _storage.remove_friend_request(from_id, user["id"]):
        raise FriendError("That request isn't there any more.")


def cancel(user: dict, to_id: int):
    """Take back a request not yet answered."""
    _storage.remove_friend_request(user["id"], to_id)


def unfriend(user: dict, friend_id: int):
    with _lock:
        _storage.remove_friendship(user["id"], friend_id)
        _friends.get(user["id"], set()).discard(friend_id)
        _friends.get(friend_id, set()).discard(user["id"])
