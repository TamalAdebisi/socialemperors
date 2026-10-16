import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { itemsById, type GameConfig } from "./config.ts";
import {
  ATTACKS_PERIOD, EAGLE, SPYINGS_PERIOD, attackerShare, attacksLeft, burnOnReturn, defenderTenth, eagleLife, eaglesOf, honour, isTarget,
  killWorth, placeOf, recover, report, spyingsLeft, startPoints, type Row,
} from "./pvp.ts";
import type { Town } from "./town.ts";

const root = new URL("../../../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("config/game_config_20120826.json", root), "utf8")) as GameConfig;
const items = itemsById(config);
const item = (id: number) => items.get(id)!;
const TOWN_HALL = 26, SWORDSMAN = 507, TOWER = 29, HOUSE = 1, VILLAGER = 500, TROLL = 509, TREE = 70, SHIP = 542, REFUGE = 151;
const NOW = 1_700_000_000;

test("attacks left: 3 in the 6 hours up to the last, all back together; an Odin Statue gives one more", () => {
  assert.deepEqual(attacksLeft([], NOW, false), { left: 3, wait: 0 });
  const two = [{ time: NOW - 5000 }, { time: NOW - 100 }];
  assert.equal(attacksLeft(two, NOW, false).left, 1);
  const three = [...two, { time: NOW - 50 }];
  assert.deepEqual(attacksLeft(three, NOW, false), { left: 0, wait: ATTACKS_PERIOD - 50 });
  assert.equal(attacksLeft(three, NOW, true).left, 1, "the statue");
  assert.equal(attacksLeft(three, NOW + ATTACKS_PERIOD, false).left, 3, "6 hours after the last, all three");
  assert.equal(attacksLeft(three, NOW, false, NOW - 200).left, 1, "those before a reset don't count");
});

test("16 start points, one on each border block; the top-left first", () => {
  const points = startPoints();
  assert.equal(points.length, 16);
  assert.deepEqual(points[0].tile, { x: 10, y: 10 });
  assert.ok(points.some((p) => p.tile.x === 90 && p.tile.y === 50));
  assert.ok(!points.some((p) => p.tile.x === 50 && p.tile.y === 50), "not the middle");
});

test("the defender's town: who fights, who's nobody's, what's cleared away; what counts as a target", () => {
  assert.equal(placeOf(item(TOWN_HALL), 55, 55, "h"), "enemy");
  assert.equal(placeOf(item(TOWER), 5, 5, "h"), "cleared", "a building on a border block");
  assert.equal(placeOf(item(TREE), 5, 5, "h"), "neutral", "trees stay, nobody's");
  assert.equal(placeOf(item(SWORDSMAN), 50, 50, "h"), "enemy");
  assert.equal(placeOf(item(SWORDSMAN), 50, 50, "t"), "cleared", "a unit of the other race");
  assert.equal(placeOf(item(SHIP), 50, 50, "h"), "cleared", "the attacker's ship");
  assert.equal(placeOf(item(REFUGE), 50, 50, "h"), "neutral");
  assert.ok(isTarget(item(TOWN_HALL), 55, 55, "h"));
  assert.ok(isTarget(item(TOWER), 45, 45, "h"));
  assert.ok(!isTarget(item(HOUSE), 45, 45, "h"));
  assert.ok(isTarget(item(SWORDSMAN), 45, 45, "h"));
  assert.ok(!isTarget(item(VILLAGER), 45, 45, "h"));
  assert.ok(item(TROLL));
});

test("what each kill pays; the defender's tenth", () => {
  assert.deepEqual(killWorth(item(TOWN_HALL), 12), { gold: 1200, xp: 60 });
  assert.deepEqual(killWorth(item(SWORDSMAN), 12), { gold: 75, xp: 4 });  // 150 gold: half, a twentieth rounded up
  assert.deepEqual(killWorth(item(HOUSE), 12), { gold: 0, xp: 1 });
  assert.equal(defenderTenth(item(SWORDSMAN)), 8);
  assert.equal(defenderTenth(item(VILLAGER)), 0);
});

test("honour, who comes home, and the report", () => {
  const victim: Row[] = [[TOWN_HALL, 1, 1, 0]];
  assert.equal(honour([], victim, items), 10);
  assert.equal(honour([[SWORDSMAN, 5, 5, 0]], [[TOWN_HALL, 1, 0, 0]], items), 1, "at least 1");
  assert.deepEqual([attackerShare(9), attackerShare(10), attackerShare(15), attackerShare(16)], [95, 75, 75, 50]);
  const back = recover([[SWORDSMAN, 10, 4, 0], [KNIGHT, 2, 2, 0]], 50, () => 0);
  assert.equal(back.reduce((s, r) => s + r[3], 0), 3, "half of 6 come home");
  const won = report({ attacker: { name: "A", level: 7, user_id: "1", world_id: 0, map: 0, race: "h" }, victim: { user_id: "2" },
    gold: 0, xp: 3, attackerRows: back, victimRows: victim, won: true, seconds: 61.4, voluntary: false, townHallGold: 700,
    defenderGold: 16, noTownHall: false, items });
  // Its six fallen outweigh one town hall: the least honour, 1.
  assert.deepEqual([won.resources, won.resources_victim, won.win, won.duration, won.honor], [{ g: 25, x: 3 }, { g: 0 }, 1, 61, 1]);
  const empty = report({ ...{ attacker: won.attacker, victim: {}, gold: 500, xp: 9, attackerRows: [], victimRows: [] }, won: true,
    seconds: 1, voluntary: false, townHallGold: 0, defenderGold: 0, noTownHall: true, items });
  assert.deepEqual([empty.resources, empty.honor], [{ g: 0, x: 0 }, 0], "no town hall: nothing");
});

const KNIGHT = 514;

test("home to an attack: the town hall and the first five buildings half burnt, not walls or decorations", () => {
  const WALL = 34, FLAG = 154;
  const placed = (id: number): { item: ReturnType<typeof item>; health?: number } => ({ item: item(id) });
  const things = [placed(WALL), placed(FLAG), placed(SWORDSMAN), ...[1, 1, 1, 1, 1, 1].map(placed), placed(TOWN_HALL)];
  const town = { race: "h", items: things } as unknown as Town;
  const burnt = burnOnReturn(town);
  assert.equal(burnt.length, 6, "the town hall and five houses");
  assert.equal(things.at(-1)!.health, Math.floor(item(TOWN_HALL).life / 2));
  assert.equal(things.filter((p) => p.item.id === HOUSE && "health" in p).length, 5);
  assert.ok([WALL, FLAG, SWORDSMAN].every((id) => !("health" in things.find((p) => p.item.id === id)!)));
});

test("spying: an Eagles building built, its eagle's life by level, 3 visits a day", () => {
  const eagles = { item: item(186), tx: 40, ty: 40, orientation: 0 };
  const town = { race: "h", items: [{ item: item(1), tx: 50, ty: 50, orientation: 0 }, eagles] } as unknown as Town;
  assert.equal(eaglesOf(town, () => true), eagles);
  assert.equal(eaglesOf(town, () => false), null, "still being built");
  assert.deepEqual([185, 186, 187, 217, 349].map((id) => eagleLife(item(id), item(EAGLE))), [200, 400, 800, 10000, item(EAGLE).life]);
  const three = [{ time: NOW - 3000 }, { time: NOW - 2000 }, { time: NOW - 1000 }];
  assert.deepEqual(spyingsLeft(three, NOW), { left: 0, wait: SPYINGS_PERIOD - 1000 });
  assert.equal(spyingsLeft(three.slice(1), NOW).left, 1);
  assert.equal(spyingsLeft(three, NOW + SPYINGS_PERIOD).left, 3, "a day after the last, all three");
});
