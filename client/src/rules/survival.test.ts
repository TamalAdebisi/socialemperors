import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { Battle, ENEMY, FPS, SELF, seededRandom } from "./battle.ts";
import { itemsById, type GameConfig } from "./config.ts";
import { MAP_TILES } from "./geometry.ts";
import { Survival, livesLeft, prizeOf, survivalArmy, survivalMap, type SurvivalNews } from "./survival.ts";

const root = new URL("../../../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("config/game_config_20120826.json", root), "utf8")) as GameConfig;
const items = itemsById(config);
const NOW = 1_700_000_000;
const RELIC = 1253;

test("lives: 3, each back 3 hours after its use, bought ones on top; none listed at all, only the bought", () => {
  assert.deepEqual(livesLeft([], 0, NOW, 3), { left: 3, next: 0 });
  assert.deepEqual(livesLeft([NOW - 100], 0, NOW, 3), { left: 2, next: 3 * 3600 - 100 });
  assert.deepEqual(livesLeft([NOW - 100, NOW - 50, NOW - 4 * 3600], 1, NOW, 3), { left: 2, next: 3 * 3600 - 100 });
  assert.equal(livesLeft(undefined, 2, NOW, 3).left, 2);
});

test("the prize: the best passed of the arena's, none before the first", () => {
  const egypt = survivalMap(100000035)!;
  assert.deepEqual([prizeOf(egypt, 300), prizeOf(egypt, 301), prizeOf(egypt, 8 * 60), prizeOf(egypt, 3600)], [null, 619, 577, 629]);
  assert.equal(survivalMap(100000037)!.available, false, "coming soon");
});

test("the army: the 30 strongest of the town", () => {
  const SWORDSMAN = 507, KNIGHT = 514, ARCHER = 516;
  const army = survivalArmy([[SWORDSMAN, 25], [KNIGHT, 20], [ARCHER, 3]], items);
  assert.equal(army.reduce((n, [, c]) => n + c, 0), 30);
  assert.equal(army[0][0], [SWORDSMAN, KNIGHT, ARCHER].sort((a, b) => items.get(b)!.attack - items.get(a)!.attack)[0]);
});

test("the waves: four of eight from one point, then the boss, two waves from all eight points while it lives, then on", () => {
  const battle = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random: seededRandom(3) });
  const relic = battle.add(items.get(RELIC)!, 50, 49, SELF);
  relic.invulnerable = true;
  const news: SurvivalNews[] = [];
  const survival = new Survival({ map: survivalMap(100000035)!, battle, relic, items, random: seededRandom(4), news: (n) => news.push(n) });
  const run = (seconds: number) => {
    for (let i = 0; i < seconds * FPS; i++) {
      battle.step();
      survival.step();
    }
  };
  survival.start();
  assert.equal(survival.enemies, 8);
  assert.deepEqual(news[0], { kind: "wave", number: 1 });
  run(20.5);
  assert.equal(survival.enemies, 16, "the second 20 seconds later");
  run(40);
  assert.equal(survival.enemies, 32, "four waves");
  run(20);
  const bosses = [...survival.bosses];
  assert.equal(bosses.length, 1);
  assert.equal(bosses[0].item.id, 669);
  assert.ok(bosses[0].steadfast && bosses[0].noConvert);
  assert.deepEqual(news.at(-1), { kind: "boss", number: 1 });
  run(5);
  assert.equal(survival.enemies, 33 + 40, "five from each of the eight points");
  run(20);
  assert.equal(survival.enemies, 33 + 80, "and again");
  run(40);
  assert.equal(survival.enemies, 113, "no more while the boss lives");
  assert.ok(battle.fighters.filter((f) => f.side === ENEMY && !f.dead).every((f) => f.target === relic), "all at the relic");
  battle.kill(bosses[0], null);
  survival.killedOne(bosses[0]);
  run(5.5);
  assert.equal(survival.enemies, 112 + 8, "the next wave 5 seconds after the boss");
  assert.deepEqual(news.at(-1), { kind: "wave", number: 5 });
  assert.ok(survival.seconds >= 150);
});
