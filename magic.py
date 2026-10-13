"""
Magic: spells learnt from the Wizard's spell book, cast in battle, and the
mana they use.

    privateState["magics"]  {spell id: times cast}; a spell is known once it
                            is here, and grows stronger after 25 and 50 casts
    privateState["mana"]

Commands from the client:

    "buy_magic"     [spell, town, 0 gold | 1 cash]   learning a spell also
                                                     gives its mana cost as mana
    "use_magic"     [spell]
    "buy_mana_new"  [town, 1 cash | 0 gold]          MANA_PER_PURCHASE mana

And from level START_LEVEL_MANA_REWARD on, each level up gives
MANA_REWARD_PER_LEVEL mana. Prices and amounts come from the game config.
"""

from get_game_config import get_game_config
from village import give, take

WITH_CASH = 1


def _globals() -> dict:
    return get_game_config()["globals"]


def _spell(spell_id):
    for spell in get_game_config()["magics"]:
        if int(spell["id"]) == int(spell_id):
            return spell
    return None


def _known(save: dict) -> dict:
    pState = save["privateState"]
    if not isinstance(pState.get("magics"), dict):
        pState["magics"] = {}
    return pState["magics"]


def learn(save: dict, spell_id, town_id: int, with_cash) -> str:
    spell = _spell(spell_id)
    if spell is None:
        return f"There is no spell {spell_id}."
    known = _known(save)
    if str(spell["id"]) in known:
        return f"{spell['name']} is already known."
    map = save["maps"][town_id]
    if int(with_cash) == WITH_CASH:
        take(save, map, "c", int(spell["cash"]))
    else:
        take(save, map, "g", int(spell["gold"]))
    give(save, map, "m", int(spell["mana"]))
    known[str(spell["id"])] = 0
    return f"{spell['name']} learnt."


def cast(save: dict, spell_id) -> str:
    spell = _spell(spell_id)
    if spell is None:
        return f"There is no spell {spell_id}."
    take(save, None, "m", int(spell["mana"]))
    known = _known(save)
    key = str(spell["id"])
    known[key] = int(known.get(key, 0)) + 1
    return f"{spell['name']} cast ({known[key]} times)."


def buy_mana(save: dict, town_id: int, with_cash) -> str:
    map = save["maps"][town_id]
    if int(with_cash) == WITH_CASH:
        take(save, map, "c", int(_globals()["COST_MANA_CASH"]))
    else:
        take(save, map, "g", int(_globals()["COST_MANA_GOLD"]))
    mana = int(_globals()["MANA_PER_PURCHASE"])
    give(save, map, "m", mana)
    return f"{mana} mana bought."


def level_up(save: dict, old_level: int, new_level: int) -> int:
    """Mana for the levels gained; nothing for a level up already counted."""
    first = max(int(old_level) + 1, int(_globals()["START_LEVEL_MANA_REWARD"]))
    levels = max(int(new_level) - first + 1, 0)
    mana = levels * int(_globals()["MANA_REWARD_PER_LEVEL"])
    give(save, None, "m", mana)
    return mana
