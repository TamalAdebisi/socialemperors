import assert from "node:assert/strict";
import { test } from "node:test";

import { Battle, ENEMY, SELF, seededRandom } from "./battle.ts";
import type { ItemInfo } from "./config.ts";
import { MAP_TILES } from "./geometry.ts";
import { FIRST_RAID, Raid, enemyIds, planBand, planRaids, raidRecovery } from "./raids.ts";

function item(fields: Partial<ItemInfo> = {}): ItemInfo {
  return { id: 510, name: "Swordsman", isUnit: true, art: "x", width: 1, height: 1, category: 0, subcategory: 78,
    flying: false, velocity: 6, capacity: 0, activation: 0, collect: 0, collectType: "", collectXp: 0, trains: 0, population: 1,
    unitsLimit: 0, cashCost: 0, cost: 100, costType: "g", facings: 1, production: null,
    inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0, isNew: false, xp: 0, race: "h",
    life: 60, attack: 30, defense: 0, attackRange: 1, attackInterval: 20, size: 1, elevation: 1, groups: "", upgradesTo: 0, ...fields };
}

const ITEMS = new Map<number, ItemInfo>();
for (const id of [509, 510, 513, 516, 517, 520, 525, 526, 527, 528, 529, 530, 531, 547, 601, 597, 603, 541, 585, 586, 501, 581]) {
  ITEMS.set(id, item({ id, name: `Unit ${id}` }));
}
const HOUSE = item({ id: 1, name: "House", isUnit: false, subcategory: 111, width: 2, height: 2, life: 120, attack: 0, velocity: 0 });
const VILLAGER = item({ id: 500, name: "Villager", subcategory: 71, attack: 0, life: 30 });

function battle(): Battle {
  return new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random: seededRandom(4), home: true });
}

const quiet = { say: () => {} };

test("who raids: trolls on a human town by level, humans on a troll town", () => {
  assert.deepEqual(enemyIds(3, "h"), [525]);
  assert.deepEqual(enemyIds(20, "h"), [525, 526, 527, 530, 531, 528, 529]);
  assert.deepEqual(enemyIds(6, "t"), [509, 516, 512, 510, 517, 513]);
});

test("bands start at five minutes even at low levels, scale by level and leave recovery between waves", () => {
  assert.equal(planRaids(1, "h", seededRandom(1))[0].units.length, 2);
  const plans = planRaids(20, "h", seededRandom(1)).filter((p) => p.kind === "bandits");
  assert.deepEqual(plans.map((p) => p.startsAt), [FIRST_RAID]);
  assert.ok(plans.every((p) => p.units.length === 5));
  assert.ok(plans.every((p) => [0, 99].includes(p.spawn.x) || [0, 99].includes(p.spawn.y)));
  assert.equal(planRaids(20, "t", seededRandom(1)).filter((p) => p.kind === "bandits")[0].units.length, 10);
  assert.equal(raidRecovery(1), 7 * 1800);
  assert.equal(raidRecovery(12), 5 * 1800);
  assert.equal(planBand(12, "h", seededRandom(2), 999).startsAt, 999);
});

test("raiders attack a town with no units, and eventually leave even if there is nothing left to burn", () => {
  const b = battle();
  const plan = planBand(1, "h", seededRandom(1), 0);
  plan.spawn = { x: 50, y: 55 };
  plan.units = [{ id: 525, x: 50, y: 55, squad: "band" }];
  const raid = new Raid(b, plan, ITEMS, 1, "h", quiet);
  const house = b.add(HOUSE, 50, 50, SELF);
  for (let i = 0; i < 6 * 1800 && !raid.done; i++) { b.step(); raid.step(); }
  assert.ok(house.ruined, "unprotected buildings burn without a player order");
  assert.ok(raid.done, "the town gets a recovery period even with no units to kill");
});

test("a band blocked from its chosen unit attacks a reachable wall", () => {
  const b = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random: () => 0.99, home: true });
  const villager = b.add(VILLAGER, 50, 50, SELF);
  villager.condition = "passive";
  const wall = item({ ...HOUSE, id: 100, subcategory: 221, width: 1, height: 1, life: 1000 });
  const walls = [];
  for (let x = 47; x <= 53; x++) {
    for (let y = 47; y <= 53; y++) {
      if ([47, 53].includes(x) || [47, 53].includes(y)) walls.push(b.add(wall, x, y, SELF));
    }
  }
  const plan = planBand(1, "h", seededRandom(1), 0);
  plan.units = [{ id: 525, x: 50, y: 57, squad: "band" }];
  const raid = new Raid(b, plan, ITEMS, 1, "h", quiet);
  for (let i = 0; i < 60; i++) { b.step(); raid.step(); }
  assert.ok(walls.includes(raid.alive[0].target!), "the wall is the next target");
  assert.equal(villager.life, villager.maxLife, "the protected unit has not been hit");
});

test("a siege 1 visit in 10, of the level's kind only", () => {
  const kinds = (level: number) => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      for (const plan of planRaids(level, "h", seededRandom(seed))) {
        seen.add(plan.kind);
      }
    }
    return [...seen].sort();
  };
  assert.deepEqual(kinds(27), ["bandits", "siege"]);
  assert.deepEqual(kinds(32), ["bandits", "stampede"]);
  assert.deepEqual(kinds(40), ["army", "bandits"]);
  let sieges = 0;
  for (let seed = 0; seed < 2000; seed++) {
    sieges += planRaids(27, "h", seededRandom(seed)).some((p) => p.kind === "siege") ? 1 : 0;
  }
  assert.ok(sieges > 140 && sieges < 260, `about 1 in 10 (${sieges} of 2000)`);
  const siege = planRaids(27, "h", () => 0.05).find((p) => p.kind === "siege")!;
  assert.equal(siege.units.length, 26, "20 soldiers, 5 engines, a captain");
});

test("a band attacks the player's buildings and units, and leaves at its spawn once both quotas are met", () => {
  const b = battle();
  const raid = new Raid(b, { kind: "bandits", startsAt: 0, spawn: { x: 50, y: 99 },
    units: [525, 525, 525].map((id) => ({ id, x: 50, y: 99, squad: "band" as const })) }, ITEMS, 12, "h", quiet);
  assert.equal(raid.fighters.length, 3);
  const houses = [b.add(HOUSE, 50, 80, SELF), b.add(HOUSE, 54, 80, SELF), b.add(HOUSE, 58, 80, SELF), b.add(HOUSE, 62, 80, SELF)];
  const people = [0, 1, 2, 3].map((i) => b.add(VILLAGER, 46 + i, 76, SELF));
  for (const p of people) {
    p.condition = "passive";
  }
  // The battle tells the raid what fell, as it falls.
  b.onDeath = (f) => raid.fell(f);
  for (let i = 0; i < 30 * 240 && !raid.done; i++) {
    b.step();
    raid.step();
  }
  assert.ok(raid.burnt >= 3 && raid.killed >= 3, `quotas of 3 at level 12 (${raid.burnt} burnt, ${raid.killed} killed)`);
  assert.ok(raid.done, "gone");
  assert.ok(houses.every((h) => b.fighters.includes(h)), "at home burnt houses stay");
  assert.ok(houses.some((h) => h.ruined));
});

test("at home a burnt-out building comes back once repaired in full", () => {
  const b = battle();
  const house = b.add(HOUSE, 50, 50, SELF);
  b.hurt(house, 1000, null);
  assert.ok(house.dead && house.ruined && b.fighters.includes(house));
  b.repair(house, 25);
  assert.ok(house.dead, "not until whole");
  for (let i = 0; i < 10; i++) {
    b.repair(house, 25);
  }
  assert.ok(!house.dead && !house.ruined && house.life === house.maxLife);
  // An enemy's building still falls.
  const theirs = b.add(HOUSE, 60, 60, ENEMY);
  b.hurt(theirs, 1000, null);
  assert.ok(!b.fighters.includes(theirs));
});

test("the siege: a minute's wait, then the engines go for the building nearest", () => {
  const b = battle();
  const said: number[] = [];
  const raid = new Raid(b, planRaids(27, "h", () => 0.05).find((p) => p.kind === "siege")!, ITEMS, 27, "h",
    { say: (_f, line) => said.push(line) });
  const near = b.add(HOUSE, 50, 85, SELF);
  b.add(HOUSE, 50, 40, SELF);
  for (let i = 0; i < 1800; i++) {
    b.step();
    raid.step();
  }
  assert.ok(said.includes(592) || said.includes(594), "the captain calls to get ready");
  b.step();
  raid.step();
  assert.ok(said.includes(582), "Siege engines! Attack!");
  const engines = raid.fighters.filter((f) => f.item.id === 520);
  assert.ok(engines.every((e) => e.target === near));
});

test("the stampede stands when no units of the player's are near the middle; the army aims by the land opened", () => {
  const b = battle();
  const stampede = new Raid(b, planRaids(32, "h", () => 0.05).find((p) => p.kind === "stampede")!, ITEMS, 32, "h", quiet);
  b.add(HOUSE, 50, 70, SELF);  // within the captain's 40 tiles, out of the mounts' sight
  for (let i = 0; i < 1900; i++) {
    b.step();
    stampede.step();
  }
  assert.ok(stampede.fighters.every((f) => f.target === null), "no charge at the town's buildings");

  const army = (owns: number[]) => {
    const a = battle();
    const raid = new Raid(a, planRaids(40, "h", () => 0.05).find((p) => p.kind === "army")!, ITEMS, 40, "h", quiet,
      (block) => owns.includes(block));
    const corner = a.add(HOUSE, 32, 32, SELF);
    const middle = a.add(HOUSE, 52, 52, SELF);
    for (let i = 0; i < 1810; i++) {
      a.step();
      raid.step();
    }
    const engines = raid.fighters.filter((f) => f.target === corner || f.target === middle);
    return engines.length ? (engines[0].target === corner ? "corner" : "middle") : "none";
  };
  assert.equal(army([7, 13]), "corner", "block 7 opened: the corner first");
  assert.equal(army([13]), "middle", "only the first block: the middle");
});
