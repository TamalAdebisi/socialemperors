import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { Battle, ENEMY, SELF, seededRandom } from "./battle.ts";
import { itemsById, type GameConfig } from "./config.ts";
import { ALL_STAY, DefencePlan, FOCUS_SIEGE, HALF_OUT, RANGED_VERSUS_SIEGE, planOf } from "./defencePlans.ts";
import { MAP_TILES } from "./geometry.ts";

const root = new URL("../../../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("config/game_config_20120826.json", root), "utf8")) as GameConfig;
const items = itemsById(config);
const SWORDSMAN = 507, ARCHER = 516, RAM = 519;

function field() {
  const b = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random: seededRandom(1) });
  const add = (id: number, x: number, y: number, side: typeof SELF | typeof ENEMY) => b.add(items.get(id)!, x, y, side);
  const run = (frames: number, plan: DefencePlan) => {
    for (let i = 0; i < frames; i++) {
      b.step();
      plan.step();
    }
  };
  return { b, add, run };
}

test("a plan the client doesn't know plays as half go out", () => {
  assert.deepEqual([planOf(8), planOf("9"), planOf(undefined), planOf(3)], [ALL_STAY, RANGED_VERSUS_SIEGE, HALF_OUT, HALF_OUT]);
});

test("all stay: every defender defensive; half go out: aggressive, and as many as came sent at the first to hit", () => {
  const { b, add } = field();
  const defenders = [add(SWORDSMAN, 50, 50, ENEMY), add(SWORDSMAN, 51, 50, ENEMY), add(SWORDSMAN, 80, 80, ENEMY)];
  new DefencePlan(b, ENEMY, ALL_STAY, 1);
  assert.ok(defenders.every((d) => d.condition === "defensive"));
  const second = field();
  const near = [second.add(SWORDSMAN, 50, 50, ENEMY), second.add(SWORDSMAN, 52, 50, ENEMY), second.add(SWORDSMAN, 90, 90, ENEMY)];
  const plan = new DefencePlan(second.b, ENEMY, HALF_OUT, 2);
  assert.ok(near.every((d) => d.condition === "aggressive"));
  const attacker = second.add(SWORDSMAN, 40, 40, SELF);
  second.b.hurt(near[0], 5, attacker);
  assert.deepEqual(near.map((d) => d.target === attacker), [true, true, false], "the two nearest of three");
  second.b.kill(attacker, null);
  second.run(15, plan);
  assert.ok(near.slice(0, 2).every((d) => d.condition === "defensive"), "then home");
});

test("archers against siege engines; all go for the siege engines", () => {
  const { b, add, run } = field();
  const archer = add(ARCHER, 50, 50, ENEMY);
  const swordsman = add(SWORDSMAN, 51, 50, ENEMY);
  const hit = add(SWORDSMAN, 70, 70, ENEMY);
  const plan = new DefencePlan(b, ENEMY, RANGED_VERSUS_SIEGE, 3);
  const ram = add(RAM, 30, 30, SELF);
  b.hurt(hit, 5, ram);
  assert.equal(archer.target, ram, "the archer is sent");
  assert.notEqual(swordsman.target, ram, "not a swordsman");
  run(1, plan);
  const second = field();
  const hunters = [second.add(SWORDSMAN, 50, 50, ENEMY), second.add(SWORDSMAN, 52, 52, ENEMY)];
  const focus = new DefencePlan(second.b, ENEMY, FOCUS_SIEGE, 1);
  const engine = second.add(RAM, 20, 20, SELF);
  second.run(15, focus);
  assert.ok(hunters.every((h) => h.target === engine), "they hunt it down");
  assert.ok(items.get(RAM)!.subcategory === 81);
});
