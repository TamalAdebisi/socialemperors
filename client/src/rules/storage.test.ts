import assert from "node:assert/strict";
import { test } from "node:test";

import { itemInfo, type ConfigItem, type ItemInfo } from "./config.ts";
import type { Level } from "./levels.ts";
import { placeStored, sellStored, storageChoices, storageRefund, storedItems } from "./storage.ts";
import type { Town } from "./town.ts";

const config = (fields: Partial<ConfigItem>): ConfigItem => ({
  id: "1", name: "Thing", type: "b", img_name: "x", width: "1", height: "1", category_id: "2",
  subcat_functional: "211", cost: "125", cost_type: "s", xp: "12", race: "h", ...fields,
});
const TOWER = itemInfo(config({ id: "29", name: "Tower I" }));
const FLAG = itemInfo(config({ id: "90", name: "Flag", cost: "5", cost_type: "c", subcat_functional: "411", xp: "3" }));
const TROLL_TOWER = itemInfo(config({ id: "331", name: "Troll Tower", race: "t" }));
const MILL = itemInfo(config({ id: "5", name: "Mill I", width: "2", height: "2", subcat_functional: "121", cost: "100", cost_type: "w" }));
const DOCK = itemInfo(config({ id: "224", name: "Dock", cost: "2000", cost_type: "g" }));
const STATUE = itemInfo(config({ id: "1478", name: "Level-up statue", xp: "0" }));
const HEART = itemInfo(config({ id: "1410", name: "Bahamut Heart" }));
const ITEMS = new Map<number, ItemInfo>([TOWER, FLAG, TROLL_TOWER, MILL, DOCK, STATUE, HEART].map((i) => [i.id, i]));
const LEVELS: Level[] = [{ name: "1", xp: 0, prize: null }, { name: "2", xp: 29, prize: null }];

function town(store: [number, number][] = [], gifts: [number, number][] = []): Town {
  return { id: 0, name: "", townName: "", level: 1, xp: 4, cash: 0, gold: 0, wood: 0, food: 0, stone: 0,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(gifts), store: new Map(store),
    items: [], unknown: [] };
}

test("storage lists the gifts, then the town's own, by name", () => {
  const list = storedItems(town([[29, 2], [5, 1]], [[90, 1]]), ITEMS);
  assert.deepEqual(list.map((s) => [s.item.name, s.gift, s.count]), [["Flag", true, 1], ["Mill I", false, 1], ["Tower I", false, 2]]);
});

test("what can be done with a stored thing", () => {
  const t = town([[29, 1], [331, 1], [1410, 1], [5, 1]]);
  const stored = (item: ItemInfo) => ({ item, gift: false, count: 1 });
  assert.deepEqual(storageChoices(t, stored(TOWER)), { place: true, sell: true, why: "" });
  assert.deepEqual(storageChoices(t, stored(TROLL_TOWER)), { place: false, sell: true, why: "For a troll town" });
  assert.deepEqual(storageChoices(t, stored(HEART)), { place: false, sell: false, why: "Kept for something special" });
  t.items.push({ item: MILL, tx: 50, ty: 50, orientation: 0, unitsInside: 0, startedAt: 0, workTime: 0 });
  assert.equal(storageChoices(t, stored(MILL)).why, "You have one");  // one mill per town, as in the shop
});

test("a unit from storage obeys its kind's limit, inside buildings too; the Mummy is let through", () => {
  const hero = itemInfo(config({ id: "602", name: "Hero", type: "u", subcat_functional: "77", units_limit: "1", population: "1" }));
  const mummy = itemInfo(config({ id: "615", name: "Mummy", type: "u", subcat_functional: "78", units_limit: "1", population: "1" }));
  const t = town([[602, 1], [615, 1]]);
  const stored = (item: ItemInfo) => ({ item, gift: false, count: 1 });
  assert.equal(storageChoices(t, stored(hero), 5).place, true);
  t.items.push({ item: TOWER, tx: 50, ty: 50, orientation: 0, unitsInside: 1, units: [602], startedAt: 0, workTime: 0 });
  assert.deepEqual(storageChoices(t, stored(hero), 5), { place: false, sell: true, why: "That's as many Hero as a town can have" });
  t.items.push({ item: mummy, tx: 45, ty: 45, orientation: 0, unitsInside: 0, startedAt: 0, workTime: 0 });
  assert.equal(storageChoices(t, stored(mummy), 5).place, true);
});

test("selling from storage gives a twentieth back; nothing for cash things or the Dock", () => {
  assert.deepEqual(storageRefund(TOWER), { resource: "stone", amount: 6 });
  assert.equal(storageRefund(FLAG), null);
  assert.equal(storageRefund(DOCK), null);
  const t = town([[29, 2]]);
  const [tower] = storedItems(t, ITEMS);
  assert.deepEqual(sellStored(t, tower), { cmd: "sell_stored_item", args: [29, 0] });
  assert.deepEqual([t.stone, t.store.get(29), tower.count], [6, 1, 1]);
});

test("placing one from storage: the Flash client's command; a gift gives its experience", () => {
  const t = town([[29, 1]], [[90, 1]]);
  const [flag, tower] = storedItems(t, ITEMS);
  const placed = placeStored(t, tower, 50, 50, 7000, LEVELS);
  assert.notEqual(typeof placed, "string");
  if (typeof placed !== "string") {
    assert.deepEqual(placed.command, { cmd: "place_stored_item", args: [29, 50, 50, 0, 0] });
  }
  assert.deepEqual([t.store.has(29), t.items.length, t.xp], [false, 1, 4]);  // the town's own: no experience
  assert.equal(placeStored(t, tower, 51, 51, 7000, LEVELS), "Tower I: none left.");
  assert.equal(placeStored(t, flag, 50, 50, 7000, LEVELS), "Flag doesn't fit there.");
  const gift = placeStored(t, flag, 51, 51, 7000, LEVELS);
  assert.notEqual(typeof gift, "string");
  if (typeof gift !== "string") {
    assert.deepEqual(gift.command, { cmd: "place_gift", args: [90, 51, 51, 0, 0] });
  }
  assert.deepEqual([t.gifts.size, t.xp], [0, 7]);
});

test("placing from storage over a mined-out rock clears it; a unit can't go there", () => {
  const regrowing = itemInfo(config({ id: "80", name: "Regenerating gold ...", subcat_functional: "128", cost: "0", cost_type: "g", race: "n" }));
  const t = town([[5, 1]]);
  t.items.push({ item: regrowing, tx: 50, ty: 50, orientation: 1, unitsInside: 0, startedAt: 0, workTime: 0 });
  const [mill] = storedItems(t, ITEMS);
  const placed = placeStored(t, mill, 50, 50, 7000, LEVELS);
  assert.notEqual(typeof placed, "string");
  if (typeof placed !== "string") {
    assert.deepEqual(placed.cleared.map((c) => c.command), [{ cmd: "sell", args: [50, 50, 80, 0, 0, "BLDZE"] }]);
    assert.deepEqual(placed.command, { cmd: "place_stored_item", args: [5, 50, 50, 0, 0] });
  }
  assert.deepEqual(t.items.map((p) => p.item.id), [5]);
});

test("the level-up statue gives the experience missing for the next level", () => {
  const t = town([], [[1478, 1]]);
  const [statue] = storedItems(t, ITEMS);
  placeStored(t, statue, 50, 50, 0, LEVELS);
  assert.equal(t.xp, 29);
});
