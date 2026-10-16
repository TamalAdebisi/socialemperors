"""
Gifts between friends (friends.py), as Facebook had them: each day a free
gift for every friend, from the game's own gift list, and things from your
own storage whenever you like. A gift waits in the friend's inbox, with who
sent it, until they take it into one of their empires: it goes into that
empire's gift box (privateState["gifts"], inventory.py), which the game shows
in its Gifts and Storage window.

The game has no window for sending gifts: its "Send gift" button (over a
neighbour's portrait) and its empty gift box call the page's gotoGifts(),
which opens ours (templates/_gifts.html), and it calls gotoInitialGifts() on
load when the page says gifts are waiting. The game reads the gift box only
when it loads the town, so ours makes it load the town again afterwards, as
the bank does; and before anything leaves storage, it makes the game send
back everything it holds, so it can't place a thing already given away.

The free gifts are the items the game config marks "giftable", each from its
"gift_level", the level it opened at on Facebook's gift page: a Yellow Tree
from the start to a Scorpion at level 30. Each name once (the config has
two Villager I and two Maya Fire).
"""

import threading
import time

import friends
import inventory
from get_game_config import get_game_config, get_name_from_item_id

DAY = 24 * 3600
FREE_GIFTS_A_DAY = 1  # to each friend, from each player (the UTC day, like the daily bonus)
MAX_GIVE = 99         # of one thing from storage at a time

_sending = threading.Lock()  # one free gift at a time, so two clicks can't both pass the daily check
_storage = None


class GiftError(Exception):
    """Something to tell the player, e.g. "You've sent Bob today's gift already"."""


def use(storage):
    """The storage to keep the inbox in (sessions.load_saved_villages)."""
    global _storage
    _storage = storage


def name(item_id) -> str:
    return str(get_name_from_item_id(int(item_id)) or f"item {item_id}")


def free_list(level: int) -> list:
    """The free gifts open at this level, as {"id", "name", "level"}, cheapest level first."""
    seen, found = set(), []
    items = [i for i in get_game_config()["items"] if str(i.get("giftable")) == "1"]
    for item in sorted(items, key=lambda i: (int(i.get("gift_level") or 1), int(i["id"]))):
        gift_level = int(item.get("gift_level") or 1)
        if gift_level <= level and item["name"] not in seen:
            seen.add(item["name"])
            found.append({"id": int(item["id"]), "name": item["name"], "level": gift_level})
    return found


def next_free(level: int):
    """The next free gift a higher level opens, as {"name", "level"}, or None."""
    later = [g for g in free_list(99) if g["level"] > level]
    return min(later, key=lambda g: g["level"]) if later else None


def _today() -> int:
    return int(time.time()) // DAY * DAY


def sent_today(user_id: int) -> set:
    """The friends this player has sent today's free gift to."""
    return set(_storage.free_gifts_sent(user_id, _today()))


def _friend(user: dict, friend_id: int) -> dict:
    if not friends.can_help(user["id"], friend_id):
        raise GiftError("Choose another player with an account.")
    friend = _storage.get_user(friend_id)
    if friend is None:
        raise GiftError("That player isn't here any more.")
    return friend


def send_free(user: dict, friend_id: int, item_id: int, level: int) -> str:
    """Today's free gift for a friend; level: the sender's, which opens the gifts."""
    friend = _friend(user, friend_id)
    if int(item_id) not in {g["id"] for g in free_list(level)}:
        raise GiftError("That gift isn't open to you yet.")
    with _sending:
        if friend_id in sent_today(user["id"]):
            raise GiftError(f"You've sent {friend['username']} today's free gift already. Another one tomorrow!")
        _storage.add_friend_gift(user["id"], friend_id, int(item_id), 1, free=True)
    return f"{name(item_id)} is on its way to {friend['username']}."


def give(user: dict, save: dict, town_id: int, friend_id: int, item_id: int, count: int) -> str:
    """Something from the storage of the empire on screen, for a friend.
    The caller holds sessions.LOCK and has made the game send everything back."""
    friend = _friend(user, friend_id)
    if not 1 <= count <= MAX_GIVE:
        raise GiftError(f"From 1 to {MAX_GIVE} at a time.")
    if inventory.held(save, town_id).get(int(item_id), 0) < count:
        raise GiftError("You don't have that many in storage.")
    _storage.add_friend_gift(user["id"], friend_id, int(item_id), count, free=False)  # first: never lost
    inventory.take(save, town_id, int(item_id), count)
    what = name(item_id) if count == 1 else f"{count} × {name(item_id)}"
    return f"{what} is on its way to {friend['username']}."


def storage_list(save: dict, town_id: int) -> list:
    """What the empire on screen could give, as {"id", "name", "count"}, by name."""
    held = inventory.held(save, town_id)
    return sorted(({"id": i, "name": name(i), "count": c} for i, c in held.items()), key=lambda g: g["name"])


def waiting(user_id: int) -> list:
    """The gifts in the inbox, as {"id", "name", "count", "sender", "free", "sent_at"}, oldest first."""
    return [dict(g, name=name(g["item"]), sender=g["sender"] or "A player who left")
            for g in _storage.waiting_gifts(user_id)]


def take(user: dict, gift_id: int, save: dict, tell_game: bool) -> str:
    """A gift out of the inbox, into this empire's gift box (the caller holds
    sessions.LOCK and marks the empire changed). tell_game: also leave it in
    the message the game shows when it next starts (taken on the Friends
    page, not in the game's own window)."""
    gift = _storage.take_friend_gift(user["id"], gift_id)
    if gift is None:
        raise GiftError("That gift was taken already.")
    inventory.add_gift(save, gift["item"], gift["count"])
    sender = (_storage.get_user(gift["from_id"]) or {}).get("username") if gift["from_id"] else None
    what = name(gift["item"]) if gift["count"] == 1 else f"{gift['count']} × {name(gift['item'])}"
    done = f"{what} from {sender or 'a player who left'}"
    if tell_game:
        pState = save["privateState"]
        before = str(pState.get("message") or "")
        pState["message"] = (before + "\n" if before else "") + f"{done} is in your Gifts and Storage."
    return done
