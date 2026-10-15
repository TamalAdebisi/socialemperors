import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { Battle, ENEMY, NEUTRAL, SELF, seededRandom } from "./battle.ts";
import { itemsById, type GameConfig } from "./config.ts";
import { MAP_TILES } from "./geometry.ts";
import islandData from "./islands.json" with { type: "json" };
import { Quest, armyOf, difficulties, islandGround, islandLock, type Island } from "./quest.ts";
import type { PlacedItem, SaveItem, Town } from "./town.ts";

const root = new URL("../../../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("config/game_config_20120826.json", root), "utf8")) as GameConfig;
const items = itemsById(config);
const islands = islandData.islands as unknown as Island[];

function layout(quest: number): SaveItem[] {
  return JSON.parse(readFileSync(new URL(`villages/quests/${quest}.json`, root), "utf8")).map.items;
}

function start(quest: number, difficulty: number, army: [number, number][], seed = 1): Quest {
  const island = islands.find((i) => i.quest === quest)!;
  const random = seededRandom(seed);
  let run: Quest | null = null;
  const battle = new Battle({ ground: islandGround(island), random, onDeath: (f) => run?.killed(f) });
  run = new Quest({ island, battle, items, layout: layout(quest), random });
  run.begin(difficulty, army);
  return run;
}

test("there are 28 islands, in the game's order, each with its 25 blocks", () => {
  assert.equal(islands.length, 28);
  assert.deepEqual(islands.map((i) => String(i.quest)), (config.globals as { ISLE_ORDER: string[] }).ISLE_ORDER.map(String));
  for (const island of islands) {
    assert.equal(island.shape.length, 25);
  }
});

test("the army: every unit but villagers, farm animals, settlers and carts", () => {
  const unit = (id: number): PlacedItem => ({ item: items.get(id)!, tx: 50, ty: 50, orientation: 0, unitsInside: 0, startedAt: null, workTime: 0 });
  const town = { race: "h", items: [unit(510), unit(510), unit(500), unit(516), items.get(29) && { ...unit(29) }].filter(Boolean) } as unknown as Town;
  assert.deepEqual(armyOf(town), [[510, 2], [516, 1]]);
});

test("the island's sea blocks can't be walked", () => {
  const island = islands[0];
  const ground = islandGround(island);
  // Mysterious Isle: the blocks in the middle are land, the corners sea.
  assert.equal(ground[0], 0);
  assert.equal(ground[50 * MAP_TILES + 50], 1);
});

test("Mysterious Isle: trolls are enemies, scenery nobody's, the High Elf the player's, the army lands", () => {
  const run = start(100000006, 1, [[510, 3]]);
  const fighters = run.battle.fighters;
  const elf = fighters.find((f) => f.item.id === 557)!;
  assert.equal(elf.side, SELF);
  assert.ok(elf.free);
  assert.equal(fighters.find((f) => f.item.id === 900)!.side, NEUTRAL);  // a palm tree
  assert.equal(fighters.find((f) => f.item.id === 34)!.side, ENEMY);     // a wall
  assert.equal(run.chest?.item.id, 82);
  assert.equal(run.remaining, 5, "five trolls to beat");
  assert.equal(run.playerUnits, 4, "three swordsmen and the elf");
  const swordsmen = fighters.filter((f) => f.item.id === 510);
  assert.equal(swordsmen.length, 3);
  for (const s of swordsmen) {
    assert.ok(Math.abs(s.tx - 72) <= 1 && Math.abs(s.ty - 40) <= 1, "landed by (72, 40)");
  }
});

test("two stars: a copy of every enemy unit; three: two", () => {
  assert.equal(start(100000006, 2, [[510, 1]]).remaining, 10);
  assert.equal(start(100000006, 3, [[510, 1]]).remaining, 15);
  assert.deepEqual(difficulties(0), { allowed: [1], chosen: 1 });
  assert.deepEqual(difficulties(2), { allowed: [1, 2, 3], chosen: 2 });
});

test("killing every troll lights the chest; collecting it wins, with the bonus", () => {
  const run = start(100000006, 1, [[510, 3]]);
  for (const troll of run.battle.fighters.filter((f) => f.side === ENEMY && f.isUnit)) {
    run.battle.kill(troll, null);
  }
  assert.equal(run.remaining, 0);
  assert.equal(run.state, "fighting");
  assert.ok(run.chest!.collectable);
  const gold = run.gold;
  assert.ok(run.collect(run.chest!));
  assert.equal(run.state, "won");
  assert.equal(run.gold, gold + 1500);
  // The results come 7 seconds later.
  for (let i = 0; i < 7 * 30; i++) {
    run.battle.step();
  }
  assert.ok(run.isOver());
  run.settle();
  const report = run.report(0, 95);
  assert.equal(report.win, 1);
  assert.equal(report.quest_id, 100000006);
  assert.deepEqual(report.units, [[510, 3, 0, 0], [557, 0, 0, 1]]);
});

test("a kill pays half a gold fighter's price, else 5, and a twentieth in experience", () => {
  const run = start(100000006, 1, [[510, 1]]);
  const troll = run.battle.fighters.find((f) => f.item.id === 527)!;  // Big Troll
  const before = run.gold;
  const paid = run.killed(troll);
  assert.equal(paid.gold, Math.floor(troll.item.cost / 2) || 5);
  assert.equal(run.gold - before, paid.gold);
  assert.equal(paid.xp, Math.ceil(paid.gold * 0.05));
  const wall = run.battle.fighters.find((f) => f.item.id === 34)!;
  assert.deepEqual(run.killed(wall), { gold: 5, xp: 1 }, "walls: 5 gold, and 1 experience (a twentieth, rounded up)");
});

test("the army all fallen is a loss; 60% of the fallen come home, rounded up", () => {
  const run = start(100000006, 1, [[510, 10]], 9);
  for (const f of run.battle.fighters.filter((f) => f.side === SELF)) {
    run.battle.kill(f, null);
  }
  assert.equal(run.state, "lost");
  run.settle();
  const [row] = run.units;
  assert.deepEqual(row.slice(0, 3), [510, 10, 10]);
  assert.equal(row[3], 6);
  assert.deepEqual(run.lost(), [[510, 4]]);
  assert.equal(run.report(0, 10).win, 0);
});

test("leaving is a loss, at once", () => {
  const run = start(100000006, 1, [[510, 1]]);
  run.leave();
  assert.equal(run.state, "lost");
  assert.ok(run.isOver());
  assert.equal(run.report(0, 1).voluntary_end, 1);
});

test("islands open one after another, rest 4 hours after each attack, some from a level", () => {
  assert.deepEqual(islandLock(islands[0], 0, 0, 6, undefined, 1000), { open: true });
  assert.equal(islandLock(islands[1], 1, 0, 6, undefined, 1000).open, false);
  const resting = islandLock(islands[0], 0, 0, 6, 1000, 1000 + 3600);
  assert.equal(resting.open, false);
  assert.equal(resting.until, 1000 + 4 * 3600);
  const late = islands.find((i) => i.quest === 100000046)!;
  assert.equal(islandLock(late, 23, 30, 39, undefined, 0).why, "From level 40");
  const god = islands.find((i) => i.quest === 100000090)!;
  assert.equal(islandLock(god, 25, 0, 50, undefined, 0).open, true, "god islands are always open");
});

test("Wild Isle lends its kamikazes and fire cannons; Emergent Isle its houses and walls", () => {
  const wild = start(100000020, 1, [[510, 1]]);
  assert.equal(wild.battle.fighters.filter((f) => f.item.id === 575 && f.side === SELF).length, 40);
  const emergent = start(100000012, 1, [[510, 1]]);
  assert.ok(emergent.battle.fighters.filter((f) => [3, 4, 36].includes(f.item.id)).every((f) => f.side === SELF));
});
