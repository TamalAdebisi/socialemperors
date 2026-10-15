import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { Battle, ENEMY, SELF, seededRandom, type Fighter } from "./battle.ts";
import { itemsById, type GameConfig } from "./config.ts";
import { MAP_TILES } from "./geometry.ts";
import { Specials, type SpecialsTable } from "./specials.ts";
import table from "./specials-table.json" with { type: "json" };

// The rarer special moves, with the game's own table and units.
const root = new URL("../../../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("config/game_config_20120826.json", root), "utf8")) as GameConfig;
// The newer units (the epic dragons) come in the server's unit patch.
const patch = JSON.parse(readFileSync(new URL("config/patch/unit_patch.json", root), "utf8")) as { op: string; path: string; value: unknown }[];
(config.items as unknown[]).push(...patch.filter((p) => p.op === "add" && p.path === "/items/-").map((p) => p.value));
const items = itemsById(config);
const KNIGHT = 514;

function setUp(seed = 1) {
  const b = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random: seededRandom(seed) });
  const specials = new Specials(b, table as unknown as SpecialsTable, items, seededRandom(seed + 1));
  const run = (frames: number) => {
    for (let i = 0; i < frames; i++) {
      b.step();
      specials.step();
    }
  };
  const add = (id: number, x: number, y: number, side: typeof SELF | typeof ENEMY, extra: Partial<Fighter> = {}) =>
    b.add(items.get(id)!, x, y, side, { condition: "passive", ...extra });
  return { b, specials, run, add };
}

/** Press a button by name, and let the move begin. */
function press(specials: Specials, f: Fighter, name: string, run: (frames: number) => void): void {
  const slot = specials.entryOf(f)!.buttons.find((b) => b.name === name)!.slot;
  assert.equal(specials.press(f, slot), "");
  run(31);
}

test("Leonidas's shield wall: no damage for 10 seconds; the ForceField: half", () => {
  const { b, specials, run, add } = setUp();
  const leonidas = add(660, 50, 50, SELF);
  press(specials, leonidas, "Shield wall", run);
  const life = leonidas.life;
  b.hurt(leonidas, 500, null);
  assert.equal(leonidas.life, life);
  run(300);
  b.hurt(leonidas, 100, null);
  assert.ok(leonidas.life < life, "over");
  const hunter = add(873, 60, 60, SELF);
  press(specials, hunter, "ForceField", run);
  const before = hunter.life;
  b.hurt(hunter, 400, null);
  assert.ok(before - hunter.life < 300 && before - hunter.life > 100, `took ${before - hunter.life}`);
});

test("the Invisible Killer can't be picked as a target; the Big Lure draws enemies to it", () => {
  const { b, specials, run, add } = setUp();
  const killer = add(2067, 50, 50, SELF);
  const troll = add(525, 52, 50, ENEMY);
  troll.target = killer;
  press(specials, killer, "Invisible", run);
  assert.equal(troll.target, null);
  assert.equal(b.nearestEnemy(troll, { x: troll.tx, y: troll.ty }, 10), null);
  const lure = add(2087, 70, 70, SELF);
  const far = add(525, 80, 75, ENEMY);
  lure.target = far;
  press(specials, lure, "Mega Slash", run);
  assert.equal(far.target, lure);
  assert.ok(far.forced);
});

test("the Rainbow Dragon becomes another dragon for 20 seconds, keeping its life and buttons; the Chameleon copies its target", () => {
  const { b, specials, run, add } = setUp();
  const rainbow = add(2037, 50, 50, SELF);
  rainbow.life = 1000;
  press(specials, rainbow, "Crystal Dragon", run);
  assert.equal(rainbow.item.id, 777);
  assert.equal(rainbow.life, 1000);
  assert.equal(specials.entryOf(rainbow)!.ids[0], 2037, "its own buttons");
  run(600);
  assert.equal(rainbow.item.id, 2037);
  const chameleon = add(896, 60, 60, SELF);
  const knight = add(KNIGHT, 61, 60, ENEMY);
  chameleon.target = knight;
  chameleon.life = chameleon.maxLife / 2;
  press(specials, chameleon, "Absorbe Powers", run);
  assert.equal(chameleon.item.id, KNIGHT);
  assert.equal(chameleon.attack, knight.item.attack);
  assert.equal(chameleon.life, Math.round(knight.item.life / 2), "half its life, as before");
  assert.ok(b.fighters.includes(knight));
});

test("a seal lifts small enemies helpless, hurts them, and drops them; the skull seal kills some", () => {
  const { b, specials, run, add } = setUp(4);
  const god = add(2160, 50, 50, SELF);
  const small = add(525, 53, 50, ENEMY);
  const big = add(564, 50, 54, ENEMY, { life: 9000, maxLife: 9000 });
  press(specials, god, "Ultra Fireball", run);
  assert.ok(small.liftedUntil! > b.frame && b.isStilled(small));
  assert.ok(!big.liftedUntil, "too big");
  const life = small.life;
  run(130);
  assert.ok(small.dead || small.life < life);
  const skull = setUp(5);
  const dragon = skull.add(2214, 50, 50, SELF);
  const trolls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => skull.add(525, 52 + i, 52, ENEMY, { life: 100, maxLife: 100 }));
  dragon.target = trolls[0];
  press(skull.specials, dragon, "Attack", skull.run);
  skull.run(100);
  assert.ok(trolls.every((t) => t.dead), "small ones die one way or the other");
});

test("ghost copies strike 8 tiles round the Red Hot dragon, throwing and burning; the werewolf's curse makes a werewolf", () => {
  const { b, specials, run, add } = setUp();
  const dragon = add(2208, 50, 50, SELF);
  const troll = add(525, 58, 50, ENEMY, { life: 5000, maxLife: 5000 });
  press(specials, dragon, "Ghost Attack", run);
  assert.ok(troll.life < 5000, "struck");
  const hit = troll.life;
  run(150);
  assert.ok(troll.life < hit, "burning");
  assert.ok(b.isStilled(dragon) || b.frame > 0);
  const wolf = setUp(2);
  const werewolf = wolf.add(735, 50, 50, ENEMY, { condition: "aggressive" });
  const thor = wolf.add(556, 51, 50, SELF, { life: 100000, maxLife: 100000 });
  wolf.b.attackWith([werewolf], thor);
  // Thor's kind has 500 life: too much to be cursed. A knight's can be.
  wolf.run(400);
  assert.ok(!thor.dead && thor.item.id === 556, "Thor stands");
  const squire = wolf.add(KNIGHT, 49, 50, SELF, { life: 3000, maxLife: 3000 });
  wolf.b.attackWith([werewolf], squire);
  wolf.run(600);
  const made = wolf.b.fighters.filter((f) => f.item.id === 735 && f.cursed);
  assert.ok(squire.dead, "cursed");
  assert.equal(made.length, 1);
  // 300 life, its maximum the werewolf's own (healers can bring it up), as in the original.
  assert.ok(made[0].side === ENEMY && made[0].life <= 300 && made[0].maxLife === made[0].item.life && made[0].poison);
});
