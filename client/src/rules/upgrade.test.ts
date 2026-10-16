import assert from "node:assert/strict";
import { test } from "node:test";

import type { ItemInfo } from "./config.ts";
import type { PlacedItem, Town } from "./town.ts";
import { cantUpgrade, upgrade, upgradeOf, upgradePrice } from "./upgrade.ts";

function item(fields: Partial<ItemInfo> = {}): ItemInfo {
  return { id: 1, name: "House I", isUnit: false, art: "casa1", width: 2, height: 2, category: 1, subcategory: 111,
    flying: false, velocity: 0, capacity: 0, activation: 0, collect: 0, collectType: "", collectXp: 0, trains: 0, population: 0, unitsLimit: 0, cashCost: 0, cost: 30, costType: "w", facings: 2, production: null,
    inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0, isNew: false, xp: 3, race: "h",
    life: 0, attack: 0, defense: 1, attackRange: 0, attackInterval: 0, size: 1, elevation: 1, groups: "", upgradesTo: 0, ...fields };
}

// As in the config: House I (30 wood) becomes House II (60 wood, from level 7, 6 XP);
// the Town Hall (1000 gold) becomes Town Hall II (3500 gold, from level 12); Castle I was bought with cash.
const HOUSE = item({ upgradesTo: 2 });
const HOUSE_2 = item({ id: 2, name: "House II", cost: 60, minLevel: 7, xp: 6, upgradesTo: 3 });
const HALL = item({ id: 26, name: "Town Hall", subcategory: 135, cost: 1000, costType: "g", width: 4, height: 4, upgradesTo: 139 });
const HALL_2 = item({ id: 139, name: "Town Hall II", subcategory: 135, cost: 3500, costType: "g", minLevel: 12, xp: 350, width: 4, height: 4 });
const CASTLE = item({ id: 27, name: "Castle I", subcategory: 231, cost: 15, costType: "c", upgradesTo: 28 });
const CASTLE_2 = item({ id: 28, name: "Castle II", subcategory: 231, cost: 25, costType: "c", minLevel: 10, xp: 300 });
const ITEMS = new Map([HOUSE, HOUSE_2, HALL, HALL_2, CASTLE, CASTLE_2].map((i) => [i.id, i]));

function town(more: Partial<Town> = {}): Town {
  return { id: 0, name: "", townName: "", level: 7, xp: 100, cash: 30, gold: 5000, wood: 100, food: 0, stone: 0,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items: [], unknown: [], ...more };
}

const at = (it: ItemInfo, tx: number, ty: number, more: Partial<PlacedItem> = {}): PlacedItem =>
  ({ item: it, tx, ty, orientation: 1, unitsInside: 0, units: [], startedAt: 5, workTime: 0, ...more });

test("what a building upgrades to: the config's upgrades_to; nothing past the last", () => {
  assert.equal(upgradeOf(HOUSE, ITEMS), HOUSE_2);
  assert.equal(upgradeOf(HALL, ITEMS), HALL_2);
  assert.equal(upgradeOf(HALL_2, ITEMS), null);
  assert.equal(upgradeOf(HOUSE_2, ITEMS), null, "an id the config hasn't: nothing");
});

test("it costs the next building's whole price, in what that costs", () => {
  assert.deepEqual(upgradePrice(HOUSE_2), { resource: "wood", amount: 60 });
  assert.deepEqual(upgradePrice(CASTLE_2), { resource: "cash", amount: 25 });
});

test("it waits for the next building's level, then its price", () => {
  assert.deepEqual(cantUpgrade(town({ level: 6 }), HOUSE_2), { kind: "level", level: 7 });
  assert.deepEqual(cantUpgrade(town({ wood: 59 }), HOUSE_2), { kind: "price", resource: "wood", amount: 60 });
  assert.equal(cantUpgrade(town(), HOUSE_2), null);
  assert.equal(upgrade(town({ level: 6 }), at(HOUSE, 50, 50), HOUSE_2, 100), null, "refused: nothing changes");
});

test("a house: a twentieth of the old one back, the new one's price paid, its experience; sold for UPGR, bought on the same tile", () => {
  const house = at(HOUSE, 50, 51);
  const t = town({ items: [at(HALL, 52, 52), house] });
  const done = upgrade(t, house, HOUSE_2, 1000)!;
  assert.equal(t.wood, 100 + 1 - 60);
  assert.equal(t.xp, 106);
  assert.deepEqual(done.back, { resource: "wood", amount: 1 });
  assert.deepEqual(done.price, { resource: "wood", amount: 60 });
  assert.equal(done.xp, 6);
  assert.deepEqual(done.commands, [
    { cmd: "sell", args: [50, 51, 1, 0, 0, "UPGR"] },
    { cmd: "buy", args: [2, 50, 51, 0, 0, 0, 1, "b"] },
  ]);
  assert.equal(t.items.length, 2);
  assert.equal(t.items[1], done.placed, "in the old one's place");
  assert.equal(done.placed.item, HOUSE_2);
  assert.deepEqual([done.placed.tx, done.placed.ty, done.placed.startedAt, done.placed.unitsInside], [50, 51, 1000, 0]);
  assert.ok(!t.items.includes(house));
});

test("the town hall becomes Town Hall II for 3500 gold, 50 back", () => {
  const hall = at(HALL, 52, 52);
  const t = town({ level: 12, items: [hall] });
  upgrade(t, hall, HALL_2, 0);
  assert.equal(t.gold, 5000 + 50 - 3500);
  assert.equal(t.items[0].item, HALL_2);
});

test("a building bought with cash gives nothing back", () => {
  const castle = at(CASTLE, 50, 50);
  const t = town({ level: 10, items: [castle] });
  const done = upgrade(t, castle, CASTLE_2, 0)!;
  assert.equal(done.back, null);
  assert.equal(t.cash, 30 - 25);
});
