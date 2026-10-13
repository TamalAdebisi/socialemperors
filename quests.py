import json
import os

from bundle import QUESTS_DIR


def get_quest_map(questid):
    # Quest ids are plain numbers. Rejecting anything else stops requests like
    # "100000/../../something" from reading files outside the quests folder.
    questid = str(questid)
    if not questid.isdigit():
        return ("", 404)
    file = os.path.join(QUESTS_DIR, questid + ".json")
    if not os.path.exists(file):
        return ("", 404)
    with open(file, "r") as f:
        return (json.load(f), 200)
