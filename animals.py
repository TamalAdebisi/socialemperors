"""Wild animals that come onto the map: sheep, cows and horses, or boars in
a troll town.

The game client adds them when a town opens, at most the config's
ANIMALS_PER_DAY of each kind a day, and tells the server how many with
admin_add_animal; the day's counts are in privateState.arrayAnimals, which
the client reads to know how many more it may add. They start again each
day (the count never did here, so a town had its animals once and never
again)."""

from engine import timestamp_now

DAY = 24 * 3600


def fresh_day(save: dict) -> None:
    """A new day: the counts start again."""
    state = save["privateState"]
    today = timestamp_now() // DAY
    if state.get("arrayAnimalsDay") != today:
        state["arrayAnimals"] = {}
        state["arrayAnimalsDay"] = today


def added(save: dict, subcat, count) -> str:
    """The client added `count` animals of a kind (its subcat_functional)."""
    fresh_day(save)
    animals = save["privateState"]["arrayAnimals"]
    animals[str(subcat)] = int(count) + int(animals.get(str(subcat), 0))
    return f"{animals[str(subcat)]} of kind {subcat} today."
