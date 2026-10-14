import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { itemsById, type GameConfig } from "./config.ts";
import { readTown, type PlayerInfo, type SaveMap } from "./town.ts";

const root = new URL("../../../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("config/game_config_20120826.json", root), "utf8")) as GameConfig;
const items = itemsById(config);

function info(map: Partial<SaveMap>): PlayerInfo {
  return {
    result: "ok",
    timestamp: 0,
    playerInfo: { name: "Emperor", cash: 7, map_names: ["My Empire"] },
    map: { id: 0, expansions: [13], level: 1, xp: 0, coins: 250, wood: 850, food: 700, stone: 250, race: "h", skin: 0, items: [], ...map },
  };
}

test("reads a new player's town from the server's starting save", () => {
  const save = JSON.parse(readFileSync(new URL("villages/initial.json", root), "utf8"));
  const town = readTown(info(save.maps[0]), items);
  assert.equal(town.items.length, save.maps[0].items.length);
  assert.deepEqual(town.unknown, []);
  assert.deepEqual([...town.expansions], [13]);
  assert.equal(town.townName, "My Empire");
  const hall = town.items.find((placed) => placed.item.art === "ayuntamiento")!;
  assert.deepEqual([hall.tx, hall.ty], [52, 52]);
  assert.equal(hall.item.isUnit, false);
});

test("items the config doesn't know are left out and reported", () => {
  const town = readTown(info({ items: [[26, 52, 52, 0], [999999, 1, 1, 0]] }), items);
  assert.equal(town.items.length, 1);
  assert.deepEqual(town.unknown, [999999]);
});

test("the numbers at the top of the screen", () => {
  const town = readTown(info({ coins: 1, wood: 2, food: 3, stone: 4, level: 5, xp: 6 }), items);
  assert.deepEqual([town.gold, town.wood, town.food, town.stone, town.level, town.xp, town.cash], [1, 2, 3, 4, 5, 6, 7]);
});
