"""Arthur's tutorial. Legacy reports remain compatible with the Flash client.
The new client saves exact objectives and awards its nest and dragon once,
as one command, before marking the mandatory tutorial complete.
"""

LAST_LESSON = 15  # the step reported when Arthur's last lesson is closed


def step(save: dict) -> int:
    """How far this empire got in the tutorial (0: not started). Older saves
    keep it as text, as the client does."""
    try:
        return int(save["playerInfo"].get("completed_tutorial") or 0)
    except (TypeError, ValueError):
        return 0


def reached(save: dict, lesson, checkpoint=None) -> str:
    """The client reports each lesson as the player reaches it."""
    lesson = int(lesson)
    if checkpoint is not None:
        # The new client's mandatory tutorial persists its exact objective
        # and tree count. Step 32 is a reward waiting to be claimed, not done.
        trees = int(checkpoint.get("trees", 0))
        if not 0 <= lesson <= 32 or not 0 <= trees <= 3:
            return "Invalid tutorial checkpoint."
        old = save["privateState"].get("tutorial", {})
        if lesson < old.get("step", 0):
            return "Tutorial checkpoint already passed."
        save["privateState"]["tutorial"] = {
            "step": lesson, "trees": max(trees, old.get("trees", 0)),
        }
        save["playerInfo"]["completed_tutorial"] = max(lesson, step(save))
        return f"Tutorial checkpoint {lesson} saved."
    if lesson <= step(save):
        return f"Tutorial step {lesson} (already past it)"
    save["playerInfo"]["completed_tutorial"] = lesson
    save["privateState"]["dragonNestActive"] = 1  # what finishing the tutorial gives; it won't start again now
    if lesson >= LAST_LESSON:
        return "Tutorial COMPLETED!"
    return f"Tutorial step {lesson} reached; a reload won't start it again"


def claim_reward(save: dict, draggy, nest_at, draggy_at) -> str:
    """Claim the whole tutorial gift once, even if a request is retried.

    Check every input before placing anything. A reload at the choice
    window can reopen it; completing the tutorial cannot lose the gift.
    """
    import inventory
    import shop

    state = save["privateState"].get("tutorial", {})
    if state.get("step", 0) >= 33:
        return "Tutorial reward already claimed."
    if state.get("step") != 32 or state.get("trees", 0) < 3:
        return "Finish the tutorial before choosing your draggy."
    draggy = int(draggy)
    if draggy not in (651, 698, 710):
        return "Choose one of Arthur's draggies."
    for point in (nest_at, draggy_at):
        if point is not None and (not isinstance(point, list) or len(point) != 2
                or any(type(n) is not int or not 0 <= n < 100 for n in point)):
            return "Invalid tutorial reward position."
    town = save["maps"][0]
    has_nest = any(int(item[0]) == 1233 for item in town["items"])
    has_nest = has_nest or inventory.held(save, 0).get(1233, 0) > 0
    def give(item, point):
        if point is None:
            inventory.add_stored(save, 0, item)
        else:
            shop.buy(save, item, point[0], point[1], 0, 0, True, 1)
    if not has_nest:
        give(1233, nest_at)
        save["privateState"].update(dragonNestActive=1, stepNumber=7,
                                    dragonNumber=0, timeStampTakeCare=-1)
    give(draggy, draggy_at)
    save["privateState"]["tutorial"] = {"step": 33, "trees": 3, "draggy": draggy}
    save["playerInfo"]["completed_tutorial"] = 33
    return "Tutorial complete; nest and draggy saved."


def carry_over(save: dict, other_empires: list) -> bool:
    """An empire whose account has already been through the tutorial in
    another empire doesn't start it again. True if the save changed."""
    if step(save) > 0 or not any(step(other) > 0 and "tutorial" not in other["privateState"] for other in other_empires):
        return False
    save["playerInfo"]["completed_tutorial"] = LAST_LESSON
    save["privateState"]["dragonNestActive"] = 1
    return True


def training_knight(save: dict, x, y) -> str:
    """Recover a combat lesson whose only soldier was lost; retries add none."""
    import shop
    from get_game_config import get_attribute_from_item_id as attr
    state = save["privateState"].get("tutorial", {})
    if not 11 <= state.get("step", 0) <= 13:
        return "A training knight is only available during the combat lesson."
    if any(type(n) is not int or not 0 <= n < 100 for n in (x, y)):
        return "Invalid knight position."
    town = save["maps"][0]
    race = str(attr(512, "race"))
    for item in town["items"]:
        if str(attr(item[0], "race")) == race and attr(item[0], "type") == "u" \
                and int(attr(item[0], "subcat_functional") or 0) != 71 \
                and float(attr(item[0], "attack") or 0) > 0:
            return "Your soldier is already here."
    shop.buy(save, 512, x, y, 0, 0, True, 1)
    return "A training knight is ready."
