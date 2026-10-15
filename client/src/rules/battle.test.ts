import assert from "node:assert/strict";
import { test } from "node:test";

import { Battle, ENEMY, SELF, distance, seededRandom, type Fighter } from "./battle.ts";
import type { ItemInfo } from "./config.ts";
import { MAP_TILES } from "./geometry.ts";

function item(fields: Partial<ItemInfo> = {}): ItemInfo {
  return { id: 510, name: "Swordsman", isUnit: true, art: "x", width: 1, height: 1, category: 0, subcategory: 78,
    flying: false, velocity: 3, capacity: 0, activation: 0, collect: 0, collectType: "", collectXp: 0, trains: 0, population: 1,
    unitsLimit: 0, cashCost: 0, cost: 100, costType: "g", facings: 1, production: null,
    inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0, isNew: false, xp: 0, race: "h",
    life: 45, attack: 12, defense: 1, attackRange: 1, attackInterval: 35, size: 1, elevation: 1, groups: "", ...fields };
}

const SWORDSMAN = item();
const ARCHER = item({ id: 516, name: "Light Archer", subcategory: 80, life: 30, attack: 5, attackRange: 5 });
const TROLL = item({ id: 525, name: "Small Troll", life: 35, attack: 12, attackInterval: 50, velocity: 2, race: "t" });
const TOWER = item({ id: 29, name: "Tower I", isUnit: false, subcategory: 211, life: 300, attack: 4, attackRange: 7, velocity: 0 });
const WALL = item({ id: 34, name: "Wall I", isUnit: false, subcategory: 221, life: 150, attack: 0, attackRange: 0, attackInterval: 0, velocity: 0 });
const HOUSE = item({ id: 1, name: "House I", isUnit: false, subcategory: 111, width: 2, height: 2, life: 180, attack: 0, attackRange: 0, attackInterval: 0, velocity: 0 });
const HEALER = item({ id: 502, name: "Healer", subcategory: 72, life: 25, attack: 15, attackRange: 5, attackInterval: 120 });

/** Open ground everywhere. */
function open(): Uint8Array {
  return new Uint8Array(MAP_TILES * MAP_TILES).fill(1);
}

function battle(seed = 1): Battle {
  return new Battle({ ground: open(), random: seededRandom(seed) });
}

function run(b: Battle, frames: number, until?: () => boolean): void {
  for (let i = 0; i < frames && !(until?.()); i++) {
    b.step();
  }
}

test("damage: the attack, give or take 4, less the defense, at least 1; 1 in 10 a critical", () => {
  const b = battle(7);
  const target = b.add(item({ life: 100000 }), 50, 50, ENEMY);
  const seen: number[] = [];
  let crits = 0;
  for (let i = 0; i < 2000; i++) {
    b.hurt(target, 12, null);
  }
  for (const e of b.takeEvents()) {
    if (e.kind === "hit") {
      seen.push(e.amount);
      crits += e.crit ? 1 : 0;
    }
  }
  const normal = seen.filter((n) => n <= 15);
  assert.ok(Math.min(...normal) >= 7 && Math.max(...normal) <= 15, "a normal hit of 12 does 7 to 15");
  assert.ok(Math.max(...seen) <= 23 && Math.max(...seen) >= 17, "a critical does 17 to 23");
  assert.ok(crits > 150 && crits < 250, `about 1 in 10 is critical (${crits} of 2000)`);
  // A weak hit still does 1.
  b.hurt(target, 1, null);
  const last = b.takeEvents()[0];
  assert.ok(last.kind === "hit" && last.amount >= 1);
});

test("siege engines do half to units; units do a quarter more to siege engines", () => {
  const b = battle(3);
  const catapult = b.add(item({ id: 521, subcategory: 81, attack: 60, attackRange: 10 }), 40, 40, SELF);
  const troll = b.add(item({ life: 100000 }), 60, 60, ENEMY);
  let total = 0;
  for (let i = 0; i < 400; i++) {
    b.hurt(troll, 60, catapult);
  }
  for (const e of b.takeEvents()) {
    total += e.kind === "hit" ? e.amount : 0;
  }
  const mean = total / 400;
  // 30 a hit on average, with criticals a little more.
  assert.ok(mean > 29 && mean < 34, `mean ${mean}`);
});

test("distance for reaching is the most tiles across or down between footprints", () => {
  const b = battle();
  const unit = b.add(SWORDSMAN, 50, 50, SELF);
  const house = b.add(HOUSE, 53, 52, ENEMY);  // covers 52-53, 51-52
  assert.equal(distance(unit, house), 2);
  const beside = b.add(SWORDSMAN, 51, 51, ENEMY);
  assert.equal(distance(unit, beside), 1);
});

test("an aggressive unit finds the nearest enemy within 10 tiles, walks up and fights it", () => {
  const b = battle(11);
  const knight = b.add(SWORDSMAN, 40, 40, SELF);
  const troll = b.add(TROLL, 46, 40, ENEMY);
  run(b, 61 * 20, () => troll.dead || knight.dead);
  assert.ok(troll.dead || knight.dead, "one of them died");
  assert.ok(Math.abs(knight.tx - troll.tx) <= 1 || knight.dead);
});

test("nothing happens between enemies more than 10 tiles apart", () => {
  const b = battle();
  const knight = b.add(SWORDSMAN, 20, 20, SELF);
  const troll = b.add(TROLL, 40, 20, ENEMY);
  run(b, 61 * 5);
  assert.equal(knight.life, knight.maxLife);
  assert.equal(troll.life, troll.maxLife);
  assert.equal(knight.target, null);
});

test("fighters come before houses: the nearest thing that fights back is taken first", () => {
  const b = battle();
  const knight = b.add(SWORDSMAN, 50, 50, SELF);
  b.add(WALL, 52, 50, ENEMY);  // 2 tiles away, but it can't fight
  const troll = b.add(TROLL, 50, 53, ENEMY);  // 3 tiles away: 9 against 4 + 10
  assert.equal(b.nearestEnemy(knight, { x: 50, y: 50 }, 10), troll);
});

test("an archer stops at its range and shoots; the arrow flies, then hurts", () => {
  const b = battle(5);
  const archer = b.add(ARCHER, 30, 30, SELF);
  const target = b.add(item({ life: 100000, attack: 0, velocity: 0 }), 30, 42, ENEMY);
  b.attackWith([archer], target);
  run(b, 400, () => archer.next === null && archer.struckAt > 0);
  assert.equal(distance(archer, target), 5, "it stands 5 tiles away");
  // Its shot is in the air, then lands.
  let shot = false;
  let hurt = false;
  run(b, 200, () => hurt);
  for (const e of b.takeEvents()) {
    shot ||= e.kind === "shot";
    hurt ||= e.kind === "hit" && e.fighter === target;
  }
  assert.ok(shot && hurt);
});

test("towers shoot the nearest enemy in range on their beat, and let a far one go", () => {
  const b = battle(2);
  const tower = b.add(TOWER, 50, 50, ENEMY);
  const knight = b.add(item({ velocity: 0 }), 53, 50, SELF);
  run(b, 35);
  assert.equal(tower.target, knight);
  assert.equal(b.shots.length, 1);
  // Out past half its range (3.5), it lets go at the next beat and takes the nearest again.
  knight.tx = 55;
  run(b, 35);
  assert.equal(tower.target, knight, "picked again: the only one in range");
  knight.tx = 60;
  run(b, 35);
  assert.equal(tower.target, null, "out of range");
});

test("allies nearby come to help when one is hit", () => {
  const b = battle(4);
  const hit = b.add(item({ life: 1000 }), 50, 50, SELF);
  const friend = b.add(SWORDSMAN, 52, 52, SELF);
  const far = b.add(SWORDSMAN, 60, 60, SELF);
  const troll = b.add(item({ life: 1000, velocity: 0 }), 49, 49, ENEMY);
  b.hurt(hit, 5, troll);
  assert.equal(friend.target, troll);
  assert.equal(far.target, null, "too far to hear");
  assert.equal(hit.target, troll, "and it hits back");
});

test("a healer heals the most hurt of its side in reach", () => {
  const b = battle(6);
  const healer = b.add(HEALER, 50, 50, SELF);
  const hurt = b.add(item({ velocity: 0 }), 52, 50, SELF);
  hurt.life = 10;
  run(b, 61 * 4, () => hurt.life > 10);
  assert.equal(healer.target, hurt);
  assert.ok(hurt.life > 10);
});

test("a destroyed building frees its ground and is gone at once; a dead unit lies 5 seconds", () => {
  const b = battle();
  const house = b.add(HOUSE, 50, 50, ENEMY);
  assert.equal(b.walkGrid()[50 * MAP_TILES + 50], 0);
  b.kill(house, null);
  assert.equal(b.walkGrid()[50 * MAP_TILES + 50], 1);
  assert.ok(!b.fighters.includes(house));
  const troll = b.add(TROLL, 30, 30, ENEMY);
  b.kill(troll, null);
  run(b, 149);
  assert.ok(b.fighters.includes(troll));
  run(b, 1);
  assert.ok(!b.fighters.includes(troll));
});

test("a walled-in target can't be reached: the order is dropped", () => {
  const b = battle();
  // A ring of walls round a troll.
  for (let x = 48; x <= 52; x++) {
    for (const y of [48, 52]) b.add(WALL, x, y, ENEMY);
  }
  for (let y = 49; y <= 51; y++) {
    for (const x of [48, 52]) b.add(WALL, x, y, ENEMY);
  }
  const troll = b.add(item({ velocity: 0 }), 50, 50, ENEMY);
  const knight = b.add(SWORDSMAN, 40, 50, SELF);
  b.attackWith([knight], troll);
  assert.equal(knight.target, null);
});

test("the same seed plays the same battle", () => {
  function fight(seed: number): number[] {
    const b = battle(seed);
    const mine: Fighter[] = [];
    for (let i = 0; i < 5; i++) mine.push(b.add(SWORDSMAN, 40 + i, 40, SELF));
    const theirs: Fighter[] = [];
    for (let i = 0; i < 5; i++) theirs.push(b.add(TROLL, 40 + i, 47, ENEMY));
    run(b, 30 * 60, () => mine.every((f) => f.dead) || theirs.every((f) => f.dead));
    return [...mine, ...theirs].map((f) => f.life);
  }
  assert.deepEqual(fight(42), fight(42));
});

test("a kamikaze blows up: 500 to itself and to all within 2 tiles, and sets off the others", () => {
  const b = battle(8);
  const KAMIKAZE = item({ id: 575, name: "Kamikaze", subcategory: 89, life: 200, attack: 500, attackInterval: 5 });
  const first = b.add(KAMIKAZE, 50, 50, SELF);
  const second = b.add(KAMIKAZE, 51, 50, SELF);
  const near = b.add(item({ life: 400 }), 52, 52, ENEMY);
  const far = b.add(item({ life: 400 }), 53, 50, ENEMY);
  b.explode(first);
  assert.ok(first.dead);
  assert.ok(near.dead, "2 tiles away: caught");
  run(b, 15);
  assert.ok(second.dead, "the other went off too");
  assert.ok(far.dead, "caught by the second");
});

const MONK = item({ id: 569, name: "Monk", subcategory: 72, life: 50, attack: 10, attackRange: 7, attackInterval: 60 });
const THOR = item({ id: 556, name: "Thor", life: 500, attack: 0, velocity: 0 });

test("a monk turns a unit within 10 tiles to its side, 24 seconds apart, 4 at most; not one of 500 life", () => {
  const b = battle(3);
  const turned: [Fighter, number][] = [];
  b.onConvert = (unit) => turned.push([unit, unit.side]);
  const monk = b.add(MONK, 50, 50, SELF);
  b.add(THOR, 52, 50, ENEMY, { condition: "passive" });
  // Trolls that don't fight back, so all five live to be turned.
  const trolls = [0, 1, 2, 3, 4].map((i) => b.add({ ...TROLL, velocity: 0, attack: 0 }, 54, 48 + i, ENEMY, { condition: "passive" }));
  run(b, 200, () => turned.length > 0);
  assert.equal(turned.length, 1);
  const [first, side] = turned[0];
  assert.ok(trolls.includes(first), "a troll, not Thor");
  assert.equal(side, ENEMY, "told while still the enemy's");
  assert.equal(first.side, SELF);
  assert.ok(first.converted);
  assert.equal(monk.conversions, 1);
  const at = b.frame;
  run(b, 700);
  assert.equal(turned.length, 1, "not before 24 seconds");
  run(b, 4000);
  assert.equal(turned.length, 4, "4 at most");
  assert.ok(turned.every(([t]) => t.side === SELF && t.item.id === 525));
  assert.equal(trolls.filter((t) => t.side === ENEMY).length, 1);
  assert.ok(b.frame - at > 3 * 720);
});

test("without anyone listening (at home) a monk turns nobody", () => {
  const b = battle(3);
  b.add(MONK, 50, 50, SELF);
  const troll = b.add({ ...TROLL, velocity: 0 }, 53, 50, ENEMY, { condition: "passive" });
  run(b, 600);
  assert.equal(troll.side, ENEMY);
});
