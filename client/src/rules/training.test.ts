import assert from "node:assert/strict";
import { test } from "node:test";

import type { ItemInfo } from "./config.ts";
import type { PlacedItem, Town } from "./town.ts";
import { cantTrain, countOf, payForTraining, population, trained, trainingPrice } from "./training.ts";

function item(fields: Partial<ItemInfo> = {}): ItemInfo {
  return { id: 1, name: "House I", isUnit: false, art: "casa1", width: 2, height: 2, category: 1, subcategory: 111,
    flying: false, velocity: 0, capacity: 0, activation: 0, collect: 0, collectType: "", collectXp: 0, trains: 0, population: 3, unitsLimit: 0, cashCost: 0,
    cost: 30, costType: "w", facings: 2, production: null,
    inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0, isNew: false, xp: 0, race: "h", ...fields };
}

const HOUSE = item({});
const HALL = item({ id: 26, name: "Town Hall", width: 4, height: 4, population: 5, trains: 500, subcategory: 135 });
const MINE = item({ id: 13, name: "Gold Mine I", population: 0, capacity: 1, subcategory: 124 });
const WONDER = item({ id: 261, name: "Saint Basil Basilica", category: 5, population: 25 });
const VILLAGER = item({ id: 500, name: "Villager I", isUnit: true, width: 1, height: 1, population: 1, cost: 50, costType: "f", xp: 5, subcategory: 71 });
const SPEARMAN = item({ id: 509, name: "Spearman", isUnit: true, width: 1, height: 1, population: 1, cost: 30, costType: "g", xp: 3, subcategory: 78, cashCost: 1 });
const KNIGHT = item({ id: 512, name: "Light Knight", isUnit: true, width: 1, height: 1, population: 2, cost: 75, costType: "g", subcategory: 79 });
const RAM = item({ id: 519, name: "Ram", isUnit: true, width: 1, height: 1, population: 2, cost: 100, costType: "g", subcategory: 81 });
const BLACKSMITH = item({ id: 22, name: "Blacksmith", population: 0, subcategory: 131 });
const WILD_COW = item({ id: 504, name: "Cow", isUnit: true, width: 1, height: 1, population: 1, race: "n", subcategory: 74 });
const ITEMS = new Map([VILLAGER, SPEARMAN, KNIGHT].map((i) => [i.id, i]));

function placed(what: ItemInfo, tx: number, ty: number, more: Partial<PlacedItem> = {}): PlacedItem {
  return { item: what, tx, ty, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0, ...more };
}

function town(items: PlacedItem[]): Town {
  return { id: 0, name: "", townName: "", level: 5, xp: 0, cash: 3, gold: 1000, wood: 0, food: 1000, stone: 0,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items, unknown: [] };
}

test("room for people: houses and the town hall; taken by units on the map and inside buildings, not wild animals", () => {
  const t = town([placed(HALL, 52, 52), placed(HOUSE, 44, 50), placed(HOUSE, 44, 52),
    placed(KNIGHT, 50, 44), placed(VILLAGER, 42, 42), placed(WILD_COW, 41, 41), placed(MINE, 47, 47, { unitsInside: 1, units: [500] })]);
  assert.deepEqual(population(t, ITEMS), { current: 4, max: 11 });
});

test("no more than 175 from buildings; wonders on top, as in the Flash client", () => {
  const houses = Array.from({ length: 70 }, (_, i) => placed(HOUSE, 40 + (i % 10) * 2, 40 + Math.floor(i / 10) * 2));
  assert.equal(population(town(houses), ITEMS).max, 175);
  assert.equal(population(town([...houses, placed(WONDER, 58, 58)]), ITEMS).max, 175 + 25);
  const church = { ...town([placed(item({ id: 470, name: "Great Church", category: 5, population: 10 }), 50, 50)]), increasedPopulation: 3 };
  assert.equal(population(church, ITEMS).max, 10 + 10 + 30);
});

test("training costs its price and twice that in food; villagers need no food; a blacksmith takes a tenth off soldiers", () => {
  const t = town([]);
  assert.deepEqual(trainingPrice(t, SPEARMAN), { resource: "gold", amount: 30, food: 60, multiplier: 1 });
  assert.deepEqual(trainingPrice(t, VILLAGER), { resource: "food", amount: 50, food: 0, multiplier: 1 });
  const smith = town([placed(BLACKSMITH, 50, 50)]);
  assert.deepEqual(trainingPrice(smith, KNIGHT), { resource: "gold", amount: 68, food: 136, multiplier: 0.9 });
  assert.equal(trainingPrice(smith, RAM).multiplier, 1, "a university's for siege engines");
});

test("what stops training: room, the limit, the price", () => {
  const hall = placed(HALL, 52, 52);
  const t = town([hall]);
  assert.equal(cantTrain(t, SPEARMAN, ITEMS, false), null);
  assert.match(cantTrain(town([]), SPEARMAN, ITEMS, false)!, /No room/);
  assert.match(cantTrain({ ...t, gold: 10 }, SPEARMAN, ITEMS, false)!, /Not enough gold/);
  assert.match(cantTrain({ ...t, food: 10 }, SPEARMAN, ITEMS, false)!, /Not enough food/);
  assert.equal(cantTrain({ ...t, gold: 0, food: 0 }, SPEARMAN, ITEMS, true), null, "cash instead");
  const limited = { ...SPEARMAN, unitsLimit: 1 };
  assert.match(cantTrain(town([hall, placed(limited, 40, 40)]), limited, ITEMS, false)!, /as many/);
  assert.equal(countOf(town([placed(MINE, 47, 47, { units: [509, 509] })]), 509), 2);
});

test("trained: paid at the start, out beside the building after, with the Flash client's command", () => {
  const hall = placed(HALL, 52, 52);
  const t = town([hall]);
  const price = payForTraining(t, SPEARMAN, false);
  assert.equal(t.gold, 970);
  assert.equal(t.food, 940);
  assert.equal(t.xp, 3);
  const done = trained(t, hall, SPEARMAN, price, false)!;
  assert.equal(Math.max(Math.abs(done.placed.tx - 52), Math.abs(done.placed.ty - 52)), 1);
  assert.deepEqual(done.command, { cmd: "buy", args: [509, done.placed.tx, done.placed.ty, 0, 0, 0, 1, "u"] });

  const cash = town([hall]);
  payForTraining(cash, SPEARMAN, true);
  assert.equal(cash.cash, 2);
  assert.equal(cash.gold, 1000);
  assert.equal(trained(cash, hall, SPEARMAN, price, true)!.command.cmd, "buy_cash");
});
