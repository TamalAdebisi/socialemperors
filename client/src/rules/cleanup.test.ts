import assert from "node:assert/strict";
import { test } from "node:test";

import { cleanUp, oneVillager } from "./cleanup.ts";
import { itemInfo, type ConfigItem, type ItemInfo } from "./config.ts";
import type { PlacedItem, Town } from "./town.ts";

const config = (id: number, name: string, fields: Partial<ConfigItem> = {}): ConfigItem => ({
  id: String(id), name, type: "b", img_name: "x", width: "2", height: "2", category_id: "1",
  subcat_functional: "111", unit_capacity: "0", activation: "0", collect: "0", collect_type: "g", collect_xp: "0",
  race: "h", ...fields,
});
const ITEMS = new Map<number, ItemInfo>([
  [26, itemInfo(config(26, "Town Hall", { subcat_functional: "135", width: "4", height: "4" }))],
  [1, itemInfo(config(1, "House I"))],
  [10, itemInfo(config(10, "Farm Land", { subcat_functional: "122" }))],
  [289, itemInfo(config(289, "Troll Town Hall", { subcat_functional: "135", race: "t" }))],
  [19, itemInfo(config(19, "Tree", { subcat_functional: "125", width: "1", height: "1", race: "n" }))],
  [3000, itemInfo(config(3000, "Path", { category_id: "6", width: "1", height: "1" }))],
  [222, itemInfo(config(222, "Wall Door", { subcat_functional: "222", width: "1", height: "1" }))],
  [500, itemInfo(config(500, "Villager I", { type: "u", subcat_functional: "71", width: "1", height: "1" }))],
  [501, itemInfo(config(501, "Villager I", { type: "u", subcat_functional: "71", width: "1", height: "1" }))],
  [512, itemInfo(config(512, "Light Knight", { type: "u", subcat_functional: "79", width: "1", height: "1" }))],
]);

function at(id: number, tx: number, ty: number, more: Partial<PlacedItem> = {}): PlacedItem {
  return { item: ITEMS.get(id)!, tx, ty, orientation: 0, unitsInside: 0, startedAt: 0, workTime: 0, ...more };
}

function town(items: PlacedItem[]): Town {
  return { id: 0, name: "", townName: "", level: 1, xp: 0, cash: 0, gold: 0, wood: 0, food: 0, stone: 0,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items, unknown: [] };
}

test("a building on top of another goes to storage; the town hall keeps its place whatever the order", () => {
  const house = at(1, 52, 52), hall = at(26, 52, 52), second = at(1, 45, 45), other = at(1, 46, 46);
  const t = town([house, hall, second, other]);
  const { commands, stored } = cleanUp(t);
  assert.deepEqual(stored, [house, other]);
  assert.deepEqual(t.items, [hall, second]);
  assert.equal(t.store.get(1), 2);
  assert.deepEqual(commands[0], { cmd: "store_item_frombug", args: [52, 52, 0, 1] });
});

test("off the map: theirs to storage, anyone else's removed; anyone else's overlapping stays", () => {
  const off = at(1, 100, 50), trollOff = at(289, 0, 0), tree = at(19, 45, 45), house = at(1, 45, 45);
  const t = town([house, off, trollOff, tree]);
  const { commands } = cleanUp(t);
  assert.deepEqual(t.items, [house, tree]);
  // (The troll town hall is looked at first: town halls go before the rest.)
  assert.deepEqual(commands.map((c) => c.cmd), ["sell", "store_item_frombug"]);
  assert.deepEqual(commands[0].args, [0, 0, 289, 0, 1, "OUTOB"]);
});

test("a unit on a building steps to the nearest free tile; on a farm or a path it stays; two on a tile, one moves", () => {
  const house = at(1, 50, 50), onHouse = at(500, 49, 49);
  const farm = at(10, 60, 60), onFarm = at(512, 60, 60);
  const path = at(3000, 40, 40), onPath = at(512, 40, 40);
  const a = at(512, 30, 30), b = at(512, 30, 30);
  const t = town([onHouse, house, farm, onFarm, path, onPath, a, b]);
  const { commands, moved } = cleanUp(t);
  assert.deepEqual(moved, [onHouse, b]);
  assert.ok(Math.max(Math.abs(onHouse.tx - 49), Math.abs(onHouse.ty - 49)) === 1 && !(onHouse.tx >= 49 && onHouse.ty >= 49), "beside the house");
  assert.deepEqual(commands[0].args.slice(0, 3), [49, 49, 500]);
  assert.equal(commands[0].args[7], "Colisio #1");
  assert.deepEqual([onFarm.tx, onPath.tx], [60, 40]);
});

test("a unit on the player's land stays on it when it steps aside; one on a gate steps off it too", () => {
  // The bought block is tiles 40 to 59; a house on its bottom-right corner, a villager on the house.
  const house = at(1, 59, 59), onHouse = at(500, 59, 59);
  const gate = at(222, 45, 45), onGate = at(500, 45, 45);
  const t = town([house, onHouse, gate, onGate]);
  const { moved } = cleanUp(t);
  assert.deepEqual(moved, [onHouse, onGate]);
  assert.ok(onHouse.tx <= 59 && onHouse.ty <= 59, `still on the land: ${onHouse.tx}, ${onHouse.ty}`);
  assert.notDeepEqual([onGate.tx, onGate.ty], [45, 45]);
});

test("a town with no villager gets one near the middle; with one, on the map or inside, none", () => {
  const t = town([at(26, 52, 52)]);
  const added = oneVillager(t, ITEMS, 1000, () => 0);
  assert.ok(added);
  assert.equal(added.villager.item.subcategory, 71);
  assert.ok(Math.abs(added.villager.tx - 54) <= 5 && Math.abs(added.villager.ty - 54) <= 5);
  assert.deepEqual(added.commands[0].args.slice(3), [0, 0, 1, 1, "u"]);
  assert.equal(oneVillager(t, ITEMS, 1000), null, "it has one now");
  const inside = town([at(10, 45, 45, { unitsInside: 1, units: [501] })]);
  assert.equal(oneVillager(inside, ITEMS, 1000), null, "one at work in a farm");
});
