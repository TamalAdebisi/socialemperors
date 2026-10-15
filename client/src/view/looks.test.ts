import assert from "node:assert/strict";
import { test } from "node:test";

import { itemInfo, type ConfigItem } from "../rules/config.ts";
import type { PlacedItem } from "../rules/town.ts";
import { lookKey, lookOf } from "./looks.ts";

const config = (fields: Partial<ConfigItem>): ConfigItem => ({
  id: "10", name: "Farm Land", type: "b", img_name: "granja3", width: "4", height: "4", category_id: "1",
  subcat_functional: "122", unit_capacity: "1", activation: "32.4", collect: "15", collect_type: "f", collect_xp: "1",
  ...fields,
});
const FARM = itemInfo(config({}));
const RANCH = itemInfo(config({ id: "11", name: "Sheep Ranch I", subcat_functional: "123", unit_capacity: "6" }));
const STABLES = itemInfo(config({ id: "227", name: "Training Stables", subcat_functional: "123", unit_capacity: "5" }));

const at = (item = FARM, units: number[] = []): PlacedItem =>
  ({ item, tx: 50, ty: 50, orientation: 0, unitsInside: units.length, units, startedAt: 0, workTime: 0 });

test("a farm: the empty field; the man or the woman at work, never both; ripe crops with them", () => {
  assert.deepEqual(lookOf(at(), 45, false), [0]);
  const man = lookOf(at(FARM, [500]), 45, false)!;
  assert.deepEqual([man[0], man.at(-1), man.length], [1, 20, 20]);
  const woman = lookOf(at(FARM, [501]), 45, false)!;
  assert.deepEqual([woman[0], woman.at(-1)], [21, 42]);
  assert.deepEqual(lookOf(at(FARM, [500]), 45, true), [43]);
  assert.deepEqual(lookOf(at(FARM, [501]), 45, true), [44]);
  assert.deepEqual(lookOf(at(FARM, [580]), 45, true), [43], "a troll man too");
});

test("a ranch: as many animals as are inside; buildings laid out otherwise play as they are", () => {
  assert.deepEqual(lookOf(at(RANCH), 7, false), [0]);
  assert.deepEqual(lookOf(at(RANCH, [505, 505, 505]), 7, false), [3]);
  assert.equal(lookOf(at(STABLES, [571]), 318, false), null);
  assert.equal(lookOf(at(FARM, [500]), 30, false), null, "a field with other pictures");
});

test("the look changes when who's inside or the harvest does", () => {
  assert.notEqual(lookKey(at(FARM, [500]), false), lookKey(at(FARM, [501]), false));
  assert.notEqual(lookKey(at(FARM, [500]), false), lookKey(at(FARM, [500]), true));
  assert.equal(lookKey(at(itemInfo(config({ subcat_functional: "111" }))), false), null, "a house has one look");
});
