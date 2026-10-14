import assert from "node:assert/strict";
import { test } from "node:test";

import { itemInfo, type ConfigItem, type ItemInfo } from "./config.ts";
import { atLimit, buy, describe, obstacle, readShop, shopItems } from "./shop.ts";
import type { PlacedItem, Town } from "./town.ts";

const config = (fields: Partial<ConfigItem>): ConfigItem => ({
  id: "1", name: "Thing", type: "b", img_name: "x", width: "2", height: "2", category_id: "1",
  subcat_functional: "111", subcategory_id: "11", in_store: "1", cost: "30", cost_type: "w", xp: "3",
  min_level: "1", store_level: "0", display_order: "10", new_item: "0", ...fields,
});
const HOUSE = itemInfo(config({ id: "1", name: "House I", display_order: "1" }));
const BIG_HOUSE = itemInfo(config({ id: "4", name: "House IV", min_level: "10", display_order: "4", cost: "500" }));
const FARM = itemInfo(config({ id: "10", name: "Farm Land", subcategory_id: "12", subcat_functional: "122", display_order: "2" }));
const GOLD_MINE = itemInfo(config({ id: "13", name: "Gold Mine I", subcategory_id: "12", subcat_functional: "124", cost: "100" }));
const TROLL_HUT = itemInfo(config({ id: "303", name: "Troll Hut", in_store: "2" }));
const LATE = itemInfo(config({ id: "40", name: "Shown from level 5", store_level: "5" }));
const CASTLE = itemInfo(config({ id: "1234", name: "Diamond Castle", category_id: "2", subcategory_id: "23", cost_type: "c" }));
const GOLDEN_TOWER = itemInfo(config({ id: "60", name: "Golden Tower", category_id: "2", subcategory_id: "21", cost_type: "c", cost: "20" }));
const NEW_STATUE = itemInfo(config({ id: "61", name: "New Statue", category_id: "4", subcategory_id: "44", new_item: "1" }));
const LIMITED = itemInfo(config({ id: "62", name: "Limited", category_id: "12", subcategory_id: "121" }));
const MARKET = itemInfo(config({ id: "63", name: "Market", subcat_functional: "132" }));
const NURSERY = itemInfo(config({ id: "226", name: "Nursery", subcat_functional: "123" }));
const ALL = [BIG_HOUSE, FARM, HOUSE, GOLD_MINE, TROLL_HUT, LATE, CASTLE, GOLDEN_TOWER, NEW_STATUE, LIMITED, MARKET, NURSERY];

function town(level = 1, items: ItemInfo[] = []): Town {
  const placed: PlacedItem[] = items.map((item, i) => ({ item, tx: 40 + 3 * i, ty: 59, orientation: 0, unitsInside: 0, startedAt: 0, workTime: 0 }));
  return { id: 0, name: "", townName: "", level, xp: 0, cash: 5, gold: 100, wood: 100, food: 100, stone: 100,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items: placed, unknown: [] };
}
const names = (items: ItemInfo[]) => items.map((i) => i.name);

test("the categories, in order, with their tabs", () => {
  const shop = readShop({
    "12": { id: 12, name: "New", sub: [{ id: 121, name: "Limited Edition", parent: 12 }] },
    "1": { id: 1, name: "Village", sub: [{ id: 11, name: "Houses", parent: 1 }, { id: 12, name: "Resources", parent: 1 }] },
    "0": { sub: [{ id: 0, name: "All", parent: 0 }] },
  });
  assert.deepEqual(shop.map((c) => c.name), ["Village", "New"]);
  assert.deepEqual(shop[0].tabs, [{ id: 11, name: "Houses" }, { id: 12, name: "Resources" }]);
});

test("a category shows what the town's people can buy, in order, what's above their level last", () => {
  assert.deepEqual(names(shopItems(ALL, town(), 1)), ["House I", "Farm Land", "Gold Mine I", "Market", "Nursery", "House IV"]);
  assert.deepEqual(names(shopItems(ALL, town(), 1, 11)), ["House I", "Market", "Nursery", "House IV"]);
  // Level 10 opens House IV, in its place; from level 5 the shop shows one more.
  assert.deepEqual(names(shopItems(ALL, town(10), 1, 11)), ["House I", "House IV", "Shown from level 5", "Market", "Nursery"]);
  assert.ok(!names(shopItems(ALL, town(), 1)).includes("Troll Hut"));
  assert.ok(names(shopItems(ALL, { ...town(), race: "t" }, 1)).includes("Troll Hut"));
});

test("the New category: its own items, and the others' new and cash ones; never members' only", () => {
  assert.deepEqual(names(shopItems(ALL, town(), 12)).sort(), ["Golden Tower", "Limited", "New Statue"]);
  assert.deepEqual(names(shopItems(ALL, town(), 12, 123)), ["Golden Tower"]);
  assert.ok(!names(shopItems(ALL, town(), 2)).includes("Diamond Castle"));
});

test("what stops a purchase: level, how many, price", () => {
  assert.deepEqual(obstacle(town(), BIG_HOUSE), { kind: "level", level: 10 });
  assert.equal(obstacle({ ...town(), unlocked: new Set([4]) }, BIG_HOUSE)?.kind, "price");  // opened early with cash: only the price now
  assert.equal(obstacle(town(), GOLD_MINE), null);
  assert.deepEqual(obstacle(town(1, [GOLD_MINE]), GOLD_MINE), { kind: "limit", most: 1 });
  assert.equal(atLimit(town(1, [MARKET]), MARKET), 1);
  assert.equal(atLimit(town(1, [NURSERY, NURSERY]), NURSERY), null);
  assert.equal(atLimit(town(1, [NURSERY, NURSERY, NURSERY]), NURSERY), 3);
  assert.deepEqual(obstacle({ ...town(), wood: 29 }, HOUSE), { kind: "price", price: { resource: "wood", amount: 30 } });
  assert.equal(describe({ kind: "limit", most: 1 }), "You have one");
});

test("buying pays, gives experience, puts it on the map and sends what the Flash client sends", () => {
  const t = town();
  const bought = buy(t, HOUSE, 50, 50, 5000);
  assert.notEqual(typeof bought, "string");
  if (typeof bought !== "string") {
    assert.deepEqual(bought.command, { cmd: "buy", args: [1, 50, 50, 0, 0, 0, 1, "b"] });
    assert.equal(bought.placed.startedAt, 5000);
  }
  assert.deepEqual([t.wood, t.xp, t.items.length], [70, 3, 1]);
  assert.equal(buy(t, HOUSE, 50, 50, 5000), "House I doesn't fit there.");  // the first one is there
  assert.equal(buy(t, HOUSE, 30, 30, 5000), "House I doesn't fit there.");  // not bought land
  assert.equal(buy(t, BIG_HOUSE, 45, 45, 5000), "House IV: from level 10.");
  assert.deepEqual([t.wood, t.items.length], [70, 1]);  // nothing changed
});
