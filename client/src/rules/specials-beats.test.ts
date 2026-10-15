import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { Battle, ENEMY, SELF, seededRandom, type Fighter } from "./battle.ts";
import { itemsById, type GameConfig } from "./config.ts";
import { MAP_TILES } from "./geometry.ts";
import { Specials, type BeatEntry, type SpecialsTable } from "./specials.ts";
import table from "./specials-table.json" with { type: "json" };

// The special units whose moves come every so many attack beats, counted
// by their own class in the original (rules/specials-table.json, "beats").
const root = new URL("../../../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("config/game_config_20120826.json", root), "utf8")) as GameConfig;
const patch = JSON.parse(readFileSync(new URL("config/patch/unit_patch.json", root), "utf8")) as { op: string; path: string; value: unknown }[];
(config.items as unknown[]).push(...patch.filter((p) => p.op === "add" && p.path === "/items/-").map((p) => p.value));
const items = itemsById(config);
const KNIGHT = 514, VILLAGER = 500, SPEARMAN = 509;
const beats = (table as unknown as SpecialsTable).beats!;

function setUp(seed = 1, custom?: SpecialsTable) {
  const b = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random: seededRandom(seed) });
  const specials = new Specials(b, custom ?? (table as unknown as SpecialsTable), items, seededRandom(seed + 1));
  const run = (frames: number) => {
    for (let i = 0; i < frames; i++) {
      b.step();
      specials.step();
    }
  };
  const add = (id: number, x: number, y: number, side: typeof SELF | typeof ENEMY, extra: Partial<Fighter> = {}) =>
    b.add(items.get(id)!, x, y, side, extra);
  return { b, specials, run, add };
}

/** A table with only this counted unit. */
function only(entry: BeatEntry): SpecialsTable {
  return { auto: [], units: [], beats: [entry] };
}

test("every unit in the table fights without fault, its moves included", () => {
  for (const entry of beats) {
    const id = entry.ids.find((i) => items.has(i));
    if (id === undefined) {
      continue;
    }
    const { b, run, add } = setUp(entry.ids[0]);
    const unit = add(id, 50, 50, SELF, { condition: "aggressive" });
    for (let i = 0; i < 6; i++) {
      add(i % 2 ? KNIGHT : SPEARMAN, 52 + i, 50 + (i % 3), ENEMY, { condition: "passive" });
    }
    assert.doesNotThrow(() => run(900), entry.name);
    assert.ok(b.fighters.length > 0, entry.name);
    assert.ok(unit.dead || unit.life <= unit.maxLife, entry.name);
  }
});

test("the Dragon Rider: four plain hits, then a sweep that throws everything within 2 tiles", () => {
  const rider = beats.find((e) => e.ids.includes(822))!;
  assert.deepEqual(rider.rules.map((r) => [r.every, r.replace]), [[5, true]]);
  const { b, specials, add } = setUp();
  const unit = add(822, 50, 50, SELF, { condition: "passive" });
  const enemy = add(KNIGHT, 51, 50, ENEMY, { condition: "passive" });
  const near = add(KNIGHT, 50, 51, ENEMY, { condition: "passive" });
  const before = { x: near.tx, y: near.ty };
  const fire = (specials as unknown as { beat: (u: Fighter, t: Fighter) => boolean }).beat.bind(specials);
  for (let i = 1; i <= 4; i++) {
    assert.equal(fire(unit, enemy), false, `beat ${i}: a plain hit`);
  }
  const life = near.life;
  assert.equal(fire(unit, enemy), true, "beat 5: the sweep instead");
  for (let i = 0; i < 60; i++) {
    b.step();
  }
  assert.ok(near.life < life, "hurt");
  assert.ok(near.tx !== before.x || near.ty !== before.y, "thrown");
  assert.equal(fire(unit, enemy), false, "then plain again");
});

test("counts: a first beat later than the rest, a count for near beats only, a sticky count, a target's kind", () => {
  const entry: BeatEntry = {
    ids: [KNIGHT], name: "test", near: 1.5, counts: "split", hits: null,
    rules: [
      { every: 5, at: 0, from: 6, counts: "near", when: "near", chance: 1, replace: true, animation: null, move: { kind: "show", fx: "a" } },
      { every: 3, at: 0, counts: "all", when: "any", chance: 1, replace: true, animation: null, if: "targetBuilding", move: { kind: "show", fx: "b" } },
    ],
  };
  const { specials, add } = setUp(1, only(entry));
  const unit = add(KNIGHT, 50, 50, SELF);
  const close = add(SPEARMAN, 51, 50, ENEMY);
  const far = add(SPEARMAN, 55, 50, ENEMY);
  const fire = (specials as unknown as { beat: (u: Fighter, t: Fighter) => boolean }).beat.bind(specials);
  const fired: number[] = [];
  for (let i = 1; i <= 16; i++) {
    if (fire(unit, i % 4 === 0 ? far : close)) {
      fired.push(i);
    }
  }
  // Near beats: 1, 2, 3, 5, 6, 7, 9...: the 6th near beat is beat 7, the 11th is beat 14. Beat 3's building rule doesn't fit a unit.
  assert.deepEqual(fired, [7, 14]);
});

test("the undead army: an enemy unit it kills may rise as a skeleton on its side, gone after 15 seconds", () => {
  const { b, run, add } = setUp(3);
  const necro = add(794, 50, 50, SELF, { condition: "passive" });
  let risen: Fighter | undefined;
  for (let i = 0; i < 30 && !risen; i++) {
    const victim = add(VILLAGER, 60 + (i % 5), 40 + Math.floor(i / 5), ENEMY, { condition: "passive" });
    b.kill(victim, necro);
    risen = b.fighters.find((f) => !f.dead && f.side === SELF && [808, 797, 818].includes(f.item.id));
  }
  assert.ok(risen, "a skeleton rose (3 chances in 10 each)");
  assert.ok(risen.summoned);
  const knight = add(KNIGHT, 70, 70, SELF, { condition: "passive" });
  const count = () => b.fighters.filter((f) => !f.dead && [808, 797, 818].includes(f.item.id)).length;
  const before = count();
  b.kill(add(VILLAGER, 72, 72, ENEMY), knight);
  assert.equal(count(), before, "only the undead raise them");
  run(451);
  assert.ok(risen.dead, "gone after 15 seconds");
});

test("plain hits that burn: the Phoenix sets its target burning, a second at a time", () => {
  const { run, add } = setUp();
  const phoenix = add(744, 50, 50, SELF, { condition: "aggressive" });
  const target = add(KNIGHT, 53, 50, ENEMY, { condition: "passive" });
  target.maxLife = target.life = 100000;
  for (let i = 0; i < 300 && !target.burn; i++) {
    run(1);
  }
  assert.ok(target.burn, "burning");
  assert.equal(target.burn!.damage, 15);
  assert.ok(phoenix.target === target);
});

test("new moves: a small unit killed outright, a big one hit instead; a web holds and hurts", () => {
  const { b, specials, run, add } = setUp();
  const unit = add(KNIGHT, 50, 50, SELF, { condition: "passive" });
  const small = add(VILLAGER, 51, 50, ENEMY, { condition: "passive" });
  specials.play(unit, { kind: "kill", maxLife: 500, push: 0, otherwise: null }, small);
  run(1);
  assert.ok(small.dead, "killed outright");
  const big = add(KNIGHT, 51, 51, ENEMY, { condition: "passive" });
  big.maxLife = big.life = 5000;
  specials.play(unit, { kind: "kill", maxLife: 500, push: 0, otherwise: { kind: "hit", factor: 1, push: 0, stun: false, fx: null } }, big);
  assert.ok(!big.dead && big.life < 5000, "hit instead");
  const caught = add(SPEARMAN, 52, 52, ENEMY, { condition: "passive" });
  const life = caught.life;
  specials.play(unit, { kind: "web", radius: 3, max: 5, around: "self", frames: 150, damage: 5, maxLife: 500 }, caught);
  assert.ok(b.isStilled(caught), "held");
  run(160);
  assert.ok(caught.life < life, "hurt each second");
  assert.ok(!big.burn, "too big for the web");
});
