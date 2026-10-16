import assert from "node:assert/strict";
import { test } from "node:test";

import { cardFacts, fill, STAT_WORDS } from "./card.ts";
import type { ItemInfo } from "./config.ts";

function item(fields: Partial<ItemInfo> = {}): ItemInfo {
  return { id: 1, name: "House I", isUnit: false, art: "casa1", width: 2, height: 2, category: 1, subcategory: 111,
    flying: false, velocity: 0, capacity: 0, activation: 0, collect: 0, collectType: "", collectXp: 0, trains: 0, population: 5, unitsLimit: 0, cashCost: 0, cost: 30, costType: "w", facings: 2, production: null,
    inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0, isNew: false, xp: 3, race: "h",
    life: 300, attack: 4, defense: 1, attackRange: 6, attackInterval: 30, size: 1, elevation: 1, groups: "", upgradesTo: 0, ...fields };
}

const stats = (it: ItemInfo) => cardFacts(it).stats.map(({ stat, value }) => `${stat} ${value}`);

test("a house: attack, the time between hits and its room for people; decorations no room", () => {
  assert.deepEqual(stats(item()), ["attack 4", "delay 30", "room 5"]);
  assert.deepEqual(stats(item({ subcategory: 411 })), ["attack 4", "delay 30"]);
  assert.equal(cardFacts(item()).tip, null);
});

test("a unit: attack, delay, reach and speed", () => {
  assert.deepEqual(stats(item({ isUnit: true, subcategory: 78, velocity: 3, attackRange: 1 })),
    ["attack 4", "delay 30", "range 1", "speed 3"]);
});

test("a farm or mill: what it earns with its time bar, who's inside, and the panel's own tip", () => {
  const farm = cardFacts(item({ id: 10, subcategory: 122, capacity: 1 }));
  assert.deepEqual([farm.earns, farm.inside, farm.stats.length], [true, true, 0]);
  assert.equal(farm.tip!.fallback, "Put peasants inside to produce resources");
  const ranch = cardFacts(item({ id: 11, subcategory: 123, capacity: 3 }));
  assert.equal(ranch.tip!.id, 291, "a sheep ranch asks for sheep");
  const bakery = cardFacts(item({ id: 233, subcategory: 138, capacity: 0 }));
  assert.deepEqual([bakery.earns, bakery.inside, bakery.tip!.id], [true, false, 296], "works on its own: nobody inside");
  assert.equal(cardFacts(item({ id: 225, subcategory: 138, capacity: 1 })).earns, false, "the sacrifice altar earns nothing");
});

test("barracks: attack and delay; the castle its reach too; towers and walls their reach", () => {
  assert.deepEqual(stats(item({ subcategory: 311 })), ["attack 4", "delay 30"]);
  assert.deepEqual(stats(item({ subcategory: 231 })), ["attack 4", "delay 30", "range 6"]);
  assert.deepEqual(stats(item({ subcategory: 211 })), ["attack 4", "delay 30", "range 6"]);
  assert.deepEqual(stats(item({ subcategory: 135 })), ["attack 4", "delay 30", "range 6"], "the town hall");
});

test("trees and rocks: what a villager brings, and how", () => {
  const tree = cardFacts(item({ subcategory: 125 }));
  assert.deepEqual([tree.harvest, tree.tip!.id, tree.stats.length], [true, 257, 0]);
  assert.equal(cardFacts(item({ subcategory: 128 })).tip!.id, 258, "a rock growing back: wait");
});

test("tips with the game's numbers: the blacksmith's tenth, the eagles' life after their line", () => {
  const smith = cardFacts(item({ subcategory: 131 })).tip!;
  assert.equal(fill(smith.fallback, smith.args), "Allows you to reduce the cost of your footman, archers and mounted troops by 10%.");
  const eagle = cardFacts(item({ id: 186, subcategory: 136 })).tip!;
  assert.deepEqual([eagle.id, eagle.then!.id, eagle.then!.args], [279, 280, [400]]);
  const wonder = cardFacts(item({ id: 470, subcategory: 511, population: 20 })).tip!;
  assert.equal(fill(wonder.fallback, wonder.args), "This wonder increases the 175 population limit by 20");
  assert.equal(cardFacts(item({ subcategory: 511, population: 0 })).earns, true, "a wonder for no one works on its own");
});

test("a fort and refuges: who's inside, to keep them safe", () => {
  const fort = cardFacts(item({ id: 469, subcategory: 221, capacity: 4 }));
  assert.deepEqual([fort.inside, fort.tip!.id], [true, 300]);
  assert.deepEqual(cardFacts(item({ id: 1284, subcategory: 1311 })).stats, [], "the warehouse has a window of its own");
});

test("the numbers' tooltips are the game's words", () => {
  assert.deepEqual(Object.values(STAT_WORDS).map((w) => w.id), [301, 302, 303, 304, 305]);
});
