import assert from "node:assert/strict";
import { test } from "node:test";

import type { ItemInfo } from "./config.ts";
import { Doings, completeGoal, goalsRun, openGoals, payGoal, progress, readGoals, type Need } from "./goals.ts";
import type { PlacedItem, Town } from "./town.ts";
import data from "./goals.json" with { type: "json" };

function item(fields: Partial<ItemInfo> = {}): ItemInfo {
  return { id: 10, name: "Farm Land", isUnit: false, art: "x", width: 3, height: 3, category: 1, subcategory: 122,
    flying: false, velocity: 0, capacity: 1, activation: 0, collect: 0, collectType: "", collectXp: 0, trains: 0, population: 0, unitsLimit: 0, cashCost: 0,
    cost: 30, costType: "w", facings: 1, production: null,
    inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0, isNew: false, xp: 0, race: "h",
    life: 0, attack: 0, defense: 1, attackRange: 0, attackInterval: 0, size: 1, elevation: 1, groups: "", ...fields };
}
const FARM = item({});
const MILL = item({ id: 5, name: "Mill I", subcategory: 121 });
const VILLAGER = item({ id: 500, name: "Villager I", isUnit: true, subcategory: 71 });
const ITEMS = new Map([FARM, MILL, VILLAGER].map((i) => [i.id, i]));

function placed(what: ItemInfo, tx: number, ty: number, more: Partial<PlacedItem> = {}): PlacedItem {
  return { item: what, tx, ty, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0, ...more };
}

function town(items: PlacedItem[] = []): Town {
  return { id: 0, name: "", townName: "", level: 1, xp: 0, cash: 5, gold: 0, wood: 0, food: 0, stone: 0,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items, unknown: [] };
}

const MISSIONS = [
  { id: 2, title: "Train villager", reward: 10 }, { id: 1, title: "Build farm land", reward: 5 },
  { id: 3, title: "Send villager to farm land", reward: 10 }, { id: 5, title: "Cut trees and get wood", reward: 10 },
  { id: 1, title: "Unknown-Mock_id1", reward: 0 },  // the server's stand-in, after the real one
];
const GOALS = readGoals(MISSIONS, data.goals as unknown as Record<string, Need>);

test("the goals file says what the first goals ask, by their number; the first title for a number counts", () => {
  assert.equal(GOALS.get(1)?.title, "Build farm land");
  assert.deepEqual(GOALS.get(1)?.need, ["build-kind", 122, 1]);
  assert.deepEqual(GOALS.get(2)?.need, ["have-kind", 71, 2]);
  assert.deepEqual(GOALS.get(3)?.need, ["inside-kind", 122, 71, 1]);
});

test("the open goals: the first ones not both done and paid", () => {
  assert.deepEqual(openGoals(GOALS, new Set(), new Set()).map((g) => g.id), [1, 2, 3, 5]);
  assert.deepEqual(openGoals(GOALS, new Set([1, 2]), new Set([1])).map((g) => g.id), [2, 3, 5], "2 is done but not paid yet");
});

test("goals that count the town: built, units, units inside", () => {
  const doings = new Doings();
  const empty = town();
  assert.deepEqual(progress(empty, GOALS.get(1)!, doings, 0, ITEMS), { done: 0, of: 1 });
  const t = town([placed(FARM, 45, 45, { unitsInside: 1, units: [500] }), placed(VILLAGER, 40, 40)]);
  assert.deepEqual(progress(t, GOALS.get(1)!, doings, 0, ITEMS), { done: 1, of: 1 });
  assert.deepEqual(progress(t, GOALS.get(2)!, doings, 0, ITEMS), { done: 2, of: 2 }, "the one inside counts too");
  assert.deepEqual(progress(t, GOALS.get(3)!, doings, 0, ITEMS), { done: 1, of: 1 });
});

test("goals that count doings since the page opened: collecting", () => {
  const doings = new Doings();
  const tree = item({ id: 19, subcategory: 125 });
  doings.collected(tree);
  doings.collected(tree);
  assert.deepEqual(progress(town(), GOALS.get(5)!, doings, 0, ITEMS), { done: 2, of: 3 });
  doings.workTime(MILL, 60);
  assert.deepEqual(progress(town(), { id: 99, title: "", description: "", reward: 8, need: ["work-time-kind", 121, 480] }, doings, 0, ITEMS), { done: 0, of: 1 });
  doings.workTime(MILL, 480);
  assert.deepEqual(progress(town(), { id: 99, title: "", description: "", reward: 8, need: ["work-time-kind", 121, 480] }, doings, 0, ITEMS), { done: 1, of: 1 });
});

test("battles and the like are for the classic game", () => {
  assert.equal(progress(town(), { id: 79, title: "", description: "", reward: 1, need: ["classic"] }, new Doings(), 0, ITEMS), null);
});

test("done and paid, as the Flash client tells the server", () => {
  const t = town();
  assert.deepEqual(completeGoal(GOALS.get(1)!, false), { cmd: "complete_mission", args: [1, 0] });
  assert.deepEqual(completeGoal(GOALS.get(1)!, true).args, [1, 1]);
  assert.deepEqual(payGoal(t, GOALS.get(1)!), { cmd: "reward_mission", args: [0, 1] });
  assert.equal(t.gold, 5);
});

test("goals run only in a human town below level 35", () => {
  const at = (level: number, race = "h") => ({ level, race }) as Town;
  assert.equal(goalsRun(at(34)), true);
  assert.equal(goalsRun(at(35)), false, "the spells box instead");
  assert.equal(goalsRun(at(5, "t")), false, "not in a troll town");
});

test("goal 44 names the host, and counts a visit to one of Arthur's towns; goal 102 the buildings helped", () => {
  const goals = readGoals([{ id: 44, title: "Visit #0#!", description: "Click on the portrait of #0#", reward: 10 }], data.goals as unknown as Record<string, Need>);
  const visit = goals.get(44)!;
  assert.equal(visit.title, "Visit Arthur!");
  assert.equal(visit.description, "Click on the portrait of Arthur");
  const doings = new Doings();
  const t = { items: [], race: "h", level: 3 } as unknown as Town;
  assert.deepEqual(progress(t, visit, doings, 0, new Map()), { done: 0, of: 1 });
  doings.lastVisited = "100000031";
  assert.deepEqual(progress(t, visit, doings, 0, new Map()), { done: 1, of: 1 });
  const help = readGoals([{ id: 102, title: "Help a friend", reward: 10 }], data.goals as unknown as Record<string, Need>).get(102)!;
  doings.helpedBuildings = 3;
  assert.deepEqual(progress(t, help, doings, 0, new Map()), { done: 3, of: 5 });
});

test("island goals: by the stars the save keeps; the map seen, and from the menus", () => {
  const goals = readGoals([82, 166, 81, 85].map((id) => ({ id, title: `Goal ${id}` })), data.goals as unknown as Record<string, Need>);
  const doings = new Doings();
  const t = town();
  assert.deepEqual(progress(t, goals.get(82)!, doings, 0, ITEMS), { done: 0, of: 1 });
  doings.questStars = { 100000006: 1, 100000007: 2 };
  assert.deepEqual(progress(t, goals.get(82)!, doings, 0, ITEMS), { done: 1, of: 1 }, "Mysterious Isle on 1 star");
  assert.deepEqual(progress(t, goals.get(166)!, doings, 0, ITEMS), { done: 2, of: 3 }, "Unknown Isle: 2 of 3 stars");
  assert.deepEqual(progress(t, goals.get(81)!, doings, 0, ITEMS), { done: 0, of: 1 });
  doings.islandsOpened = true;
  assert.deepEqual(progress(t, goals.get(81)!, doings, 0, ITEMS), { done: 1, of: 1 });
  assert.deepEqual(progress(t, goals.get(85)!, doings, 0, ITEMS), { done: 0, of: 1 }, "not from a harbour's button");
});
