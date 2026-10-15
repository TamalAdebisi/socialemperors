import assert from "node:assert/strict";
import { test } from "node:test";

import { itemInfo, type ConfigItem } from "./config.ts";
import { BUILD_MS, builtShare, inConstruction, isBuilt, scaffoldOf, startBuilding } from "./construction.ts";
import { choices } from "./editing.ts";
import type { PlacedItem, Town } from "./town.ts";
import { canGoInside } from "./work.ts";

const item = (id: number, subcat: number, width: number, type = "b", capacity = 0) => itemInfo({
  id: String(id), name: `Item ${id}`, type, img_name: "x", width: String(width), height: String(width), category_id: "1",
  subcat_functional: String(subcat), unit_capacity: String(capacity), race: "h",
} as ConfigItem);

const placed = (info: ReturnType<typeof item>, tx = 55, ty = 55): PlacedItem => ({
  item: info, tx, ty, orientation: 0, unitsInside: 0, units: [], startedAt: 0, workTime: 0,
});

test("the scaffolding: the farm's and the ranch's own, else one for the width", () => {
  assert.equal(scaffoldOf(item(10, 122, 3)), "scaffold-farm");
  assert.equal(scaffoldOf(item(11, 123, 4)), "scaffold-ranch");
  assert.equal(scaffoldOf(item(226, 123, 3)), "scaffold-3x3", "the Hatchery, a ranch by its kind, gets the usual one");
  assert.equal(scaffoldOf(item(500, 71, 1, "u")), "scaffold-1x1");
  assert.equal(scaffoldOf(item(1, 101, 2)), "scaffold-2x2");
  assert.equal(scaffoldOf(item(2, 101, 3)), "scaffold-3x3");
  assert.equal(scaffoldOf(item(3, 101, 4)), "scaffold-4x4");
  assert.equal(scaffoldOf(item(4, 101, 6)), "scaffold-4x4", "wider than four: the biggest");
});

test("anything bought is built first; from storage, only buildings", () => {
  assert.ok(isBuilt(item(1, 101, 2), false));
  assert.ok(isBuilt(item(500, 71, 1, "u"), false), "a unit from the shop too");
  assert.ok(isBuilt(item(1, 101, 2), true));
  assert.ok(!isBuilt(item(500, 71, 1, "u"), true), "a unit from storage comes as it is");
});

test("10 seconds of building, with its share done", () => {
  const house = placed(item(1, 101, 2));
  assert.ok(!inConstruction(house, 0), "not being built until it's started");
  assert.equal(builtShare(house, 0), 1);
  startBuilding(house, 1000);
  assert.ok(inConstruction(house, 1000));
  assert.equal(builtShare(house, 1000), 0);
  assert.equal(builtShare(house, 1000 + BUILD_MS / 4), 0.25);
  assert.ok(inConstruction(house, 1000 + BUILD_MS - 1));
  assert.ok(!inConstruction(house, 1000 + BUILD_MS), "done after 10 seconds");
  assert.equal(builtShare(house, 1000 + 2 * BUILD_MS), 1);
});

test("meanwhile it takes nobody in and has no buttons", () => {
  const farm = placed(item(10, 122, 3, "b", 1));
  const town = { items: [farm], race: "h", expansions: [13], skin: 0 } as unknown as Town;
  const villager = item(500, 71, 1, "u");
  startBuilding(farm, 1000);
  assert.ok(!canGoInside(town, villager, farm, 1000 + BUILD_MS / 2), "no villager goes in yet");
  assert.ok(canGoInside(town, villager, farm, 1000 + BUILD_MS), "built: in it goes");
  const being = choices(town, farm, 1000 + BUILD_MS / 2);
  assert.deepEqual([being.move, being.turn, being.store, being.sell], [false, false, false, false]);
  const built = choices(town, farm, 1000 + BUILD_MS);
  assert.ok(built.move && built.store && built.sell);
});
