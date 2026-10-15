import assert from "node:assert/strict";
import { test } from "node:test";

import { Battle, ENEMY, SELF, seededRandom } from "./battle.ts";
import type { GameConfig, ItemInfo } from "./config.ts";
import { MAP_TILES } from "./geometry.ts";
import {
  castRank, castSpell, knownSpells, learn, learnProblem, magicOpen, manaForLevels, marked, rankOf, readMagic, readSpells, spend,
  summonSpot, type SpellInfo,
} from "./magic.ts";

function item(fields: Partial<ItemInfo> = {}): ItemInfo {
  return { id: 510, name: "Swordsman", isUnit: true, art: "x", width: 1, height: 1, category: 0, subcategory: 78,
    flying: false, velocity: 3, capacity: 0, activation: 0, collect: 0, collectType: "", collectXp: 0, trains: 0, population: 1,
    unitsLimit: 0, cashCost: 0, cost: 100, costType: "g", facings: 1, production: null,
    inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0, isNew: false, xp: 0, race: "h",
    life: 400, attack: 12, defense: 1, attackRange: 1, attackInterval: 35, size: 1, elevation: 1, groups: "", ...fields };
}

const KNIGHT = item();
const TROLL = item({ id: 525, name: "Small Troll", race: "t" });
const BIG_TROLL = item({ id: 527, name: "Big Troll", life: 600, race: "t" });
const BOSS = item({ id: 538, name: "Boss", subcategory: 84, life: 5000 });
const TOWN_HALL = item({ id: 26, name: "Town Hall", isUnit: false, subcategory: 135, width: 3, height: 3, life: 2000, attack: 0, velocity: 0 });
const HUT = item({ id: 300, name: "Hut", isUnit: false, subcategory: 111, width: 2, height: 2, life: 2000, attack: 0, velocity: 0 });
const GOLEM = item({ id: 630, name: "Summoned Golem", life: 1000, attack: 25 });
const ITEMS = new Map<number, ItemInfo>([[630, GOLEM], [631, item({ id: 631, name: "Summoned Yeti", life: 1000 })],
  ...[862, 853, 875, 891, 846].map((id): [number, ItemInfo] => [id, item({ id, name: "Bahamut", life: 2300, flying: true })])]);

const CONFIG = { items: [], magics: [
  { id: 2, name: "Fire Havoc", description: "", mana: 5, area: "[5,7,9]", level: 35, gold: 1000, cash: 35, img_name: "magic_fire", target: 2 },
  { id: 3, name: "Ultimate Hail", description: "", mana: 7, area: "[5,7,9]", level: 45, gold: 60000, cash: 55, img_name: "magic_stone", target: 2 },
  { id: 4, name: "Deadly Frostbite", description: "", mana: 5, area: "[5,7,9]", level: 43, gold: 15000, cash: 35, img_name: "magic_frozen", target: 2 },
  { id: 5, name: "Sacred Rain", description: "", mana: 3, area: "[5,7,9]", level: 36, gold: 10000, cash: 38, img_name: "magic_heal", target: 1 },
  { id: 6, name: "Golem's Wrath", description: "", mana: 15, area: "[1,1,1]", level: 40, gold: 25000, cash: 45, img_name: "magic_golem", target: 0 },
  { id: 7, name: "Hell Abyss", description: "", mana: 10, area: "[5,7,9]", level: 38, gold: 15000, cash: 40, img_name: "magic_crack", target: 2 },
  { id: 8, name: "Poisonous Flood", description: "", mana: 10, area: "[5,7,9]", level: 43, gold: 10000, cash: 30, img_name: "magic_poison", target: 2 },
  { id: 9, name: "Ether Shield", description: "", mana: 6, area: "[5,7,9]", level: 38, gold: 50000, cash: 40, img_name: "magic_shield", target: 1 },
  { id: 11, name: "Age of Colossus", description: "", mana: 8, area: "[5,7,9]", level: 40, gold: 25000, cash: 45, img_name: "magic_enlarge", target: 1 },
  { id: 12, name: "Summon Dragon", description: "", mana: 18, area: "[1,1,1]", level: 53, gold: 300000, cash: 80, img_name: "magic_dragon", target: 0 },
  { id: 14, name: "2x Speed", description: "", mana: 10, area: "[5,7,9]", level: 47, gold: 150000, cash: 60, img_name: "magic_speed_increaser", target: 0 },
  { id: 16, name: "Black Hole", description: "", mana: 16, area: "[5,7,9]", level: 49, gold: 300000, cash: 80, img_name: "magic_black_hole", target: 0 },
] } as unknown as GameConfig;
const SPELLS = readSpells(CONFIG);
const spell = (name: string): SpellInfo => SPELLS.find((s) => s.name === name)!;

function battle(seed = 3): Battle {
  return new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random: seededRandom(seed) });
}

function run(b: Battle, frames: number): void {
  for (let i = 0; i < frames; i++) {
    b.step();
  }
}

/** Units that only stand there: nobody walks off its tile while a spell lands. */
function still(b: Battle): void {
  for (const f of b.fighters) {
    f.condition = "passive";
  }
}

test("the config's spells, by level; rank from the casts, the cast itself counted", () => {
  assert.equal(SPELLS[0].name, "Fire Havoc");
  assert.deepEqual(spell("Golem's Wrath").areas, [1, 1, 1]);
  assert.equal(spell("Black Hole").mana, 16);
  assert.deepEqual([rankOf(0), rankOf(24), rankOf(25), rankOf(49), rankOf(50)], [1, 1, 2, 2, 3]);
  // The 25th cast (24 before it) is already a rank 2 one.
  assert.deepEqual([castRank(23), castRank(24), castRank(49)], [1, 2, 3]);
});

test("the marker lights the spell's side on the A x A tiles up and left of the tapped tile", () => {
  const b = battle();
  const inside = b.add(TROLL, 46, 46, ENEMY);
  const corner = b.add(TROLL, 50, 50, ENEMY);
  b.add(TROLL, 51, 50, ENEMY);       // past the corner
  b.add(KNIGHT, 48, 48, SELF);       // the wrong side
  const hut = b.add(HUT, 47, 47, ENEMY);  // 46..47 x 46..47
  assert.deepEqual(new Set(marked(b, spell("Fire Havoc"), 1, { x: 50, y: 50 })), new Set([inside, corner, hut]));
  assert.deepEqual(marked(b, spell("Golem's Wrath"), 1, { x: 50, y: 50 }), [], "a summoning lights nothing");
});

test("Fire Havoc: 30 fireballs over 3 seconds, hurting whatever they land on, the player's own too", () => {
  const b = battle();
  const trolls = [b.add(TROLL, 48, 48, ENEMY), b.add(TROLL, 49, 48, ENEMY), b.add(TROLL, 48, 49, ENEMY)];
  const knight = b.add(KNIGHT, 47, 47, SELF);
  still(b);
  castSpell(b, spell("Fire Havoc"), 1, { x: 50, y: 50 }, { items: ITEMS, random: seededRandom(5) });
  const effects = () => b.takeEvents().filter((e) => e.kind === "effect").length;
  run(b, 1);
  assert.equal(effects(), 1, "the first ball at once");
  run(b, 100);
  assert.equal(effects(), 29, "then one every 3 frames");
  const hurt = trolls.filter((t) => t.life < t.maxLife);
  assert.ok(hurt.length >= 2, "every third ball is aimed at an enemy");
  for (const t of hurt) {
    assert.equal((t.maxLife - t.life) % 1, 0);
  }
  assert.ok(knight.life <= knight.maxLife);
});

test("Ultimate Hail: enemy buildings take it all, units a tenth and are knocked down; the town hall is spared", () => {
  const b = battle();
  const hut = b.add(HUT, 48, 48, ENEMY);
  const hall = b.add(TOWN_HALL, 52, 47, ENEMY);
  const troll = b.add(TROLL, 50, 50, ENEMY);
  const knight = b.add(KNIGHT, 49, 50, SELF);
  still(b);
  castSpell(b, spell("Ultimate Hail"), 1, { x: 52, y: 52 }, { items: ITEMS, random: seededRandom(2) });
  let knockedDown = false;
  for (let i = 0; i < 130; i++) {
    b.step();
    knockedDown ||= b.isStilled(troll);
  }
  assert.ok(hut.dead, `a hut with 2000 life takes 4 boulders of about 800 (${hut.life} left)`);
  assert.equal(hall.life, hall.maxLife);
  assert.ok(knockedDown, "knocked down");
  assert.ok(troll.maxLife - troll.life >= 70 && troll.maxLife - troll.life <= 130, `a tenth of 800 (${troll.maxLife - troll.life})`);
  assert.equal(knight.life, knight.maxLife, "the player's own aren't hit");
});

test("Deadly Frostbite: enemy units can't move or fight until it wears off; bosses shrug it off", () => {
  const b = battle();
  const troll = b.add(TROLL, 48, 48, ENEMY);
  const boss = b.add(BOSS, 49, 49, ENEMY);
  const knight = b.add(KNIGHT, 47, 47, SELF);
  boss.condition = "passive";
  castSpell(b, spell("Deadly Frostbite"), 1, { x: 50, y: 50 }, { items: ITEMS, random: seededRandom(4) });
  run(b, 62);
  assert.ok(b.isFrozen(troll) && b.isStilled(troll));
  assert.ok(!b.isFrozen(boss));
  // It stays put while frozen, though an enemy is next to it.
  const at = { ...troll.at };
  run(b, 300);
  assert.deepEqual(troll.at, at);
  assert.equal(knight.life, knight.maxLife, "a frozen troll doesn't hit");
  run(b, 120);
  assert.ok(!b.isFrozen(troll), "15 seconds at rank 1");
});

test("Sacred Rain: 100 life to the player's units under it; at rank 2, 20 a second for 5 seconds", () => {
  const b = battle();
  const knight = b.add(KNIGHT, 49, 49, SELF);
  const troll = b.add(TROLL, 48, 48, ENEMY);
  still(b);
  knight.life = 100;
  troll.life = 100;
  castSpell(b, spell("Sacred Rain"), 2, { x: 50, y: 50 }, { items: ITEMS, random: seededRandom(1) });
  run(b, 61);
  assert.equal(knight.life, 200);
  run(b, 150);
  assert.equal(knight.life, 300);
  assert.equal(troll.life, 100);
});

test("Golem's Wrath: a golem of the player's with the rank's life, on the tapped tile or the nearest free one", () => {
  const b = battle();
  b.add(TROLL, 50, 50, ENEMY);
  castSpell(b, spell("Golem's Wrath"), 2, { x: 50, y: 50 }, { items: ITEMS, random: seededRandom(1) });
  run(b, 56);
  assert.equal(b.fighters.filter((f) => f.summoned).length, 0, "it comes on frame 57");
  run(b, 1);
  const golem = b.fighters.find((f) => f.summoned)!;
  assert.equal(golem.side, SELF);
  assert.equal(golem.maxLife, 5000);
  assert.equal(GOLEM.life, 1000, "the item itself is unchanged");
  assert.equal(Math.max(Math.abs(golem.tx - 50), Math.abs(golem.ty - 50)), 1, "the tapped tile is taken: the next ring");
  // No room at all within 4 rings: nothing.
  const walled = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES), random: seededRandom(1) });
  assert.equal(summonSpot(walled, { x: 50, y: 50 }), null);
});

test("Summon Dragon: at rank 1 it leaves after 30 seconds, without dying", () => {
  const b = battle();
  castSpell(b, spell("Summon Dragon"), 1, { x: 50, y: 50 }, { items: ITEMS, random: seededRandom(1) });
  run(b, 57);
  const dragon = b.fighters.find((f) => f.summoned)!;
  assert.equal(dragon.maxLife, 4000);
  run(b, 900 + 15);
  assert.ok(!b.fighters.includes(dragon));
  const events = b.takeEvents();
  assert.ok(events.some((e) => e.kind === "gone" && e.fighter === dragon));
  assert.ok(!events.some((e) => e.kind === "died" && e.fighter === dragon));
});

test("Hell Abyss: swallows the enemies in the middle; bosses, town halls and strong units stay", () => {
  const b = battle();
  const deaths: string[] = [];
  const swallowed = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random: seededRandom(1),
    onDeath: (f, by) => deaths.push(`${f.item.name} ${by === null ? "by the spell" : "by someone"}`) });
  void b;
  const troll = swallowed.add(TROLL, 48, 48, ENEMY);
  const big = swallowed.add(BIG_TROLL, 47, 48, ENEMY);
  const boss = swallowed.add(BOSS, 48, 47, ENEMY);
  const hut = swallowed.add(HUT, 49, 49, ENEMY);
  const knight = swallowed.add(KNIGHT, 48, 49, SELF);
  const far = swallowed.add(TROLL, 40, 40, ENEMY);
  still(swallowed);
  castSpell(swallowed, spell("Hell Abyss"), 1, { x: 50, y: 50 }, { items: ITEMS });
  run(swallowed, 28);
  assert.ok(!troll.dead && troll.sinkingSince !== undefined, "sinking from frame 28");
  run(swallowed, 15);
  assert.ok(troll.dead && hut.dead);
  assert.ok(!big.dead && !boss.dead && !knight.dead && !far.dead);
  assert.ok(deaths.includes("Small Troll by the spell"));
});

test("Poisonous Flood: enemy units are hurt every 3 seconds for 5 bites at rank 1", () => {
  const b = battle();
  const troll = b.add(TROLL, 48, 48, ENEMY);
  still(b);
  castSpell(b, spell("Poisonous Flood"), 1, { x: 50, y: 50 }, { items: ITEMS });
  run(b, 27);
  assert.ok(troll.poison);
  run(b, 89);
  assert.equal(troll.life, troll.maxLife);
  run(b, 1);
  assert.ok(troll.life < troll.maxLife, "the first bite 90 frames after");
  run(b, 90 * 5);
  const bites = b.takeEvents().filter((e) => e.kind === "hit" && e.fighter === troll).length;
  assert.equal(bites, 5);
  assert.ok(!troll.poison);
});

test("Ether Shield: hits on anyone inside are cut to 70% at rank 1, for 20 seconds", () => {
  const b = battle(9);
  const knight = b.add(item({ life: 1000000, defense: 0 }), 48, 48, SELF);
  castSpell(b, spell("Ether Shield"), 1, { x: 50, y: 50 }, { items: ITEMS });
  const average = () => {
    let total = 0;
    for (let i = 0; i < 400; i++) {
      b.hurt(knight, 100, null);
    }
    for (const e of b.takeEvents()) {
      total += e.kind === "hit" ? e.amount : 0;
    }
    return total / 400;
  };
  const shielded = average();
  assert.ok(shielded > 66 && shielded < 82, `about 70 of 100 (with the criticals): ${shielded}`);
  run(b, 600);
  const bare = average();
  assert.ok(bare > 100 && bare < 110, `back to 100 or so: ${bare}`);
});

test("Age of Colossus: the player's units hit half again as hard for 30 seconds", () => {
  const b = battle();
  const knight = b.add(item({ attack: 100 }), 48, 48, SELF);
  castSpell(b, spell("Age of Colossus"), 1, { x: 50, y: 50 }, { items: ITEMS });
  run(b, 20);
  assert.ok(b.isEnlarged(knight));
  const dummy = b.add(item({ life: 1000000, defense: 0 }), 20, 20, ENEMY);
  b.takeEvents();
  for (let i = 0; i < 300; i++) {
    b.hurt(dummy, knight.attack, knight);
  }
  const hits = b.takeEvents().filter((e) => e.kind === "hit").map((e) => (e.kind === "hit" ? e.amount : 0));
  const average = hits.reduce((a, n) => a + n, 0) / hits.length;
  assert.ok(average > 150 && average < 170, `about 150 and the criticals: ${average}`);
  run(b, 900);
  assert.ok(!b.isEnlarged(knight));
});

test("2x Speed: doubled for 15 seconds; cast again, the time starts over without doubling twice", () => {
  const b = battle();
  const knight = b.add(item({ velocity: 3 }), 48, 48, SELF);
  castSpell(b, spell("2x Speed"), 1, { x: 50, y: 50 }, { items: ITEMS });
  run(b, 20);
  assert.equal(knight.velocity, 6);
  run(b, 400);
  castSpell(b, spell("2x Speed"), 1, { x: 50, y: 50 }, { items: ITEMS });
  run(b, 20);
  assert.equal(knight.velocity, 6);
  run(b, 100);
  assert.equal(knight.velocity, 6, "the first cast's end doesn't undo the second");
  run(b, 400);
  assert.equal(knight.velocity, 3);
});

test("Black Hole: swallows once a second, so enemies walking in later go too", () => {
  const b = battle();
  const first = b.add(TROLL, 48, 48, ENEMY);
  still(b);
  castSpell(b, spell("Black Hole"), 1, { x: 50, y: 50 }, { items: ITEMS });
  run(b, 55 + 15);
  assert.ok(first.dead);
  const later = b.add(TROLL, 47, 48, ENEMY);
  later.condition = "passive";
  run(b, 45);
  assert.ok(later.dead);
  // Done after 16 swallows.
  run(b, 30 * 16);
  const last = b.add(TROLL, 48, 48, ENEMY);
  last.condition = "passive";
  run(b, 100);
  assert.ok(!last.dead);
});

test("learning: gold from the spell's level, cash at any level; it gives the spell's mana once", () => {
  const fire = spell("Fire Havoc");
  const state = { mana: 0, casts: {} as Record<string, number> };
  const rich = { gold: 100000, cash: 100 };
  assert.match(learnProblem(fire, state, 30, rich, false), /from level 35/);
  assert.equal(learnProblem(fire, state, 30, rich, true), "");
  assert.match(learnProblem(fire, state, 40, { gold: 10, cash: 0 }, false), /Not enough gold/);
  assert.equal(learnProblem(fire, state, 40, rich, false), "");
  learn(fire, state);
  assert.deepEqual(state, { mana: 5, casts: { 2: 0 } });
  assert.match(learnProblem(fire, state, 40, rich, false), /already known/);
  assert.deepEqual(knownSpells(SPELLS, state).map((s) => s.name), ["Fire Havoc"]);
  assert.equal(spend(fire, state), 1);
  assert.deepEqual(state, { mana: 0, casts: { 2: 1 } });
  state.casts[2] = 24;
  assert.equal(spend(fire, state), 2, "the 25th cast");
  assert.ok(magicOpen("t", 1) && !magicOpen("h", 34) && magicOpen("h", 35));
  assert.deepEqual(readMagic({ mana: "12", magics: { 3: 4 } }), { mana: 12, casts: { 3: 4 } });
  assert.deepEqual(readMagic({ magics: [] }), { mana: 0, casts: {} });
});

test("one mana record per save read: the Academy and a fight share it; levels from 36 bring 2 mana each", () => {
  const save = { mana: 10, magics: { 2: 3 } };
  const a = readMagic(save);
  const b = readMagic(save);
  a.mana -= 4;
  assert.equal(b.mana, 6, "the same record");
  assert.equal(manaForLevels(34, 37, 36, 2), 4, "36 and 37");
  assert.equal(manaForLevels(40, 41, 36, 2), 2);
  assert.equal(manaForLevels(10, 20, 36, 2), 0);
});
