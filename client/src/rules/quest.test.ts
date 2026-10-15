import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { Battle, ENEMY, NEUTRAL, SELF, seededRandom } from "./battle.ts";
import { itemsById, type GameConfig } from "./config.ts";
import { MAP_TILES } from "./geometry.ts";
import islandData from "./islands.json" with { type: "json" };
import { Quest, armyOf, difficulties, islandGround, islandLock, lastTeam, teamArmy, teamChoices, teamProblem, teamSlots, type Island } from "./quest.ts";
import type { PlacedItem, SaveItem, Town } from "./town.ts";

const root = new URL("../../../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("config/game_config_20120826.json", root), "utf8")) as GameConfig;
const items = itemsById(config);
const islands = islandData.islands as unknown as Island[];

function layout(quest: number): SaveItem[] {
  return JSON.parse(readFileSync(new URL(`villages/quests/${quest}.json`, root), "utf8")).map.items;
}

function start(quest: number, difficulty: number, army: [number, number][], seed = 1, level = 10): Quest {
  const island = islands.find((i) => i.quest === quest)!;
  const random = seededRandom(seed);
  let run: Quest | null = null;
  const battle = new Battle({ ground: islandGround(island), random, onDeath: (f) => run?.killed(f) });
  run = new Quest({ island, battle, items, layout: layout(quest), level, random });
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

test("the last islands take a team of 20: each kind up to its limit, gods needed on the god islands", () => {
  const god3 = islands.find((i) => i.quest === 100000092)!;
  const hardcore7 = islands.find((i) => i.quest === 100000047)!;
  assert.ok(god3.team && hardcore7.team);
  const limited = [...items.values()].find((i) => i.isUnit && i.unitsLimit > 0)!;
  assert.deepEqual(teamChoices([[510, 30], [limited.id, limited.unitsLimit + 3]], items), [[510, 30], [limited.id, limited.unitsLimit]]);
  // The last team, kept to what's left; 20 places.
  assert.deepEqual(lastTeam([510, 510, 510, 0, 999], [[510, 2]]), [510, 510]);
  assert.equal(teamSlots([510, 510]).length, 20);
  assert.deepEqual(teamSlots([510]).slice(0, 2), [510, 0]);
  assert.deepEqual(teamArmy([510, 516, 510]), [[510, 2], [516, 1]]);
  // Nobody picked; no gods on a god island; enough gods.
  assert.match(teamProblem([], hardcore7, items)!, /Pick/);
  assert.equal(teamProblem([510], hardcore7, items), null);
  assert.match(teamProblem([510], god3, items)!, /at least 5 gods/);
  const gods = [...items.values()].filter((i) => i.isUnit && (i.groups === "god" || i.groups === "colossus")).map((i) => i.id);
  assert.ok(gods.length >= 1);
  assert.equal(teamProblem(Array(5).fill(gods[0]), god3, items), null);
});

test("Hero Isle: seven parts behind doors; a part's door opens when its last enemy dies", () => {
  const run = start(100000018, 1, [[510, 3]]);
  const fighters = run.battle.fighters;
  assert.deepEqual(run.zoneLeft, [6, 5, 4, 4, 7, 6, 6]);
  assert.ok(run.doors.every((door) => door?.item.id === 37 && door.side === NEUTRAL), "a door to each part, nobody's");
  assert.equal(run.remaining, 9 + 6 + 5 + 4 + 4 + 7 + 6 + 6, "every enemy unit, the nine outside the parts too");
  const door = run.doors[1]!;
  const tile = door.ty * MAP_TILES + door.tx;
  assert.equal(run.battle.walkGrid()[tile], 0, "shut");
  const inPart = (f: (typeof fighters)[number], [x1, y1, x2, y2]: number[]) => f.tx >= x1 && f.tx <= x2 && f.ty >= y1 && f.ty <= y2;
  const part1 = fighters.filter((f) => f.side === ENEMY && f.isUnit && inPart(f, run.island.doorZones![1]));
  for (const enemy of part1.slice(1)) {
    run.battle.kill(enemy, null);
  }
  assert.equal(door.facing, 0, "not while one is left");
  run.battle.kill(part1[0], null);
  assert.equal(door.facing, 2, "its open picture");
  assert.ok(door.open);
  assert.equal(run.battle.walkGrid()[tile], 1, "units walk through");
  assert.equal(run.doors[0]!.open, undefined);
});

test("Hero Isle: an enemy in no part counts against the first, so its door can open early", () => {
  const run = start(100000018, 2, [[510, 3]]);
  const enemies = run.battle.fighters.filter((f) => f.side === ENEMY && f.isUnit);
  // The island's 47 units first, then a copy of each, which belongs to no part.
  const outside = [...enemies.slice(0, 47).filter((f) => f.tx >= 86), ...enemies.slice(47)];
  assert.equal(outside.length, 9 + 47, "the nine outside, and the copies");
  for (const enemy of outside.slice(0, 6)) {
    run.battle.kill(enemy, null);
  }
  assert.equal(run.zoneLeft[0], 0);
  assert.ok(run.doors[0]!.open, "the first part's door opened, its Rangers alive");
  run.battle.kill(outside[6], null);
  assert.equal(run.zoneLeft[0], -1, "and never shuts again");
  assert.ok(run.doors[0]!.open);
});

test("Hero Isle: every enemy dead wins; kills pay a sixteenth", () => {
  const run = start(100000018, 1, [[510, 3]]);
  const enemies = run.battle.fighters.filter((f) => f.side === ENEMY && f.isUnit);
  for (const enemy of enemies) {
    run.battle.kill(enemy, null);
  }
  assert.equal(run.state, "won");
  assert.equal(run.endsAt, run.battle.frame + 90);
  assert.ok(run.gold >= 12000 && run.gold <= 25000);
  assert.ok(run.doors.every((door) => door!.open));
});

test("a turned enemy counts as beaten once; a turned unit of the player's as lost", () => {
  const run = start(100000018, 1, [[510, 3]]);
  const enemy = run.battle.fighters.find((f) => f.side === ENEMY && f.isUnit && f.tx >= 54 && f.ty >= 75)!;
  const [left, zone, units] = [run.remaining, run.zoneLeft[0], run.playerUnits];
  // What the battle does when a monk turns it: the quest hears, then it changes sides.
  const paid = run.converted(enemy);
  Object.assign(enemy, { side: SELF, converted: true });
  assert.ok(paid.xp >= 1);
  assert.deepEqual([run.remaining, run.zoneLeft[0], run.playerUnits], [left - 1, zone - 1, units + 1]);
  run.battle.kill(enemy, null);
  assert.deepEqual([run.remaining, run.playerUnits], [left - 1, units], "its fall later counts no more");
  assert.ok(!run.units.some(([id]) => id === enemy.item.id), "and it isn't the player's to lose");

  const mine = run.battle.fighters.find((f) => f.side === SELF && f.item.id === 510)!;
  run.converted(mine);
  Object.assign(mine, { side: ENEMY, converted: true });
  assert.deepEqual(run.units.find(([id]) => id === 510), [510, 3, 1, 0]);
  run.battle.kill(mine, null);
  assert.equal(run.remaining, left - 1, "beaten again, it isn't one of the island's");
});

test("Arctic Isle: four guard groups, a key each, the gate, the yeti's life by level and stars", () => {
  const run = start(100000002, 1, [[510, 3]], 1, 12);
  const boss = run.boss!;
  assert.ok(boss, "played here");
  assert.deepEqual(boss.groups.map((g) => [...g].map((f) => f.item.id)), [[531, 531, 531, 531], [530, 530, 530, 530], [529, 529, 529, 529], [528, 528, 528, 528]]);
  assert.deepEqual(boss.keys.map((k) => k && [k.tx, k.ty, k.side]), [[20, 40, NEUTRAL], [20, 60, NEUTRAL], [30, 80, NEUTRAL], [60, 80, NEUTRAL]]);
  assert.equal(boss.door?.side, NEUTRAL);
  assert.equal(run.remaining, 4);
  assert.deepEqual(boss.bosses.map((b) => b.maxLife), [8000], "level 10 to 14");
  const lent = run.battle.fighters.filter((f) => f.free);
  assert.deepEqual(lent.map((f) => f.item.id).sort(), [541, 541, 541, 541, 550]);
  const three = start(100000002, 3, [[510, 3]], 1, 25);
  assert.deepEqual(three.boss!.bosses.map((b) => b.maxLife), [24000, 24000], "two at 3 stars, each twice the level's");
});

test("Arctic Isle: a group beaten lights its key; a key brings penguins; the last takes the gate; the yeti's fall wins", () => {
  const run = start(100000002, 1, [[510, 3]], 1, 12);
  const boss = run.boss!;
  const gate = boss.door!;
  const gateTile = gate.ty * MAP_TILES + gate.tx;
  const goldBefore = run.gold;
  for (const guard of [...boss.groups[0]].slice(1)) run.battle.kill(guard, null);
  assert.ok(!boss.keys[0]!.collectable);
  run.battle.kill([...boss.groups[0]][0], null);
  assert.ok(boss.keys[0]!.collectable, "lit");
  assert.ok(run.gold > goldBefore, "guards pay");
  const players = run.playerUnits;
  assert.ok(run.canCollect(boss.keys[0]));
  assert.ok(run.collect(boss.keys[0]!));
  assert.equal(run.remaining, 3);
  assert.equal(run.playerUnits, players + 3, "three penguins join");
  assert.equal(run.battle.fighters.filter((f) => f.item.id === 546 && f.side === SELF).length, 3);
  assert.equal(gate.still, 1, "the gate's picture steps on");
  for (const group of boss.groups) for (const guard of [...group]) run.battle.kill(guard, null);
  for (const key of [...boss.keys]) if (key) run.collect(key);
  assert.equal(run.remaining, 0);
  assert.equal(boss.door, null);
  assert.ok(!run.battle.fighters.includes(gate), "the gate is gone");
  assert.equal(run.battle.walkGrid()[gateTile], 1);
  const gold = run.gold;
  const penguin = run.battle.fighters.find((f) => f.item.id === 546)!;
  run.battle.kill(penguin, null);
  assert.ok(!run.units.some(([id]) => id === 546), "a penguin isn't the player's to lose");
  assert.equal(run.state, "fighting");
  run.battle.kill(boss.bosses[0], null);
  assert.equal(run.state, "won");
  assert.equal(run.gold, gold + 3000, "the boss pays nothing itself; the win its bonus");
  assert.equal(run.endsAt, run.battle.frame + 150);
});

test("Desert Isle: by quarters; the last gem takes the altar and brings the golem; small golems have 100 life", () => {
  const run = start(100000003, 3, [[510, 3]], 1, 16);
  const boss = run.boss!;
  assert.deepEqual(boss.groups.map((g) => g.size), [6, 3, 3, 6]);
  assert.ok([...boss.groups[3]].filter((f) => f.item.id === 537).every((f) => f.maxLife === 100));
  assert.equal(boss.bosses.length, 0, "no golem yet");
  const tower = run.battle.fighters.find((f) => f.item.id === 29)!;
  assert.equal(tower.side, ENEMY);
  const gold = run.gold;
  run.battle.kill(tower, null);
  assert.equal(run.gold, gold, "a tower outside the groups pays nothing");
  for (const group of boss.groups) for (const guard of [...group]) run.battle.kill(guard, null);
  for (const key of [...boss.keys]) assert.ok(run.collect(key!));
  assert.equal(boss.door, null);
  assert.equal(boss.bosses.length, 2, "and a second at 3 stars");
  assert.deepEqual([boss.bosses[0].tx, boss.bosses[0].ty], [50, 49], "on the altar's tile");
  assert.deepEqual(boss.bosses.map((b) => b.maxLife), [3800, 3800], "levels 15 to 19: the original's 1900, twice");
  assert.equal(run.state, "fighting");
  for (const golem of boss.bosses) run.battle.kill(golem, null);
  assert.equal(run.state, "won");
});
