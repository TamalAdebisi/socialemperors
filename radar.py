"""
The bug radar: what players' games asked of the server that it couldn't do.

Three kinds of problem are counted, so the admin page can show which missing
features and bugs players run into most (ROADMAP.md, "How we add a missing
feature"):

    unhandled   a command the server doesn't handle yet (its name)
    failed      a command or page that raised an error (where in the code)
    client      an error the game client reported (sync errors, reloads)
    refused     something the server wouldn't do on the game's word: a
                purchase without the cash, a unit no feature explains
                (trust.py). From a cheater, or a rule that misses a feature.

Counted in memory as they happen and written to storage with the villages
(sessions.flush), adding to the counts saved before. Nothing here may stop a
game request: noting a problem never raises.

Players can send anything, so the radar keeps at most MAX_PENDING different
problems between two flushes and storage at most storage.MAX_PROBLEMS: a
flood of made-up commands fills it up, but can't fill the server's memory.
"""

import os
import threading
import time
import traceback

UNHANDLED, FAILED, CLIENT, REFUSED = "unhandled", "failed", "client", "refused"
EXAMPLE_LENGTH = 300
MAX_PENDING = 500

__lock = threading.Lock()
__pending = {}  # (kind, name, detail) -> {"count", "first", "last", "player", "example"}


def note(kind: str, name, detail="", example="", player=None):
    """One more of this problem."""
    try:
        key = (kind, str(name)[:80], str(detail)[:160])
        now = int(time.time())
        with __lock:
            if key not in __pending and len(__pending) >= MAX_PENDING:
                return
            seen = __pending.setdefault(key, {"count": 0, "first": now})
            seen.update(count=seen["count"] + 1, last=now, player=None if player is None else str(player),
                        example=str(example)[:EXAMPLE_LENGTH])
    except Exception as e:  # the radar must never cost a player a command
        print(f" [!] Bug radar: {e!r}")


def failure(name, error: BaseException, example="", player=None):
    """Something that raised error: counted by the kind of error and the line
    it came from, so the same bug with different values counts as one."""
    frames = traceback.extract_tb(error.__traceback__)
    where = f" at {os.path.basename(frames[-1].filename)}:{frames[-1].lineno}" if frames else ""
    note(FAILED, name, type(error).__name__ + where, f"{error!r} {example}".strip(), player)


def flush(storage):
    """Add the problems counted since the last flush to those in storage."""
    with __lock:
        pending = dict(__pending)
        __pending.clear()
    if not pending or storage is None:
        return
    rows = [(kind, name, detail, seen["count"], seen["first"], seen["last"], seen["player"], seen["example"])
            for (kind, name, detail), seen in pending.items()]
    try:
        storage.save_problems(rows)
    except Exception as e:
        print(f" [!] Saving the bug radar failed, will retry: {e}")
        with __lock:
            for key, seen in pending.items():
                newer = __pending.get(key)
                if newer is None:
                    __pending[key] = seen
                else:
                    newer.update(count=newer["count"] + seen["count"], first=min(newer["first"], seen["first"]))
