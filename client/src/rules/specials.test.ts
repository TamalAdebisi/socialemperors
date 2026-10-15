import assert from "node:assert/strict";
import { test } from "node:test";

import { Battle, ENEMY, SELF, seededRandom } from "./battle.ts";
import type { ItemInfo } from "./config.ts";
import { MAP_TILES } from "./geometry.ts";
import { Specials, type SpecialsTable } from "./specials.ts";

function item(fields: Partial<ItemInfo> = {}): ItemInfo {
  return { id: 510, name: "Swordsman", isUnit: true, art: "x", width: 1, height: 1, category: 0, subcategory: 78,
    flying: false, velocity: 3, capacity: 0, activation: 0, collect: 0, collectType: "", collectXp: 0, trains: 0, population: 1,
    unitsLimit: 0, cashCost: 0, cost: 100, costType: "g", facings: 1, production: null,
    inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0, isNew: false, xp: 0, race: "h",
    life: 400, attack: 20, defense: 0, attackRange: 1, attackInterval: 35, size: 1, elevation: 1, groups: "", ...fields };
}

const PRINCESS = item({ id: 533, name: "Warrior Princess", attack: 18, life: 300 });
const VALKYRIE = item({ id: 554, name: "Valkyrie", attack: 26 });
const DRAGON = item({ id: 862, name: "Electric Bahamut Dragon", attack: 60, attackRange: 9, life: 2300, flying: true });
const DRAGGY = item({ id: 2004, name: "Draggy", attack: 10 });
const TROLL = item({ id: 525, name: "Troll", race: "t", life: 1000 });
const ITEMS = new Map([PRINCESS, VALKYRIE, DRAGON, DRAGGY, TROLL].map((i) => [i.id, i]));

const TABLE: SpecialsTable = {
  auto: [
    { ids: [533], name: "whirlwind", interval: 60, length: 60, animation: 6, moves: [{ kind: "diagonal", factor: 1 }] },
    { ids: [554], name: "healing", interval: 70, length: 70, animation: 6,
      moves: [{ kind: "heal", who: "allies", radius: 2, max: 20, amount: 0, factor: 1 }] },
  ],
  units: [{
    ids: [862], name: "Bahamut", cooldown: 25, giant: true,
    buttons: [
      { slot: 0, name: "Storm", picture: "btn_storm", animation: 7, needsTarget: true,
        move: { kind: "storm", count: 40, radius: 1, factor: 0.5, minDelay: 0, maxDelay: 30, around: "target", fx: null } },
      { slot: 1, name: "Draggies", picture: "btn_eggs", animation: 8, needsTarget: false,
        move: { kind: "spawn", minion: 2004, count: 2, maxAlive: 3, egg: true } },
      { slot: 2, name: "Shapeshift", picture: "btn_x", animation: 6, needsTarget: false, move: { kind: "other", note: "not yet" } },
    ],
    limit: { max: 2000, fill: "damage", name: "LIMIT", animation: 9, move: { kind: "smash", max: 20, factor: 2 } },
  }],
};

function setUp(seed = 1): { b: Battle; specials: Specials } {
  const b = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random: seededRandom(seed) });
  return { b, specials: new Specials(b, TABLE, ITEMS, seededRandom(seed + 1)) };
}

function run(b: Battle, specials: Specials, frames: number): void {
  for (let i = 0; i < frames; i++) {
    b.step();
    specials.step();
  }
}

test("the princess's whirlwind: after a while fighting, her beats hit the 4 diagonal tiles", () => {
  const { b, specials } = setUp();
  const princess = b.add(PRINCESS, 50, 50, SELF);
  const ahead = b.add(TROLL, 51, 50, ENEMY);
  const diagonal = b.add(TROLL, 49, 49, ENEMY);
  for (const f of [ahead, diagonal]) {
    f.condition = "passive";
  }
  b.attackWith([princess], ahead);
  run(b, specials, 59);
  assert.equal(diagonal.life, diagonal.maxLife, "plain hits on her target first");
  assert.ok(ahead.life < ahead.maxLife);
  run(b, specials, 70);
  assert.ok(diagonal.life < diagonal.maxLife, "the whirlwind reaches the diagonal");
  assert.ok(princess.special && princess.special.animation === 6);
});

test("the valkyrie heals her side around her instead of hitting, while her special lasts", () => {
  const { b, specials } = setUp();
  const valkyrie = b.add(VALKYRIE, 50, 50, SELF);
  const friend = b.add(PRINCESS, 50, 51, SELF);
  const troll = b.add(TROLL, 51, 50, ENEMY);
  friend.condition = "passive";
  troll.condition = "passive";
  friend.life = 100;
  b.attackWith([valkyrie], troll);
  run(b, specials, 160);
  assert.ok(friend.life > 100);
});

test("a button: needs an enemy, then works, then waits its cooldown (25 s) before any button", () => {
  const { b, specials } = setUp();
  const dragon = b.add(DRAGON, 50, 50, SELF);
  assert.equal(dragon.giant, undefined);
  const views = specials.buttons(dragon);
  assert.equal(dragon.giant, true, "set up on first look");
  assert.deepEqual(views.map((v) => v.name), ["Storm", "Draggies", "LIMIT"], "moves not done yet aren't shown");
  assert.equal(specials.press(dragon, 0), "No enemy in reach");
  const troll = b.add(TROLL, 54, 50, ENEMY);
  troll.condition = "passive";
  assert.equal(specials.press(dragon, 0), "");
  assert.match(specials.press(dragon, 1), /Ready in/, "one cooldown for every button");
  run(b, specials, 70);
  assert.ok(troll.life < troll.maxLife, "the storm fell round the troll");
  assert.ok(specials.buttons(dragon)[0].wait > 20);
  run(b, specials, 30 * 25);
  assert.equal(specials.buttons(dragon)[0].wait, 0);
});

test("eggs: laid towards the target, hatching on the dragon's side; 3 at most", () => {
  const { b, specials } = setUp();
  const dragon = b.add(DRAGON, 50, 50, SELF);
  const troll = b.add(TROLL, 60, 50, ENEMY);
  troll.condition = "passive";
  dragon.target = troll;
  assert.equal(specials.press(dragon, 1), "");
  run(b, specials, 30 + 60);
  const draggies = b.fighters.filter((f) => f.item.id === 2004);
  assert.equal(draggies.length, 2);
  assert.ok(draggies.every((d) => d.side === SELF && d.summoned && d.tx > 52));
  run(b, specials, 30 * 26);
  assert.equal(specials.press(dragon, 1), "");
  run(b, specials, 120);
  assert.equal(b.fighters.filter((f) => f.item.id === 2004 && !f.dead).length, 3);
});

test("the LIMIT bar fills from damage dealt, once a second, and the LIMIT empties it", () => {
  const { b, specials } = setUp();
  const dragon = b.add(DRAGON, 50, 50, SELF);
  specials.buttons(dragon);
  const troll = b.add(item({ id: 525, life: 100000 }), 51, 50, ENEMY);
  troll.condition = "passive";
  b.hurt(troll, 500, dragon);
  b.hurt(troll, 500, dragon);
  assert.ok(dragon.limit! > 400 && dragon.limit! < 600, "the second hit within the second doesn't count");
  assert.match(specials.press(dragon, 4), /isn't full/);
  dragon.limit = 2000;
  assert.equal(specials.press(dragon, 4), "");
  run(b, specials, 40);
  assert.ok(troll.life < 100000);
  assert.equal(dragon.limit, 0);
});

test("thrown: a unit lands about half the distance away and lies helpless; giants stay put", () => {
  const { b } = setUp();
  const troll = b.add(TROLL, 50, 50, ENEMY);
  b.knock(troll, { x: 48, y: 50 }, 4);
  assert.equal(troll.tx, 52);
  assert.ok(b.isStilled(troll));
  const giant = b.add(DRAGON, 40, 40, ENEMY);
  giant.giant = true;
  b.knock(giant, { x: 38, y: 40 }, 4);
  assert.equal(giant.tx, 40);
});

test("the game's own table leaves the monk to the battle: with special moves on, monks still turn units", async () => {
  const { default: table } = await import("./specials-table.json", { with: { type: "json" } });
  const b = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random: seededRandom(2) });
  let turned = 0;
  b.onConvert = () => turned++;
  const specials = new Specials(b, table as unknown as SpecialsTable, ITEMS, seededRandom(3));
  b.add(item({ id: 569, name: "Monk", subcategory: 72, life: 50, attack: 10, attackRange: 7, attackInterval: 60 }), 50, 50, SELF);
  for (let i = 0; i < 3; i++) b.add(item({ ...TROLL, life: 100, velocity: 0, attack: 0 }), 54, 48 + i, ENEMY, { condition: "passive" });
  run(b, specials, 1000);
  assert.ok(turned >= 1, `turned ${turned}`);
});
