import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { Battle, ENEMY, SELF, seededRandom } from "./battle.ts";
import { BossMinds, ROCKDRILLER, Rockdriller } from "./bossMinds.ts";
import { itemsById, type GameConfig } from "./config.ts";
import { MAP_TILES } from "./geometry.ts";

const root = new URL("../../../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("config/game_config_20120826.json", root), "utf8")) as GameConfig;
const items = itemsById(config);

function field(seed = 1) {
  const battle = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random: seededRandom(seed) });
  const minds = new BossMinds(battle, items);
  const boss = battle.add(items.get(566)!, 49, 49, ENEMY, { life: 25000, maxLife: 25000 });
  minds.add(boss);
  const run = (frames: number, until?: () => boolean) => {
    for (let i = 0; i < frames && !until?.(); i++) {
      battle.step();
      minds.step();
    }
  };
  return { battle, minds, boss, mind: minds.minds[0] as Rockdriller, run };
}

test("the Rockdriller stands and waits until someone comes within 3 tiles, then shoots", () => {
  const { battle, boss, mind, run } = field();
  assert.equal(boss.velocity, 0);
  assert.equal(boss.attack, ROCKDRILLER.attack);
  const far = battle.add(items.get(514)!, 49, 56, SELF, { condition: "passive", velocity: 0 });
  run(200);
  assert.ok(!mind.engaged, "7 tiles off: not yet");
  far.tx = 49; far.ty = 52;
  run(200, () => far.life < far.maxLife);
  assert.ok(mind.engaged);
  assert.equal(boss.target, far);
  assert.ok(far.life < far.maxLife, "shot");
  assert.ok(mind.slimed(49, 52), "its shot left slime");
});

test("it burrows and comes up in turns of 15 seconds; a Sanddriller comes up as it burrows; in a rage after 5 minutes", () => {
  const { battle, boss, mind, run } = field();
  const knight = battle.add(items.get(514)!, 49, 51, SELF, { condition: "passive", velocity: 0, life: 1e9, maxLife: 1e9 });
  run(100, () => mind.engaged);
  run(ROCKDRILLER.phase + 5);
  assert.ok(mind.burrowed);
  assert.equal(boss.velocity, ROCKDRILLER.burrowedSpeed);
  assert.equal(boss.target, null);
  assert.equal(mind.sanddrillers.length, 1);
  const worm = mind.sanddrillers[0].unit;
  assert.equal(worm.maxLife, 10000);
  assert.ok(worm.summoned, "pays nothing, counts for nothing");
  run(ROCKDRILLER.phase);
  assert.ok(!mind.burrowed, "up again");
  assert.equal(boss.velocity, 0);
  run(ROCKDRILLER.rage);
  assert.ok(mind.enraged && boss.enraged);
  assert.equal(boss.attack, 100);
  assert.equal(boss.interval, 5);
  assert.ok(!mind.burrowed, "up for good");
  assert.ok(knight.life < 1e9);
});

test("a Sanddriller on slime dies; the Rockdriller's fall takes its Sanddrillers", () => {
  const { battle, boss, mind, run } = field();
  battle.add(items.get(514)!, 49, 51, SELF, { condition: "passive", velocity: 0, life: 1e9, maxLife: 1e9 });
  run(100, () => mind.engaged);
  run(ROCKDRILLER.phase + 5);
  const worm = mind.sanddrillers[0].unit;
  mind.slime.set(`${worm.tx},${worm.ty}`, battle.frame + 1000);
  worm.velocity = 0;
  run(70);
  assert.ok(worm.dead, "slimed");
  run(ROCKDRILLER.phase * 2);
  const next = mind.sanddrillers.find((s) => !s.unit.dead)!.unit;
  battle.kill(boss, null);
  run(2);
  assert.ok(!battle.fighters.includes(next), "gone with it");
});

test("its target too far: back to 25,000 life, home to the middle, as if new", () => {
  const { battle, boss, mind, run } = field();
  const knight = battle.add(items.get(514)!, 49, 51, SELF, { condition: "passive", velocity: 0, life: 1e9, maxLife: 1e9 });
  run(100, () => mind.engaged);
  boss.life = 5000;
  knight.tx = 49; knight.ty = 75;
  run(70);
  assert.equal(boss.life, ROCKDRILLER.life);
  assert.ok(!mind.engaged);
});
