"""
Room for people (DECISIONS.md, 20 October 2026): the owner's rule is that
the population cap is for fighting units, so the villagers take no room.
Both game clients count a town's people from each unit's population in the
game config the server sends them, so the server gives villagers none.

Run from the repository folder:  python -m unittest discover tests
"""

import unittest

import get_game_config
from get_game_config import get_game_config as config, get_item_from_id

VILLAGERS = {500: "Villager I", 501: "Villager I", 580: "Mr. Troll", 581: "Mrs. Troll"}


class VillagersTakeNoRoomTest(unittest.TestCase):

    def test_the_config_gives_villagers_no_room(self):
        workers = {int(i["id"]): (i["name"], i["population"]) for i in config()["items"]
                   if str(i["subcat_functional"]) == get_game_config.VILLAGERS}
        self.assertEqual(workers, {id: (name, "0") for id, name in VILLAGERS.items()})

    def test_other_units_keep_theirs(self):
        # Spearman, Light Knight, Ram, a hero: as the game's config has them.
        kept = {id: str(get_item_from_id(id)["population"]) for id in (509, 512, 519, 602)}
        self.assertEqual(kept, {509: "1", 512: "2", 519: "2", 602: "4"})

    def test_only_workers_change(self):
        items = [{"id": 1, "type": "b", "subcat_functional": "71", "population": "3"},  # not a unit
                 {"id": 2, "type": "u", "subcat_functional": 71, "population": "1"},
                 {"id": 3, "type": "u", "subcat_functional": "78", "population": "1"}]
        get_game_config.villagers_take_no_room({"items": items})
        self.assertEqual([i["population"] for i in items], ["3", "0", "1"])


if __name__ == "__main__":
    unittest.main()
