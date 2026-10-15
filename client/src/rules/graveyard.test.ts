import assert from "node:assert/strict";
import { test } from "node:test";

import type { ItemInfo } from "./config.ts";
import { bury, cantRevive, graveyardUnits, heroPrice, readDead, revivalPrice, revivalSpot, shortPrice, standBeside, unbury } from "./graveyard.ts";
import type { PlacedItem, Town } from "./town.ts";

function item(fields: Partial<ItemInfo> = {}): ItemInfo {
  return { id: 1, name: "House I", isUnit: false, art: "casa1", width: 2, height: 2, category: 1, subcategory: 111,
    flying: false, velocity: 0, capacity: 0, activation: 0, collect: 0, collectType: "", collectXp: 0, trains: 0, population: 3, unitsLimit: 0, cashCost: 0,
    cost: 30, costType: "w", facings: 2, production: null,
    inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0, isNew: false, xp: 0, race: "h",
    life: 0, attack: 0, defense: 1, attackRange: 0, attackInterval: 0, size: 1, elevation: 1, groups: "", ...fields };
}

const unit = (fields: Partial<ItemInfo>) => item({ isUnit: true, width: 1, height: 1, population: 1, ...fields });
const SPEARMAN = unit({ id: 509, name: "Spearman", cost: 30, costType: "g", potion: 1, displayOrder: 2 });
const KNIGHT = unit({ id: 514, name: "Knight", cost: 175, costType: "g", potion: 2, displayOrder: 1, population: 2 });
const CASH_UNIT = unit({ id: 600, name: "Paladin", cost: 25, costType: "c", potion: 20, displayOrder: 3 });
const VILLAGER = unit({ id: 500, name: "Villager", cost: 50, costType: "f" });
const FREE = unit({ id: 601, name: "Gift", cost: 0, costType: "g" });
const TROLL = unit({ id: 602, name: "Troll", cost: 40, costType: "g", race: "t" });
const ANYONE = unit({ id: 603, name: "Dragon", cost: 40, costType: "g", race: "a", displayOrder: 9 });
const RANGER = unit({ id: 535, name: "Ranger", cost: 0, costType: "g", cashCost: 3 });
const GRAVEYARD = item({ id: 486, name: "Graveyard", width: 4, height: 4, population: 0 });
const HOUSE = item({});
const ITEMS = new Map([SPEARMAN, KNIGHT, CASH_UNIT, VILLAGER, FREE, TROLL, ANYONE, RANGER, HOUSE].map((i) => [i.id, i]));

function placed(what: ItemInfo, tx: number, ty: number): PlacedItem {
  return { item: what, tx, ty, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
}

function town(items: PlacedItem[]): Town {
  return { id: 0, name: "", townName: "", level: 5, xp: 0, cash: 3, gold: 1000, wood: 0, food: 1000, stone: 0,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items, unknown: [] };
}

test("the fallen as the save keeps them: an object of counts, or an empty list", () => {
  assert.deepEqual([...readDead({ "509": 2, "514": "1", "600": 0 })], [[509, 2], [514, 1]]);
  assert.equal(readDead([]).size, 0);
  assert.equal(readDead(undefined).size, 0);
  const dead = readDead({ "509": 1 });
  bury(dead, 509);
  bury(dead, 514);
  assert.deepEqual([...dead], [[509, 2], [514, 1]]);
  unbury(dead, 514);
  assert.equal(dead.has(514), false, "none left: gone from the list");
});

test("the graveyard lists the town's race (and anyone's) bought with gold or cash, heroes aside, by the shop's order", () => {
  const dead = readDead({ "509": 2, "514": 1, "600": 1, "500": 3, "601": 1, "602": 1, "603": 1, "535": 1 });
  assert.deepEqual(graveyardUnits(dead, ITEMS, "h").map((u) => [u.item.id, u.count]), [[514, 1], [509, 2], [600, 1], [603, 1]]);
  assert.deepEqual(graveyardUnits(dead, ITEMS, "t").map((u) => u.item.id), [602, 603]);
});

test("prices: potions; half the cash; half the gold and the whole price in food; heroes 500 gold a cash", () => {
  assert.deepEqual(revivalPrice(KNIGHT), { potions: 2, cash: 0, gold: 88, food: 175 });
  assert.deepEqual(revivalPrice(CASH_UNIT), { potions: 20, cash: 13, gold: 0, food: 0 });
  assert.equal(heroPrice(RANGER), 1500);
  assert.equal(shortPrice(1500), "1.5k");
  assert.equal(shortPrice(17500), "17.5k");
  assert.equal(shortPrice(999), "999");
});

test("no coming back without room for people, or past the units limit", () => {
  const full = town([placed(HOUSE, 10, 10), placed(SPEARMAN, 20, 20), placed(SPEARMAN, 21, 21)]);
  assert.match(cantRevive(full, KNIGHT, ITEMS) ?? "", /houses/);
  assert.equal(cantRevive(full, SPEARMAN, ITEMS), null);
  const limited = { ...SPEARMAN, unitsLimit: 2 };
  assert.match(cantRevive(full, limited, ITEMS) ?? "", /as many/);
});

test("the unit comes back beside the building: the first ring with room, its tile furthest down and right", () => {
  const t = town([placed(GRAVEYARD, 50, 50)]);
  assert.deepEqual(revivalSpot(t, { x: 50, y: 50 }), { x: 51, y: 51 });
  t.items.push(placed(HOUSE, 51, 51));  // 2x2: takes 50..51 both ways
  assert.deepEqual(revivalSpot(t, { x: 50, y: 50 }), { x: 49, y: 51 }, "a tie: the first found, by x");
  const back = standBeside(t, KNIGHT, t.items[0]);
  assert.ok(t.items.includes(back));
  assert.equal(back.item, KNIGHT);
});
