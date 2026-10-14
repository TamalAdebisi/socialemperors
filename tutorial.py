"""
Arthur's tutorial: how far the player got, kept for the whole account.

The game client knows two states only. When playerInfo.completed_tutorial is
0, it starts the tutorial at Arthur's first lesson; anything else and the
tutorial is over. It cannot start at a later lesson. As the player reaches
each lesson the client reports its number and writes it into
completed_tutorial itself, so the server keeps that number too: a player who
reloads partway through carries on playing instead of going back to the
first lesson, and finds the town as they left it.

The tutorial belongs to the player, not to one empire. Once an account has
been through it (all of it or part of it) in any of its empires, none of its
empires starts it again.
"""

LAST_LESSON = 15  # the step reported when Arthur's last lesson is closed


def step(save: dict) -> int:
    """How far this empire got in the tutorial (0: not started). Older saves
    keep it as text, as the client does."""
    try:
        return int(save["playerInfo"].get("completed_tutorial") or 0)
    except (TypeError, ValueError):
        return 0


def reached(save: dict, lesson) -> str:
    """The client reports each lesson as the player reaches it."""
    lesson = int(lesson)
    if lesson <= step(save):
        return f"Tutorial step {lesson} (already past it)"
    save["playerInfo"]["completed_tutorial"] = lesson
    save["privateState"]["dragonNestActive"] = 1  # what finishing the tutorial gives; it won't start again now
    if lesson >= LAST_LESSON:
        return "Tutorial COMPLETED!"
    return f"Tutorial step {lesson} reached; a reload won't start it again"


def carry_over(save: dict, other_empires: list) -> bool:
    """An empire whose account has already been through the tutorial in
    another empire doesn't start it again. True if the save changed."""
    if step(save) > 0 or not any(step(other) > 0 for other in other_empires):
        return False
    save["playerInfo"]["completed_tutorial"] = LAST_LESSON
    save["privateState"]["dragonNestActive"] = 1
    return True
