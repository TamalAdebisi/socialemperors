import assert from "node:assert/strict";
import { test } from "node:test";

import { seededRandom } from "./battle.ts";
import type { ItemInfo } from "./config.ts";
import {
  BUILT_HERE, borderTrolls, campDue, campOfChest, campReward, campTexts, correctCamp, freedUnits, nextCamp, onBorder, planCamp,
  sideAtHome, type Ground,
} from "./camps.ts";

/** Open ground: what's taken is remembered, footprints included. */
function ground(): Ground & { taken: Set<string> } {
  const taken = new Set<string>();
  return {
    taken,
    free: (x, y) => !taken.has(`${x},${y}`),
    take: (x, y, w, h) => {
      for (let dx = 0; dx < w; dx++) {
        for (let dy = 0; dy < h; dy++) {
          taken.add(`${x - dx},${y - dy}`);
        }
      }
    },
  };
}

const size = (id: number): [number, number] => ([134, 307, 308, 309, 1, 2, 3, 4].includes(id) ? [2, 2]
  : [82, 83, 84, 85, 86, 87, 90, 135].includes(id) ? [3, 3] : [1, 1]);

function item(fields: Partial<ItemInfo>): ItemInfo {
  return { id: 1, name: "x", isUnit: false, art: "x", width: 1, height: 1, category: 0, subcategory: 111,
    flying: false, velocity: 0, capacity: 0, activation: 0, collect: 0, collectType: "", collectXp: 0, trains: 0, population: 0,
    unitsLimit: 0, cashCost: 0, cost: 0, costType: "g", facings: 1, production: null,
    inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0, isNew: false, xp: 0, race: "h",
    life: 100, attack: 0, defense: 1, attackRange: 0, attackInterval: 0, size: 1, elevation: 1, groups: "", upgradesTo: 0, ...fields };
}

test("a camp every 4 hours from the last chest; the next after the last is the first", () => {
  assert.ok(campDue(0, 1_000_000));
  assert.ok(!campDue(1_000_000, 1_000_000 + 4 * 3600 - 1));
  assert.ok(campDue(1_000_000, 1_000_000 + 4 * 3600));
  assert.equal(nextCamp(29), 0);
});

test("the camps a race doesn't get move on, as the original moves them", () => {
  assert.deepEqual([0, 3, 4, 6, 9, 11, 15, 2].map((id) => correctCamp(id, "t")), [1, 5, 5, 10, 10, 12, 1, 2]);
  assert.deepEqual([0, 9, 11, 20].map((id) => correctCamp(id, "h")), [0, 10, 12, 20]);
  assert.deepEqual([...BUILT_HERE].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 8, 10, 12]);
});

test("what a chest pays by level, level 26 included", () => {
  assert.deepEqual([1, 6, 15, 20, 25, 26, 40].map((l) => campReward(l).gold), [250, 350, 450, 550, 650, 750, 750]);
  assert.equal(campReward(26).xp, 100);
});

test("the treasure village: walled with a way in, the chest, huts, towers and soldiers by level, on the border", () => {
  const g = ground();
  const camp = planCamp(3, 20, "h", seededRandom(3), g, size)!;
  const count = (id: number) => camp.pieces.filter((p) => p.id === id).length;
  assert.equal(camp.chest.id, 82);
  assert.equal(count(134), 4, "4 huts");
  assert.equal(count(291), 7, "towers: a third of the level");
  assert.equal(camp.pieces.filter((p) => p.unit).length, 9, "soldiers: a quarter of the level and 4");
  assert.equal(count(305), 15 * 2 + 13 * 2 - 3, "walls all round but a 3-tile gap");
  assert.ok(camp.pieces.every((p) => onBorder(p.x, p.y)), "all on the border ring");
});

test("a layout camp: the drawn shape, with the enemy race's walls, towers and soldiers for the level", () => {
  const camp = planCamp(1, 12, "h", seededRandom(9), ground(), size)!;
  assert.equal(camp.chest.id, 86);
  const ids = new Set(camp.pieces.map((p) => p.id));
  assert.ok(ids.has(305), "Troll Wall II from level 11");
  assert.ok(!ids.has(35), "not the template's human wall");
  assert.ok(camp.pieces.filter((p) => p.unit).every((p) => [525, 526, 527, 530].includes(p.id)));
  const trollPlayer = planCamp(1, 12, "t", seededRandom(9), ground(), size)!;
  assert.equal(trollPlayer.chest.id, 364);
  assert.ok(trollPlayer.pieces.filter((p) => p.unit).every((p) => [509, 516, 512, 510, 517, 513, 511, 518, 514].includes(p.id)));
});

test("a prison frees its prisoners beside it, the player's", () => {
  const g = ground();
  const freed = freedUnits(1, "h", { x: 50, y: 10 }, seededRandom(1), g);
  assert.deepEqual(freed.map((u) => u.id), [535, 535, 535]);
  assert.equal(new Set(freed.map((u) => `${u.x},${u.y}`)).size, 3, "each on its own tile");
  assert.equal(freedUnits(4, "h", { x: 50, y: 10 }, seededRandom(1), ground()).length, 3);
  assert.equal(campOfChest(364), 1);
  assert.equal(campOfChest(82), 3);
  assert.equal(campTexts(3, "h")!.start[0], 719);
});

test("trolls on the border: clusters, fewer the more enemies there are", () => {
  const many = borderTrolls(0, 10, "h", seededRandom(2), ground());
  assert.ok(many.length >= 18 && many.length <= 24, `6 clusters of 3 or 4 (${many.length})`);
  // In the border's big tiles, give or take the few tiles a crowded cluster spills over.
  assert.ok(many.every((t) => t.x < 25 || t.x >= 75 || t.y < 25 || t.y >= 75));
  assert.equal(borderTrolls(24, 10, "h", seededRandom(2), ground()).length, 0);
});

test("whose things are at home: by race, and the border's buildings are enemies but chests and nature", () => {
  const troll = item({ race: "t", isUnit: true });
  assert.equal(sideAtHome("h", troll, 50, 50), "enemy");
  assert.equal(sideAtHome("t", troll, 50, 50), "self");
  assert.equal(sideAtHome("h", item({ race: "h" }), 50, 50), "self");
  assert.equal(sideAtHome("h", item({ race: "h" }), 5, 50), "enemy", "a human building on the border is an enemy's");
  assert.equal(sideAtHome("h", item({ race: "n", subcategory: 125 }), 5, 50), "nobody", "a tree");
  assert.equal(sideAtHome("h", item({ race: "n", subcategory: 811 }), 5, 50), "nobody", "the chest");
  assert.equal(sideAtHome("h", item({ race: "n", subcategory: 125 }), 50, 50), "nobody");
});

test("the scripted camps' chests aren't ours: their stories open them", () => {
  // The burning mill's (camp 7) and the skeleton statue's (13).
  assert.equal(campOfChest(211), null);
  assert.equal(campOfChest(259), null);
  assert.equal(campOfChest(83), 0);
});
